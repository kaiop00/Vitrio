import { FormEvent, useState } from 'react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';

export function ForgotPasswordPage(){
  const [email,setEmail]=useState(''); const [loading,setLoading]=useState(false); const [sent,setSent]=useState(false); const [error,setError]=useState('');
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{auth.languageCode='pt-BR';await sendPasswordResetEmail(auth,email.trim());setSent(true);}catch{setError('Não foi possível enviar o link agora. Confira o e-mail e tente novamente.');}finally{setLoading(false)}}
  return <div className="login-page"><div className="login-card"><Link to="/login" className="back-link"><ArrowLeft size={17}/> Voltar para o login</Link><div className="brand login-brand"><span className="brand-mark">V</span><div><strong>Vitrio</strong><small>Recuperação de acesso</small></div></div>{sent?<div className="auth-success"><MailCheck/><h1>Confira seu e-mail</h1><p>Enviamos um link para redefinir sua senha. Se não encontrar, confira também a caixa de spam.</p><Link className="primary-btn" to="/login">Voltar para entrar</Link></div>:<><h1>Esqueci minha senha</h1><p>Informe o e-mail da sua conta para receber o link de redefinição.</p><form onSubmit={submit}><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required autoFocus/></label>{error&&<div className="error">{error}</div>}<button className="primary-btn" disabled={loading}>{loading?'Enviando...':'Enviar link de recuperação'}</button></form></>}</div></div>
}
