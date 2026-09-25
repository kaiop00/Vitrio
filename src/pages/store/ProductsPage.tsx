import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import {
  getDownloadURL,
  ref,
  uploadBytes
} from 'firebase/storage';
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileUp,
  ImagePlus,
  Pencil,
  Search,
  Star,
  Trash2
} from 'lucide-react';

import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUi } from '../../contexts/UiContext';
import { Category, Product } from '../../types/models';

const money = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

const blank = {
  name: '',
  sku: '',
  description: '',
  price: '',
  purchasePrice: '',
  compareAtPrice: '',
  stock: '',
  categoryId: '',
  tags: '',
  featured: false,
  flashOffer: false,
  flashStart: '',
  flashEnd: '',
  availableForPickup: true,
  availableForDelivery: true,
  maxPerOrder: '',
  variantsText: '',
  addonsText: ''
};

export function ProductsPage() {
  const { profile } = useAuth();
  const { toast, confirm: confirmAction } = useUi();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editVariantsText, setEditVariantsText] = useState('');
  const [editAddonsText, setEditAddonsText] = useState('');
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const csvRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.storeId) return;

    const a = onSnapshot(
      query(
        collection(db, 'products'),
        where('storeId', '==', profile.storeId)
      ),
      s =>
        setProducts(
          s.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as Product))
        )
    );

    const b = onSnapshot(
      query(
        collection(db, 'categories'),
        where('storeId', '==', profile.storeId)
      ),
      s =>
        setCategories(
          s.docs
            .map(d => ({
              id: d.id,
              ...d.data()
            } as Category))
            .filter(c => c.active)
        )
    );

    return () => {
      a();
      b();
    };
  }, [profile?.storeId]);

  const cats = useMemo(
    () => new Map(categories.map(c => [c.id, c.name])),
    [categories]
  );

  const filtered = useMemo(
    () =>
      products
        .filter(p => {
          const q = search.toLowerCase();

          const hit =
            !q ||
            p.name.toLowerCase().includes(q) ||
            (p.sku || '').toLowerCase().includes(q) ||
            (p.tags || []).join(' ').toLowerCase().includes(q);

          const ok =
            status === 'all' ||
            (status === 'active' && p.active) ||
            (status === 'hidden' && !p.active) ||
            (status === 'featured' && p.featured) ||
            (status === 'low' && p.stock <= 5);

          return hit && ok;
        })
        .sort(
          (a, b) =>
            Number(a.sortOrder ?? 999999999) -
              Number(b.sortOrder ?? 999999999) ||
            a.name.localeCompare(b.name)
        ),
    [products, search, status]
  );

  async function uploadImages(list: File[]) {
    if (!profile?.storeId) return [];

    const urls: string[] = [];

    for (const f of list.slice(0, 6)) {
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '-');

      const r = ref(
        storage,
        `stores/${profile.storeId}/products/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}-${safe}`
      );

      await uploadBytes(r, f);
      urls.push(await getDownloadURL(r));
    }

    return urls;
  }

  async function create(e: FormEvent) {
    e.preventDefault();

    if (!profile?.storeId) return;

    setBusy(true);
    setMsg('');

    try {
      const imageUrls = await uploadImages(files);

      const variants: any[] = parseVariants(
        form.variantsText,
        Number(form.price || 0),
        Number(form.purchasePrice || 0)
      ) as any[];

      const addonGroups = parseAddons(form.addonsText);

      const variantStock = variants.reduce(
        (sum, v) => sum + Number(v.stock || 0),
        0
      );

      const effectiveStock = variants.length ? variantStock : 0;

      await addDoc(collection(db, 'products'), {
        storeId: profile.storeId,

        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),

        price: Number(form.price) || 0,
        purchasePrice: Number(form.purchasePrice) || 0,

        compareAtPrice: form.compareAtPrice
          ? Number(form.compareAtPrice)
          : null,

        stock: effectiveStock,

        categoryId: form.categoryId || '',

        tags: form.tags
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),

        imageUrl: imageUrls[0] || '',
        imageUrls,

        active: true,
        featured: form.featured,
        flashOffer: form.flashOffer,

        flashOfferStartsAt:
          form.flashOffer && form.flashStart
            ? Timestamp.fromDate(new Date(form.flashStart))
            : null,

        flashOfferEndsAt:
          form.flashOffer && form.flashEnd
            ? Timestamp.fromDate(new Date(form.flashEnd))
            : null,

        availableForPickup: form.availableForPickup,
        availableForDelivery: form.availableForDelivery,

        maxPerOrder: form.maxPerOrder
          ? Number(form.maxPerOrder)
          : 0,

        variants,
        addonGroups,

        sortOrder: Date.now(),

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setForm(blank);
      setFiles([]);

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }

      setMsg('Produto cadastrado com sucesso.');
      toast('Produto cadastrado com sucesso.');
    } finally {
      setBusy(false);
    }
  }

  type EditableVariant = {
    name: string;
    sku: string;
    stock: string;
    price: string;
    purchasePrice: string;
  };

  const editableVariants = (): EditableVariant[] => {
    return editVariantsText
      .split(/\r?\n/)
      .map(line => {
        const [
          name = '',
          sku = '',
          stock = '0',
          price = '0',
          purchasePrice = '0'
        ] = line.split('|').map(x => x.trim());

        return {
          name,
          sku,
          stock,
          price,
          purchasePrice
        };
      })
      .filter(v => v.name);
  };

  const updateEditableVariant = (
    index: number,
    field: keyof EditableVariant,
    value: string
  ) => {
    const rows = editableVariants();

    rows[index] = {
      ...rows[index],
      [field]: value
    };

    setEditVariantsText(
      rows
        .map(
          v =>
            `${v.name} | ${v.sku} | ${v.stock} | ${v.price} | ${v.purchasePrice}`
        )
        .join('\n')
    );
  };

  const removeEditableVariant = (index: number) => {
    const rows = editableVariants().filter((_, i) => i !== index);

    setEditVariantsText(
      rows
        .map(
          v =>
            `${v.name} | ${v.sku} | ${v.stock} | ${v.price} | ${v.purchasePrice}`
        )
        .join('\n')
    );
  };

  const addEditableVariant = () => {
    const rows = editableVariants();

    rows.push({
      name: 'Nova variação',
      sku: '',
      stock: '0',
      price: String(editing?.price || 0).replace('.', ','),
      purchasePrice: String(editing?.purchasePrice || 0).replace('.', ',')
    });

    setEditVariantsText(
      rows
        .map(
          v =>
            `${v.name} | ${v.sku} | ${v.stock} | ${v.price} | ${v.purchasePrice}`
        )
        .join('\n')
    );
  };

  function openEdit(p: Product) {
    setEditing({ ...p });

    setEditVariantsText(
      serializeVariants(
        p.variants || [],
        Number(p.price || 0),
        Number(p.purchasePrice || 0)
      )
    );

    setEditAddonsText(
      serializeAddons(p.addonGroups || [])
    );
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();

    if (!editing) return;

    const variants = parseVariants(
      editVariantsText,
      Number(editing.price || 0),
      Number(editing.purchasePrice || 0)
    ) as any[];

    const addonGroups = parseAddons(editAddonsText);

    const effectiveStock = variants.length
      ? variants.reduce(
          (sum, v) => sum + Number(v.stock || 0),
          0
        )
      : Math.max(
          0,
          Number(editing.stock || 0) || 0
        );

    await updateDoc(doc(db, 'products', editing.id), {
      name: editing.name.trim(),
      sku: editing.sku || '',
      description: editing.description || '',

      price: Number(editing.price) || 0,

      purchasePrice:
        Number(editing.purchasePrice || 0) || 0,

      compareAtPrice: editing.compareAtPrice
        ? Number(editing.compareAtPrice)
        : null,

      stock: effectiveStock,

      categoryId: editing.categoryId || '',

      tags: editing.tags || [],

      active: editing.active,
      featured: !!editing.featured,
      flashOffer: !!editing.flashOffer,

      availableForPickup:
        editing.availableForPickup !== false,

      availableForDelivery:
        editing.availableForDelivery !== false,

      maxPerOrder:
        Number(editing.maxPerOrder || 0),

      variants,
      addonGroups,

      updatedAt: serverTimestamp()
    });

    setEditing(null);
    setEditVariantsText('');
    setEditAddonsText('');

    toast('Produto atualizado.');
  }

  async function duplicate(p: Product) {
    if (!profile?.storeId) return;

    const { id, ...data } = p as any;

    delete data.createdAt;
    delete data.updatedAt;

    await addDoc(collection(db, 'products'), {
      ...data,
      storeId: profile.storeId,
      name: `${p.name} (cópia)`,
      sku: p.sku ? `${p.sku}-COPIA` : '',
      active: false,
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  function exportPdf() {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const generatedAt = new Intl.DateTimeFormat(
      'pt-BR',
      {
        dateStyle: 'short',
        timeStyle: 'short'
      }
    ).format(new Date());

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);

    doc.text(
      'Vitrio - Relatorio de Produtos',
      14,
      16
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100);

    doc.text(
      `${products.length} produto(s) - Gerado em ${generatedAt}`,
      14,
      22
    );

    const rows = products.map(p => [
      p.name || '-',
      p.sku || '-',
      cats.get(p.categoryId || '') || 'Sem categoria',

      Number(p.purchasePrice || 0).toLocaleString(
        'pt-BR',
        {
          style: 'currency',
          currency: 'BRL'
        }
      ),

      Number(p.price || 0).toLocaleString(
        'pt-BR',
        {
          style: 'currency',
          currency: 'BRL'
        }
      ),

      p.compareAtPrice
        ? Number(p.compareAtPrice).toLocaleString(
            'pt-BR',
            {
              style: 'currency',
              currency: 'BRL'
            }
          )
        : '-',

      String(p.stock ?? 0),

      p.active ? 'Ativo' : 'Inativo',

      p.featured ? 'Sim' : 'Nao'
    ]);

    autoTable(doc, {
      startY: 28,

      head: [[
        'Produto',
        'SKU / codigo',
        'Categoria',
        'Compra',
        'Venda',
        'Preco anterior',
        'Estoque',
        'Status',
        'Destaque'
      ]],

      body: rows,

      theme: 'grid',

      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.5,
        overflow: 'linebreak',
        valign: 'middle'
      },

      headStyles: {
        fontStyle: 'bold'
      },

      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 25 },
        2: { cellWidth: 38 },
        3: { cellWidth: 27, halign: 'right' },
        4: { cellWidth: 27, halign: 'right' },
        5: { cellWidth: 27, halign: 'right' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 20, halign: 'center' },
        8: { cellWidth: 20, halign: 'center' }
      },

      didDrawPage: () => {
        const pageCount = doc.getNumberOfPages();

        doc.setFontSize(8);
        doc.setTextColor(120);

        doc.text(
          `Vitrio - Pagina ${pageCount}`,
          doc.internal.pageSize.getWidth() - 14,
          doc.internal.pageSize.getHeight() - 7,
          {
            align: 'right'
          }
        );
      }
    });

    doc.save('produtos-vitrio.pdf');
  }

  function exportCsv() {
    const rows = [
      [
        'nome',
        'sku',
        'preco',
        'valor_compra',
        'preco_anterior',
        'estoque',
        'categoria',
        'tags',
        'ativo',
        'destaque'
      ],

      ...products.map(p => [
        p.name,
        p.sku || '',
        p.price,
        p.purchasePrice ?? 0,
        p.compareAtPrice || '',
        p.stock,
        cats.get(p.categoryId || '') || '',
        (p.tags || []).join('|'),
        p.active ? 'sim' : 'nao',
        p.featured ? 'sim' : 'nao'
      ])
    ];

    const csv = rows
      .map(r =>
        r
          .map(v =>
            `"${String(v).replace(/"/g, '""')}"`
          )
          .join(';')
      )
      .join('\n');

    const a = document.createElement('a');

    a.href = URL.createObjectURL(
      new Blob(
        ['\ufeff' + csv],
        {
          type: 'text/csv;charset=utf-8'
        }
      )
    );

    a.download = 'produtos-vitrio.csv';
    a.click();

    URL.revokeObjectURL(a.href);
  }

  async function importCsv(
    e: ChangeEvent<HTMLInputElement>
  ) {
    const f = e.target.files?.[0];

    if (!f || !profile?.storeId) return;

    const text = await f.text();

    const lines = text
      .split(/\r?\n/)
      .filter(Boolean);

    if (lines.length < 2) return;

    const sep = lines[0].includes(';')
      ? ';'
      : ',';

    const clean = (v: string) =>
      v
        .trim()
        .replace(/^"|"$/g, '')
        .replace(/""/g, '"');

    const head = lines[0]
      .split(sep)
      .map(x => clean(x).toLowerCase());

    let count = 0;

    for (const line of lines.slice(1)) {
      const vals = line
        .split(sep)
        .map(clean);

      const obj: ObjectLiteral = {};

      head.forEach((h, i) => {
        obj[h] = vals[i] || '';
      });

      const name = String(
        obj.nome || obj.name || ''
      ).trim();

      if (!name) continue;

      const catName = String(
        obj.categoria || ''
      ).trim();

      const cat = categories.find(
        c =>
          c.name.toLowerCase() ===
          catName.toLowerCase()
      );

      await addDoc(
        collection(db, 'products'),
        {
          storeId: profile.storeId,

          name,

          sku: String(obj.sku || ''),

          description: String(
            obj.descricao || ''
          ),

          price:
            Number(
              String(
                obj.preco ||
                  obj.price ||
                  '0'
              ).replace(',', '.')
            ) || 0,

          purchasePrice:
            Number(
              String(
                obj.valor_compra ||
                  obj.preco_compra ||
                  obj.purchasePrice ||
                  '0'
              ).replace(',', '.')
            ) || 0,

          compareAtPrice:
            Number(
              String(
                obj.preco_anterior || ''
              ).replace(',', '.')
            ) || null,

          stock:
            Number(
              obj.estoque ||
                obj.stock ||
                0
            ) || 0,

          categoryId: cat?.id || '',

          tags: String(
            obj.tags || ''
          )
            .split('|')
            .map(x => x.trim())
            .filter(Boolean),

          imageUrl: '',
          imageUrls: [],

          active:
            String(
              obj.ativo || 'sim'
            ).toLowerCase() !== 'nao',

          featured:
            String(
              obj.destaque || 'nao'
            ).toLowerCase() === 'sim',

          flashOffer: false,

          sortOrder: Date.now() + count,

          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }
      );

      count++;
    }

    setMsg(
      `${count} produto(s) importado(s).`
    );

    e.target.value = '';
  }

  const stableKey = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const parseAddons = (text: string) => {
    const groups = new Map<string, any>();

    text
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
      .forEach(line => {
        const parts = line
          .split('|')
          .map(x => x.trim());

        let groupName = '';
        let optionName = '';
        let priceRaw = '0';
        let requiredRaw = '';
        let maxRaw = '1';

        if (parts.length === 1) {
          groupName = 'Cor';
          optionName = parts[0];
          requiredRaw = 'sim';
        } else {
          [
            groupName,
            optionName,
            priceRaw = '0',
            requiredRaw = '',
            maxRaw = '1'
          ] = parts as any;
        }

        if (!groupName || !optionName) return;

        const key = stableKey(groupName);

        const colorGroup = [
          'cor',
          'cores',
          'color',
          'colors'
        ].includes(key);

        const required =
          [
            'sim',
            's',
            'yes',
            '1',
            'true'
          ].includes(
            (requiredRaw || '').toLowerCase()
          ) || colorGroup;

        const max = Math.max(
          1,
          Number(maxRaw || 1) || 1
        );

        if (!groups.has(key)) {
          groups.set(key, {
            id: `group-${key}`,
            name: groupName,
            required,
            maxSelections: max,
            options: []
          });
        }

        const g = groups.get(key);

        g.required =
          g.required || required;

        g.maxSelections = Math.max(
          g.maxSelections,
          max
        );

        const optionKey =
          stableKey(optionName);

        g.options.push({
          id: `option-${key}-${optionKey}`,
          name: optionName,
          price:
            Number(
              String(
                priceRaw || '0'
              ).replace(',', '.')
            ) || 0,
          active: true
        });
      });

    return [...groups.values()];
  };

  const serializeAddons = (
    groups: any[] = []
  ) =>
    groups
      .flatMap(g =>
        (g.options || []).map(
          (o: any) =>
            `${g.name} | ${o.name} | ${Number(
              o.price || 0
            )
              .toFixed(2)
              .replace('.', ',')} | ${
              g.required ? 'sim' : 'nao'
            } | ${Number(
              g.maxSelections || 1
            )}`
        )
      )
      .join('\n');

  const serializeVariants = (
    variants: any[] = [],
    basePrice = 0,
    basePurchasePrice = 0
  ) =>
    variants
      .map(v => {
        const finalPrice = Math.max(
          0,
          Number(basePrice || 0) +
            Number(v.priceAdjustment || 0)
        );

        const purchasePrice =
          v.purchasePrice !== undefined &&
          v.purchasePrice !== null
            ? Number(v.purchasePrice || 0)
            : Number(basePurchasePrice || 0);

        return `${v.name} | ${
          v.sku || ''
        } | ${Number(v.stock || 0)} | ${finalPrice
          .toFixed(2)
          .replace('.', ',')} | ${purchasePrice
          .toFixed(2)
          .replace('.', ',')}`;
      })
      .join('\n');

  const parseVariants = (
    text: string,
    basePrice = 0,
    basePurchasePrice = 0
  ) =>
    text
      .split(/\r?\n/)
      .map(line => {
        const [
          name,
          sku,
          stock,
          finalPriceRaw,
          purchasePriceRaw
        ] = line
          .split('|')
          .map(x => x.trim());

        if (!name) return null;

        const parsedFinal =
          finalPriceRaw === undefined ||
          finalPriceRaw === ''
            ? Number(basePrice || 0)
            : Number(
                String(
                  finalPriceRaw ||
                    basePrice ||
                    0
                ).replace(',', '.')
              );

        const finalPrice =
          Number.isFinite(parsedFinal)
            ? Math.max(0, parsedFinal)
            : Number(basePrice || 0);

        const parsedPurchase =
          purchasePriceRaw === undefined ||
          purchasePriceRaw === ''
            ? Number(basePurchasePrice || 0)
            : Number(
                String(
                  purchasePriceRaw || 0
                ).replace(',', '.')
              );

        const purchasePrice =
          Number.isFinite(parsedPurchase)
            ? Math.max(0, parsedPurchase)
            : Number(basePurchasePrice || 0);

        return {
          id: `variant-${stableKey(
            name
          )}-${stableKey(sku || name)}`,

          name,

          sku: sku || '',

          stock: Math.max(
            0,
            Number(stock || 0)
          ),

          priceAdjustment:
            finalPrice -
            Number(basePrice || 0),

          purchasePrice,

          active: true
        };
      })
      .filter(Boolean);

  const offerStatus = (p: Product) => {
    if (!p.flashOffer) return '';

    const now = Date.now();

    const st =
      p.flashOfferStartsAt
        ?.toDate?.()
        ?.getTime?.() || 0;

    const en =
      p.flashOfferEndsAt
        ?.toDate?.()
        ?.getTime?.() || 0;

    if (st && st > now) return 'Agendada';

    if (en && en < now) return 'Encerrada';

    return 'Ativa';
  };

  async function bulkUpdate(
    data: Record<string, unknown>
  ) {
    if (selected.length === 0) return;

    setBusy(true);

    try {
      await Promise.all(
        selected.map(id =>
          updateDoc(
            doc(db, 'products', id),
            {
              ...data,
              updatedAt:
                serverTimestamp()
            }
          )
        )
      );

      setMsg(
        `${selected.length} produto(s) atualizado(s).`
      );

      setSelected([]);
    } finally {
      setBusy(false);
    }
  }

  async function moveProduct(
    p: Product,
    direction: -1 | 1
  ) {
    const ordered = [...products].sort(
      (a, b) =>
        Number(
          a.sortOrder ?? 999999999
        ) -
          Number(
            b.sortOrder ?? 999999999
          ) ||
        a.name.localeCompare(b.name)
    );

    const index = ordered.findIndex(
      x => x.id === p.id
    );

    const next = index + direction;

    if (
      index < 0 ||
      next < 0 ||
      next >= ordered.length
    ) {
      return;
    }

    const [item] =
      ordered.splice(index, 1);

    ordered.splice(next, 0, item);

    await Promise.all(
      ordered.map((x, i) =>
        updateDoc(
          doc(db, 'products', x.id),
          {
            sortOrder: i + 1,
            updatedAt:
              serverTimestamp()
          }
        )
      )
    );
  }

  async function bulkDelete() {
    if (selected.length === 0) return;

    const ok = await confirmAction({
      title: 'Excluir produtos',
      message: `Excluir ${selected.length} produto(s)? Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      danger: true
    });

    if (!ok) return;

    setBusy(true);

    try {
      await Promise.all(
        selected.map(id =>
          deleteDoc(
            doc(db, 'products', id)
          )
        )
      );

      setMsg(
        `${selected.length} produto(s) excluído(s).`
      );

      toast(
        `${selected.length} produto(s) excluído(s).`
      );

      setSelected([]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Produtos</h1>

          <p>
            Catálogo organizado, estoque,
            variações, valores de compra,
            destaques e ordem de exibição
            em um só lugar.
          </p>
        </div>

        <div className="page-actions">
          <input
            ref={csvRef}
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={importCsv}
          />

          <button
            className="secondary-btn"
            onClick={() =>
              csvRef.current?.click()
            }
          >
            <FileUp size={17} />
            Importar CSV
          </button>

          <button
            className="secondary-btn"
            onClick={exportCsv}
          >
            <Download size={17} />
            Exportar CSV
          </button>

          <button
            className="secondary-btn"
            onClick={exportPdf}
          >
            <Download size={17} />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="panel">
        <form
          onSubmit={create}
          className="form-grid"
        >
          <label>
            Nome

            <input
              value={form.name}
              onChange={e =>
                setForm({
                  ...form,
                  name: e.target.value
                })
              }
              required
            />
          </label>

          <label>
            SKU / código

            <input
              value={form.sku}
              onChange={e =>
                setForm({
                  ...form,
                  sku:
                    e.target.value.toUpperCase()
                })
              }
              placeholder="Ex.: CAM-001"
            />
          </label>

          <label>
            Categoria

            <select
              value={form.categoryId}
              onChange={e =>
                setForm({
                  ...form,
                  categoryId: e.target.value
                })
              }
            >
              <option value="">
                Sem categoria
              </option>

              {categories.map(c => (
                <option
                  key={c.id}
                  value={c.id}
                >
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Preço de venda

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={e =>
                setForm({
                  ...form,
                  price: e.target.value
                })
              }
              required
            />

            <small className="field-help">
              Valor que o cliente pagará pelo
              produto quando não houver uma
              variação com preço diferente.
            </small>
          </label>

          <label>
            Valor de compra

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.purchasePrice}
              onChange={e =>
                setForm({
                  ...form,
                  purchasePrice:
                    e.target.value
                })
              }
              placeholder="Ex.: 30,00"
            />

            <small className="field-help">
              Quanto você paga para adquirir
              uma unidade. Usado para calcular
              o capital investido e o lucro
              potencial do estoque.
            </small>
          </label>

          <label>
            Preço anterior

            <input
              type="number"
              min="0"
              step="0.01"
              value={form.compareAtPrice}
              onChange={e =>
                setForm({
                  ...form,
                  compareAtPrice:
                    e.target.value
                })
              }
            />
          </label>

          <label className="span-2">
            Fotos (até 6)

            <div className="file-drop">
              <ImagePlus size={20} />

              <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={e =>
                  setFiles(
                    Array.from(
                      e.target.files || []
                    ).slice(0, 6)
                  )
                }
              />

              <span>
                {files.length
                  ? `${files.length} foto(s) selecionada(s)`
                  : 'Escolha imagens do produto'}
              </span>
            </div>
          </label>

          <label className="span-2">
            Tags

            <input
              value={form.tags}
              onChange={e =>
                setForm({
                  ...form,
                  tags: e.target.value
                })
              }
              placeholder="Ex.: verão, presente, lançamento"
            />
          </label>

          <label>
            Limite por pedido

            <input
              type="number"
              min="0"
              value={form.maxPerOrder}
              onChange={e =>
                setForm({
                  ...form,
                  maxPerOrder:
                    e.target.value
                })
              }
              placeholder="0 = sem limite"
            />
          </label>

          <label className="span-2">
            Variações (opcional)

            <textarea
              rows={5}
              value={form.variantsText}
              onChange={e =>
                setForm({
                  ...form,
                  variantsText:
                    e.target.value
                })
              }
              placeholder={
                'Uma por linha: Nome | SKU | Estoque | Preço de venda | Valor de compra\nEx.: Tamanho P | CAM-P | 8 | 45,00 | 25,00\nTamanho M | CAM-M | 10 | 50,00 | 28,00\nTamanho G | CAM-G | 5 | 55,00 | 30,00'
              }
            />

            <small>
              Informe estoque, preço de venda e
              valor de compra de cada variação.
              O estoque total será a soma das
              variações.
            </small>
          </label>

          <label className="span-2">
            Opções do produto (cores e adicionais)

            <textarea
              rows={5}
              value={form.addonsText}
              onChange={e =>
                setForm({
                  ...form,
                  addonsText:
                    e.target.value
                })
              }
              placeholder={
                'Uma opção por linha: Grupo | Opção | Preço | Obrigatório | Máximo\nEx.: Cor | Azul | 0 | sim | 1\nEmbalagem | Presente | 5,00 | nao | 1'
              }
            />

            <small>
              Para cores, você pode digitar
              apenas uma por linha (Azul, Preto,
              Verde). Também aceita o formato
              completo: Cor | Azul | 0 | sim | 1.
            </small>
          </label>

          <div className="fulfillment-product-options">
            <label className="check-line">
              <input
                type="checkbox"
                checked={
                  form.availableForPickup
                }
                onChange={e =>
                  setForm({
                    ...form,
                    availableForPickup:
                      e.target.checked
                  })
                }
              />

              Disponível para retirada
            </label>

            <label className="check-line">
              <input
                type="checkbox"
                checked={
                  form.availableForDelivery
                }
                onChange={e =>
                  setForm({
                    ...form,
                    availableForDelivery:
                      e.target.checked
                  })
                }
              />

              Disponível para entrega
            </label>
          </div>

          <label className="span-2">
            Descrição

            <textarea
              value={form.description}
              onChange={e =>
                setForm({
                  ...form,
                  description:
                    e.target.value
                })
              }
            />
          </label>

          <label className="check-line">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={e =>
                setForm({
                  ...form,
                  featured:
                    e.target.checked
                })
              }
            />

            <Star size={18} />

            Produto em destaque
          </label>

          <label className="check-line">
            <input
              type="checkbox"
              checked={form.flashOffer}
              onChange={e =>
                setForm({
                  ...form,
                  flashOffer:
                    e.target.checked
                })
              }
            />

            <BadgePercent size={18} />

            Oferta relâmpago
          </label>

          {form.flashOffer && (
            <div className="span-2 flash-dates">
              <label>
                Início da oferta

                <input
                  type="datetime-local"
                  value={form.flashStart}
                  onChange={e =>
                    setForm({
                      ...form,
                      flashStart:
                        e.target.value
                    })
                  }
                />
              </label>

              <label>
                Fim da oferta

                <input
                  type="datetime-local"
                  value={form.flashEnd}
                  onChange={e =>
                    setForm({
                      ...form,
                      flashEnd:
                        e.target.value
                    })
                  }
                />
              </label>
            </div>
          )}

          <button
            className="primary-btn"
            disabled={busy}
          >
            {busy
              ? 'Salvando...'
              : 'Cadastrar produto'}
          </button>

          {msg && (
            <span className="success-inline">
              {msg}
            </span>
          )}
        </form>
      </div>

      <div className="catalog-admin-toolbar">
        <label className="search-box">
          <Search size={17} />

          <input
            placeholder="Buscar por nome, SKU ou tag"
            value={search}
            onChange={e =>
              setSearch(e.target.value)
            }
          />
        </label>

        <select
          value={status}
          onChange={e =>
            setStatus(e.target.value)
          }
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="hidden">Ocultos</option>
          <option value="featured">
            Destaques
          </option>
          <option value="low">
            Estoque baixo
          </option>
        </select>

        <span>
          {filtered.length} de{' '}
          {products.length}
        </span>
      </div>

      <div className="bulk-select-row">
        <label>
          <input
            type="checkbox"
            checked={
              filtered.length > 0 &&
              filtered.every(p =>
                selected.includes(p.id)
              )
            }
            onChange={e =>
              setSelected(
                e.target.checked
                  ? Array.from(
                      new Set([
                        ...selected,
                        ...filtered.map(
                          p => p.id
                        )
                      ])
                    )
                  : selected.filter(
                      id =>
                        !filtered.some(
                          p => p.id === id
                        )
                    )
              )
            }
          />

          Selecionar itens visíveis
        </label>

        {selected.length > 0 && (
          <div className="bulk-actions">
            <strong>
              {selected.length} selecionado(s)
            </strong>

            <button
              onClick={() =>
                bulkUpdate({
                  active: true
                })
              }
            >
              Ativar
            </button>

            <button
              onClick={() =>
                bulkUpdate({
                  active: false
                })
              }
            >
              Ocultar
            </button>

            <button
              onClick={() =>
                bulkUpdate({
                  featured: true
                })
              }
            >
              Destacar
            </button>

            <button
              onClick={() =>
                bulkUpdate({
                  featured: false
                })
              }
            >
              Remover destaque
            </button>

            <button
              className="danger-text"
              onClick={bulkDelete}
            >
              Excluir
            </button>
          </div>
        )}
      </div>

      <div className="product-grid">
        {filtered.map(p => (
          <div
            className={`product-card admin-product ${
              selected.includes(p.id)
                ? 'selected-product-card'
                : ''
            }`}
            key={p.id}
          >
            <label className="product-select">
              <input
                type="checkbox"
                checked={selected.includes(
                  p.id
                )}
                onChange={e =>
                  setSelected(v =>
                    e.target.checked
                      ? [...v, p.id]
                      : v.filter(
                          id => id !== p.id
                        )
                  )
                }
              />
            </label>

            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.name}
              />
            ) : (
              <div className="product-placeholder">
                V
              </div>
            )}

            <div className="product-info">
              <div className="product-flags">
                {p.featured && (
                  <span className="featured-chip">
                    <Star size={12} />
                    Destaque
                  </span>
                )}

                {p.flashOffer && (
                  <span className="offer-chip">
                    {offerStatus(p)}
                  </span>
                )}

                <span
                  className={
                    p.active
                      ? 'status-chip ok'
                      : 'status-chip'
                  }
                >
                  {p.active
                    ? 'Ativo'
                    : 'Oculto'}
                </span>
              </div>

              <h3>{p.name}</h3>

              <small>
                {p.sku
                  ? `SKU ${p.sku} · `
                  : ''}

                {p.categoryId
                  ? cats.get(
                      p.categoryId
                    ) ||
                    'Categoria removida'
                  : 'Sem categoria'}
              </small>

              <p>
                Venda:{' '}
                <strong>
                  {money(
                    Number(p.price || 0)
                  )}
                </strong>
              </p>

              <small>
                Compra:{' '}
                <strong>
                  {money(
                    Number(
                      p.purchasePrice || 0
                    )
                  )}
                </strong>
              </small>

              <div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginTop: '8px',
    marginBottom: '12px'
  }}
>
  <div
    style={{
      display: 'block',
      lineHeight: '1.5'
    }}
  >
    <small>
      {p.stock} em estoque
    </small>
  </div>

  {(p.variants || []).length > 0 && (
    <div
      style={{
        display: 'block',
        lineHeight: '1.5'
      }}
    >
      <small>
        {p.variants!.length} variação(ões)
      </small>
    </div>
  )}

  {(p.addonGroups || []).length > 0 && (
    <div
      style={{
        display: 'block',
        lineHeight: '1.5'
      }}
    >
      <small>
        {p.addonGroups!.length} grupo(s) de opcionais
      </small>
    </div>
  )}
</div> 

              {(p.tags || []).length >
                0 && (
                <div className="mini-tags">
                  {p.tags!.slice(0, 3).map(
                    t => (
                      <span key={t}>
                        {t}
                      </span>
                    )
                  )}
                </div>
              )}

              <div className="product-actions">
                <button
                  className="icon-btn"
                  title="Mover para cima"
                  onClick={() =>
                    moveProduct(p, -1)
                  }
                >
                  <ArrowUp size={17} />
                </button>

                <button
                  className="icon-btn"
                  title="Mover para baixo"
                  onClick={() =>
                    moveProduct(p, 1)
                  }
                >
                  <ArrowDown size={17} />
                </button>

                <button
                  className="icon-btn"
                  title="Editar"
                  onClick={() =>
                    openEdit(p)
                  }
                >
                  <Pencil size={17} />
                </button>

                <button
                  className="icon-btn"
                  title="Duplicar"
                  onClick={() =>
                    duplicate(p)
                  }
                >
                  <Copy size={17} />
                </button>

                <button
                  className="icon-btn"
                  title={
                    p.featured
                      ? 'Remover destaque'
                      : 'Destacar'
                  }
                  onClick={() =>
                    updateDoc(
                      doc(
                        db,
                        'products',
                        p.id
                      ),
                      {
                        featured:
                          !p.featured,
                        updatedAt:
                          serverTimestamp()
                      }
                    )
                  }
                >
                  <Star size={17} />
                </button>

                <button
                  className="icon-btn"
                  title={
                    p.active
                      ? 'Ocultar'
                      : 'Exibir'
                  }
                  onClick={() =>
                    updateDoc(
                      doc(
                        db,
                        'products',
                        p.id
                      ),
                      {
                        active: !p.active,
                        updatedAt:
                          serverTimestamp()
                      }
                    )
                  }
                >
                  {p.active ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>

                <button
                  className="icon-btn danger-btn"
                  title="Excluir"
                  onClick={async () => {
                    const ok =
                      await confirmAction({
                        title:
                          'Excluir produto',
                        message: `Excluir ${p.name}? Esta ação não pode ser desfeita.`,
                        confirmLabel:
                          'Excluir',
                        danger: true
                      });

                    if (ok) {
                      await deleteDoc(
                        doc(
                          db,
                          'products',
                          p.id
                        )
                      );

                      toast(
                        'Produto excluído.'
                      );
                    }
                  }}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="catalog-empty">
            <Search />

            <h3>
              Nenhum produto nesse filtro
            </h3>

            <p>
              Altere a busca ou o filtro
              de status.
            </p>
          </div>
        )}
      </div>

      {editing && (
        <div
          className="modal-backdrop"
          onMouseDown={() => {
            setEditing(null);
            setEditVariantsText('');
            setEditAddonsText('');
          }}
        >
          <div
            className="modal-card"
            onMouseDown={e =>
              e.stopPropagation()
            }
          >
            <div className="drawer-head">
              <div>
                <h2>
                  Editar produto
                </h2>

                <small>
                  Atualize os dados principais
                  do item.
                </small>
              </div>

              <button
                onClick={() => {
                  setEditing(null);
                  setEditVariantsText('');
                  setEditAddonsText('');
                }}
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveEdit}
              className="form-grid"
            >
              <label>
                Nome

                <input
                  value={editing.name}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      name: e.target.value
                    })
                  }
                />
              </label>

              <label>
                SKU

                <input
                  value={editing.sku || ''}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      sku:
                        e.target.value.toUpperCase()
                    })
                  }
                />
              </label>

              <label>
                Categoria

                <select
                  value={
                    editing.categoryId ||
                    ''
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      categoryId:
                        e.target.value
                    })
                  }
                >
                  <option value="">
                    Sem categoria
                  </option>

                  {categories.map(c => (
                    <option
                      key={c.id}
                      value={c.id}
                    >
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Preço de venda

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    editing.price ?? ''
                  }
                  onFocus={e =>
                    e.currentTarget.select()
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      price:
                        Number(
                          e.target.value
                        ) || 0
                    })
                  }
                />

                <small className="field-help">
                  Preço padrão de venda do
                  produto.
                </small>
              </label>

              {/* CORREÇÃO: valor de compra vazio quando for 0 */}
              <label>
                Valor de compra

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    editing.purchasePrice &&
                    Number(editing.purchasePrice) > 0
                      ? editing.purchasePrice
                      : ''
                  }
                  placeholder="Ex.: 30,00"
                  onFocus={e =>
                    e.currentTarget.select()
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      purchasePrice:
                        e.target.value === ''
                          ? undefined
                          : Number(e.target.value)
                    })
                  }
                />

                <small className="field-help">
                  Quanto você paga por uma
                  unidade. Esse valor será usado
                  nos cálculos financeiros do
                  estoque.
                </small>
              </label>

              <label>
                Preço anterior

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    editing.compareAtPrice ||
                    ''
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      compareAtPrice:
                        e.target.value
                          ? Number(
                              e.target.value
                            )
                          : undefined
                    })
                  }
                />
              </label>

              <div className="stock-managed-note">
                <strong>
                  Estoque: {editing.stock}
                </strong>

                <small>
                  {editVariantsText.trim()
                    ? 'Calculado pela soma das variações abaixo.'
                    : 'Gerencie a quantidade pela página Estoque.'}
                </small>
              </div>

              <label className="span-2">
                Tags

                <input
                  value={(
                    editing.tags || []
                  ).join(', ')}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      tags: e.target.value
                        .split(',')
                        .map(x =>
                          x.trim()
                        )
                        .filter(Boolean)
                    })
                  }
                />
              </label>

              <label className="check-line">
                <input
                  type="checkbox"
                  checked={
                    editing.active
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      active:
                        e.target.checked
                    })
                  }
                />

                Produto ativo
              </label>

              <label className="check-line">
                <input
                  type="checkbox"
                  checked={
                    !!editing.featured
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      featured:
                        e.target.checked
                    })
                  }
                />

                Produto em destaque
              </label>

              <label>
                Limite por pedido

                <input
                  type="number"
                  min="0"
                  value={
                    editing.maxPerOrder ||
                    ''
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      maxPerOrder:
                        Number(
                          e.target.value
                        ) || 0
                    })
                  }
                  placeholder="0 = sem limite"
                />
              </label>

              <div className="span-2 variant-editor">
                <div className="variant-editor-head">
                  <div>
                    <strong>
                      Variações, preços e custos
                    </strong>

                    <small>
                      Defina estoque, preço de
                      venda e valor de compra de
                      cada opção.
                    </small>
                  </div>

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={
                      addEditableVariant
                    }
                  >
                    + Adicionar variação
                  </button>
                </div>

                {editableVariants()
                  .length > 0 ? (
                  <div className="variant-editor-list">
                    {editableVariants().map(
                      (
                        variant,
                        index
                      ) => (
                        <div
                          className="variant-edit-row"
                          key={index}
                        >
                          <label className="variant-name">
                            <span>
                              Variação
                            </span>

                            <input
                              value={
                                variant.name
                              }
                              onChange={e =>
                                updateEditableVariant(
                                  index,
                                  'name',
                                  e.target.value
                                )
                              }
                              placeholder="Ex.: Tamanho P"
                            />
                          </label>

                          <label className="variant-sku">
                            <span>
                              SKU{' '}
                              <small>
                                opcional
                              </small>
                            </span>

                            <input
                              value={
                                variant.sku
                              }
                              onChange={e =>
                                updateEditableVariant(
                                  index,
                                  'sku',
                                  e.target.value
                                )
                              }
                              placeholder="Ex.: CAM-P"
                            />
                          </label>

                          <label className="variant-stock">
                            <span>
                              Estoque
                            </span>

                            <input
                              type="number"
                              min="0"
                              value={
                                variant.stock
                              }
                              onFocus={e =>
                                e.currentTarget.select()
                              }
                              onChange={e =>
                                updateEditableVariant(
                                  index,
                                  'stock',
                                  e.target.value
                                )
                              }
                            />
                          </label>

                          <label className="variant-price">
                            <span>
                              Preço de venda
                            </span>

                            <div className="money-input">
                              <span>
                                R$
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={variant.price.replace(
                                  ',',
                                  '.'
                                )}
                                onFocus={e =>
                                  e.currentTarget.select()
                                }
                                onChange={e =>
                                  updateEditableVariant(
                                    index,
                                    'price',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </label>

                          {/* CORREÇÃO: valor de compra da variação vazio quando for 0 */}
                          <label className="variant-price">
                            <span>
                              Valor de compra
                            </span>

                            <div className="money-input">
                              <span>
                                R$
                              </span>

                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  Number(
                                    variant.purchasePrice.replace(
                                      ',',
                                      '.'
                                    )
                                  ) > 0
                                    ? variant.purchasePrice.replace(
                                        ',',
                                        '.'
                                      )
                                    : ''
                                }
                                placeholder="Ex.: 25,00"
                                onFocus={e =>
                                  e.currentTarget.select()
                                }
                                onChange={e =>
                                  updateEditableVariant(
                                    index,
                                    'purchasePrice',
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </label>

                          <button
                            type="button"
                            className="variant-remove"
                            onClick={() =>
                              removeEditableVariant(
                                index
                              )
                            }
                            title="Remover variação"
                            aria-label={`Remover ${variant.name}`}
                          >
                            ×
                          </button>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="variant-empty">
                    <strong>
                      Este produto não possui
                      variações.
                    </strong>

                    <small>
                      Adicione tamanhos, modelos
                      ou outras opções somente
                      quando necessário.
                    </small>
                  </div>
                )}

                {editableVariants()
                  .length > 0 && (
                  <div className="variant-summary">
                    <span>
                      Estoque total

                      <strong>
                        {editableVariants().reduce(
                          (sum, v) =>
                            sum +
                            (Number(
                              v.stock
                            ) || 0),
                          0
                        )}
                      </strong>
                    </span>

                    <span>
                      Variações

                      <strong>
                        {
                          editableVariants()
                            .length
                        }
                      </strong>
                    </span>

                    <span>
                      Custo estimado

                      <strong>
                        {money(
                          editableVariants().reduce(
                            (
                              sum,
                              v
                            ) =>
                              sum +
                              (Number(
                                v.stock
                              ) || 0) *
                                (Number(
                                  String(
                                    v.purchasePrice ||
                                      '0'
                                  ).replace(
                                    ',',
                                    '.'
                                  )
                                ) || 0),
                            0
                          )
                        )}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <label className="span-2">
                Opções do produto (cores e adicionais)

                <textarea
                  rows={5}
                  value={
                    editAddonsText
                  }
                  onChange={e =>
                    setEditAddonsText(
                      e.target.value
                    )
                  }
                  placeholder={
                    'Uma cor por linha: Azul\nPreto\nVerde\nou formato completo: Cor | Azul | 0 | sim | 1'
                  }
                />

                <small>
                  Cores simples são agrupadas
                  automaticamente como “Cor” e
                  exigem uma escolha do cliente.
                </small>
              </label>

              <div className="fulfillment-product-options">
                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={
                      editing.availableForPickup !==
                      false
                    }
                    onChange={e =>
                      setEditing({
                        ...editing,
                        availableForPickup:
                          e.target.checked
                      })
                    }
                  />

                  Disponível para retirada
                </label>

                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={
                      editing.availableForDelivery !==
                      false
                    }
                    onChange={e =>
                      setEditing({
                        ...editing,
                        availableForDelivery:
                          e.target.checked
                      })
                    }
                  />

                  Disponível para entrega
                </label>
              </div>

              <label className="span-2">
                Descrição

                <textarea
                  value={
                    editing.description ||
                    ''
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      description:
                        e.target.value
                    })
                  }
                />
              </label>

              <button className="primary-btn">
                Salvar alterações
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

type ObjectLiteral =
  Record<string, string>;