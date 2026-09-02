import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { ExternalLink, Package, ShoppingCart, Users } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { db } from '../../lib/firebase';
import { Store } from '../../types/models';

export function SupportPage() {
  const { storeId } = useParams();
  const [store, setStore] = useState<Store | null>(null);
  const [counts, setCounts] = useState({ products: 0, orders: 0, users: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!storeId) {
        setError('Loja não informada.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const snapshot = await getDoc(doc(db, 'stores', storeId));
        if (cancelled) return;

        if (!snapshot.exists()) {
          setStore(null);
          setError('Loja não encontrada.');
          setLoading(false);
          return;
        }

        setStore({ id: snapshot.id, ...snapshot.data() } as Store);

        const [productsSnapshot, ordersSnapshot, usersSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'products'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'orders'), where('storeId', '==', storeId))),
          getDocs(query(collection(db, 'users'), where('storeId', '==', storeId))),
        ]);

        if (cancelled) return;

        setCounts({
          products: productsSnapshot.size,
          orders: ordersSnapshot.size,
          users: usersSnapshot.size,
        });
        setLoading(false);
      } catch {
        if (cancelled) return;
        setStore(null);
        setError('Não foi possível carregar a loja.');
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (loading) {
    return <div className="screen-center">Carregando loja...</div>;
  }

  if (error || !store) {
    return (
      <div className="screen-center">
        <div className="panel compact-panel">
          <h2>Suporte indisponível</h2>
          <p className="muted">{error || 'Não foi possível carregar esta loja.'}</p>
          <Link className="secondary-btn" to="/admin/lojas">
            Voltar para lojas
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="back-link" to="/admin/lojas">
            ← Voltar para lojas
          </Link>
          <h1>Suporte · {store.name}</h1>
          <p>Visão administrativa sem utilizar a senha do cliente.</p>
        </div>
        <a className="secondary-btn" href={`/loja/${store.slug}`} target="_blank" rel="noreferrer">
          Abrir vitrine <ExternalLink size={16} />
        </a>
      </div>

      <div className="stats">
        <div className="stat">
          <span><Package size={15} /> Produtos</span>
          <strong>{counts.products}</strong>
        </div>
        <div className="stat">
          <span><ShoppingCart size={15} /> Pedidos</span>
          <strong>{counts.orders}</strong>
        </div>
        <div className="stat">
          <span><Users size={15} /> Usuários</span>
          <strong>{counts.users}</strong>
        </div>
        <div className="stat">
          <span>Status</span>
          <strong>{store.subscriptionStatus || 'trial'}</strong>
        </div>
      </div>

      <div className="two-cols">
        <div className="panel">
          <h2>Dados da loja</h2>
          <div className="detail-list simple">
            <div>
              <span>Responsável</span>
              <strong>{store.ownerEmail || '—'}</strong>
            </div>
            <div>
              <span>Link</span>
              <strong>/loja/{store.slug}</strong>
            </div>
            <div>
              <span>Plano</span>
              <strong>{store.plan || 'starter'}</strong>
            </div>
            <div>
              <span>Acesso</span>
              <strong>{store.active ? 'Liberado' : 'Bloqueado'}</strong>
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Modo suporte seguro</h2>
          <p className="muted">
            Esta área permite ajudar o cliente sem usar a senha dele. Aqui o Master acompanha dados e orienta a operação.
          </p>
          <div className="connection-tip">
            <ExternalLink size={18} />
            <div>
              <strong>Acesso direto à vitrine</strong>
              <p>A loja abre em nova aba com o link público para que você compare o que o cliente vê.</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}