import { FormEvent, useEffect, useState } from 'react';
import { collection,
  doc,
  getDoc,
  getDocs,
  query,
  updateDoc,
  where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, functions, storage } from '../../lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';

const formatBrPhone = (value: string) => {
  const d = value.replace(/\D/g, '').slice(0, 11);

  if (d.length <= 2) return d;
  if (d.length <= 3) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 7)
    return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3)}`;

  return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)} - ${d.slice(7, 11)}`;
};

const parsePtBrNumber = (value: string) => {
  const raw = value.trim().replace(/\s/g, '');

  if (!raw) return 0;

  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.')) || 0;
  }

  const parts = raw.split('.');

  if (parts.length > 1 && parts.slice(1).every(x => x.length === 3)) {
    return Number(parts.join('')) || 0;
  }

  return Number(raw) || 0;
};

const formatPtBrInteger = (value: string) => {
  const n = parsePtBrNumber(value);

  return value.trim() === ''
    ? ''
    : Math.round(n).toLocaleString('pt-BR');
};

export function StoreSettingsPage() {
  const { profile } = useAuth();

  const [store, setStore] = useState<Partial<Store>>({});
  const [logo, setLogo] = useState<File | null>(null);
  const [banner, setBanner] = useState<File | null>(null);
  const [saved, setSaved] = useState(false);
  const [minOrderValue, setMinOrderValue] = useState('');
  const [monthlySalesGoal, setMonthlySalesGoal] = useState('');
  const [melhorEnvioConnected, setMelhorEnvioConnected] = useState(false);
  const [melhorEnvioChecking, setMelhorEnvioChecking] = useState(true);
  const [melhorEnvioConnecting, setMelhorEnvioConnecting] = useState(false);
  const [melhorEnvioMessage, setMelhorEnvioMessage] = useState('');
  const [shippingProductsMissing, setShippingProductsMissing] = useState(0);

  useEffect(() => {
    if (!profile?.storeId) return;

    const storeId = profile.storeId;
        async function loadMelhorEnvio() {
      setMelhorEnvioChecking(true);

      try {
        const statusFn = httpsCallable(
          functions,
          'getMelhorEnvioStatus'
        );

        const result: any = await statusFn({
          storeId: storeId
        });

        setMelhorEnvioConnected(result.data?.connected === true);

        if (result.data?.connected === true) {
          setStore(current => ({
            ...current,
            melhorEnvioConnected: true,
            melhorEnvioEnvironment: 'production'
          }));
        }
      } catch (error) {
        console.error('Erro ao verificar Melhor Envio:', error);
        setMelhorEnvioConnected(false);
      } finally {
        setMelhorEnvioChecking(false);
      }
    }

    async function loadShippingProducts() {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'products'),
            where('storeId', '==', storeId)
          )
        );

        let missing = 0;

        snap.forEach(productDoc => {
          const product: any = productDoc.data();

          // Contar apenas produtos ativos e explicitamente disponíveis
          // para envio pelo Melhor Envio.
          if (product.active === false) return;
          if (product.availableForShipping !== true) return;

          // Considerar somente os campos usados pelo cálculo de frete.
          const weight = Number(product.shippingWeightGrams ?? 0);
          const width = Number(product.shippingWidthCm ?? 0);
          const height = Number(product.shippingHeightCm ?? 0);
          const length = Number(product.shippingLengthCm ?? 0);

          const hasCompleteShippingData =
            Number.isFinite(weight) && weight > 0 &&
            Number.isFinite(width) && width > 0 &&
            Number.isFinite(height) && height > 0 &&
            Number.isFinite(length) && length > 0;

          if (!hasCompleteShippingData) {
            missing++;
          }
        });

        setShippingProductsMissing(missing);
      } catch (error) {
        console.error(
          'Erro ao verificar dados de envio dos produtos:',
          error
        );
      }
    }

    loadMelhorEnvio();
    loadShippingProducts();


    getDoc(doc(db, 'stores', profile.storeId)).then(s => {
      if (!s.exists()) return;

      const data = {
        id: s.id,
        ...s.data()
      } as Store;

      setStore(data);

      setMinOrderValue(
        data.minOrderValue == null
          ? ''
          : String(data.minOrderValue)
      );

      setMonthlySalesGoal(
        data.monthlySalesGoal == null
          ? ''
          : String(data.monthlySalesGoal)
      );
    });
  }, [profile?.storeId]);


  async function save(e: FormEvent) {
    e.preventDefault();

    if (!profile?.storeId) return;

    let logoUrl = store.logoUrl || '';

    if (logo) {
      const r = ref(
        storage,
        `stores/${profile.storeId}/brand/logo-${Date.now()}`
      );

      await uploadBytes(r, logo);
      logoUrl = await getDownloadURL(r);
    }

    let bannerUrl = store.bannerUrl || '';

    if (banner) {
      const b = ref(
        storage,
        `stores/${profile.storeId}/brand/banner-${Date.now()}`
      );

      await uploadBytes(b, banner);
      bannerUrl = await getDownloadURL(b);
    }

    const data = {
      name: store.name || '',
      description: store.description || '',
      whatsapp: (store.whatsapp || '').replace(/\D/g, ''),
      instagram: store.instagram || '',
      address: store.address || '',
      shippingOriginCep: String(store.shippingOriginCep || '').replace(/\D/g, '').slice(0, 8),
      primaryColor: store.primaryColor || '#6d5dfc',
      logoUrl,
      bannerUrl,
      bannerText: store.bannerText || '',
      businessHours: store.businessHours || '',
      showStock: store.showStock !== false,

      minOrderValue:
        minOrderValue.trim() === ''
          ? 0
          : Number(minOrderValue.replace(',', '.')) || 0,

      preparationTime: store.preparationTime || '',
      orderPrefix: store.orderPrefix || '',
      returnPolicy: store.returnPolicy || '',
      supportPhone: store.supportPhone || '',

      monthlySalesGoal:
        parsePtBrNumber(monthlySalesGoal),
      catalogAccessEnabled: store.catalogAccessEnabled === true
    };

    await updateDoc(
      doc(db, 'stores', profile.storeId),
      data
    );

    setStore({
      ...store,
      ...data
    });

    setSaved(true);
  }

  async function connectMelhorEnvio() {
  if (!profile?.storeId || melhorEnvioConnecting) return;

  setMelhorEnvioConnecting(true);
  setMelhorEnvioMessage('');

  try {
    const startFn = httpsCallable(
      functions,
      'startMelhorEnvioAuthorization'
    );

    const result: any = await startFn({
      storeId: profile.storeId
    });

    const url = String(result.data?.url || '');

    if (!url) {
      throw new Error(
        'Não foi possível iniciar a autorização do Melhor Envio.'
      );
    }

    window.location.href = url;
  } catch (error: any) {
    console.error('Erro ao conectar Melhor Envio:', error);

    setMelhorEnvioMessage(
      error?.message?.replace('FirebaseError: ', '') ||
        'Não foi possível iniciar a conexão com o Melhor Envio.'
    );

    setMelhorEnvioConnecting(false);
  }
}

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Minha loja</h1>
          <p>Deixe a vitrine com a identidade da sua marca.</p>
        </div>
      </div>

      <div className="panel">
        <form onSubmit={save} className="form-grid">

          <label>
            Nome da marca
            <input
              value={store.name || ''}
              onChange={e =>
                setStore({
                  ...store,
                  name: e.target.value
                })
              }
            />
          </label>

          <label>
            WhatsApp
            <input
              inputMode="tel"
              maxLength={18}
              placeholder="(88) 9 9999 - 9999"
              value={store.whatsapp || ''}
              onChange={e =>
                setStore({
                  ...store,
                  whatsapp: formatBrPhone(e.target.value)
                })
              }
            />
          </label>

          <label>
            Instagram
            <input
              value={store.instagram || ''}
              onChange={e =>
                setStore({
                  ...store,
                  instagram: e.target.value
                })
              }
            />
          </label>

          <label>
            Cor principal
            <input
              type="color"
              value={store.primaryColor || '#6d5dfc'}
              onChange={e =>
                setStore({
                  ...store,
                  primaryColor: e.target.value
                })
              }
            />
          </label>

          <label>
            Logo
            <input
              type="file"
              accept="image/*"
              onChange={e =>
                setLogo(e.target.files?.[0] || null)
              }
            />
          </label>

          <label>
            Banner da loja
            <input
              type="file"
              accept="image/*"
              onChange={e =>
                setBanner(e.target.files?.[0] || null)
              }
            />
          </label>

          <label className="span-2">
            Texto de destaque
            <input
              value={store.bannerText || ''}
              onChange={e =>
                setStore({
                  ...store,
                  bannerText: e.target.value
                })
              }
              placeholder="Ex.: Entrega rápida e ofertas todos os dias"
            />
          </label>

          <label className="span-2">
            Horário de funcionamento
            <input
              value={store.businessHours || ''}
              onChange={e =>
                setStore({
                  ...store,
                  businessHours: e.target.value
                })
              }
              placeholder="Seg a Sex 08h às 18h"
            />
          </label>

          <label>
            <input
              type="checkbox"
              checked={store.showStock !== false}
              onChange={e =>
                setStore({
                  ...store,
                  showStock: e.target.checked
                })
              }
            />

            Mostrar estoque na vitrine
          </label>

          <label>
            Pedido mínimo
            <input
              type="number"
              min="0"
              step="0.01"
              value={minOrderValue}
              onChange={e =>
                setMinOrderValue(e.target.value)
              }
              placeholder="0,00"
            />
          </label>

          <label>
            Prazo médio de preparo
            <input
              value={store.preparationTime || ''}
              onChange={e =>
                setStore({
                  ...store,
                  preparationTime: e.target.value
                })
              }
              placeholder="Ex.: 30 a 45 minutos"
            />
          </label>

          <label>
            Telefone de suporte
            <input
              value={store.supportPhone || ''}
              onChange={e =>
                setStore({
                  ...store,
                  supportPhone: e.target.value
                })
              }
            />
          </label>

          <label>
            Meta mensal de vendas
            <input
              type="text"
              inputMode="numeric"
              value={monthlySalesGoal}
              onChange={e =>
                setMonthlySalesGoal(
                  e.target.value.replace(/[^0-9.,]/g, '')
                )
              }
              onBlur={() =>
                setMonthlySalesGoal(v =>
                  formatPtBrInteger(v)
                )
              }
              placeholder="Ex.: 1.000"
            />
          </label>

          <label>
            Prefixo dos pedidos
            <input
              maxLength={6}
              value={store.orderPrefix || ''}
              onChange={e =>
                setStore({
                  ...store,
                  orderPrefix:
                    e.target.value.toUpperCase()
                })
              }
              placeholder="Ex.: LOJA"
            />
          </label>

          <label className="span-2">
            Política de trocas/devoluções
            <textarea
              className="return-policy-textarea"
              rows={6}
              value={store.returnPolicy || ''}
              onChange={e => {
                setStore({
                  ...store,
                  returnPolicy: e.target.value
                });

                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
              onFocus={e => {
                e.currentTarget.style.height = 'auto';
                e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
              }}
              placeholder="Informe as condições da sua loja"
            />
          </label>

          <label className="span-2">
            Descrição
            <textarea
              value={store.description || ''}
              onChange={e =>
                setStore({
                  ...store,
                  description: e.target.value
                })
              }
            />
          </label>

          <label className="span-2">
            Endereço
            <input
              value={store.address || ''}
              onChange={e =>
                setStore({
                  ...store,
                  address: e.target.value
                })
              }
            />
          </label>

          <button type="submit">
            Salvar alterações
          </button>

          {saved && <span>Salvo ✓</span>}

        </form>
      </div>


<div className="panel melhor-envio-panel">
  <div className="melhor-envio-header">
    <div>
      <h2>Envio para outros locais</h2>

      <p className="muted">
        Use o Melhor Envio para calcular automaticamente
        transportadora, modalidade, prazo e valor do frete no checkout.
      </p>
    </div>

    {!melhorEnvioChecking && (
      <span
        className={
          melhorEnvioConnected
            ? 'melhor-envio-status connected'
            : 'melhor-envio-status'
        }
      >
        {melhorEnvioConnected
          ? '✓ Conectado'
          : 'Não conectado'}
      </span>
    )}
  </div>

  <div className="melhor-envio-content">

    <div className="melhor-envio-origin">
      <label>
        CEP de origem dos envios

        <input
          inputMode="numeric"
          maxLength={9}
          value={String(store.shippingOriginCep || '')
            .replace(/\D/g, '')
            .replace(/(\d{5})(\d{1,3})/, '$1-$2')
            .slice(0, 9)}
          onChange={e =>
            setStore({
              ...store,
              shippingOriginCep: e.target.value
                .replace(/\D/g, '')
                .slice(0, 8)
            })
          }
          placeholder="Ex.: 63800-000"
        />
      </label>

      <small>
        É o CEP de onde os pedidos serão enviados.
        Ele será usado nas cotações do Melhor Envio.
      </small>
    </div>

    <div className="melhor-envio-info">
      <strong>Antes de ativar o envio</strong>

      <p>
        Os produtos enviados precisam ter peso, largura, altura e
        comprimento da embalagem preenchidos em Produtos.
        Essas informações determinam a cotação do frete.
      </p>

      {shippingProductsMissing > 0 && (
        <div className="melhor-envio-warning">
          ⚠️ {shippingProductsMissing} produto(s) ativo(s) ainda
          precisam dessas informações.
        </div>
      )}

      {shippingProductsMissing === 0 && (
        <div className="melhor-envio-success">
          ✓ Todos os produtos disponíveis para envio possuem
          peso e dimensões cadastrados.
        </div>
      )}
    </div>

    <div className="melhor-envio-footer">
      <div>
        <strong>Melhor Envio</strong>

        <span>
          Ambiente: Produção
        </span>
      </div>

      <button
        type="button"
        className="secondary-btn"
        onClick={connectMelhorEnvio}
        disabled={melhorEnvioConnecting}
      >
        {melhorEnvioConnecting
          ? 'Conectando...'
          : melhorEnvioConnected
            ? 'Reconectar Melhor Envio'
            : 'Vincular Melhor Envio'}
      </button>
    </div>

    {melhorEnvioMessage && (
      <div className="error-text">
        {melhorEnvioMessage}
      </div>
    )}
  </div>
</div>
    </>
  );
}
