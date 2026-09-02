import { useEffect,useState } from 'react';
import { doc,onSnapshot } from 'firebase/firestore';
import { Ban, Clock3, LogOut, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Store } from '../types/models';
import { LoadingState } from './ui/LoadingState';

function toDate(v:any){if(!v)return null;if(typeof v?.toDate==='function')return v.toDate();const d=new Date(v);return Number.isNaN(d.getTime())?null:d;}
export function MerchantAccessGate({children}:{children:React.ReactNode}){
 const {profile,logout}=useAuth();const [store,setStore]=useState<(Store&{subscriptionStatus?:string;trialEndsAt?:any})|null>(null);const [loading,setLoading]=useState(true);
 useEffect(()=>{if(!profile?.storeId){setLoading(false);return;}return onSnapshot(doc(db,'stores',profile.storeId),s=>{setStore(s.exists()?({id:s.id,...s.data()} as any):null);setLoading(false);},()=>setLoading(false));},[profile?.storeId]);
 if(loading)return <div className="screen-center"><LoadingState rows={3} label="Verificando sua loja..."/></div>;
 if(!profile?.storeId||!store)return <AccessState title="Loja não vinculada" text="Seu usuário não está vinculado a uma loja. Fale com o suporte do Vitrio." onLogout={logout}/>;
 const trialEnd=toDate(store.trialEndsAt);const trialExpired=store.subscriptionStatus==='trial'&&trialEnd&&trialEnd.getTime()<Date.now();
 const blocked=!store.active||trialExpired||['past_due','suspended','cancelled'].includes(store.subscriptionStatus||'');
 if(blocked){const trial=store.subscriptionStatus==='trial';return <AccessState title={trial?'Seu período de teste terminou':'Acesso da loja suspenso'} text={trial?'Seu teste gratuito terminou. Consulte a situação da assinatura para continuar usando o Vitrio.':'A loja está temporariamente sem acesso ao painel. Consulte a assinatura ou fale com o suporte.'} trial={trial} onLogout={logout}/>;}
 return <>{children}</>;
}
function AccessState({title,text,trial,onLogout}:{title:string;text:string;trial?:boolean;onLogout:()=>Promise<void>}){return <div className="access-state"><div className="access-state-card"><div className="access-state-icon">{trial?<Clock3/>:<ShieldAlert/>}</div><span className="status-chip"><Ban size={13}/> Acesso restrito</span><h1>{title}</h1><p>{text}</p><div className="verify-actions"><Link className="primary-btn" to="/painel/assinatura">Ver plano e assinatura</Link><button className="secondary-btn" onClick={onLogout}><LogOut size={17}/>Sair da conta</button></div></div></div>}
