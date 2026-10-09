import { FormEvent, useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { DeliveryZone, Store } from '../../types/models';

const money = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

export function DeliveryZonesPage() {
  const { profile } = useAuth();

  const [store, setStore] = useState<Partial<Store>>({});
  const [items, setItems] = useState<DeliveryZone[]>([]);
  const [name, setName] = useState('');
  const [fee, setFee] = useState('');
  const [mode, setMode] = useState<'zones' | 'default'>('zones');
  const [defaultFee, setDefaultFee] = useState('');
  const [deliveryEnabled, setDeliveryEnabled] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile?.storeId) return;

    getDoc(doc(db, 'stores', profile.storeId)).then((s) => {
      if (!s.exists()) return;

      const data = { id: s.id, ...s.data() } as Store;

      setStore(data);
      setMode(data.deliveryFeeMode === 'default' ? 'default' : 'zones');
      setDefaultFee(String(data.deliveryFee ?? 0));
      setDeliveryEnabled(data.allowDelivery !== false);
    });

    return onSnapshot(
      query(
        collection(db, 'deliveryZones'),
        where('storeId', '==', profile.storeId)
      ),
      (s) =>
        setItems(
          s.docs.map(
            (d) =>
              ({
                id: d.id,
                ...d.data()
              }) as DeliveryZone
          )
        )
    );
  }, [profile?.storeId]);

  async function saveDeliveryConfig() {
    if (!profile?.storeId) return;

    const parsed =
      Number(defaultFee.replace(/\./g, '').replace(',', '.')) || 0;

    const normalizedFee = Math.max(0, parsed);

    await updateDoc(doc(db, 'stores', profile.storeId), {
      allowDelivery: deliveryEnabled,
      deliveryFeeMode: mode,
      deliveryFee: normalizedFee
    });

    setStore((v) => ({
      ...v,
      allowDelivery: deliveryEnabled,
      deliveryFeeMode: mode,
      deliveryFee: normalizedFee
    }));

    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  async function create(e: FormEvent) {
    e.preventDefault();

    if (!profile?.storeId || !name.trim()) return;

    const parsed =
      Number(fee.replace(/\./g, '').replace(',', '.')) || 0;

    await addDoc(collection(db, 'deliveryZones'), {
      storeId: profile.storeId,
      name: name.trim(),
      fee: Math.max(0, parsed),
      active: true,
      createdAt: new Date()
    });

    setName('');
    setFee('');
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Entregas</h1>
          <p>
            Configure em um só lugar como sua loja cobra pela entrega local.
          </p>
        </div>
      </div>

      <div className="panel delivery-local-panel">
        <div className="delivery-local-header">
          <div>
            <h2>Entrega local</h2>
            <p className="muted">
              Escolha entre cobrar uma taxa única para toda a cidade ou
              definir valores diferentes por bairro / região.
            </p>
          </div>

          <label className="delivery-enabled-toggle">
            <input
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
            />
            <span>Entrega</span>
          </label>
        </div>

        <div className="delivery-mode-grid">
          <label
            className={`delivery-mode-option ${
              mode === 'default' ? 'active' : ''
            }`}
          >
            <div className="delivery-mode-radio">
              <input
                type="radio"
                name="deliveryMode"
                checked={mode === 'default'}
                onChange={() => setMode('default')}
              />
            </div>

            <div>
              <strong>Taxa única</strong>
              <small>O mesmo valor para todas as entregas.</small>
            </div>
          </label>

          <label
            className={`delivery-mode-option ${
              mode === 'zones' ? 'active' : ''
            }`}
          >
            <div className="delivery-mode-radio">
              <input
                type="radio"
                name="deliveryMode"
                checked={mode === 'zones'}
                onChange={() => setMode('zones')}
              />
            </div>

            <div>
              <strong>Por bairro / região</strong>
              <small>
                O cliente escolhe a região e o Vitrio aplica a taxa
                cadastrada.
              </small>
            </div>
          </label>
        </div>

        {mode === 'default' && (
          <div className="delivery-single-fee">
            <label>
              Valor da taxa de entrega (R$)
              <input
                inputMode="decimal"
                placeholder="Ex.: 10,00"
                value={defaultFee}
                onChange={(e) => setDefaultFee(e.target.value)}
              />
            </label>
          </div>
        )}

        <div className="delivery-config-actions">
          <button
            className="primary-btn"
            type="button"
            onClick={saveDeliveryConfig}
          >
            Salvar configuração de entrega
          </button>

          {saved && <span className="success-text">Salvo ✓</span>}
        </div>
      </div>

      {mode === 'zones' && (
        <>
          <div className="panel" style={{ marginTop: 18 }}>
            <h2>Bairros / regiões</h2>

            <p className="muted">
              Cadastre cada área e sua respectiva taxa. Somente regiões ativas
              aparecerão no checkout.
            </p>

            <form onSubmit={create} className="inline-form">
              <input
                placeholder="Bairro ou região"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                inputMode="decimal"
                placeholder="Taxa: 10,00"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />

              <button className="primary-btn">Adicionar</button>
            </form>
          </div>

          <div className="table-card">
            <table>
              <thead>
                <tr>
                  <th>Região</th>
                  <th>Taxa</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {items.map((z) => (
                  <tr key={z.id}>
                    <td>
                      <strong>{z.name}</strong>
                    </td>

                    <td>{money(z.fee)}</td>

                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          updateDoc(doc(db, 'deliveryZones', z.id), {
                            active: !z.active
                          })
                        }
                      >
                        {z.active ? 'Ativa' : 'Inativa'}
                      </button>
                    </td>

                    <td>
                      <button
                        className="secondary-btn"
                        onClick={() =>
                          deleteDoc(doc(db, 'deliveryZones', z.id))
                        }
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}