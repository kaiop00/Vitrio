import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Permission, Role } from '../types/models';
import { MerchantAccessGate } from './MerchantAccessGate';
import { LoadingState } from './ui/LoadingState';
export function ProtectedRoute({roles,permission,children}:{roles?:Role[];permission?:Permission;children:React.ReactNode}){
 const {firebaseUser,profile,loading}=useAuth(); const location=useLocation();
 if(loading)return <div className="screen-center"><LoadingState rows={3} label="Carregando Vitrio..."/></div>;
 if(!firebaseUser)return <Navigate to="/login" replace/>;
 if(!profile)return <div className="screen-center">Seu usuário ainda não possui perfil no Vitrio.</div>;
 if(!profile.active)return <div className="screen-center">Acesso desativado. Fale com o administrador.</div>;
 if(roles&&!roles.includes(profile.role))return <Navigate to={profile.role==='admin'?'/admin':'/painel'} replace/>;
 if(permission&&profile.role==='merchant'&&profile.isStoreOwner!==true&&profile.permissions!==undefined&&!(profile.permissions||[]).includes(permission))return <Navigate to="/painel" replace/>;
 // A página de assinatura continua acessível mesmo quando a loja está suspensa,
 // para o lojista entender o motivo do bloqueio e consultar sua situação.
 if(profile.role==='merchant' && location.pathname==='/painel/assinatura') return <>{children}</>;
 if(profile.role==='merchant')return <MerchantAccessGate>{children}</MerchantAccessGate>;
 return <>{children}</>;
}
