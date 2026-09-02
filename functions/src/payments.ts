import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, getFirestore, DocumentReference } from 'firebase-admin/firestore';
import { MP_CLIENT_ID, MP_CLIENT_SECRET, MP_WEBHOOK_SECRET } from './mercadoPago';

const db = getFirestore();

type SellerSecret = {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: number;
  publicKey?: string;
};

async function getSellerSecret(storeId: string): Promise<SellerSecret> {
  const ref = db.doc(`storePaymentSecrets/${storeId}`);
  const snap = await ref.get();
  if (!snap.exists || !snap.data()?.accessToken) {
    throw new HttpsError('failed-precondition', 'A loja ainda não conectou uma conta Mercado Pago.');
  }

  const data = snap.data() as any;
  const expiresAt = Number(data.expiresAt || 0);
  if (!expiresAt || expiresAt - Date.now() > 24 * 60 * 60 * 1000) {
    return data as SellerSecret;
  }
  if (!data.refreshToken) throw new HttpsError('failed-precondition', 'A conexão Mercado Pago expirou. Reconecte a conta.');

  const response = await fetch('https://api.mercadopago.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: MP_CLIENT_ID.value(),
      client_secret: MP_CLIENT_SECRET.value(),
      grant_type: 'refresh_token',
      refresh_token: data.refreshToken,
    }),
  });
  const token: any = await response.json();
  if (!response.ok || !token.access_token) throw new HttpsError('unavailable', 'Não foi possível renovar a conexão Mercado Pago.');

  const next = {
    accessToken: token.access_token,
    refreshToken: token.refresh_token || data.refreshToken,
    expiresIn: Number(token.expires_in || 0),
    expiresAt: Date.now() + Number(token.expires_in || 0) * 1000,
    publicKey: String(token.public_key || data.publicKey || ''),
    mercadoPagoUserId: String(token.user_id || data.mercadoPagoUserId || ''),
    scope: String(token.scope || data.scope || ''),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(next, { merge: true });
  if (next.publicKey) await db.doc(`stores/${storeId}`).set({ mercadoPagoPublicKey: next.publicKey }, { merge: true });
  return next;
}

function getPaymentSummary(mpOrder: any) {
  const payments = mpOrder?.transactions?.payments || mpOrder?.transaction?.payments || [];
  const payment = Array.isArray(payments) ? payments[0] : payments;
  const status = String(payment?.status || mpOrder?.status || '').toLowerCase();
  const detail = String(payment?.status_detail || mpOrder?.status_detail || '').toLowerCase();
  return { payment, status, detail };
}

function mapPaymentState(mpOrder: any): 'paid'|'pending'|'failed'|'refunded' {
  const { status, detail } = getPaymentSummary(mpOrder);
  if (detail.includes('refunded') || status.includes('refunded')) return 'refunded';
  if (detail === 'accredited' || status === 'approved' || status === 'processed' || status === 'accredited') return 'paid';
  if (['rejected','cancelled','canceled','failed'].some(v => status.includes(v) || detail.includes(v))) return 'failed';
  return 'pending';
}

async function releaseStock(orderRef: DocumentReference, order: any) {
  if (order.stockReleasedAt) return;
  await db.runTransaction(async tx => {
    const fresh = await tx.get(orderRef);
    if (!fresh.exists || fresh.data()?.stockReleasedAt) return;
    const data = fresh.data()!;
    for (const item of data.items || []) {
      const pRef = db.doc(`products/${item.productId}`);
      const p = await tx.get(pRef);
      if (p.exists) tx.update(pRef, { stock: Number(p.data()?.stock || 0) + Number(item.quantity || 0), updatedAt: FieldValue.serverTimestamp() });
    }
    tx.update(orderRef, { stockReleasedAt: FieldValue.serverTimestamp(), status: 'cancelled', updatedAt: FieldValue.serverTimestamp() });
  });
}

