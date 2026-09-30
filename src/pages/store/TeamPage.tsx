import { FormEvent, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Pencil, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { AppUser, Permission } from '../../types/models';

const options: [Permission, string][] = [
  ['dashboard', 'Dashboard'],
  ['products', 'Produtos'],
  ['categories', 'Categorias'],
  ['inventory', 'Estoque'],
  ['orders', 'Pedidos'],
  ['returns', 'Trocas/devoluções'],
  ['cash', 'Caixa'],
  ['customers', 'Clientes'],
  ['coupons', 'Cupons'],
  ['delivery', 'Entregas'],
  ['reports', 'Relatórios'],
  ['audit', 'Auditoria'],
];

const defaultPermissions: Permission[] = ['dashboard', 'orders'];

export function TeamPage() {
  const { profile } = useAuth();

  const [users, setUsers] = useState<AppUser[]>([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    permissions: defaultPermissions,
  });

  useEffect(() => {
    if (!profile?.storeId) return;

    return onSnapshot(
      query(
        collection(db, 'users'),
        where('storeId', '==', profile.storeId)
      ),
      snapshot => {
        setUsers(
          snapshot.docs.map(
            d => ({ uid: d.id, ...d.data() } as AppUser)
          )
        );
      }
    );
  }, [profile?.storeId]);

  function resetForm() {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      password: '',
      permissions: defaultPermissions,
    });
  }

  function togglePermission(permission: Permission) {
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter(p => p !== permission)
        : [...current.permissions, permission],
    }));
  }

  function startEdit(user: AppUser) {
    if (user.isStoreOwner) return;

    setMessage('');
    setEditing(user);

    setForm({
      name: user.displayName || '',
      email: user.email || '',
      password: '',
      permissions: user.permissions || [],
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (!profile?.storeId || saving) return;

    setSaving(true);
    setMessage('');

    try {
      if (editing) {
        const fn = httpsCallable(functions, 'updateStoreUser');

        await fn({
          uid: editing.uid,
          name: form.name,
          email: form.email,
          permissions: form.permissions,
        });

        setMessage('Funcionário atualizado com sucesso.');
      } else {
        const fn = httpsCallable(functions, 'createStoreUser');

        await fn({
          ...form,
          storeId: profile.storeId,
          isStoreOwner: false,
        });

        setMessage('Funcionário criado com sucesso.');
      }

      resetForm();
    } catch (e: any) {
      setMessage(
        String(
          e?.message ||
            `Não foi possível ${editing ? 'atualizar' : 'criar'} o funcionário.`
        ).replace('FirebaseError: ', '')
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: AppUser) {
    if (user.isStoreOwner) return;

    setMessage('');

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        active: !user.active,
      });

      setMessage(
        user.active
          ? 'Funcionário desativado.'
          : 'Funcionário ativado.'
      );
    } catch (e: any) {
      setMessage(
        String(
          e?.message ||
            'Não foi possível alterar o status do funcionário.'
        ).replace('FirebaseError: ', '')
      );
    }
  }

  async function confirmDelete() {
    if (!deleting || saving) return;

    setSaving(true);
    setMessage('');

    try {
      const fn = httpsCallable(functions, 'deleteStoreUser');

      await fn({
        uid: deleting.uid,
      });

      if (editing?.uid === deleting.uid) {
        resetForm();
      }

      setDeleting(null);
      setMessage('Funcionário excluído com sucesso.');
    } catch (e: any) {
      setMessage(
        String(
          e?.message ||
            'Não foi possível excluir o funcionário.'
        ).replace('FirebaseError: ', '')
      );
    } finally {
      setSaving(false);
    }
  }

  if (
    profile?.isStoreOwner !== true &&
    profile?.permissions !== undefined
  ) {
    return (
      <div className="screen-center">
        Somente o responsável principal da loja pode gerenciar a equipe.
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Equipe</h1>
          <p>
            Gerencie os acessos e escolha o que cada funcionário pode
            visualizar.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="page-head">
          <div>
            <h2>
              {editing ? 'Editar funcionário' : 'Novo funcionário'}
            </h2>

            <p>
              {editing
                ? 'Atualize os dados e as permissões deste acesso.'
                : 'Crie um acesso individual para um membro da equipe.'}
            </p>
          </div>

          {editing && (
            <button
              type="button"
              className="secondary-btn"
              onClick={resetForm}
            >
              <X size={17} />
              Cancelar edição
            </button>
          )}
        </div>

        <form className="form-grid" onSubmit={submit}>
          <label>
            Nome
            <input
              value={form.name}
              onChange={e =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              required
            />
          </label>

          <label>
            E-mail
            <input
              type="email"
              value={form.email}
              onChange={e =>
                setForm({
                  ...form,
                  email: e.target.value,
                })
              }
              required
            />
          </label>

          {!editing && (
            <label>
              Senha inicial
              <input
                type="password"
                minLength={6}
                value={form.password}
                onChange={e =>
                  setForm({
                    ...form,
                    password: e.target.value,
                  })
                }
                required
              />
            </label>
          )}

          <div className="span-2">
            <strong>Permissões</strong>

            <div className="permission-grid">
              {options.map(([permission, label]) => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={form.permissions.includes(permission)}
                    onChange={() =>
                      togglePermission(permission)
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <button
            className="primary-btn"
            disabled={saving}
          >
            {saving
              ? 'Salvando...'
              : editing
                ? 'Salvar alterações'
                : 'Criar funcionário'}
          </button>
        </form>

        {message && <p>{message}</p>}
      </div>

      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Permissões</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {users.map(user => (
              <tr key={user.uid}>
                <td>
                  <strong>
                    {user.displayName || 'Sem nome'}
                  </strong>
                  <br />
                  <small>{user.email}</small>
                </td>

                <td>
                  {user.isStoreOwner
                    ? 'Responsável'
                    : 'Funcionário'}
                </td>

                <td>
                  {user.isStoreOwner
                    ? 'Acesso total'
                    : (user.permissions || [])
                        .map(
                          permission =>
                            options.find(
                              option =>
                                option[0] === permission
                            )?.[1] || permission
                        )
                        .join(', ') || 'Sem permissões'}
                </td>

                <td>
                  <span
                    className={`status-chip ${
                      user.active ? 'ok' : ''
                    }`}
                  >
                    {user.active ? 'Ativo' : 'Inativo'}
                  </span>
                </td>

                <td>
                  {user.isStoreOwner ? (
                    <small>Responsável principal</small>
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => startEdit(user)}
                      >
                        <Pencil size={16} />
                        Editar
                      </button>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          toggleActive(user)
                        }
                      >
                        {user.active ? (
                          <UserX size={16} />
                        ) : (
                          <UserCheck size={16} />
                        )}

                        {user.active
                          ? 'Desativar'
                          : 'Ativar'}
                      </button>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() =>
                          setDeleting(user)
                        }
                      >
                        <Trash2 size={16} />
                        Excluir
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {users.length === 0 && (
              <tr>
                <td colSpan={5}>
                  Nenhum membro da equipe encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {deleting && (
        <div className="modal-backdrop">
          <div
            className="panel"
            role="dialog"
            aria-modal="true"
            style={{ maxWidth: 480 }}
          >
            <h2>Excluir funcionário?</h2>

            <p>
              O acesso de{' '}
              <strong>
                {deleting.displayName || deleting.email}
              </strong>{' '}
              será removido permanentemente.
            </p>

            <p>
              O histórico de pedidos e operações já realizadas será
              preservado.
            </p>

            <div
              style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setDeleting(null)}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary-btn"
                onClick={confirmDelete}
                disabled={saving}
              >
                <Trash2 size={16} />
                {saving ? 'Excluindo...' : 'Excluir funcionário'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
