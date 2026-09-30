import { FormEvent, useEffect, useState } from 'react';
import { addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';
import { Headphones, Loader2, MessageSquarePlus } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type Ticket={id:string;subject:string;message:string;status:string;priority:string;adminReply?:string;createdAt?:any};

export function MerchantSupportPage(){
 const {profile}=useAuth();
 const [tickets,setTickets]=useState<Ticket[]>([]);
 const [form,setForm]=useState({subject:'',message:'',priority:'normal'});
 const [sending,setSending]=useState(false);
 const [feedback,setFeedback]=useState<{type:'success'|'error';text:string}|null>(null);

 useEffect(()=>{
  if(!profile?.storeId)return;
  return onSnapshot(
   query(collection(db,'supportTickets'),where('storeId','==',profile.storeId)),
   s=>setTickets(s.docs.map(d=>({id:d.id,...d.data()} as Ticket)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))),
   err=>{console.error('supportTickets snapshot',err);setFeedback({type:'error',text:'Não foi possível carregar seus chamados.'});}
  );
 },[profile?.storeId]);

 async function send(e:FormEvent){
  e.preventDefault();setFeedback(null);
  if(!profile?.storeId||!profile.uid){setFeedback({type:'error',text:'Sua sessão não está vinculada a uma loja.'});return;}
  if(!form.subject.trim()){setFeedback({type:'error',text:'Informe o assunto do chamado.'});return;}
  if(!form.message.trim()){setFeedback({type:'error',text:'Descreva o problema antes de enviar.'});return;}
  if(sending)return;setSending(true);
  try{
   await addDoc(collection(db,'supportTickets'),{
    storeId:profile.storeId,userId:profile.uid,userName:profile.displayName||profile.email||'Lojista',userEmail:profile.email||'',
    subject:form.subject.trim(),message:form.message.trim(),priority:form.priority,status:'open',createdAt:serverTimestamp(),updatedAt:serverTimestamp()
   });
   setForm({subject:'',message:'',priority:'normal'});
   setFeedback({type:'success',text:'Chamado enviado com sucesso. Nossa equipe já pode visualizá-lo.'});
  }catch(err:any){console.error('support ticket create',err);setFeedback({type:'error',text:err?.code==='permission-denied'?'Não foi possível enviar o chamado por falta de permissão. Atualize as regras do sistema.':'Não foi possível enviar o chamado.'});}
  finally{setSending(false);}
 }

 return <><div className="page-head"><div><h1>Suporte</h1><p>Abra uma solicitação para a equipe Vitrio.</p></div></div><div className="support-layout"><section className="panel"><div className="section-title-icon"><MessageSquarePlus/><div><h2>Novo chamado</h2><p>Descreva o problema com o máximo de detalhes.</p></div></div><form onSubmit={send} className="form-grid"><label className="span-2">Assunto<input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} placeholder="Ex.: erro ao registrar pedido" required/></label><label>Prioridade<select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option></select></label><label className="span-2">Mensagem<textarea rows={6} value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Explique o que aconteceu e, se possível, informe a tela e a ação realizada." required/></label><button className="primary-btn" type="submit" disabled={sending}>{sending?<><Loader2 size={17} className="spin"/>Enviando...</>:<>Enviar chamado</>}</button>{feedback&&<div className={`span-2 support-feedback ${feedback.type}`}>{feedback.text}</div>}</form></section><section className="panel"><div className="section-title-icon"><Headphones/><div><h2>Meus chamados</h2><p>Acompanhe respostas e situação.</p></div></div><div className="ticket-list">{tickets.length===0?<p className="muted">Nenhum chamado aberto.</p>:tickets.map(t=><article className="ticket-card" key={t.id}><div><strong>{t.subject}</strong><span className={`status-chip ${t.status==='closed'?'ok':''}`}>{t.status==='open'?'Aberto':t.status==='in_progress'?'Em atendimento':'Resolvido'}</span></div><p>{t.message}</p>{t.adminReply&&<div className="admin-reply"><b>Resposta do suporte</b><p>{t.adminReply}</p></div>}</article>)}</div></section></div></>;
}
