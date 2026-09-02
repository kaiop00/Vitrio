import { useEffect, useState } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { CheckCircle2, Clock3, CreditCard, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';

const labels: Record<string, string> = {
  active: 'Assinatura ativa',
  trial: 'Teste grátis',
  past_due: 'Pagamento pendente',
  blocked: 'Conta bloqueada'
};

function toDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export function SubscriptionPage() {
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
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

        setStore({ id: snapshot.id, ...snapshot.data() } as Store);
        setLoading(false);
      } catch {
        if (cancelled) return;
        setStore(null);
        setError('Não foi possível carregar a assinatura da loja.');
        setLoading(false);
      }
    }

    load();

    if (!profile?.storeId) return undefined;

    return onSnapshot(
      doc(db, 'stores', profile.storeId),
      snapshot => {
        setStore(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Store) : null);
      },
      () => {
        setError('Não foi possível acompanhar as mudanças da assinatura.');
      }
    );
  }, [profile?.storeId]);

  if (loading) return <div className="screen-center">Carregando assinatura...</div>;
  if (error || !store) return <div className="screen-center"><strong>{error || 'Não foi possível carregar a assinatura da loja.'}</strong></div>;

  const end = toDate(store.trialEndsAt);
  const days = end ? Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)) : null;
  const status = store.subscriptionStatus || 'trial';

  return <>
    <div className="page-head">
      <div>
        <h1>Plano e assinatura</h1>
        <p>Acompanhe a situação comercial da sua loja no Vitrio.</p>
      </div>
      <span className={`status-chip ${status === 'active' ? 'ok' : ''}`}>{labels[status] || status}</span>
    </div>

    <div className="subscription-hero">
      <div>
        <span>Plano atual</span>
        <strong>{(store.plan || 'free').toString().toUpperCase()}</strong>
        <p>{status === 'active' ? 'Sua loja está com acesso completo.' : 'Veja abaixo o que acontece com sua conta e o que você pode fazer agora.'}</p>
      </div>
      <div className="subscription-stats">
        <div>
          <Gift size={18} />
          <span>Teste grátis</span>
          <strong>{days === null ? 'Indisponível' : `${days} dia(s)`}</strong>
        </div>
        <div>
          <CreditCard size={18} />
          <span>Pagamento</span>
          <strong>{status === 'past_due' ? 'Pendente' : 'Em dia'}</strong>
        </div>
      </div>
    </div>

    <div className="subscription-grid">
      <section className="panel">
        <h2>Status da conta</h2>
        <div className="status-list">
          <div><CheckCircle2 size={18} /> <strong>Loja ativa</strong><span>Seu acesso depende do plano e da situação da assinatura.</span></div>
          <div><Clock3 size={18} /> <strong>Período de teste</strong><span>Se houver um teste em andamento, você consegue acompanhar a data final aqui.</span></div>
          <div><ShieldCheck size={18} /> <strong>Bloqueios</strong><span>Quando a assinatura fica pendente, o painel informa o motivo com clareza.</span></div>
        </div>
      </section>

      <section className="panel">
        <h2>Próximos passos</h2>
        <p>Se a conta estiver em teste, finalize a configuração da loja. Se houver pendência, regularize o pagamento para evitar bloqueio.</p>
        <div className="subscription-actions">
          <a className="primary-btn" href="/painel/configuracoes">Abrir configurações</a>
          <a className="secondary-btn" href="/painel/pagamentos">Ver pagamentos</a>
        </div>
        <div className="subscription-note"><Sparkles size={16} /><span>Assinatura e pagamento são tratados em tempo real para manter a experiência consistente.</span></div>
      </section>
    </div>
  </>;
}
