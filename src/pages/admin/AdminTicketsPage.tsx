import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Headphones, Loader2, RefreshCw, Send, Store, User } from 'lucide-react';
import { db } from '../../lib/firebase';

type Ticket={
 id:string;storeId:string;userName?:string;userEmail?:string;subject:string;message:string;
 status:string;priority:string;adminReply?:string;createdAt?:any;updatedAt?:any;
};
type StoreRow={id:string;name?:string};

const priorityLabel=(v:string)=>v==='high'?'Alta':v==='low'?'Baixa':'Normal';
const statusLabel=(v:string)=>v==='open'?'Aberto':v==='in_progress'?'Em atendimento':'Resolvido';
const when=(value:any)=>{try{return value?.toDate?.()?.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})||'—'}catch{return'—'}};

export function AdminTicketsPage(){
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [stores,setStores]=useState<StoreRow[]>([]);
 const [reply,setReply]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState<Record<string,boolean>>({});
 const [feedback,setFeedback]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);

 useEffect(()=>{
  setLoading(true);setFeedback('');
  const a=onSnapshot(
   query(collection(db,'supportTickets'),orderBy('createdAt','desc')),
   snap=>{
    const list=snap.docs.map(d=>({id:d.id,...d.data()} as Ticket));
    setTickets(list);
    setReply(current=>Object.fromEntries(list.map(t=>[t.id,current[t.id]??t.adminReply??''])));
    setLoading(false);
   },
   err=>{console.error('supportTickets admin snapshot',err);setFeedback('Não foi possível carregar os chamados. Verifique se as regras do Firestore desta versão foram publicadas.');setLoading(false);}
  );
  const b=onSnapshot(collection(db,'stores'),snap=>setStores(snap.docs.map(d=>({id:d.id,...d.data()} as StoreRow))),err=>console.error('stores support snapshot',err));
  return()=>{a();b();};
 },[refreshKey]);

 const storeMap=useMemo(()=>new Map(stores.map(s=>[s.id,s.name||s.id])),[stores]);

 async function answer(t:Ticket,status:'in_progress'|'closed'){
  if(busy[t.id])return;
  const text=(reply[t.id]||'').trim();
  if(status!=='closed'&&text.length<2){setFeedback('Digite uma resposta antes de enviar.');return;}
  setBusy(v=>({...v,[t.id]:true}));setFeedback('');
  try{
   const updates:any={status,updatedAt:serverTimestamp()};
   if(text)updates.adminReply=text;
   if(status==='closed')updates.closedAt=serverTimestamp();
   await updateDoc(doc(db,'supportTickets',t.id),updates);
   setFeedback(status==='closed'?'Chamado marcado como resolvido.':'Resposta enviada ao lojista.');
  }catch(err:any){
   console.error('support ticket update',err);
   setFeedback(err?.code==='permission-denied'?'Sem permissão para atualizar o chamado. Publique as regras do Firestore desta versão.':'Não foi possível atualizar o chamado.');
  }finally{setBusy(v=>({...v,[t.id]:false}));}
 }

 return <>
  <div className="page-head"><div><h1>Central de suporte</h1><p>Acompanhe e responda às solicitações enviadas pelos lojistas.</p></div><button className="secondary-btn" onClick={()=>setRefreshKey(v=>v+1)} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/> Atualizar</button></div>
  {feedback&&<div className="support-feedback-panel"><strong>{feedback}</strong></div>}
  {loading?<div className="panel"><Loader2 className="spin"/> Carregando chamados...</div>:<div className="ticket-admin-list">
   {tickets.length===0?<div className="panel"><strong>Nenhum chamado recebido.</strong><p className="muted">Quando um lojista enviar uma solicitação, ela aparecerá aqui automaticamente.</p></div>:tickets.map(t=><section className="panel ticket-admin" key={t.id}>
    <div className="ticket-admin-head"><div><span className="eyebrow">#{t.id.slice(0,6).toUpperCase()}</span><h2>{t.subject}</h2><small>{when(t.createdAt)}</small></div><span className={`status-chip ${t.status==='closed'?'ok':''}`}>{statusLabel(t.status)}</span></div>
    <div className="ticket-support-meta"><span><Store size={15}/><b>{storeMap.get(t.storeId)||t.storeId}</b></span><span><User size={15}/>{t.userName||'Lojista'}{t.userEmail?` · ${t.userEmail}`:''}</span><span>Prioridade: <b>{priorityLabel(t.priority)}</b></span></div>
    <div className="ticket-message"><strong>Mensagem do lojista</strong><p>{t.message}</p></div>
    {t.adminReply&&<div className="admin-reply"><b>Última resposta</b><p>{t.adminReply}</p></div>}
    <label>Resposta<textarea rows={4} value={reply[t.id]??''} onChange={e=>setReply(v=>({...v,[t.id]:e.target.value}))} placeholder="Digite a resposta que aparecerá para o lojista..."/></label>
    <div className="ticket-actions"><button className="primary-btn" disabled={busy[t.id]} onClick={()=>answer(t,'in_progress')}>{busy[t.id]?<Loader2 className="spin"/>:<Send/>} Responder</button><button className="secondary-btn" disabled={busy[t.id]} onClick={()=>answer(t,'closed')}><Headphones/> Marcar resolvido</button></div>
   </section>)}
  </div>}
 </>;
}
