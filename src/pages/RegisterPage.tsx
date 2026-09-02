import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Store } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { sendEmailVerification } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { functions } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

function slugify(v:string){
  return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,55);
}

export function RegisterPage(){
  const navigate=useNavigate();
  const {login}=useAuth();
  const [form,setForm]=useState({ownerName:'',storeName:'',email:'',phone:'',password:'',confirm:''});
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const slug=useMemo(()=>slugify(form.storeName),[form.storeName]);

  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    if(form.password.length<6){setError('A senha precisa ter pelo menos 6 caracteres.');return;}
    if(form.password!==form.confirm){setError('As senhas não coincidem.');return;}
    if(!slug){setError('Informe o nome da loja.');return;}
    setLoading(true);
    try{
      const fn=httpsCallable(functions,'registerStore');
      await fn({ownerName:form.ownerName.trim(),storeName:form.storeName.trim(),email:form.email.trim(),phone:form.phone.trim(),password:form.password,slug});
      await login(form.email.trim(),form.password);
      if(auth.currentUser && !auth.currentUser.emailVerified){ try{auth.languageCode='pt-BR';await sendEmailVerification(auth.currentUser);}catch{} }
      navigate('/painel');
    }catch(err:any){
      const msg=String(err?.message||'');
      setError(msg.replace('FirebaseError: ','')||'Não foi possível criar sua loja.');
    }finally{setLoading(false);}
  }

  return <div className="signup-page">
    <div className="signup-aside">
      <Link to="/" className="marketing-brand"><span>V</span><strong>Vitrio</strong></Link>
      <div><span className="marketing-pill">Comece sua operação digital</span><h1>Crie sua loja e tenha seu próprio link de vendas.</h1><p>Você recebe um painel para cadastrar produtos, acompanhar pedidos, controlar estoque e personalizar sua vitrine.</p></div>
      <div className="signup-benefits"><span><CheckCircle2/> Vitrine responsiva</span><span><CheckCircle2/> Controle de estoque</span><span><CheckCircle2/> Pedidos e clientes</span><span><CheckCircle2/> Cupons e entregas</span></div>
    </div>

    <div className="signup-main">
      <div className="signup-card">
        <Link className="back-link" to="/"><ArrowLeft size={17}/> Voltar para o início</Link>
        <div className="signup-title"><div className="feature-icon"><Store/></div><div><h2>Crie sua loja</h2><p>Leva apenas alguns minutos.</p></div></div>
        <form onSubmit={submit} className="signup-form">
          <label>Seu nome<input value={form.ownerName} onChange={e=>setForm({...form,ownerName:e.target.value})} required placeholder="Nome do responsável"/></label>
          <label>Nome da loja<input value={form.storeName} onChange={e=>setForm({...form,storeName:e.target.value})} required placeholder="Ex.: Loja Central"/></label>
          {slug&&<div className="slug-preview">Seu link: <strong>/loja/{slug}</strong></div>}
          <div className="signup-two"><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>WhatsApp<input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="(88) 99999-9999"/></label></div>
          <div className="signup-two"><label>Senha<input type="password" minLength={6} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Confirmar senha<input type="password" minLength={6} value={form.confirm} onChange={e=>setForm({...form,confirm:e.target.value})} required/></label></div>
          {error&&<div className="error">{error}</div>}
          <button className="primary-btn big full" disabled={loading}>{loading?'Criando sua loja...':'Criar minha loja'}</button>
          <p className="signup-login">Já possui uma conta? <Link to="/login">Entrar</Link></p>
        </form>
      </div>
    </div>
  </div>
}