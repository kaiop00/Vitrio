import { useEffect,useMemo,useState } from 'react';
import { collection,deleteField,doc,onSnapshot,serverTimestamp,Timestamp,updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ExternalLink,Headphones,Search,ShieldCheck,ShieldOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db,functions } from '../../lib/firebase';
import { useUi } from '../../contexts/UiContext';
import { Store,SubscriptionPlan,SubscriptionStatus } from '../../types/models';
const labels:Record<string,string>={trial:'Em teste',active:'Ativa',past_due:'Pagamento pendente',suspended:'Bloqueada',cancelled:'Cancelada'};
function date(v:any){try{return v?.toDate?.().toLocaleDateString('pt-BR')||'—'}catch{const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}}
function isoDate(v:any){try{const d=v?.toDate?.()||new Date(v);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10)}catch{return ''}}
export function StoresPage(){
 const [stores,setStores]=useState<Store[]>([]),[search,setSearch]=useState(''),[status,setStatus]=useState('all'),[busy,setBusy]=useState('');
 const {toast}=useUi();
 useEffect(()=>onSnapshot(collection(db,'stores'),s=>setStores(s.docs.map(d=>({id:d.id,...d.data()} as Store)).sort((a,b)=>a.name.localeCompare(b.name)))),[]);
 async function patch(id:string,data:Record<string,unknown>){
  if(busy===id)return;
  setBusy(id);
  try{
    // Mantém a Cloud Function como caminho principal para registrar auditoria.
    const fn=httpsCallable(functions,'adminUpdateStoreAccess');
    await fn({storeId:id,...data});
    toast('Situação da loja atualizada.');
  }catch(err:any){
    // Fallback administrativo: evita que uma Function antiga/não publicada impeça o Master de operar.
    // As regras do Firestore continuam exigindo role=admin e active=true para esta escrita.
    try{
      const fallbackData:Record<string,unknown>={...data,updatedAt:serverTimestamp()};
      for(const field of ['trialEndsAt','subscriptionEndsAt']){
        if(Object.prototype.hasOwnProperty.call(fallbackData,field)){
          const value=fallbackData[field];
          if(value===null||value==='') fallbackData[field]=deleteField();
          else if(typeof value==='string'){
            const parsed=new Date(`${value}T23:59:59`);
            if(!Number.isNaN(parsed.getTime())) fallbackData[field]=Timestamp.fromDate(parsed);
          }
        }
      }
      await updateDoc(doc(db,'stores',id),fallbackData);
      toast('Situação da loja atualizada.');
    }catch(fallbackErr:any){
      const message=String(fallbackErr?.message||err?.message||'Não foi possível atualizar a loja.').replace('FirebaseError: ','');
      toast(message,'error');
    }
  }finally{setBusy('')}
 }
 const filtered=useMemo(()=>stores.filter(s=>(status==='all'||s.subscriptionStatus===status)&&`${s.name} ${s.slug} ${s.ownerEmail||''}`.toLowerCase().includes(search.toLowerCase())),[stores,search,status]);
 return <><div className="page-head"><div><h1>Clientes e lojas</h1><p>Gerencie contrato, teste, plano e acesso sem interferir no login pessoal do lojista.</p></div></div>
 <div className="metric-grid"><div className="metric-card"><span>Total</span><strong>{stores.length}</strong></div><div className="metric-card"><span>Em teste</span><strong>{stores.filter(s=>s.subscriptionStatus==='trial').length}</strong></div><div className="metric-card"><span>Ativas</span><strong>{stores.filter(s=>s.subscriptionStatus==='active').length}</strong></div><div className="metric-card"><span>Bloqueadas</span><strong>{stores.filter(s=>!s.active||['suspended','cancelled'].includes(s.subscriptionStatus||'')).length}</strong></div></div>
 <div className="panel admin-toolbar"><div className="search-box"><Search size={17}/><input placeholder="Buscar loja, link ou e-mail..." value={search} onChange={e=>setSearch(e.target.value)}/></div><select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Todas as situações</option>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
 <div className="table-card"><table><thead><tr><th>Cliente / loja</th><th>Vitrine</th><th>Plano</th><th>Assinatura</th><th>Teste até</th><th>Ações</th></tr></thead><tbody>{filtered.map(s=><tr key={s.id}><td><strong>{s.name}</strong><small className="table-sub">{s.ownerEmail||'Lojista cadastrado'}</small></td><td><a className="table-link" href={`/loja/${s.slug}`} target="_blank" rel="noreferrer">/{s.slug}<ExternalLink size={13}/></a></td><td><select disabled={busy===s.id} value={s.plan||'starter'} onChange={e=>patch(s.id,{plan:e.target.value as SubscriptionPlan})}><option value="starter">Starter</option><option value="pro">Pro</option><option value="business">Business</option></select></td><td><select disabled={busy===s.id} value={s.subscriptionStatus||'trial'} onChange={e=>patch(s.id,{subscriptionStatus:e.target.value as SubscriptionStatus,active:!['suspended','cancelled'].includes(e.target.value)})}>{Object.entries(labels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td><input className="date-input" type="date" value={isoDate(s.trialEndsAt)} onChange={e=>patch(s.id,{trialEndsAt:e.target.value})}/></td><td><div className="table-actions"><Link title="Abrir suporte" className="icon-btn" to={`/admin/suporte/${s.id}`}><Headphones size={16}/></Link><button disabled={busy===s.id} className={s.active?'secondary-btn compact':'primary-btn compact'} onClick={()=>patch(s.id,{active:!s.active,subscriptionStatus:!s.active?'active':'suspended'})}>{s.active?<><ShieldOff size={15}/>Bloquear</>:<><ShieldCheck size={15}/>Liberar</>}</button></div></td></tr>)}</tbody></table>{filtered.length===0&&<div className="empty-admin">Nenhuma loja encontrada.</div>}</div></>;
}
