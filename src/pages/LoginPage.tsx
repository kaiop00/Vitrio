import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function LoginPage() {
  const { login, firebaseUser, profile, loading:authLoading } = useAuth(); const navigate=useNavigate();
  useEffect(()=>{if(!authLoading&&firebaseUser&&profile)navigate(profile.role==='admin'?'/admin':'/painel',{replace:true});},[authLoading,firebaseUser,profile,navigate]);
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  async function submit(e:FormEvent){e.preventDefault();setError('');setLoading(true);try{
    const profile=await login(email,password);
    navigate(profile.role==='admin'?'/admin':'/painel',{replace:true});
  }catch(err:any){const code=String(err?.message||'');setError(code==='ACCESS_DISABLED'?'Seu acesso está desativado. Entre em contato com o suporte.':code==='PROFILE_NOT_FOUND'?'Conta sem perfil no Vitrio. Entre em contato com o suporte.':'E-mail ou senha inválidos.');}finally{setLoading(false);}}
  return <div className="login-page"><div className="login-card">
    <Link to="/" className="back-link">← Voltar para o início</Link>
    <div className="brand login-brand"><span className="brand-mark">V</span><div><strong>Vitrio</strong><small>Seu comércio em um link.</small></div></div>
    <h1>Bem-vindo</h1><p>Um único acesso. O Vitrio direciona você automaticamente para o painel correto.</p>
    <form onSubmit={submit}><label>E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>Senha<input value={password} onChange={e=>setPassword(e.target.value)} type="password" required/></label><div className="login-tools"><Link to="/recuperar-senha">Esqueci minha senha</Link></div>{error&&<div className="error">{error}</div>}<button className="primary-btn" disabled={loading}>{loading?'Entrando...':'Entrar'}</button></form>
    <p className="signup-login">Quer abrir uma loja? <Link to="/cadastro">Criar minha loja</Link></p>
  </div></div>;
}
