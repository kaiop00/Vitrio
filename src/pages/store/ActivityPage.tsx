import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { AlertTriangle, CheckCircle2, History, Package, ShoppingCart } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { AuditLog, Order, Product } from '../../types/models';

const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmt=(v:any)=>{const d=v?.toDate?.();return d?d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Agora'};

export function ActivityPage(){
 const {profile}=useAuth(); const [orders,setOrders]=useState<Order[]>([]),[products,setProducts]=useState<Product[]>([]),[audit,setAudit]=useState<AuditLog[]>([]);
 useEffect(()=>{if(!profile?.storeId)return;const id=profile.storeId;const a=onSnapshot(query(collection(db,'orders'),where('storeId','==',id)),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()} as Order))));const b=onSnapshot(query(collection(db,'products'),where('storeId','==',id)),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()} as Product))));const c=onSnapshot(query(collection(db,'auditLogs'),where('storeId','==',id)),s=>setAudit(s.docs.map(d=>({id:d.id,...d.data()} as AuditLog))));return()=>{a();b();c()}},[profile?.storeId]);
 const recent=useMemo(()=>orders.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,8),[orders]);
 const logs=useMemo(()=>audit.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,8),[audit]);
 const low=products.filter(p=>p.stock<=5), pending=orders.filter(o=>!['completed','cancelled'].includes(o.status));
 return <><div className="page-head"><div><h1>Central de atividade</h1><p>O que está acontecendo agora na sua operação, em um só lugar.</p></div></div>
 <div className="insight-strip"><div><ShoppingCart/><span><strong>{pending.length}</strong> pedidos em andamento</span></div><div><AlertTriangle/><span><strong>{low.length}</strong> produtos com estoque baixo</span></div><div><History/><span><strong>{audit.length}</strong> alterações registradas</span></div></div>
 <div className="activity-layout"><section className="panel"><div className="panel-head"><h2>Pedidos recentes</h2><span className="soft-badge">Tempo real</span></div>{recent.length===0?<div className="empty-state compact-empty"><ShoppingCart/><p>Nenhum pedido por enquanto.</p></div>:recent.map(o=><div className="activity-row" key={o.id}><span className={`activity-dot ${o.paymentStatus==='paid'?'ok':'warning'}`}/><div><strong>Pedido #{o.id.slice(0,6).toUpperCase()}</strong><small>{o.customerName} · {fmt(o.createdAt)}</small></div><b>{money(o.total)}</b></div>)}</section>
 <section className="panel"><div className="panel-head"><h2>Estoque que pede atenção</h2><span className="soft-badge">{low.length} item(ns)</span></div>{low.length===0?<div className="empty-state compact-empty"><CheckCircle2/><p>Estoque saudável.</p></div>:low.slice(0,8).map(p=><div className="activity-row" key={p.id}><span className={`activity-icon ${p.stock===0?'danger':'warning'}`}><Package size={15}/></span><div><strong>{p.name}</strong><small>{p.stock===0?'Produto esgotado':'Reposição recomendada'}</small></div><b>{p.stock} un.</b></div>)}</section>
 <section className="panel activity-wide"><div className="panel-head"><h2>Alterações recentes</h2><span className="soft-badge">Auditoria</span></div>{logs.length===0?<p className="muted">Nenhuma alteração registrada ainda.</p>:logs.map(l=><div className="timeline-row" key={l.id}><span/><div><strong>{l.description}</strong><small>{l.userName||'Usuário'} · {fmt(l.createdAt)}</small></div></div>)}</section></div></>;
}
