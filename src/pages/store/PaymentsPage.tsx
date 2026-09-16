import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import QRCode from 'qrcode';
import {
  CreditCard,
  QrCode,
  ShieldCheck,
  WalletCards,
  MessageCircle,
  Copy,
  Link2,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { buildPixPayload } from '../../lib/pix';

type StoreSettings = {
  id?: string;
  name?: string;
  checkoutMode?: 'whatsapp' | 'online' | 'both';
  paymentProviderConnected?: boolean;
  mercadoPagoUserId?: string;
};

type Billing = {
  pixKey?: string;
  pixName?: string;
  pixCity?: string;
  billingWhatsapp?: string;
  monthlyPrice?: number;
};

export function PaymentsPage() {
  const { profile } = useAuth();

  const [store, setStore] = useState<StoreSettings | null>(null);
  const [billing, setBilling] = useState<Billing>({});
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [message, setMessage] = useState('');
  const [qr, setQr] = useState('');
  const [tab, setTab] = useState<'sales' | 'subscription'>('sales');

  async function loadStore() {
    if (!profile?.storeId) return;

    const s = await getDoc(doc(db, 'stores', profile.storeId));

    setStore(
      s.exists()
        ? ({ id: s.id, ...s.data() } as StoreSettings)
        : null
    );
  }

  useEffect(() => {
    let active = true;

    const withTimeout = <T,>(promise: Promise<T>, ms = 10000) =>
      Promise.race<T>([
        promise,
        new Promise<T>((_, reject) =>
          window.setTimeout(
            () => reject(new Error('Tempo limite excedido ao carregar os dados.')),
            ms
          )
        ),
      ]);

    (async () => {
      if (!profile?.storeId) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      setMessage('');

      try {
        await withTimeout(loadStore());

        try {
          const b = await withTimeout(
            getDoc(doc(db, 'platformSettings', 'billing'))
          );

          if (active) {
            setBilling(b.exists() ? (b.data() as Billing) : {});
          }
        } catch (billingError) {
          console.warn('Falha ao carregar configuração de cobrança:', billingError);

          if (active) {
            setBilling({
              billingWhatsapp: '88888499692',
            });
          }
        }

        const params = new URLSearchParams(window.location.search);
        const mp = params.get('mp');

        if (mp === 'connected') {
          if (active) {
            setMessage(
              'Mercado Pago conectado com sucesso. Sua loja já pode receber pagamentos integrados.'
            );
          }

          await withTimeout(loadStore());

          params.delete('mp');
          const query = params.toString();

          window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`
          );
        }

        if (mp === 'error') {
          if (active) {
            setMessage(
              'Não foi possível concluir a conexão com o Mercado Pago. Tente novamente.'
            );
          }

          params.delete('mp');
          const query = params.toString();

          window.history.replaceState(
            {},
            '',
            `${window.location.pathname}${query ? `?${query}` : ''}`
          );
        }
      } catch (e: any) {
        console.error('Erro ao carregar Pagamentos:', e);

        if (active) {
          setMessage(
            String(
              e?.message || 'Não foi possível carregar os dados da loja.'
            ).replace('FirebaseError: ', '')
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [profile?.storeId]);

  const amount = useMemo(
    () => Number(billing.monthlyPrice || 0),
    [billing.monthlyPrice]
  );

  const payload = useMemo(
    () =>
      billing.pixKey && amount > 0
        ? buildPixPayload({
            key: billing.pixKey,
            name: billing.pixName || 'VITRIO',
            city: billing.pixCity || 'QUIXERAMOBIM',
            amount,
            txid: `VITRIO${profile?.storeId?.slice(0, 12) || ''}`,
          })
        : '',
    [billing, amount, profile?.storeId]
  );

  useEffect(() => {
    if (!payload) {
      setQr('');
      return;
    }

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 2,
    }).then(setQr);
  }, [payload]);

  async function disconnectMercadoPago() {
    if (disconnecting) return;

    setDisconnecting(true);
    setMessage('');

    try {
      const fn = httpsCallable(functions, 'disconnectMercadoPago');
      await fn({});

      await loadStore();

      setConfirmDisconnect(false);
      setMessage(
        'Mercado Pago desconectado. Seus pedidos e pagamentos anteriores foram preservados.'
      );
    } catch (e: any) {
      console.error(e);

      setMessage(
        String(
          e?.message ||
            'Não foi possível desconectar o Mercado Pago.'
        ).replace('FirebaseError: ', '')
      );
    } finally {
      setDisconnecting(false);
    }
  }

  async function connectMercadoPago() {
    if (connecting) return;

    setConnecting(true);
    setMessage('');

    try {
      const fn = httpsCallable(functions, 'getMercadoPagoConnectUrl');
      const result: any = await fn({});
      const url = String(result?.data?.url || '');

      if (!url) {
        throw new Error('O Mercado Pago não retornou a URL de conexão.');
      }

      window.location.assign(url);
    } catch (e: any) {
      console.error(e);

      setMessage(
        String(
          e?.message ||
            'Não foi possível iniciar a conexão com o Mercado Pago.'
        ).replace('FirebaseError: ', '')
      );

      setConnecting(false);
    }
  }

  async function notifyPayment() {
    if (!profile?.storeId || !store) return;

    await addDoc(collection(db, 'subscriptionPayments'), {
      storeId: profile.storeId,
      storeName: store.name || '',
      plan: 'monthly',
      amount,
      status: 'awaiting_review',
      createdAt: serverTimestamp(),
      createdBy: profile.uid,
    });

    const phone = (billing.billingWhatsapp || '').replace(/\D/g, '');

    const text = encodeURIComponent(
      `Olá! Sou da loja ${store.name || profile.storeId}. Efetuei o pagamento da assinatura mensal Vitrio no valor de R$ ${amount.toFixed(2)}. Vou enviar o comprovante nesta conversa para conferência.`
    );

    if (phone) {
      window.location.href = `https://wa.me/${phone}?text=${text}`;
    } else {
      setMessage(
        'O responsável pela plataforma ainda não configurou o WhatsApp para conferência.'
      );
    }
  }

  if (loading) {
    return <div className="panel">Carregando pagamentos...</div>;
  }

  if (!store) {
    return <div className="panel">Loja não encontrada.</div>;
  }

  return (
    <>
      {confirmDisconnect && (
        <div className="modal-backdrop">
          <div className="panel mp-disconnect-modal" role="dialog" aria-modal="true">
            <h2>Desconectar Mercado Pago?</h2>

            <p>
              Novos pagamentos integrados serão desativados e o checkout
              voltará para WhatsApp.
            </p>

            <div className="connection-tip">
              <ShieldCheck />

              <div>
                <strong>Seus dados serão preservados</strong>
                <p>
                  Pedidos e pagamentos anteriores continuarão disponíveis,
                  incluindo os identificadores das transações já realizadas.
                  Você poderá conectar o Mercado Pago novamente quando quiser.
                </p>
              </div>
            </div>

            <div className="mp-disconnect-modal-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setConfirmDisconnect(false)}
                disabled={disconnecting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="secondary-btn danger-action"
                onClick={disconnectMercadoPago}
                disabled={disconnecting}
              >
                {disconnecting
                  ? 'Desconectando...'
                  : 'Desconectar Mercado Pago'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-head">
        <div>
          <h1>Pagamentos</h1>
          <p>
            Gerencie os recebimentos das suas vendas e a assinatura do Vitrio
            separadamente.
          </p>
        </div>
      </div>

      <div className="payment-tabs">
        <button
          className={tab === 'sales' ? 'active' : ''}
          onClick={() => setTab('sales')}
        >
          <WalletCards />
          Recebimentos da loja
        </button>

        <button
          className={tab === 'subscription' ? 'active' : ''}
          onClick={() => setTab('subscription')}
        >
          <QrCode />
          Assinatura Vitrio
        </button>
      </div>

      {message && <div className="notice">{message}</div>}

      {tab === 'sales' ? (
        <div className="payment-layout">
          <section className="panel payment-hero">
            <CreditCard />

            <div>
              <h2>Mercado Pago</h2>

              {store.paymentProviderConnected ? (
                <p>
                  Sua conta está conectada. Os pagamentos das vendas são
                  processados diretamente na sua conta Mercado Pago.
                </p>
              ) : (
                <p>
                  Conecte sua conta Mercado Pago para receber Pix e cartão
                  diretamente pelo checkout do Vitrio.
                </p>
              )}
            </div>

            <span
              className={`status-chip ${
                store.paymentProviderConnected ? 'active' : ''
              }`}
            >
              {store.paymentProviderConnected
                ? 'Conectado'
                : 'Não conectado'}
            </span>
          </section>

          <section className="panel">
            {store.paymentProviderConnected ? (
              <>
                <div className="connection-tip">
                  <CheckCircle2 />

                  <div>
                    <strong>Mercado Pago conectado</strong>
                    <p>
                      O dinheiro das vendas vai diretamente para a conta
                      Mercado Pago desta loja.
                    </p>
                  </div>
                </div>

                <div className="mp-connection-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={connectMercadoPago}
                    disabled={connecting || disconnecting}
                  >
                    <RefreshCw />
                    {connecting
                      ? 'Abrindo Mercado Pago...'
                      : 'Reconectar Mercado Pago'}
                  </button>

                  <button
                    type="button"
                    className="secondary-btn danger-action"
                    onClick={() => setConfirmDisconnect(true)}
                    disabled={connecting || disconnecting}
                  >
                    Desconectar Mercado Pago
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2>Ativar pagamento integrado</h2>

                <p>
                  A conexão é feita pelo ambiente oficial do Mercado Pago. O
                  Vitrio não recebe nem armazena o dinheiro das vendas.
                </p>

                <button
                  type="button"
                  className="primary-btn"
                  onClick={connectMercadoPago}
                  disabled={connecting}
                >
                  <Link2 />
                  {connecting
                    ? 'Abrindo Mercado Pago...'
                    : 'Conectar Mercado Pago'}
                </button>
              </>
            )}

            <div className="connection-tip">
              <ShieldCheck />

              <div>
                <strong>Separação financeira</strong>
                <p>
                  Os recebimentos dos clientes pertencem à loja. A mensalidade
                  do Vitrio continua sendo cobrada separadamente.
                </p>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <div className="payment-layout">
          <section className="panel subscription-pay-card">
            <div>
              <span className="eyebrow">ASSINATURA MENSAL</span>

              <h2>
                {amount.toLocaleString('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                })}
              </h2>

              <p>Pagamento da assinatura da plataforma Vitrio.</p>
            </div>

            {qr ? (
              <img src={qr} alt="QR Code Pix da assinatura" />
            ) : (
              <div className="qr-placeholder">
                Pix ainda não configurado pelo responsável pela plataforma.
              </div>
            )}

            <button
              className="secondary-btn"
              disabled={!payload}
              onClick={() => navigator.clipboard.writeText(payload)}
            >
              <Copy />
              Copiar Pix copia e cola
            </button>
          </section>

          <section className="panel">
            <h2>Como confirmar o pagamento</h2>

            <div className="billing-steps">
              <div>
                <b>1</b>
                <span>Escaneie o QR Code ou copie o código Pix.</span>
              </div>

              <div>
                <b>2</b>
                <span>Confira o valor da mensalidade.</span>
              </div>

              <div>
                <b>3</b>
                <span>
                  Após pagar, clique abaixo e envie o comprovante no WhatsApp.
                </span>
              </div>
            </div>

            <button
              className="primary-btn"
              disabled={!payload || !billing.billingWhatsapp}
              onClick={notifyPayment}
            >
              <MessageCircle />
              Paguei — enviar comprovante
            </button>

            <small className="muted">
              A ativação/renovação acontece após a conferência do responsável
              pela plataforma.
            </small>
          </section>
        </div>
      )}
    </>
  );
}
