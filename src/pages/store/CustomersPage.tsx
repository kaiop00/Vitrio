import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  Check,
  Megaphone,
  MessageCircle,
  Search,
  Users,
  X,
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Customer } from '../../types/models';

const money = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

function cleanPhone(value = '') {
  const digits = value.replace(/\D/g, '');

  if (!digits) return '';

  // Telefones brasileiros salvos sem DDI.
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

export function CustomersPage() {
  const { profile } = useAuth();

  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignSent, setCampaignSent] = useState<string[]>([]);

  const [message, setMessage] = useState(
    'Olá, {cliente}! 👋\n\nTemos novidades na {loja} para você.\n\nConfira nossa loja:\n{link}'
  );

  useEffect(() => {
    if (!profile?.storeId) return;

    return onSnapshot(
      query(
        collection(db, 'customers'),
        where('storeId', '==', profile.storeId)
      ),
      snapshot =>
        setItems(
          snapshot.docs.map(
            doc => ({ id: doc.id, ...doc.data() } as Customer)
          )
        )
    );
  }, [profile?.storeId]);

  const visible = useMemo(
    () =>
      items.filter(customer =>
        `${customer.name} ${customer.phone} ${customer.email || ''}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [items, search]
  );

  const selectedCustomers = useMemo(
    () => items.filter(customer => selected.includes(customer.id)),
    [items, selected]
  );

  const validSelectedCustomers = useMemo(
    () => selectedCustomers.filter(customer => cleanPhone(customer.phone)),
    [selectedCustomers]
  );

  const allVisibleSelected =
    visible.length > 0 &&
    visible.every(customer => selected.includes(customer.id));

  const storeName =
    (profile as any)?.storeName ||
    (profile as any)?.name ||
    'nossa loja';

  const storefrontLink =
    typeof window !== 'undefined'
      ? `${window.location.origin}/loja/${(profile as any)?.storeSlug || ''}`
      : '';

  function toggleCustomer(id: string) {
    setSelected(current =>
      current.includes(id)
        ? current.filter(item => item !== id)
        : [...current, id]
    );
  }

  function toggleAllVisible() {
    if (allVisibleSelected) {
      const visibleIds = new Set(visible.map(customer => customer.id));

      setSelected(current =>
        current.filter(id => !visibleIds.has(id))
      );

      return;
    }

    setSelected(current => [
      ...new Set([
        ...current,
        ...visible.map(customer => customer.id),
      ]),
    ]);
  }

  function personalizedMessage(customer: Customer) {
    return message
      .replace(/\{cliente\}/g, customer.name || 'cliente')
      .replace(/\{loja\}/g, storeName)
      .replace(/\{link\}/g, storefrontLink);
  }

  function openCampaign() {
    if (!validSelectedCustomers.length) return;

    setCampaignSent([]);
    setCampaignOpen(true);
  }

  function sendCustomer(customer: Customer) {
    const phone = cleanPhone(customer.phone);
    if (!phone) return;

    const text = personalizedMessage(customer);

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
      '_blank',
      'noopener,noreferrer'
    );

    setCampaignSent(current =>
      current.includes(customer.id)
        ? current
        : [...current, customer.id]
    );
  }

  function finishCampaign() {
    setCampaignOpen(false);
    setCampaignSent([]);
    setSelected([]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clientes</h1>
          <p>
            Histórico de clientes e relacionamento da sua loja.
          </p>
        </div>

        {selected.length > 0 && (
          <button
            type="button"
            className="primary-btn"
            onClick={openCampaign}
            disabled={!validSelectedCustomers.length}
          >
            <Megaphone size={17} />
            Criar campanha ({selected.length})
          </button>
        )}
      </div>

      <div className="panel customers-toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            placeholder="Buscar cliente"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>

        <div className="customers-selection">
          <button
            type="button"
            className="secondary-btn"
            onClick={toggleAllVisible}
            disabled={!visible.length}
          >
            <Users size={17} />
            {allVisibleSelected
              ? 'Desmarcar todos'
              : 'Selecionar todos'}
          </button>

          {selected.length > 0 && (
            <span>
              <strong>{selected.length}</strong>{' '}
              {selected.length === 1
                ? 'cliente selecionado'
                : 'clientes selecionados'}
            </span>
          )}
        </div>
      </div>

      <div className="table-card customers-table-card">
        <table>
          <thead>
            <tr>
              <th className="customer-check-col">
                <input
                  type="checkbox"
                  aria-label="Selecionar todos"
                  checked={allVisibleSelected}
                  onChange={toggleAllVisible}
                />
              </th>
              <th>Cliente</th>
              <th>Contato</th>
              <th>Pedidos</th>
              <th>Total comprado</th>
            </tr>
          </thead>

          <tbody>
            {visible.map(customer => (
              <tr
                key={customer.id}
                className={
                  selected.includes(customer.id)
                    ? 'customer-selected-row'
                    : ''
                }
              >
                <td className="customer-check-col">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${customer.name}`}
                    checked={selected.includes(customer.id)}
                    onChange={() => toggleCustomer(customer.id)}
                  />
                </td>

                <td>
                  <strong>{customer.name}</strong>
                </td>

                <td>
                  {customer.phone}
                  <br />
                  <small>{customer.email}</small>
                </td>

                <td>{customer.ordersCount || 0}</td>

                <td>{money(customer.totalSpent || 0)}</td>
              </tr>
            ))}

            {!visible.length && (
              <tr>
                <td colSpan={5}>
                  <div className="customers-empty">
                    Nenhum cliente encontrado.
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {campaignOpen && validSelectedCustomers.length > 0 && (
        <div
          className="campaign-modal-backdrop"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setCampaignOpen(false);
            }
          }}
        >
          <div className="campaign-modal">
            <div className="campaign-modal-head">
              <div>
                <span className="campaign-kicker">
                  <Megaphone size={15} />
                  Campanha WhatsApp
                </span>

                <h2>Enviar mensagem aos clientes</h2>

                <p>
                  Personalize a mensagem antes de iniciar os
                  envios.
                </p>
              </div>

              <button
                type="button"
                className="icon-btn"
                onClick={() => setCampaignOpen(false)}
                aria-label="Fechar"
              >
                <X size={20} />
              </button>
            </div>

            <div className="campaign-summary">
              <div>
                <strong>{validSelectedCustomers.length}</strong>
                <span>clientes</span>
              </div>

              <div>
                <strong>
                  {campaignSent.length}/{validSelectedCustomers.length}
                </strong>
                <span>contatos abertos</span>
              </div>
            </div>

            <label className="campaign-message-field">
              Mensagem
              <textarea
                rows={8}
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </label>

            <div className="campaign-variables">
              <span>Variáveis:</span>

              <button
                type="button"
                onClick={() =>
                  setMessage(current => `${current}{cliente}`)
                }
              >
                {'{cliente}'}
              </button>

              <button
                type="button"
                onClick={() =>
                  setMessage(current => `${current}{loja}`)
                }
              >
                {'{loja}'}
              </button>

              <button
                type="button"
                onClick={() =>
                  setMessage(current => `${current}{link}`)
                }
              >
                {'{link}'}
              </button>
            </div>

            <div className="campaign-preview">
              <span>Prévia da mensagem</span>
              <strong>
                {validSelectedCustomers[0]?.name}
              </strong>

              <p>
                {personalizedMessage(validSelectedCustomers[0])}
              </p>
            </div>

            <div className="campaign-queue">
              <div className="campaign-queue-head">
                <strong>Fila de envio</strong>
                <span>
                  {campaignSent.length} de {validSelectedCustomers.length} abertos
                </span>
              </div>

              {validSelectedCustomers.map(customer => {
                const sent = campaignSent.includes(customer.id);

                return (
                  <div
                    className={`campaign-queue-item ${sent ? 'sent' : ''}`}
                    key={customer.id}
                  >
                    <div className="campaign-queue-customer">
                      <span className="campaign-queue-status">
                        {sent ? <Check size={15} /> : <MessageCircle size={15} />}
                      </span>

                      <div>
                        <strong>{customer.name}</strong>
                        <small>{customer.phone}</small>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={sent ? 'secondary-btn' : 'primary-btn'}
                      onClick={() => sendCustomer(customer)}
                    >
                      <MessageCircle size={16} />
                      {sent ? 'Abrir novamente' : 'Enviar WhatsApp'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="campaign-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={finishCampaign}
              >
                <Check size={17} />
                Finalizar campanha
              </button>
            </div>

            {selectedCustomers.length !==
              validSelectedCustomers.length && (
              <small className="campaign-warning">
                Alguns clientes foram ignorados porque não possuem
                telefone válido.
              </small>
            )}
          </div>
        </div>
      )}
    </>
  );
}
