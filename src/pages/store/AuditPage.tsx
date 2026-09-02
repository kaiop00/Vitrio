import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';import { useAuth } from '../../contexts/AuthContext';import { AuditLog } from '../../types/models';
export function AuditPage(){const {profile}=useAuth();const [logs,setLogs]=useState<AuditLog[]>([]);
useEffect(()=>{if(!profile?.storeId)return;return onSnapshot(query(collection(db,'auditLogs'),where('storeId','==',profile.storeId)),s=>setLogs(s.docs.map(d=>({id:d.id,...d.data()} as AuditLog)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).slice(0,100)));},[profile?.storeId]);
return <><div className="page-head"><div><h1>Auditoria</h1><p>Últimas ações críticas realizadas no sistema.</p></div></div><div className="panel">{logs.length===0?<p className="muted">Ainda não há eventos de auditoria.</p>:logs.map(l=><div className="audit-row" key={l.id}><div><strong>{l.description}</strong><small>{l.userName||'Sistema'} · {l.createdAt?.toDate?.()?.toLocaleString('pt-BR')||'agora'}</small></div><span>{l.action}</span></div>)}</div></>;}
