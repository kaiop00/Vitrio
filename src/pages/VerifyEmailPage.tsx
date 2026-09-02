import { useState } from 'react';
import { CheckCircle2, Mail, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../lib/firebase';

export function VerifyEmailPage(){
 const {firebaseUser,profile}=useAuth(); const navigate=useNavigate(); const [msg,setMsg]=useState(''); const [loading,setLoading]=useState(false);
 async function send(){if(!firebaseUser)return;setLoading(true);setMsg('');try{auth.languageCode='pt-BR';await sendEmailVerification(firebaseUser);setMsg('E-mail de confirmação enviado em português.');}catch{setMsg('Não foi possível enviar agora. Aguarde um pouco e tente novamente.');}finally{setLoading(false)}}
 async function refresh(){if(!firebaseUser)return;await firebaseUser.reload();navigate(profile?.role==='admin'?'/admin':'/painel',{replace:true});}
 return <div className="access-state"><div className="access-state-card"><div className="access-state-icon email"><Mail/></div><span className="status-chip">Verificação de e-mail</span><h1>Confirme seu endereço de e-mail</h1><p>Isso ajuda a proteger sua conta e permite recuperar o acesso com segurança.</p>{firebaseUser?.emailVerified?<div className="success-inline"><CheckCircle2/> E-mail já confirmado.</div>:<div className="verify-actions"><button className="primary-btn" onClick={send} disabled={loading}>{loading?'Enviando...':'Enviar e-mail de confirmação'}</button><button className="secondary-btn" onClick={refresh}><RefreshCw size={16}/> Já confirmei</button></div>}{msg&&<p className="muted">{msg}</p>}</div></div>
}
