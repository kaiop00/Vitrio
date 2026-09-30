import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import QRCode from 'qrcode';
import { CalendarClock, CheckCircle2, Clock3, Copy, MessageCircle, QrCode, ShieldAlert, WalletCards } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';
import { buildPixPayload } from '../../lib/pix';

const labels:Record<string,string>={trial:'Período de teste',active:'Assinatura ativa',past_due:'Pagamento pendente',suspended:'Bloqueado por falta de pagamento',cancelled:'Assinatura cancelada'};
type Billing={pixKey?:string;pixName?:string;pixCity?:string;billingWhatsapp?:string;monthlyPrice?:number;starterPrice?:number;proPrice?:number;businessPrice?:number};
type PendingPayment={id:string;status?:string;amount?:number;createdAt?:any};
function toDate(v:any){if(!v)return null;if(typeof v?.toDate==='function')return v.toDate();const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
function date(v:any){const d=toDate(v);return d?d.toLocaleDateString('pt-BR'):'—';}
function money(v:number){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function normalizeWhatsapp(value?:string){const digits=String(value||'').replace(/\D/g,'');if(!digits)return'';return digits.startsWith('55')?digits:(digits.length===10||digits.length===11)?`55${digits}`:digits;}

export function SubscriptionPage(){
 const {profile}=useAuth();
 const [store,setStore]=useState<Store|null>(null),[billing,setBilling]=useState<Billing>({}),[qr,setQr]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState<PendingPayment|null>(null);
 useEffect(()=>{if(!profile?.storeId)return;const a=onSnapshot(doc(db,'stores',profile.storeId),s=>setStore(s.exists()?({id:s.id,...s.data()} as Store):null));const c=onSnapshot(query(collection(db,'subscriptionPayments'),where('storeId','==',profile.storeId)),s=>{const rows=s.docs.map(d=>({id:d.id,...d.data()} as PendingPayment)).filter(x=>x.status==='awaiting_review').sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0));setPending(rows[0]||null);});(async()=>{try{const snap=await getDoc(doc(db,'platformSettings','billing'));setBilling((snap.exists()?snap.data():{}) as Billing);}catch(e:any){console.error('billing customer load',e);setMessage('Não foi possível carregar os dados de cobrança.');}})();return()=>{a();c();}},[profile?.storeId]);
 const now=Date.now(),trialEnd=toDate(store?.trialEndsAt),trialExpired=!!(store?.subscriptionStatus==='trial'&&trialEnd&&trialEnd.getTime()<now),status=trialExpired?'expired':(store?.subscriptionStatus||'trial');
 const amount=useMemo(()=>Number(billing.monthlyPrice??billing.starterPrice??billing.proPrice??billing.businessPrice)||0,[billing]);
 const payload=useMemo(()=>billing.pixKey&&amount>0&&profile?.storeId?buildPixPayload({key:billing.pixKey,name:billing.pixName||'VITRIO',city:billing.pixCity||'QUIXERAMOBIM',amount,txid:`VITRIO${profile.storeId.replace(/[^a-zA-Z0-9]/g,'').slice(0,14)}`}):'',[billing,amount,profile?.storeId]);
 useEffect(()=>{if(!payload){setQr('');return;}QRCode.toDataURL(payload,{width:360,margin:2,errorCorrectionLevel:'M'}).then(setQr).catch(()=>setQr(''));},[payload]);
 const days=trialEnd?Math.max(0,Math.ceil((trialEnd.getTime()-now)/86400000)):null;
 async function copyPix(){if(!payload)return;try{await navigator.clipboard.writeText(payload);setMessage('Código Pix copiado.');}catch{setMessage('Não foi possível copiar automaticamente. Selecione o código Pix manualmente.');}}
 async function notifyPayment(){if(!profile?.storeId||!store||!payload)return;setBusy(true);setMessage('');try{
   if(!pending){const existing=await getDocs(query(collection(db,'subscriptionPayments'),where('storeId','==',profile.storeId)));const open=existing.docs.find(d=>d.data()?.status==='awaiting_review');if(!open)await addDoc(collection(db,'subscriptionPayments'),{storeId:profile.storeId,storeName:store.name,ownerEmail:store.ownerEmail||profile.email||'',plan:'monthly',amount,status:'awaiting_review',paymentMethod:'pix_manual',createdBy:profile.uid,createdAt:serverTimestamp()});}
   const phone=normalizeWhatsapp(billing.billingWhatsapp||'88888499692');if(!phone){setMessage('O WhatsApp para comprovantes ainda não foi configurado pelo responsável pela plataforma.');return;}
   const text=encodeURIComponent(`Olá! Sou da loja ${store.name}. Efetuei o pagamento da mensalidade Vitrio no valor de ${money(amount)}. Vou enviar o comprovante nesta conversa para conferência e liberação do acesso.`);window.location.href=`https://wa.me/${phone}?text=${text}`;
 }catch(e:any){setMessage(String(e?.message||'Não foi possível registrar a solicitação de pagamento.').replace('FirebaseError: ',''));}finally{setBusy(false);}}
 if(!store)return <div className="screen-center">Carregando assinatura...</div>;
 const needsPayment=status!=='active';
 return <><div className="page-head"><div><h1>Plano e assinatura</h1><p>Acompanhe sua assinatura e regularize o acesso por Pix quando necessário.</p></div><span className={`status-chip ${status==='active'?'ok':status==='expired'||status==='past_due'?'warning':status==='suspended'||status==='cancelled'?'danger':''}`}>{status==='expired'?'Teste expirado':labels[status]||status}</span></div>
 <div className={`subscription-hero ${needsPayment?'needs-payment':''}`}><div><span>Assinatura Vitrio</span><strong>Mensal</strong><p>{status==='expired'?'Seu período gratuito terminou. Efetue o pagamento abaixo para solicitar a ativação.':status==='suspended'?'Seu acesso está bloqueado por falta de pagamento. Regularize abaixo e envie o comprovante para liberação.':status==='past_due'?'Existe um pagamento pendente. Regularize abaixo para manter o acesso.':status==='trial'&&days!==null?`${days} dia(s) restantes no teste gratuito.`:labels[status]}</p></div>{status==='active'?<CheckCircle2/>:status==='trial'?<Clock3/>:<ShieldAlert/>}</div>
 {message&&<div className="notice">{message}</div>}
 {pending&&<div className="subscription-review-banner"><Clock3/><div><strong>Comprovante aguardando conferência</strong><span>Sua solicitação de pagamento já foi registrada. Após enviar o comprovante pelo WhatsApp, o responsável pela plataforma fará a conferência e liberará a assinatura.</span></div></div>}
 <div className="subscription-grid">
  <section className="panel subscription-pay-card"><div className="subscription-price"><span>Valor do plano</span><strong>{money(amount)}</strong><small>Pagamento manual via Pix</small></div>{qr?<img src={qr} alt="QR Code Pix da assinatura Vitrio"/>:<div className="qr-placeholder">O Pix da plataforma ainda não foi configurado pelo responsável pela plataforma.</div>}<button className="secondary-btn" disabled={!payload} onClick={copyPix}><Copy size={17}/>Copiar Pix copia e cola</button>{payload&&<textarea className="pix-copy-code" readOnly value={payload} aria-label="Código Pix copia e cola"/>}</section>
  <section className="panel subscription-instructions"><div className="section-title-icon"><WalletCards/><div><h2>Regularizar assinatura</h2><p>A conferência do pagamento é realizada pela equipe responsável do Vitrio.</p></div></div><div className="billing-steps"><div><b>1</b><span>Escaneie o QR Code ou copie o código Pix.</span></div><div><b>2</b><span>Efetue o pagamento de <strong>{money(amount)}</strong>.</span></div><div><b>3</b><span>Clique em “Enviar comprovante” e anexe a imagem do comprovante no WhatsApp.</span></div><div><b>4</b><span>Após a conferência, o responsável ativa ou renova sua assinatura.</span></div></div><button className="primary-btn" disabled={!payload||busy} onClick={notifyPayment}><MessageCircle size={18}/>{busy?'Preparando...':pending?'Abrir WhatsApp do financeiro':'Paguei — enviar comprovante'}</button><small className="muted">WhatsApp financeiro: {billing.billingWhatsapp||'(88) 8 8849-9692'}</small></section>
 </div>
 <div className="two-cols"><div className="panel"><h2>Datas da assinatura</h2><div className="detail-list"><div><CalendarClock/><span>Fim do teste</span><strong>{date(store.trialEndsAt)}</strong></div><div><CalendarClock/><span>Vigência da assinatura</span><strong>{date(store.subscriptionEndsAt)}</strong></div></div></div><div className="panel"><h2>Como funciona a liberação?</h2><p className="muted">Após o pagamento, envie o comprovante pelo WhatsApp. O responsável pela plataforma fará a conferência e, após a aprovação, sua assinatura será liberada ou renovada.</p></div></div></>;
}