async function applyPaidOrder(orderRef: DocumentReference, order: any, mpOrder: any) {
  await db.runTransaction(async tx => {
    const fresh = await tx.get(orderRef);
    if (!fresh.exists) return;
    const data = fresh.data()!;
    if (data.paymentAppliedAt) return;

    tx.update(orderRef, {
      paymentStatus: 'paid',
      status: data.status === 'pending_payment' ? 'paid' : data.status,
      paymentAppliedAt: FieldValue.serverTimestamp(),
      paidAt: FieldValue.serverTimestamp(),
      mercadoPagoStatus: String(mpOrder?.status || ''),
      mercadoPagoStatusDetail: String(mpOrder?.status_detail || ''),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (!data.customerSpentAppliedAt) {
      const customerId = `${data.storeId}_${String(data.customerPhone || '').replace(/\D/g,'')}`.slice(0,180);
      const customerRef = db.doc(`customers/${customerId}`);
      const customer = await tx.get(customerRef);
      if (customer.exists) {
        tx.update(customerRef, { totalSpent: Number((Number(customer.data()?.totalSpent || 0) + Number(data.total || 0)).toFixed(2)), updatedAt: FieldValue.serverTimestamp() });
      }
      tx.update(orderRef, { customerSpentAppliedAt: FieldValue.serverTimestamp() });
    }

    const paymentRef = db.doc(`payments/${orderRef.id}`);
    tx.set(paymentRef, {
      storeId: data.storeId,
      orderId: orderRef.id,
      provider: 'mercadopago',
      providerOrderId: data.mercadoPagoOrderId || mpOrder?.id || '',
      amount: Number(data.total || 0),
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  // Se houver caixa aberto, lança a venda automaticamente uma única vez.
  const latest = (await orderRef.get()).data();
  if (!latest?.cashMovementAppliedAt) {
    const open = await db.collection('cashRegisters')
      .where('storeId', '==', latest?.storeId)
      .where('status', '==', 'open')
      .limit(1).get();

    if (!open.empty) {
      const movementRef = db.doc(`cashMovements/mp_${orderRef.id}`);
      await db.runTransaction(async tx => {
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists || orderSnap.data()?.cashMovementAppliedAt) return;
        tx.set(movementRef, {
          storeId: latest!.storeId,
          cashRegisterId: open.docs[0].id,
          type: 'income',
          amount: Number(latest!.total || 0),
          description: `Venda online #${orderRef.id.slice(0,6).toUpperCase()}`,
          source: 'mercadopago',
          orderId: orderRef.id,
          createdBy: 'system',
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.update(orderRef, { cashMovementAppliedAt: FieldValue.serverTimestamp() });
      });
    }
  }
}

export const createMercadoPagoPayment = onCall({
  region: 'us-central1',
  secrets: [MP_CLIENT_ID, MP_CLIENT_SECRET],
}, async (request) => {
  const data = request.data || {};
  const orderId = String(data.orderId || '');
  const payerEmail = String(data.payerEmail || '').trim().toLowerCase();
  const kind = data.kind === 'card' ? 'card' : 'pix';
  if (!orderId || !payerEmail || !payerEmail.includes('@')) throw new HttpsError('invalid-argument', 'Informe um e-mail válido.');

  const orderRef = db.doc(`orders/${orderId}`);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new HttpsError('not-found', 'Pedido não encontrado.');
  const order = orderSnap.data()!;
  if (order.paymentStatus === 'paid') return { orderId, status: 'paid' };
  if (order.status === 'cancelled') throw new HttpsError('failed-precondition', 'Este pedido foi cancelado.');

  const storeSnap = await db.doc(`stores/${order.storeId}`).get();
  if (!storeSnap.exists || storeSnap.data()?.active !== true || storeSnap.data()?.paymentProviderConnected !== true) {
    throw new HttpsError('failed-precondition', 'Pagamento online indisponível nesta loja.');
  }

  if ((kind === 'pix' && order.paymentMethod !== 'Pix') || (kind === 'card' && order.paymentMethod !== 'Cartão')) {
    throw new HttpsError('failed-precondition', 'Forma de pagamento diferente da escolhida no pedido.');
  }

  // Não cria duas cobranças para o mesmo pedido.
  if (order.mercadoPagoOrderId) {
    return {
      orderId,
      mercadoPagoOrderId: order.mercadoPagoOrderId,
      status: order.paymentStatus || 'pending',
      pix: order.pix || null,
    };
  }

  const seller = await getSellerSecret(String(order.storeId));
  const amount = Number(order.total || 0).toFixed(2);
  const body: any = {
    type: 'online',
    processing_mode: 'automatic',
    external_reference: orderId,
    total_amount: amount,
    payer: { email: payerEmail },
    transactions: { payments: [] },
  };

  if (kind === 'pix') {
    body.transactions.payments.push({
      amount,
      payment_method: { id: 'pix', type: 'bank_transfer' },
      expiration_time: 'PT30M',
    });
  } else {
    const token = String(data.card?.token || '');
    const paymentMethodId = String(data.card?.paymentMethodId || data.card?.payment_method_id || '');
    const installments = Math.max(1, Math.floor(Number(data.card?.installments || 1)));
    if (!token || !paymentMethodId) throw new HttpsError('invalid-argument', 'Dados do cartão incompletos.');
    body.transactions.payments.push({
      amount,
      payment_method: {
        id: paymentMethodId,
        type: 'credit_card',
        token,
        installments,
      },
    });
  }

  const idempotencyKey = randomUUID();
  const response = await fetch('https://api.mercadopago.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${seller.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  });
  const mpOrder: any = await response.json();
  if (!response.ok || !mpOrder?.id) {
    console.error('Mercado Pago create order error', response.status, mpOrder);
    throw new HttpsError('failed-precondition', 'O Mercado Pago não conseguiu processar o pagamento.');
  }

  const summary = getPaymentSummary(mpOrder);
  const pix = kind === 'pix' ? {
    qrCode: String(summary.payment?.payment_method?.qr_code || ''),
    qrCodeBase64: String(summary.payment?.payment_method?.qr_code_base64 || ''),
    ticketUrl: String(summary.payment?.payment_method?.ticket_url || ''),
  } : null;
  const mapped = mapPaymentState(mpOrder);

  await orderRef.update({
    customerEmail: payerEmail,
    mercadoPagoOrderId: String(mpOrder.id),
    mercadoPagoStatus: String(mpOrder.status || ''),
    mercadoPagoStatusDetail: String(mpOrder.status_detail || ''),
    paymentStatus: mapped,
    pix,
    paymentCreatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  if (mapped === 'paid') await applyPaidOrder(orderRef, { ...order, customerEmail: payerEmail }, mpOrder);
  if (mapped === 'failed') await releaseStock(orderRef, order);

  return {
    orderId,
    mercadoPagoOrderId: String(mpOrder.id),
    status: mapped,
    statusDetail: String(mpOrder.status_detail || ''),
    pix,
  };
});

function verifyWebhook(req: any) {
  const xSignature = String(req.header('x-signature') || '');
  const requestId = String(req.header('x-request-id') || '');
  const dataId = String(req.query?.['data.id'] || req.query?.data_id || req.body?.data?.id || '');
  if (!xSignature || !dataId) return false;
  const parts = Object.fromEntries(xSignature.split(',').map((part: string) => part.trim().split('=')));
  const ts = String(parts.ts || '');
  const v1 = String(parts.v1 || '');
  if (!ts || !v1) return false;
  const id = dataId.toLowerCase();
  const manifest = `id:${id};${requestId ? `request-id:${requestId};` : ''}ts:${ts};`;
  const expected = createHmac('sha256', MP_WEBHOOK_SECRET.value()).update(manifest).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(v1, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export const mercadoPagoWebhook = onRequest({
  region: 'us-central1',
  secrets: [MP_WEBHOOK_SECRET, MP_CLIENT_ID, MP_CLIENT_SECRET],
}, async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method not allowed'); return; }
  if (!verifyWebhook(req)) { res.status(401).send('Invalid signature'); return; }

  const mpOrderId = String(req.query?.['data.id'] || req.query?.data_id || req.body?.data?.id || '');
  if (!mpOrderId) { res.status(200).send('ok'); return; }

  try {
    const found = await db.collection('orders').where('mercadoPagoOrderId', '==', mpOrderId).limit(1).get();
    if (found.empty) { res.status(200).send('ok'); return; }

    const orderRef = found.docs[0].ref;
    const order = found.docs[0].data();
    const seller = await getSellerSecret(String(order.storeId));
    const response = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(mpOrderId)}`, {
      headers: { Authorization: `Bearer ${seller.accessToken}`, Accept: 'application/json' },
    });
    const mpOrder: any = await response.json();
    if (!response.ok) { console.error('MP webhook lookup error', response.status, mpOrder); res.status(200).send('ok'); return; }

    const mapped = mapPaymentState(mpOrder);
    await orderRef.set({
      mercadoPagoStatus: String(mpOrder.status || ''),
      mercadoPagoStatusDetail: String(mpOrder.status_detail || ''),
      paymentStatus: mapped,
      lastPaymentWebhookAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    if (mapped === 'paid') await applyPaidOrder(orderRef, order, mpOrder);
    if (mapped === 'failed') await releaseStock(orderRef, order);
    if (mapped === 'refunded') await orderRef.set({ paymentStatus: 'refunded', updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    res.status(200).send('ok');
  } catch (error) {
    console.error('Mercado Pago webhook error', error);
    // MP fará novas tentativas quando houver falha transitória.
    res.status(500).send('retry');
  }
});


export const cleanupAbandonedOrders = onSchedule({
  region: 'us-central1',
  schedule: 'every 60 minutes',
  timeZone: 'America/Fortaleza',
}, async () => {
  const pending = await db.collection('orders').where('status', '==', 'pending_payment').limit(100).get();
  const cutoff = Date.now() - 45 * 60 * 1000;
  for (const doc of pending.docs) {
    const data = doc.data();
    const created = data.createdAt?.toMillis?.() || 0;
    if (!created || created > cutoff || data.paymentStatus === 'paid') continue;
    // Só libera reserva abandonada que nem chegou a gerar cobrança ou cuja cobrança falhou.
    if (!data.mercadoPagoOrderId || data.paymentStatus === 'failed') {
      await releaseStock(doc.ref, data);
    }
  }
});
