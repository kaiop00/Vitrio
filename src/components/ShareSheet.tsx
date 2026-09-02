import { Copy, Instagram, MessageCircle, Share2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type SharePayload={title:string;text:string;url:string};
type Props={payload:SharePayload|null;onClose:()=>void};

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function ShareSheet({payload,onClose}:Props){
 const [copied,setCopied]=useState(false);
 const [status,setStatus]=useState('');
 if(!payload)return null;
 const message=`${payload.text}\n${payload.url}`;
 useEffect(()=>{
   function onKeyDown(event: KeyboardEvent) {
     if(event.key === 'Escape') onClose();
   }

   window.addEventListener('keydown', onKeyDown);
   return () => window.removeEventListener('keydown', onKeyDown);
 }, [onClose]);

 async function copy(){
   try{
     await navigator.clipboard.writeText(payload!.url);
     setCopied(true);
     setStatus('Link copiado para a área de transferência.');
     setTimeout(()=>setCopied(false),1500);
   }catch{
     setStatus('Não foi possível copiar o link.');
   }
 }
 function whatsapp(){
   setStatus('Abrindo o WhatsApp Web.');
   openExternal(`https://wa.me/?text=${encodeURIComponent(message)}`);
 }
 async function instagram(){
   try{await navigator.clipboard.writeText(payload!.url);setCopied(true);setStatus('Link copiado. Abra o Instagram para colar na conversa ou story.')}catch{setStatus('Abra o Instagram e copie o link manualmente.');}
   openExternal('https://www.instagram.com/');
 }
 async function nativeShare(){
   try{if(navigator.share)await navigator.share(payload!);else await copy();setStatus('Compartilhamento concluído.')}catch{setStatus('Não foi possível abrir o compartilhamento do dispositivo.');}
 }
 return <div className="share-sheet-backdrop" onMouseDown={onClose}>
   <div className="share-sheet" role="dialog" aria-modal="true" aria-label="Compartilhar" onMouseDown={e=>e.stopPropagation()}>
    <div className="share-sheet-head"><div><span>COMPARTILHAR</span><h3>{payload.title}</h3><p>Escolha onde deseja enviar o link.</p></div><button type="button" onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
    <div className="share-app-grid">
      <button type="button" className="share-app whatsapp" onClick={whatsapp}><span><MessageCircle/></span><strong>WhatsApp</strong><small>Abrir no navegador</small></button>
      <button type="button" className="share-app instagram" onClick={instagram}><span><Instagram/></span><strong>Instagram</strong><small>Copiar link e abrir</small></button>
      <button type="button" className="share-app others" onClick={nativeShare}><span><Share2/></span><strong>Outros apps</strong><small>Menu do dispositivo</small></button>
      <button type="button" className="share-app copy" onClick={copy}><span><Copy/></span><strong>{copied?'Link copiado':'Copiar link'}</strong><small>{copied?'Pronto para colar':'Copiar para área de transferência'}</small></button>
    </div>
    {status&&<p className="share-status" aria-live="polite">{status}</p>}
    <p className="share-instagram-note">No Instagram, navegadores não conseguem preencher automaticamente um Story ou Direct. O Vitrio copia o link e abre o aplicativo para você colar onde desejar.</p>
   </div>
 </div>;
}
