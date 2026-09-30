import { randomBytes } from 'node:crypto';
import { defineSecret } from 'firebase-functions/params';
import { getApps, initializeApp } from 'firebase-admin/app';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) initializeApp();
const db = getFirestore();

// Segredos do backend. Nunca use VITE_ para estes valores.
export const MP_CLIENT_ID = defineSecret('MP_CLIENT_ID');
export const MP_CLIENT_SECRET = defineSecret('MP_CLIENT_SECRET');
export const MP_OAUTH_REDIRECT_URI = defineSecret('MP_OAUTH_REDIRECT_URI');
export const VITRIO_APP_URL = defineSecret('VITRIO_APP_URL');
export const MP_WEBHOOK_SECRET = defineSecret('MP_WEBHOOK_SECRET');

async function assertMerchant(uid: string) {
  const user = await db.doc(`users/${uid}`).get();
  if (!user.exists || user.data()?.active !== true || user.data()?.role !== 'merchant' || !user.data()?.storeId) {
    throw new HttpsError('permission-denied', 'Acesso restrito ao lojista.');
  }
  return String(user.data()!.storeId);
}

/**
 * Retorna a URL oficial para o lojista autorizar o Vitrio a operar a conta
 * Mercado Pago dele. O state e de uso unico para evitar CSRF.
 */
export const getMercadoPagoConnectUrl = onCall({
  region: 'us-central1',
  secrets: [MP_CLIENT_ID, MP_OAUTH_REDIRECT_URI],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login.');
  const storeId = await assertMerchant(request.auth.uid);
  const state = randomBytes(32).toString('hex');
  await db.doc(`mercadoPagoOauthStates/${state}`).set({
    uid: request.auth.uid,
    storeId,
    createdAt: FieldValue.serverTimestamp(),
    used: false,
  });

  const qs = new URLSearchParams({
    client_id: MP_CLIENT_ID.value(),
    response_type: 'code',
    platform_id: 'mp',
    state,
    redirect_uri: MP_OAUTH_REDIRECT_URI.value(),
  });
  return { url: `https://auth.mercadopago.com/authorization?${qs.toString()}` };
});

/**
 * Callback configurado na aplicacao Mercado Pago. Troca o authorization_code
 * por access/refresh tokens do LOJISTA e os guarda em colecao privada.
 */
export const mercadoPagoOauthCallback = onRequest({
  region: 'us-central1',
  secrets: [MP_CLIENT_ID, MP_CLIENT_SECRET, MP_OAUTH_REDIRECT_URI, VITRIO_APP_URL],
}, async (req, res) => {
  const code = String(req.query.code || '');
  const state = String(req.query.state || '');
  if (!code || !state) { res.status(400).send('Autorizacao invalida.'); return; }

  const stateRef = db.doc(`mercadoPagoOauthStates/${state}`);
  try {
    await db.runTransaction(async tx => {
      const stateSnap = await tx.get(stateRef);
      if (!stateSnap.exists || stateSnap.data()?.used === true) throw new Error('STATE_INVALID');
      const createdAt = stateSnap.data()?.createdAt?.toMillis?.() || 0;
      if (!createdAt || Date.now() - createdAt > 10 * 60 * 1000) throw new Error('STATE_EXPIRED');
      tx.update(stateRef, { used: true, usedAt: FieldValue.serverTimestamp() });
    });

    const stateSnap = await stateRef.get();
    const storeId = String(stateSnap.data()?.storeId || '');
    if (!storeId) throw new Error('STORE_NOT_FOUND');

    const response = await fetch('https://api.mercadopago.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: MP_CLIENT_ID.value(),
        client_secret: MP_CLIENT_SECRET.value(),
        grant_type: 'authorization_code',
        code,
        redirect_uri: MP_OAUTH_REDIRECT_URI.value(),
      }),
    });
    const token: any = await response.json();
    if (!response.ok || !token.access_token) throw new Error(`MP_OAUTH_${response.status}`);

    // Tokens nunca ficam no documento publico da loja.
    await db.doc(`storePaymentSecrets/${storeId}`).set({
      provider: 'mercadopago',
      accessToken: token.access_token,
      refreshToken: token.refresh_token || null,
      mercadoPagoUserId: String(token.user_id || ''),
      expiresIn: Number(token.expires_in || 0),
      expiresAt: Date.now() + Number(token.expires_in || 0) * 1000,
      publicKey: String(token.public_key || ''),
      scope: String(token.scope || ''),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.doc(`stores/${storeId}`).set({
      paymentProvider: 'mercadopago',
      paymentProviderConnected: true,
      mercadoPagoUserId: String(token.user_id || ''),
      mercadoPagoPublicKey: String(token.public_key || ''),
      paymentProviderConnectedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const app = VITRIO_APP_URL.value().replace(/\/$/, '');
    res.redirect(`${app}/painel/pagamentos?mp=connected`);
  } catch (e) {
    console.error('Mercado Pago OAuth callback:', e);
    const app = VITRIO_APP_URL.value().replace(/\/$/, '');
    res.redirect(`${app}/painel/pagamentos?mp=error`);
  }
});



/**
 * Desconecta a conta Mercado Pago da loja.
 * Remove somente a autorização da integração.
 * Pedidos, pagamentos e histórico financeiro são preservados.
 */
export const disconnectMercadoPago = onCall({
  region: 'us-central1',
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Faça login.');
  }

  const storeId = await assertMerchant(request.auth.uid);

  const storeRef = db.doc(`stores/${storeId}`);
  const secretRef = db.doc(`storePaymentSecrets/${storeId}`);

  await db.runTransaction(async (tx) => {
    const storeSnap = await tx.get(storeRef);

    if (!storeSnap.exists) {
      throw new HttpsError('not-found', 'Loja não encontrada.');
    }

    const store = storeSnap.data() || {};
    const checkoutMode = String(store.checkoutMode || 'whatsapp');

    // Remove as credenciais privadas da integração.
    tx.delete(secretRef);

    // Mantém a vitrine funcional caso ela dependesse exclusivamente
    // do pagamento integrado.
    tx.set(storeRef, {
      paymentProvider: '',
      paymentProviderConnected: false,
      mercadoPagoUserId: '',
      mercadoPagoPublicKey: '',
      paymentProviderDisconnectedAt: FieldValue.serverTimestamp(),

      ...(checkoutMode === 'online' || checkoutMode === 'both'
        ? { checkoutMode: 'whatsapp' }
        : {}),

      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  return {
    ok: true,
    checkoutMode: 'whatsapp',
  };
});
