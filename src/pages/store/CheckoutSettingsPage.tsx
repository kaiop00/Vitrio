import { FormEvent, useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import {
  CheckCircle2,
  CreditCard,
  MessageCircle,
  Shuffle,
  PackageCheck,
} from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';

type CheckoutMode = 'whatsapp' | 'online' | 'both';

export function CheckoutSettingsPage() {
  const { profile } = useAuth();

  const [store, setStore] = useState<Partial<Store>>({
    checkoutMode: 'whatsapp', allowPix: true, allowCard: true, allowCash: true, allowPickup: true, allowDelivery: true
  });

  const [melhorEnvioConnected, setMelhorEnvioConnected] = useState(false);
  const [melhorEnvioLoading, setMelhorEnvioLoading] = useState(false);
  const [melhorEnvioMessage, setMelhorEnvioMessage] = useState('');
  const [shippingOriginCep, setShippingOriginCep] = useState('');
  const [shippingIncompleteCount, setShippingIncompleteCount] = useState(0);
  const [shippingIncompleteNames, setShippingIncompleteNames] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!profile?.storeId) return;

    getDoc(doc(db, 'stores', profile.storeId)).then((s) => {
      if (!s.exists()) return;

      const data = {
        id: s.id,
        ...s.data(),
      } as Store;

      setStore((v) => ({
        ...v,
        ...data,
      }));

      setShippingOriginCep(String(data.shippingOriginCep || ''));
    });
  }, [profile?.storeId]);

  useEffect(() => {
    if (!profile?.storeId) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('melhorEnvio');
    if (result === 'connected') setMelhorEnvioMessage('Melhor Envio conectado com sucesso em produção.');
    if (result === 'error') setMelhorEnvioMessage('Não foi possível concluir a autorização do Melhor Envio. Tente conectar novamente.');
    if (result) window.history.replaceState({}, '', window.location.pathname);

    (async () => {
      try {
        const statusFn = httpsCallable<{storeId:string},{connected:boolean}>(functions,'getMelhorEnvioStatus');
        const status = await statusFn({storeId:profile.storeId!});
        setMelhorEnvioConnected(status.data.connected === true);
      } catch (error) { console.error('getMelhorEnvioStatus', error); }
      try {
        const snap = await getDocs(query(collection(db,'products'), where('storeId','==',profile.storeId), where('active','==',true)));
        const incomplete = snap.docs.map(d => ({name:String(d.data()?.name||'Produto'), p:d.data()})).filter(x => Number(x.p.shippingWeightGrams||0)<=0 || Number(x.p.shippingWidthCm||0)<=0 || Number(x.p.shippingHeightCm||0)<=0 || Number(x.p.shippingLengthCm||0)<=0);
        setShippingIncompleteCount(incomplete.length);
        setShippingIncompleteNames(incomplete.slice(0,5).map(x=>x.name));
      } catch (error) { console.error('shipping product validation', error); }
    })();
  }, [profile?.storeId]);

  async function connectMelhorEnvio() {
    if (!profile?.storeId) return;
    setMelhorEnvioLoading(true); setMelhorEnvioMessage('');
    try {
      const fn = httpsCallable<{storeId:string},{url:string}>(functions,'startMelhorEnvioAuthorization');
      const result = await fn({storeId:profile.storeId});
      if (!result.data?.url) throw new Error('URL de autorização não retornada.');
      window.location.href = result.data.url;
    } catch (error) {
      console.error('startMelhorEnvioAuthorization', error);
      setMelhorEnvioMessage('Não foi possível iniciar a conexão com o Melhor Envio.');
      setMelhorEnvioLoading(false);
    }
  }

  function selectMode(mode: CheckoutMode) {
    if (
      (mode === 'online' || mode === 'both') &&
      store.paymentProviderConnected !== true
    ) {
      setMessage(
        'Conecte primeiro sua conta Mercado Pago na página Pagamentos para ativar o checkout integrado.'
      );
      return;
    }

    setMessage('');
    setStore((current) => ({
      ...current,
      checkoutMode: mode,
    }));
  }

  async function save(e: FormEvent) {
    e.preventDefault();

    if (!profile?.storeId) return;

    const mode: CheckoutMode =
      (store.checkoutMode as CheckoutMode) || 'whatsapp';

    if (
      (mode === 'online' || mode === 'both') &&
      store.paymentProviderConnected !== true
    ) {
      setMessage(
        'Não é possível salvar o pagamento integrado sem conectar o Mercado Pago.'
      );
      return;
    }

    await updateDoc(doc(db, 'stores', profile.storeId), {
      checkoutMode: mode,
      allowPix: store.allowPix !== false,
      allowCard: store.allowCard !== false,
      allowCash: store.allowCash !== false,
      allowPickup: store.allowPickup !== false,
      allowDelivery: store.allowDelivery !== false,
      shippingOriginCep: shippingOriginCep.replace(/\D/g,'').slice(0,8),
    });

    setMessage('');
    setSaved(true);

    setTimeout(() => setSaved(false), 2500);
  }

  const mode = (store.checkoutMode || 'whatsapp') as CheckoutMode;
  const connected = store.paymentProviderConnected === true;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Finalização da compra</h1>
          <p>Escolha como seus clientes poderão concluir os pedidos.</p>
        </div>
      </div>

      <form onSubmit={save}>
        <div className="checkout-mode-grid">
          <div
            className={`mode-card ${
              mode === 'whatsapp' ? 'selected' : ''
            }`}
            role="button"
            tabIndex={0}
            onClick={() => selectMode('whatsapp')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                selectMode('whatsapp');
              }
            }}
          >
            <MessageCircle />

            <strong>WhatsApp</strong>

            <span>
              O pedido é registrado no Vitrio e a negociação é concluída pelo
              WhatsApp.
            </span>

            {mode === 'whatsapp' && (
              <CheckCircle2 className="mode-check" />
            )}
          </div>

          <div
            className={`mode-card ${
              mode === 'online' ? 'selected' : ''
            } ${!connected ? 'disabled' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => selectMode('online')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                selectMode('online');
              }
            }}
          >
            <CreditCard />

            <strong>Pagamento integrado</strong>

            <span>
              O cliente conclui o pagamento diretamente no checkout do Vitrio
              usando Mercado Pago.
            </span>

            {!connected && (
              <small className="muted">
                Conecte o Mercado Pago para habilitar.
              </small>
            )}

            {mode === 'online' && (
              <CheckCircle2 className="mode-check" />
            )}
          </div>

          <div
            className={`mode-card ${
              mode === 'both' ? 'selected' : ''
            } ${!connected ? 'disabled' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => selectMode('both')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                selectMode('both');
              }
            }}
          >
            <Shuffle />

            <strong>Ambos</strong>

            <span>
              O cliente escolhe entre finalizar pelo WhatsApp ou pagar
              diretamente pelo Vitrio.
            </span>

            {!connected && (
              <small className="muted">
                Conecte o Mercado Pago para habilitar.
              </small>
            )}

            {mode === 'both' && (
              <CheckCircle2 className="mode-check" />
            )}
          </div>
        </div>

        {message && <div className="notice">{message}</div>}

        {connected && (
          <div className="notice">
            Mercado Pago conectado. O dinheiro das vendas é processado
            diretamente na conta da sua loja.
          </div>
        )}

        <div className="panel settings-panel">
          <h2>Formas disponíveis</h2>

          <div className="toggle-grid">
            <label>
              <input
                type="checkbox"
                checked={store.allowPix !== false}
                onChange={(e) =>
                  setStore({
                    ...store,
                    allowPix: e.target.checked,
                  })
                }
              />
              Pix
            </label>

            <label>
              <input
                type="checkbox"
                checked={store.allowCard !== false}
                onChange={(e) =>
                  setStore({
                    ...store,
                    allowCard: e.target.checked,
                  })
                }
              />
              Cartão
            </label>

            <label>
              <input
                type="checkbox"
                checked={store.allowCash !== false}
                onChange={(e) =>
                  setStore({
                    ...store,
                    allowCash: e.target.checked,
                  })
                }
              />
              Dinheiro
            </label>

            <label>
              <input
                type="checkbox"
                checked={store.allowPickup !== false}
                onChange={(e) =>
                  setStore({
                    ...store,
                    allowPickup: e.target.checked,
                  })
                }
              />
              Retirada na loja
            </label>

            <label className="checkout-availability-option">
              <input
                type="checkbox"
                checked={store.allowDelivery !== false}
                onChange={(e) =>
                  setStore({
                    ...store,
                    allowDelivery: e.target.checked,
                  })
                }
              />
              <span>Entrega local</span>
            </label>

          </div>

          <div className="save-row">
            <button className="primary-btn">
              Salvar configurações
            </button>

            {saved && (
              <span className="success-text">
                Configurações salvas ✓
              </span>
            )}
          </div>
        </div>
      </form>
    </>
  );
}
