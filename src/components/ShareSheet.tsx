import { Copy, Instagram, MessageCircle, Share2, X } from 'lucide-react';
import { useState } from 'react';

type SharePayload={title:string;text:string;url:string};
type Props={payload:SharePayload|null;onClose:()=>void};

function launchApp(appUrl:string,fallbackUrl:string){
  const started=Date.now();
  window.location.href=appUrl;
  window.setTimeout(()=>{
    if(document.visibilityState==='visible'&&Date.now()-started<2200)window.open(fallbackUrl,'_blank','noopener,noreferrer');
  },1200);
}

export function ShareSheet({payload,onClose}:Props){
 const [copied,setCopied]=useState(false);
 if(!payload)return null;
 const message=`${payload.text}\n${payload.url}`;
 async function copy(){try{await navigator.clipboard.writeText(payload!.url);setCopied(true);setTimeout(()=>setCopied(false),1500)}catch{}}
 function whatsapp(){launchApp(`whatsapp://send?text=${encodeURIComponent(message)}`,`https://wa.me/?text=${encodeURIComponent(message)}`);}
 async function instagram(){
   try{await navigator.clipboard.writeText(payload!.url);setCopied(true)}catch{}
   launchApp('instagram://app','https://www.instagram.com/');
 }
 async function nativeShare(){
   try{if(navigator.share)await navigator.share(payload!);else await copy()}catch{}
 }
 return <div className="share-sheet-backdrop" onMouseDown={onClose}>
   <div className="share-sheet" role="dialog" aria-modal="true" aria-label="Compartilhar" onMouseDown={e=>e.stopPropagation()}>
    <div className="share-sheet-head"><div><span>COMPARTILHAR</span><h3>{payload.title}</h3><p>Escolha onde deseja enviar o link.</p></div><button onClick={onClose} aria-label="Fechar"><X size={19}/></button></div>
    <div className="share-app-grid">
      <button className="share-app whatsapp" onClick={whatsapp}><span><MessageCircle/></span><strong>WhatsApp</strong><small>Abrir aplicativo</small></button>
      <button className="share-app instagram" onClick={instagram}><span><Instagram/></span><strong>Instagram</strong><small>Copiar link e abrir app</small></button>
      <button className="share-app others" onClick={nativeShare}><span><Share2/></span><strong>Outros apps</strong><small>Menu do dispositivo</small></button>
      <button className="share-app copy" onClick={copy}><span><Copy/></span><strong>{copied?'Link copiado':'Copiar link'}</strong><small>{copied?'Pronto para colar':'Copiar para área de transferência'}</small></button>
    </div>
    <p className="share-instagram-note">No Instagram, navegadores não conseguem preencher automaticamente um Story ou Direct. O Vitrio copia o link e abre o aplicativo para você colar onde desejar.</p>
   </div>
 </div>;
}
