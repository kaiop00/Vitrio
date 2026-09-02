import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, ExternalLink, KeyRound, Link2, ShieldCheck, WalletCards } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

const connectionSteps = [
  {
    icon: WalletCards,
    title: 'Tenha uma conta Mercado Pago',
    text: 'Use uma conta Mercado Pago da própria loja. É nessa conta que os pagamentos das vendas online serão processados.'
  },
  {
    icon: Link2,
    title: 'Clique em “Conectar Mercado Pago”',
    text: 'O Vitrio abrirá a página oficial do Mercado Pago para iniciar a autorização com segurança.'
  },
  {
    icon: KeyRound,
    title: 'Entre na conta e autorize o Vitrio',
    text: 'Faça login no Mercado Pago e confirme a autorização solicitada. O Vitrio não pede sua senha do Mercado Pago.'
  },
  {
    icon: CheckCircle2,
    title: 'Volte ao Vitrio',
    text: 'Depois da autorização, você será redirecionado automaticamente. A tela mostrará “Conta conectada”.'
  },
  {
    icon: ShieldCheck,
    title: 'Ative o pagamento online',
    text: 'Depois de conectado, selecione Checkout Vitrio ou WhatsApp + Vitrio nas configurações da loja para liberar o pagamento online.'
  }
];

type StoreSettings = {
  id?: string;
  checkoutMode?: 'whatsapp' | 'online' | 'both';
  paymentProviderConnected?: boolean;
};

export function PaymentsPage() {
  const { profile } = useAuth();
  const [store, setStore] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!profile?.storeId) {
        setError('Loja não vinculada ao usuário.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const snapshot = await getDoc(doc(db, 'stores', profile.storeId));
        if (cancelled) return;

        if (!snapshot.exists()) {
          setStore(null);
          setError('Loja não encontrada.');
          setLoading(false);
          return;
        }

        setStore({ id: snapshot.id, ...snapshot.data() } as StoreSettings);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setStore(null);
        setError('Não foi possível carregar as configurações de pagamento.');
        setLoading(false);
      }
    }

    load();

    const params = new URLSearchParams(window.location.search);
    if (params.get('mp') === 'connected') setMessage('Mercado Pago conectado com sucesso. Sua loja já está autorizada no Vitrio.');
    if (params.get('mp') === 'error') setMessage('Não foi possível concluir a conexão. Tente novamente e confirme a autorização no Mercado Pago.');

    return () => {
      cancelled = true;
    };
  }, [profile?.storeId]);

  async function connect() {
    try {
      setLoading(true);
      setMessage('');
      const fn = httpsCallable(functions, 'getMercadoPagoConnectUrl');
      const result: any = await fn();
      if (result.data?.url) window.location.href = result.data.url;
    } catch (e: any) {
      setMessage(e?.message || 'Erro ao iniciar a conexão.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="panel">Carregando configurações de pagamento...</div>;
  if (error || !store) return <div className="panel"><strong>{error || 'Não foi possível carregar as configurações de pagamento.'}</strong></div>;

  return <>
    <div className="page-head"><div><h1>Pagamentos</h1><p>Central de recebimentos da sua loja.</p></div></div>
    {message && <div className="panel"><strong>{message}</strong></div>}

    <div className="settings-grid">
      <div className="panel">
        <h2>Finalização de compra</h2>
        <p>O Vitrio permite WhatsApp, checkout pelo sistema ou os dois. Essa escolha continua em Configurações.</p>
        <div className="status-row"><span>Modo atual</span><strong>{store.checkoutMode === 'both' ? 'WhatsApp + Vitrio' : store.checkoutMode === 'online' ? 'Checkout Vitrio' : 'WhatsApp'}</strong></div>
      </div>

      <div className="panel">
        <h2>Mercado Pago</h2>
        <p>Cada lojista conecta a própria conta. As vendas online são processadas em nome da loja, sem usar a conta do Vitrio para receber o faturamento dela.</p>
        <div className="integration-box">
          <div>
            <strong>{store.paymentProviderConnected ? 'Conta conectada' : 'Conta ainda não conectada'}</strong>
            <small>{store.paymentProviderConnected ? 'Conta autorizada via Mercado Pago.' : 'Você será direcionado ao Mercado Pago para autorizar o Vitrio.'}</small>
          </div>
          <button className="primary-btn" onClick={connect} disabled={loading || store.paymentProviderConnected}>
            {store.paymentProviderConnected ? 'Conectado' : loading ? 'Abrindo...' : 'Conectar Mercado Pago'}
          </button>
        </div>
      </div>
    </div>

    <div className="panel">
      <div className="steps-head">
        <div><h2>Como conectar sua conta</h2><p>Siga estas etapas. O processo é feito no ambiente oficial do Mercado Pago.</p></div>
        {!store.paymentProviderConnected && <button className="secondary-btn" onClick={connect} disabled={loading}><ExternalLink size={17}/> Começar conexão</button>}
      </div>
      <div className="connection-steps">
        {connectionSteps.map((step, index) => {
          const Icon = step.icon;
          return <div className="connection-step" key={step.title}>
            <div className="step-number">{index + 1}</div>
            <div className="step-icon"><Icon size={20} /></div>
            <div><strong>{step.title}</strong><p>{step.text}</p></div>
          </div>;
        })}
      </div>
      <div className="connection-tip"><ShieldCheck size={19}/><div><strong>Importante</strong><p>Nunca envie sua senha, Access Token ou código de segurança para outra pessoa. A autorização é feita diretamente no Mercado Pago.</p></div></div>
    </div>

    <div className="panel"><h2>Segurança</h2><p>A Public Key pode ficar no frontend. Access Token, Client Secret e tokens OAuth dos lojistas ficam exclusivamente nas Cloud Functions e na área privada do backend.</p></div>
  </>;
}