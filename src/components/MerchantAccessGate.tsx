import { useEffect,useState } from 'react';
import { doc,onSnapshot } from 'firebase/firestore';
import { Ban, Clock3, LogOut, ShieldAlert, WalletCards } from 'lucide-react';
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
 const now=Date.now();const trialEnd=toDate(store.trialEndsAt);const trialExpired=store.subscriptionStatus==='trial'&&trialEnd&&trialEnd.getTime()<=now;const subscriptionEnd=toDate((store as any).subscriptionEndsAt);const subscriptionExpired=store.subscriptionStatus==='active'&&subscriptionEnd&&subscriptionEnd.getTime()<now;
 const blocked=!store.active||trialExpired||subscriptionExpired||['past_due','suspended','cancelled'].includes(store.subscriptionStatus||'');
 if(blocked){
  const trial=!!trialExpired;
  const payment=!!(trialExpired||subscriptionExpired||['past_due','suspended'].includes(store.subscriptionStatus||''));
  const title=trial?'Seu período de teste expirou':subscriptionExpired?'Sua assinatura venceu':store.subscriptionStatus==='past_due'?'Pagamento pendente':store.subscriptionStatus==='suspended'?'Acesso bloqueado por falta de pagamento':store.subscriptionStatus==='cancelled'?'Assinatura cancelada':'Acesso da loja bloqueado';
  const text=trial?'O período gratuito terminou. Para continuar usando o Vitrio, efetue o pagamento da assinatura via Pix e envie o comprovante para conferência.':subscriptionExpired?'A vigência da sua assinatura terminou. Efetue o pagamento da mensalidade via Pix e envie o comprovante para conferência.':store.subscriptionStatus==='past_due'?'Existe uma pendência de pagamento na sua assinatura. Regularize via Pix e envie o comprovante para o financeiro do Vitrio.':store.subscriptionStatus==='suspended'?'Seu acesso foi bloqueado por falta de pagamento. Efetue o Pix da assinatura e envie o comprovante para conferência. Após a validação, o responsável pela plataforma libera novamente a loja.':store.subscriptionStatus==='cancelled'?'A assinatura desta loja está cancelada. Entre em contato com o suporte caso queira reativar o acesso.':'A loja está temporariamente sem acesso ao painel. Consulte a assinatura ou fale com o suporte.';
  return <AccessState title={title} text={text} payment={payment} trial={trial} onLogout={logout}/>;
 }
 return <>{children}</>;
}
function AccessState({title,text,trial,payment,onLogout}:{title:string;text:string;trial?:boolean;payment?:boolean;onLogout:()=>Promise<void>}){return <div className="access-state"><div className="access-state-card"><div className="access-state-icon">{trial?<Clock3/>:<ShieldAlert/>}</div><span className="status-chip"><Ban size={13}/> Acesso restrito</span><h1>{title}</h1><p>{text}</p>{payment&&<div className="access-payment-note"><WalletCards/><span>O pagamento é conferido manualmente. Seu acesso será liberado após a validação do comprovante.</span></div>}<div className="verify-actions"><Link className="primary-btn" to="/painel/assinatura">Pagar / ver assinatura</Link><button className="secondary-btn" onClick={onLogout}><LogOut size={17}/>Sair da conta</button></div></div></div>}
