import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, ExternalLink, Instagram, Link2, MessageCircle, QrCode, Share2, Sparkles } from 'lucide-react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';
import { ShareSheet } from '../../components/ShareSheet';

export function PromotionPage() {
  const { profile } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
        setError('Não foi possível carregar os dados da loja.');
        setLoading(false);
      }
    }

    load();

    if (!profile?.storeId) return;
    return onSnapshot(doc(db, 'stores', profile.storeId), snapshot => {
      setStore(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as Store) : null);
    });
  }, [profile?.storeId]);

  const url = useMemo(() => store ? `${window.location.origin}/loja/${store.slug}` : '', [store]);
  const sharePayload = store && shareOpen ? { title: store.name, text: `Conheça a vitrine da ${store.name}`, url } : null;

  useEffect(() => {
    if (!url) return;
    QRCode.toDataURL(url, { width: 900, margin: 2, errorCorrectionLevel: 'H' }).then(setQr).catch(() => setQr(''));
  }, [url]);

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function download() {
    if (!qr || !store) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `qrcode-${store.slug}.png`;
    a.click();
  }

  if (loading) return <div className="card">Carregando dados da loja...</div>;
  if (error || !store) return <div className="card"><strong>{error || 'Não foi possível carregar os dados da loja.'}</strong></div>;

  return <>
    <div className="page-head promotion-head"><div><span className="promotion-kicker">DIVULGAÇÃO</span><h1>Leve sua loja para onde seus clientes estão</h1><p>Compartilhe a vitrine por aplicativos, copie o link ou use o QR Code em materiais físicos.</p></div><a className="secondary-btn" href={`/loja/${store.slug}`} target="_blank" rel="noreferrer"><ExternalLink size={17}/>Abrir vitrine</a></div>
    <section className="promotion-hero-card">
      <div className="promotion-hero-copy"><span className="promotion-icon"><Sparkles size={21}/></span><div><small>LINK PRINCIPAL DA LOJA</small><h2>{store.name}</h2><p>Um único endereço para catálogo, produtos, carrinho e checkout.</p></div></div>
      <div className="promotion-link-row"><div className="share-link-box"><Link2 size={17}/><span>{url}</span><button onClick={copy}><Copy size={17}/>{copied ? 'Copiado' : 'Copiar'}</button></div><button className="primary-btn promotion-share-main" onClick={() => setShareOpen(true)}><Share2 size={18}/>Compartilhar</button></div>
      <div className="promotion-social-row"><button onClick={() => setShareOpen(true)}><MessageCircle size={18}/><span><strong>WhatsApp</strong><small>Abrir o app</small></span></button><button onClick={() => setShareOpen(true)}><Instagram size={18}/><span><strong>Instagram</strong><small>Copiar e abrir o app</small></span></button><button onClick={() => setShareOpen(true)}><Share2 size={18}/><span><strong>Outros apps</strong><small>Usar menu do dispositivo</small></span></button></div>
    </section>
    <div className="promotion-grid v28">
      <section className="promotion-panel promotion-qr-panel"><div className="promotion-panel-head"><div className="promotion-icon"><QrCode size={21}/></div><div><h2>QR Code da vitrine</h2><p>Ideal para balcão, embalagem, cartão, fachada e material promocional.</p></div></div><div className="promotion-qr-stage">{qr ? <img className="store-qr" src={qr} alt={`QR Code da ${store.name}`}/> : <div className="qr-loading">Gerando QR Code...</div>}<div className="qr-copy"><strong>Escaneie e acesse</strong><span>O QR Code aponta sempre para a vitrine pública desta loja.</span></div></div><button className="secondary-btn full" onClick={download} disabled={!qr}><Download size={17}/>Baixar QR Code em PNG</button></section>
      <section className="promotion-panel promotion-tips-v28"><div className="promotion-panel-head"><div className="promotion-icon"><Share2 size={21}/></div><div><h2>Onde divulgar</h2><p>Atalhos simples para manter o link da loja presente nos canais mais usados.</p></div></div><div className="tips-grid-v28"><div><span>01</span><strong>Bio do Instagram</strong><small>Use a vitrine como link principal do perfil.</small></div><div><span>02</span><strong>WhatsApp</strong><small>Envie o catálogo completo em vez de várias fotos.</small></div><div><span>03</span><strong>Loja física</strong><small>Coloque o QR Code no balcão, sacolas e etiquetas.</small></div><div><span>04</span><strong>Pós-venda</strong><small>Inclua o link na mensagem de agradecimento.</small></div></div></section>
    </div>
    <ShareSheet payload={sharePayload} onClose={() => setShareOpen(false)}/>
  </>;
}