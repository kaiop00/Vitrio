import { FormEvent, useEffect, useState } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Save, QrCode, MessageCircle, WalletCards } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';

type BillingForm={pixKey:string;pixName:string;pixCity:string;billingWhatsapp:string;monthlyPrice:string};

export function AdminSettingsPage(){
 const {profile}=useAuth();
 const [form,setForm]=useState<BillingForm>({pixKey:'',pixName:'VITRIO',pixCity:'QUIXERAMOBIM',billingWhatsapp:'88888499692',monthlyPrice:'200'});
 const [saved,setSaved]=useState(false),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,'platformSettings','billing'));const d=snap.exists()?snap.data():{};setForm(v=>({...v,pixKey:String(d.pixKey??''),pixName:String(d.pixName??v.pixName),pixCity:String(d.pixCity??v.pixCity),billingWhatsapp:String(d.billingWhatsapp??v.billingWhatsapp),monthlyPrice:String(d.monthlyPrice??d.starterPrice??v.monthlyPrice)}));}catch(e:any){console.error('billing load',e);setMessage('Não foi possível carregar as configurações de cobrança. Verifique as regras do Firestore.');}finally{setLoading(false);}})();},[]);
 async function save(e:FormEvent){
  e.preventDefault();setMessage('');setSaved(false);
  if(!form.pixKey.trim()||!form.pixName.trim()||!form.pixCity.trim()||!form.billingWhatsapp.trim()||Number(form.monthlyPrice)<=0){setMessage('Preencha a chave Pix, recebedor, cidade, WhatsApp e um valor de mensalidade maior que zero.');return;}
  setSaving(true);
  try{await setDoc(doc(db,'platformSettings','billing'),{pixKey:form.pixKey.trim(),pixName:form.pixName.trim(),pixCity:form.pixCity.trim().toUpperCase(),billingWhatsapp:form.billingWhatsapp.replace(/\D/g,''),monthlyPrice:Number(form.monthlyPrice),updatedAt:serverTimestamp(),updatedBy:profile?.uid||null},{merge:true});setSaved(true);setMessage('Dados da cobrança salvos com sucesso.');setTimeout(()=>{setSaved(false);setMessage('');},2500);}catch(e:any){console.error('billing save',e);setMessage(e?.code==='permission-denied'?'Sem permissão para salvar. Faça o deploy das regras do Firestore desta versão.':'Não foi possível salvar a cobrança.');}finally{setSaving(false);}
 }
 return <><div className="page-head"><div><h1>Configurações da plataforma</h1><p>Cobrança manual da mensalidade do Vitrio e dados globais da plataforma.</p></div></div>
 {message&&<div className="notice">{message}</div>}
 <form onSubmit={save} className="settings-grid billing-admin-grid">
  <section className="panel"><div className="section-title-icon"><QrCode/><div><h2>Pix da assinatura Vitrio</h2><p>Este Pix é exclusivo para a mensalidade da plataforma. Não recebe vendas dos lojistas.</p></div></div>
   <div className="form-grid"><label className="span-2">Chave Pix<input disabled={loading||saving} value={form.pixKey} onChange={e=>setForm({...form,pixKey:e.target.value})} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"/></label><label>Nome do recebedor<input disabled={loading||saving} value={form.pixName} onChange={e=>setForm({...form,pixName:e.target.value})}/></label><label>Cidade<input disabled={loading||saving} value={form.pixCity} onChange={e=>setForm({...form,pixCity:e.target.value})}/></label><label className="span-2">WhatsApp para comprovantes<input disabled={loading||saving} value={form.billingWhatsapp} onChange={e=>setForm({...form,billingWhatsapp:e.target.value})} placeholder="(88) 8 8849-9692"/></label></div>
  </section>
  <section className="panel"><div className="section-title-icon"><WalletCards/><div><h2>Valor da mensalidade</h2><p>Um único valor de assinatura para todas as lojas da plataforma.</p></div></div><div className="billing-single-price"><label>Mensalidade Vitrio<input disabled={loading||saving} type="number" min="0.01" step="0.01" value={form.monthlyPrice} onChange={e=>setForm({...form,monthlyPrice:e.target.value})}/></label><div className="notice">Este valor alimenta automaticamente o QR Code e o Pix copia e cola exibidos ao lojista quando houver cobrança.</div></div></section>
  <section className="panel span-all"><div className="section-title-icon"><MessageCircle/><div><h2>Conferência manual</h2><p>O lojista paga pelo QR Code, envia o comprovante pelo WhatsApp e o responsável pela plataforma faz a conferência antes da liberação.</p></div></div><button disabled={loading||saving} className="primary-btn"><Save size={17}/> {saving?'Salvando...':'Salvar cobrança'}</button>{saved&&<span className="success-text">Configurações salvas ✓</span>}</section>
 </form></>;
}
