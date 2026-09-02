import { FormEvent, useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { CheckCircle2, Clock3, MapPin, PackageCheck, Search, Store, Truck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { functions } from '../lib/firebase';

const steps=[
  {key:'paid',label:'Pedido confirmado',icon:CheckCircle2},
  {key:'preparing',label:'Em preparação',icon:Clock3},
  {key:'ready',label:'Pronto',icon:PackageCheck},
  {key:'out_for_delivery',label:'Saiu para entrega',icon:Truck},
  {key:'completed',label:'Concluído',icon:CheckCircle2},
];
const flow=['paid','preparing','ready','out_for_delivery','completed'];
const money=(v:number)=>Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function OrderTrackingPage(){
 const {orderId=''}=useParams();const [phone,setPhone]=useState(''),[data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{const saved=sessionStorage.getItem(`vitrio:tracking:${orderId}`);if(saved)setPhone(saved)},[orderId]);
 async function track(e?:FormEvent){e?.preventDefault();if(!orderId||phone.replace(/\D/g,'').length<8)return;setBusy(true);setError('');try{const fn=httpsCallable(functions,'getPublicOrderTracking');const res:any=await fn({orderId,phone});setData(res.data);sessionStorage.setItem(`vitrio:tracking:${orderId}`,phone)}catch(err:any){setData(null);setError(err?.message?.replace('FirebaseError: ','')||'Não foi possível localizar esse pedido.')}finally{setBusy(false)}}
 const current=data?.status==='pending_payment'?-1:flow.indexOf(data?.status);
 return <div className="tracking-page"><header className="tracking-header"><Link to="/" className="brand"><span className="brand-mark">V</span><strong>Vitrio</strong></Link><span>Acompanhar pedido</span></header><main className="tracking-wrap"><div className="tracking-intro"><span className="eyebrow">ACOMPANHAMENTO</span><h1>Veja onde está seu pedido</h1><p>Informe o telefone usado na compra. Seus dados continuam protegidos.</p></div><form className="tracking-search" onSubmit={track}><label>Pedido<input value={orderId.slice(0,12).toUpperCase()} disabled/></label><label>Telefone / WhatsApp<input autoFocus inputMode="tel" placeholder="(88) 99999-9999" value={phone} onChange={e=>setPhone(e.target.value)}/></label><button className="primary-btn" disabled={busy||phone.replace(/\D/g,'').length<8}><Search size={17}/>{busy?'Consultando...':'Acompanhar'}</button></form>{error&&<div className="tracking-error">{error}</div>}{data&&<section className="tracking-card"><div className="tracking-order-head"><div><small>Pedido #{data.shortId}</small><h2>{data.storeName}</h2><span>{data.customerName}</span></div><strong>{money(data.total)}</strong></div>{data.status==='cancelled'?<div className="tracking-cancelled"><XCircle/><div><strong>Pedido cancelado</strong><p>Entre em contato com a loja se precisar de ajuda.</p></div></div>:<div className="tracking-timeline">{steps.map((s,i)=>{const Icon=s.icon;const active=i<=current;const now=i===current;return <div className={`tracking-step ${active?'done':''} ${now?'current':''}`} key={s.key}><div className="tracking-step-icon"><Icon size={19}/></div><div><strong>{s.label}</strong><small>{now?'Etapa atual':active?'Concluído':'Aguardando'}</small></div></div>})}</div>}<div className="tracking-meta"><span><Store size={17}/>{data.fulfillment==='delivery'?'Entrega':'Retirada na loja'}</span>{data.address&&<span><MapPin size={17}/>{data.address}</span>}<span><Clock3 size={17}/>{data.updatedLabel||data.createdLabel}</span></div><div className="tracking-items">{(data.items||[]).map((i:any)=><div key={`${i.productId}-${i.name}`}><span>{i.quantity}x {i.name}{i.variantName?` · ${i.variantName}`:''}{(i.addons||[]).length?<small>{i.addons.map((a:any)=>`${a.groupName}: ${a.optionName}`).join(' · ')}</small>:null}</span><strong>{money(i.subtotal)}</strong></div>)}</div>{data.supportPhone&&<a className="secondary-btn centered" href={`https://wa.me/${String(data.supportPhone).replace(/\D/g,'')}`} target="_blank" rel="noreferrer">Falar com a loja</a>}</section>}</main></div>
}
