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
  Trash2,
  X
} from 'lucide-react';

import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUi } from '../../contexts/UiContext';
import { Category, Product, ProductMedia } from '../../types/models';

const money = (v: number) =>
  v.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });

// Aceita valores digitados no padrão brasileiro ou sem separador de milhar.
const parseMoney = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let raw = String(value ?? '').trim().replace(/\s|R\$/gi, '');
  if (!raw) return 0;
  if (raw.includes(',')) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    raw = raw.replace(/\./g, '');
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const formatDateBR = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

const parseDateBR = (value: string, time: string): Date | null => {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  const clock = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match || !clock) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  const hour = Number(clock[1]), minute = Number(clock[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const parseLocalDateTime = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [, ys, mos, ds, hs, mins] = match;
  const year = Number(ys), month = Number(mos), day = Number(ds), hour = Number(hs), minute = Number(mins);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) return null;
  return date;
};

const maskDateBR = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const timestampToDate = (value: any): Date | null => {
  if (!value) return null;
  const date = typeof value?.toDate === 'function' ? value.toDate()
    : typeof value?.seconds === 'number' ? new Date(value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6))
    : value instanceof Date ? value
    : typeof value === 'number' ? new Date(value)
    : typeof value === 'string' ? new Date(value) : null;
  return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
};

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
  flashOfferPrice: '',
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [editFiles, setEditFiles] = useState<File[]>([]);
  const [editVideoFile, setEditVideoFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editVariantsText, setEditVariantsText] = useState('');
  const [editAddonsText, setEditAddonsText] = useState('');
  const [form, setForm] = useState(blank);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [flashProduct, setFlashProduct] = useState<Product | null>(null);
  const [flashPriceInput, setFlashPriceInput] = useState('');
  const [flashStartDate, setFlashStartDate] = useState('');
  const [flashStartTime, setFlashStartTime] = useState('');
  const [flashEndDate, setFlashEndDate] = useState('');
  const [flashEndTime, setFlashEndTime] = useState('');
  const [flashSaving, setFlashSaving] = useState(false);
  const [clockNow, setClockNow] = useState(() => Date.now());
  const expiryCleanupInFlight = useRef(new Set<string>());
  const expiryCleanupAttempted = useRef(new Set<string>());

  const csvRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const editImageInputRef = useRef<HTMLInputElement>(null);
  const editVideoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  useEffect(() => {
    products.forEach(p => {
      if (!p.flashOffer || expiryCleanupInFlight.current.has(p.id) || expiryCleanupAttempted.current.has(p.id)) return;
      const endDate = timestampToDate(p.flashOfferEndsAt);
      const endMs = endDate?.getTime() || 0;
      // Dados sem encerramento válido não podem deixar selo/cronômetro preso em 00:00.
      if (endMs && endMs > Date.now()) return;
      expiryCleanupInFlight.current.add(p.id);
      expiryCleanupAttempted.current.add(p.id);
      updateDoc(doc(db, 'products', p.id), {
        flashOffer: false,
        flashOfferPrice: null,
        flashOfferStartsAt: null,
        flashOfferEndsAt: null,
        updatedAt: serverTimestamp()
      }).catch(error => console.error('[Vitrio] Falha ao limpar oferta expirada:', error))
        .finally(() => expiryCleanupInFlight.current.delete(p.id));
    });
  }, [products, clockNow]);

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
    if (!profile?.storeId) throw new Error('Loja não identificada.');

    const selected = list.slice(0, 6);
    const invalid = selected.find(f => !f.type.startsWith('image/'));
    if (invalid) throw new Error(`O arquivo ${invalid.name} não é uma imagem válida.`);

    const urls: string[] = [];
    for (const [index, f] of selected.entries()) {
      setMsg(`Enviando foto ${index + 1} de ${selected.length}...`);
      const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const r = ref(storage, `stores/${profile.storeId}/products/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
      await uploadBytes(r, f, { contentType: f.type });
      urls.push(await getDownloadURL(r));
    }
    return urls;
  }

  async function uploadVideo(file: File | null) {
    if (!profile?.storeId || !file) return '';
    if (!file.type.startsWith('video/')) throw new Error('Selecione um arquivo de vídeo válido.');
    const maxBytes = 80 * 1024 * 1024;
    if (file.size > maxBytes) throw new Error('O vídeo deve ter no máximo 80 MB.');
    setMsg('Enviando vídeo...');
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
    const r = ref(storage, `stores/${profile.storeId}/products/videos/${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
    await uploadBytes(r, file, { contentType: file.type });
    return getDownloadURL(r);
  }

  const buildMediaItems = (imageUrls: string[], videoUrl = ''): ProductMedia[] => [
    ...imageUrls.map(url => ({ type: 'image' as const, url })),
    ...(videoUrl ? [{ type: 'video' as const, url: videoUrl }] : [])
  ];

  async function create(e: FormEvent) {
    e.preventDefault();
    if (!profile?.storeId || busy) return;
    setBusy(true);
    setMsg('Preparando cadastro...');
    try {
      const normalPrice = parseMoney(form.price);
      const flashPrice = parseMoney(form.flashOfferPrice);
      const flashStarts = form.flashOffer ? parseLocalDateTime(form.flashStart) : null;
      const flashEnds = form.flashOffer ? parseLocalDateTime(form.flashEnd) : null;
      if (form.flashOffer) {
        if (!(flashPrice > 0 && flashPrice < normalPrice)) throw new Error('O preço promocional precisa ser maior que zero e menor que o preço de venda.');
        if (!flashStarts || !flashEnds || flashEnds <= flashStarts || flashStarts.getTime() <= Date.now() || flashEnds.getTime() <= Date.now()) throw new Error('Informe início e encerramento válidos no futuro. O encerramento deve ser posterior ao início.');
      }
      const imageUrls = await uploadImages(files);
      const videoUrl = await uploadVideo(videoFile);

      const variants: any[] = parseVariants(
        form.variantsText,
        parseMoney(form.price),
        parseMoney(form.purchasePrice)
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

        price: normalPrice,
        purchasePrice: parseMoney(form.purchasePrice),

        compareAtPrice: form.compareAtPrice
          ? parseMoney(form.compareAtPrice)
          : null,

        stock: effectiveStock,

        categoryId: form.categoryId || '',

        tags: form.tags
          .split(',')
          .map(x => x.trim())
          .filter(Boolean),

        imageUrl: imageUrls[0] || '',
        imageUrls,
        videoUrl,
        mediaItems: buildMediaItems(imageUrls, videoUrl),

        active: true,
        featured: form.featured,
        flashOffer: form.flashOffer,
        flashOfferPrice: form.flashOffer ? flashPrice : null,
        flashOfferStartsAt: flashStarts ? Timestamp.fromDate(flashStarts) : null,
        flashOfferEndsAt: flashEnds ? Timestamp.fromDate(flashEnds) : null,

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
      setVideoFile(null);

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
      if (videoInputRef.current) videoInputRef.current.value = '';

      setMsg('Produto cadastrado com sucesso.');
      toast('Produto cadastrado com sucesso.');
    } catch (error: any) {
      const message = String(error?.message || 'Não foi possível cadastrar o produto.').replace('FirebaseError: ', '');
      setMsg(message);
      toast(message, 'error');
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
    const normalizedImages = (p.imageUrls?.length ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : [])).filter(Boolean).slice(0, 6);
    setEditing({ ...p, imageUrls: normalizedImages, imageUrl: normalizedImages[0] || '', videoUrl: p.videoUrl || '' });
    setEditFiles([]);
    setEditVideoFile(null);
    if (editImageInputRef.current) editImageInputRef.current.value = '';
    if (editVideoInputRef.current) editVideoInputRef.current.value = '';

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

  function removeNewImage(index: number) {
    setFiles(current => {
      const next = current.filter((_, i) => i !== index);
      if (imageInputRef.current) imageInputRef.current.value = '';
      return next;
    });
  }

  function removeNewVideo() {
    setVideoFile(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  }

  function removeEditImage(index: number) {
    if (!editing) return;
    const images = (editing.imageUrls || []).filter((_, i) => i !== index);
    setEditing({ ...editing, imageUrls: images, imageUrl: images[0] || '' });
  }

  function removeEditVideo() {
    if (!editing) return;
    setEditing({ ...editing, videoUrl: '' });
    setEditVideoFile(null);
    if (editVideoInputRef.current) editVideoInputRef.current.value = '';
  }

  function removeNewEditImage(index: number) {
    setEditFiles(current => {
      const next = current.filter((_, i) => i !== index);
      if (editImageInputRef.current) editImageInputRef.current.value = '';
      return next;
    });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || busy) return;
    setBusy(true);
    setMsg('Preparando atualização...');

    try {
    const variants = parseVariants(
      editVariantsText,
      parseMoney(editing.price),
      parseMoney(editing.purchasePrice)
    ) as any[];

    const addonGroups = parseAddons(editAddonsText);

    const newImageUrls = editFiles.length ? await uploadImages(editFiles) : [];
    const existingImages = (editing.imageUrls?.length ? editing.imageUrls : (editing.imageUrl ? [editing.imageUrl] : [])).filter(Boolean);
    const mergedImages = [...existingImages, ...newImageUrls].filter((url, i, arr) => arr.indexOf(url) === i).slice(0, 6);
    const uploadedVideoUrl = editVideoFile ? await uploadVideo(editVideoFile) : '';
    const finalVideoUrl = editVideoFile ? uploadedVideoUrl : (editing.videoUrl || '');

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

      price: parseMoney(editing.price),

      purchasePrice:
        parseMoney(editing.purchasePrice),

      compareAtPrice: editing.compareAtPrice
        ? parseMoney(editing.compareAtPrice)
        : null,

      stock: effectiveStock,

      categoryId: editing.categoryId || '',

      tags: editing.tags || [],

      imageUrl: mergedImages[0] || '',
      imageUrls: mergedImages,
      videoUrl: finalVideoUrl,
      mediaItems: buildMediaItems(mergedImages, finalVideoUrl),

      active: editing.active,
      featured: !!editing.featured,
      flashOffer: !!editing.flashOffer,
      flashOfferPrice: Number((editing as any).flashOfferPrice || 0) || null,
      flashOfferStartsAt: (editing as any).flashOfferStartsAt || null,
      flashOfferEndsAt: (editing as any).flashOfferEndsAt || null,

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
    setEditFiles([]);
    setEditVideoFile(null);
    if (editImageInputRef.current) editImageInputRef.current.value = '';
    if (editVideoInputRef.current) editVideoInputRef.current.value = '';

    toast('Produto atualizado.');
    setMsg('');
    } catch (error: any) {
      const message = String(error?.message || 'Não foi possível atualizar o produto.').replace('FirebaseError: ', '');
      setMsg(message);
      toast(message, 'error');
    } finally {
      setBusy(false);
    }
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
            parseMoney(priceRaw),
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
          parseMoney(basePrice) +
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
            ? parseMoney(basePrice)
            : parseMoney(finalPriceRaw);

        const finalPrice =
          Number.isFinite(parsedFinal)
            ? Math.max(0, parsedFinal)
            : parseMoney(basePrice);

        const parsedPurchase =
          purchasePriceRaw === undefined ||
          purchasePriceRaw === ''
            ? parseMoney(basePurchasePrice)
            : parseMoney(purchasePriceRaw);

        const purchasePrice =
          Number.isFinite(parsedPurchase)
            ? Math.max(0, parsedPurchase)
            : parseMoney(basePurchasePrice);

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
            parseMoney(basePrice),

          purchasePrice,

          active: true
        };
      })
      .filter(Boolean);

  const offerStatus = (p: Product) => {
    if (!p.flashOffer) return '';

    const now = clockNow;

    const st = timestampToDate(p.flashOfferStartsAt)?.getTime() || 0;
    const en = timestampToDate(p.flashOfferEndsAt)?.getTime() || 0;

    if (!st || !en || en <= now) return '';
    if (st > now) return 'Agendada';
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
              type="text"
              inputMode="decimal"
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
              type="text"
              inputMode="decimal"
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
              type="text"
              inputMode="decimal"
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
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 6))}
              />
              <span>{files.length ? `${files.length} foto(s) selecionada(s)` : 'Escolha imagens do produto'}</span>
            </div>
            {files.length>0&&<div className="media-selection-list">{files.map((file,index)=><div className="media-selection-item" key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="media-remove-btn" onClick={()=>removeNewImage(index)} title="Remover foto"><X size={15}/></button></div>)}</div>}
          </label>

          <label className="span-2">
            Vídeo do produto (opcional)
            <div className="file-drop">
              <span className="media-file-icon">▶</span>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={e => setVideoFile(e.target.files?.[0] || null)}
              />
              <span>{videoFile ? videoFile.name : 'Escolha um vídeo MP4, WebM ou MOV'}</span>
              {videoFile&&<button type="button" className="media-remove-btn" onClick={removeNewVideo} title="Remover vídeo"><X size={15}/></button>}
            </div>
            <small className="field-help">O vídeo aparece junto com as fotos na galeria do anúncio, com áudio e controles.</small>
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
                Preço promocional (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex.: 40,00"
                  value={form.flashOfferPrice}
                  onChange={e => setForm({ ...form, flashOfferPrice: e.target.value.replace(/[^0-9.,]/g, '').slice(0, 14) })}
                  required
                />
                <small>O preço promocional deve ser menor que o preço de venda.</small>
              </label>
              <label>
                Início da oferta

                <input
                  type="datetime-local"
                  required
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
                  required
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

                {p.flashOffer && offerStatus(p) && (
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
                  title={p.flashOffer ? 'Configurar oferta relâmpago' : 'Criar oferta relâmpago'}
                  onClick={() => {
                    const asDate = (value: any) => {
                      const d = timestampToDate(value);
                      if (!d) return { date: '', time: '' };
                      const pad = (n: number) => String(n).padStart(2, '0');
                      return { date: formatDateBR(d), time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
                    };
                    const start = asDate(p.flashOfferStartsAt);
                    const end = asDate(p.flashOfferEndsAt);
                    setFlashProduct(p);
                    setFlashPriceInput(p.flashOfferPrice ? String(p.flashOfferPrice).replace('.', ',') : '');
                    setFlashStartDate(start.date || formatDateBR(new Date()));
                    setFlashStartTime(start.time || (() => { const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; })());
                    setFlashEndDate(end.date || formatDateBR(new Date()));
                    setFlashEndTime(end.time || '23:59');
                  }}
                >
                  <BadgePercent size={17} />
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
                  type="text"
                  inputMode="decimal"
                  value={editing.price ?? ''}
                  onFocus={e =>
                    e.currentTarget.select()
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      price: e.target.value as any
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
                  type="text"
                  inputMode="decimal"
                  value={editing.purchasePrice ? String(editing.purchasePrice) : ''}
                  placeholder="Ex.: 30,00"
                  onFocus={e =>
                    e.currentTarget.select()
                  }
                  onChange={e =>
                    setEditing({
                      ...editing,
                      purchasePrice: e.target.value === '' ? undefined : e.target.value as any
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
                  type="text"
                  inputMode="decimal"
                  value={editing.compareAtPrice ? String(editing.compareAtPrice) : ''}
                  onChange={e =>
                    setEditing({
                      ...editing,
                      compareAtPrice: e.target.value ? e.target.value as any : undefined
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

              <div className="span-2 media-editor-block">
                <strong>Fotos do produto</strong>
                {(editing.imageUrls||[]).length>0&&<div className="existing-media-list">{(editing.imageUrls||[]).map((url,index)=><div className="existing-media-item" key={`${url}-${index}`}><img src={url} alt={`Foto ${index+1}`}/><button type="button" className="media-remove-overlay" onClick={()=>removeEditImage(index)} title="Remover foto"><X size={14}/></button></div>)}</div>}
                <div className="file-drop">
                  <ImagePlus size={20} />
                  <input ref={editImageInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => setEditFiles(Array.from(e.target.files || []).slice(0, 6))}/>
                  <span>{editFiles.length ? `${editFiles.length} foto(s) nova(s)` : 'Adicionar novas fotos'}</span>
                </div>
                {editFiles.length>0&&<div className="media-selection-list">{editFiles.map((file,index)=><div className="media-selection-item" key={`${file.name}-${index}`}><span>{file.name}</span><button type="button" className="media-remove-btn" onClick={()=>removeNewEditImage(index)} title="Remover foto selecionada"><X size={15}/></button></div>)}</div>}
                <small className="field-help">Você pode remover fotos antigas e adicionar novas. Máximo de 6 fotos.</small>
              </div>

              <div className="span-2 media-editor-block">
                <strong>Vídeo do produto</strong>
                {editing.videoUrl&&<div className="existing-video-row"><video src={editing.videoUrl} controls muted playsInline preload="metadata"/><button type="button" className="danger-btn" onClick={removeEditVideo}><Trash2 size={15}/> Remover vídeo atual</button></div>}
                <div className="file-drop">
                  <span className="media-file-icon">▶</span>
                  <input ref={editVideoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" onChange={e => setEditVideoFile(e.target.files?.[0] || null)}/>
                  <span>{editVideoFile ? editVideoFile.name : (editing.videoUrl ? 'Escolher novo vídeo para substituir o atual' : 'Adicionar vídeo')}</span>
                  {editVideoFile&&<button type="button" className="media-remove-btn" onClick={()=>{setEditVideoFile(null);if(editVideoInputRef.current)editVideoInputRef.current.value='';}} title="Remover vídeo selecionado"><X size={15}/></button>}
                </div>
                <small className="field-help">Você pode remover o vídeo atual ou escolher outro para substituí-lo.</small>
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
                                type="text"
                                inputMode="decimal"
                                value={variant.price}
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
                                type="text"
                                inputMode="decimal"
                                value={variant.purchasePrice}
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
                                (parseMoney(v.purchasePrice)),
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

              <button className="primary-btn" disabled={busy}>
                {busy ? 'Salvando...' : 'Salvar alterações'}
              </button>
              {msg && <span className="edit-media-status">{msg}</span>}
            </form>
          </div>
        </div>
      )}

      {flashProduct && (
        <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !flashSaving) setFlashProduct(null); }}>
          <form className="form-card flash-config-modal" onSubmit={async e => {
            e.preventDefault();
            if (!flashProduct || flashSaving) return;
            const promotional = parseMoney(flashPriceInput);
            const starts = parseDateBR(flashStartDate, flashStartTime);
            const ends = parseDateBR(flashEndDate, flashEndTime);
            if (!promotional || promotional >= Number(flashProduct.price || 0)) {
              toast('O preço promocional precisa ser maior que zero e menor que o preço de venda.', 'error');
              return;
            }
            if (!starts || !ends || ends <= starts || ends.getTime() <= Date.now()) {
              toast('Confira as datas no formato DD/MM/AAAA e os horários. O encerramento precisa ser posterior ao início e estar no futuro.', 'error');
              return;
            }
            if (!profile?.storeId || flashProduct.storeId !== profile.storeId) {
              toast('Não foi possível confirmar a loja deste produto. Atualize a página e tente novamente.', 'error');
              return;
            }
            setFlashSaving(true);
            try {
              await updateDoc(doc(db, 'products', flashProduct.id), {
                flashOffer: true,
                flashOfferPrice: promotional,
                flashOfferStartsAt: Timestamp.fromDate(starts),
                flashOfferEndsAt: Timestamp.fromDate(ends),
                updatedAt: serverTimestamp()
              });
              toast('Oferta relâmpago salva com sucesso!');
              setFlashProduct(null);
            } catch (error: any) {
              console.error('[Vitrio] Falha ao salvar oferta relâmpago:', error);
              const message = String(error?.message || 'Não foi possível salvar a oferta. Verifique sua conexão e suas permissões.').replace('FirebaseError: ', '');
              toast(message, 'error');
            } finally {
              setFlashSaving(false);
            }
          }}>
            <div className="form-head">
              <div><h2>Oferta relâmpago</h2><p>{flashProduct.name}</p></div>
              <button type="button" className="icon-btn" disabled={flashSaving} onClick={() => setFlashProduct(null)} aria-label="Fechar"><X size={18}/></button>
            </div>
            <div className="flash-price-reference">
              <span>Preço de venda normal</span><strong>{money(Number(flashProduct.price || 0))}</strong>
              <small>Esse valor será restaurado automaticamente quando a oferta terminar.</small>
            </div>
            <label>Preço promocional (R$)
              <input required inputMode="decimal" placeholder="Ex.: 40,00" value={flashPriceInput} onChange={e => setFlashPriceInput(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 14))}/>
            </label>
            <div className="flash-date-grid">
              <label>Data de início<input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="DD/MM/AAAA" pattern="\d{2}/\d{2}/\d{4}" value={flashStartDate} onChange={e => setFlashStartDate(maskDateBR(e.target.value))}/></label>
              <label>Horário de início<input required type="time" step={60} value={flashStartTime} onChange={e => setFlashStartTime(e.target.value)}/></label>
              <label>Data de encerramento<input required type="text" inputMode="numeric" autoComplete="off" maxLength={10} placeholder="DD/MM/AAAA" pattern="\d{2}/\d{2}/\d{4}" value={flashEndDate} onChange={e => setFlashEndDate(maskDateBR(e.target.value))}/></label>
              <label>Horário de encerramento<input required type="time" step={60} value={flashEndTime} onChange={e => setFlashEndTime(e.target.value)}/></label>
            </div>
            <p className="flash-form-help">Informe a data como dia/mês/ano. A oferta entra no ar no início programado e desaparece da vitrine ao terminar; o preço de venda normal é preservado.</p>
            <div className="form-actions"><button type="button" className="secondary-btn" disabled={flashSaving} onClick={() => setFlashProduct(null)}>Cancelar</button><button type="submit" className="primary-btn" disabled={flashSaving}>{flashSaving ? 'Salvando oferta…' : 'Salvar oferta relâmpago'}</button></div>
          </form>
        </div>
      )}
    </>
  );
}

type ObjectLiteral =
  Record<string, string>