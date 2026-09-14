import { FormEvent, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword, deleteUser, getAuth, signOut, updateProfile } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { CheckCircle2, LoaderCircle, UserPlus, X } from 'lucide-react';
import { db, firebaseConfig } from '../../lib/firebase';
import { Permission, Store } from '../../types/models';

const options:[Permission,string][]=[
 ['dashboard','Dashboard'],['products','Produtos'],['categories','Categorias'],['inventory','Estoque'],['orders','Pedidos'],['returns','Trocas/devoluções'],['cash','Caixa'],['customers','Clientes'],['coupons','Cupons'],['delivery','Entregas'],['payments','Pagamentos'],['reports','Relatórios'],['audit','Auditoria'],['store_settings','Minha loja'],['checkout_settings','Configurações']
];

const secondaryAppName='vitrio-user-creator';

export function AccessPage(){
 const [stores,setStores]=useState<Store[]>([]),[loadingStores,setLoadingStores]=useState(true),[busy,setBusy]=useState(false);
 const [form,setForm]=useState({name:'',email:'',password:'',storeId:'',isStoreOwner:true,permissions:[] as Permission[]});
 const [message,setMessage]=useState('');
 const [created,setCreated]=useState<{name:string;email:string;storeName:string}|null>(null);

 useEffect(()=>{
  setLoadingStores(true);
  const unsub=onSnapshot(collection(db,'stores'),snap=>{
   const rows=snap.docs.map(d=>({id:d.id,...d.data()} as Store)).sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
   setStores(rows);
   setLoadingStores(false);
  },e=>{
   console.error('stores load',e);
   setStores([]);
   setLoadingStores(false);
   setMessage(e?.code==='permission-denied'?'Sem permissão para carregar as lojas. Confira as regras do Firestore.':'Não foi possível carregar as lojas.');
  });
  return()=>unsub();
 },[]);

 const toggle=(p:Permission)=>setForm({...form,permissions:form.permissions.includes(p)?form.permissions.filter(x=>x!==p):[...form.permissions,p]});

 async function submit(e:FormEvent){
  e.preventDefault();
  setMessage('');
  if(busy)return;
  const name=form.name.trim();
  const email=form.email.trim().toLowerCase();
  const password=form.password;
  if(!name||!email||password.length<6||!form.storeId){setMessage('Preencha nome, e-mail, senha e loja.');return;}
  setBusy(true);

  let createdUser:any=null;
  try{
   // Cria o novo login em uma instância de Auth separada para não desconectar o Master.
   const secondaryApp=getApps().find(a=>a.name===secondaryAppName) || initializeApp(firebaseConfig,secondaryAppName);
   const secondaryAuth=getAuth(secondaryApp);
   await signOut(secondaryAuth).catch(()=>{});
   const credential=await createUserWithEmailAndPassword(secondaryAuth,email,password);
   createdUser=credential.user;
   await updateProfile(createdUser,{displayName:name});

   const permissions=form.isStoreOwner?options.map(x=>x[0]):form.permissions;
   try{
    // O perfil é gravado pelo Firestore autenticado do Master.
    await setDoc(doc(db,'users',createdUser.uid),{
     displayName:name,
     email,
     role:'merchant',
     storeId:form.storeId,
     active:true,
     isStoreOwner:form.isStoreOwner,
     permissions,
     createdAt:serverTimestamp(),
     updatedAt:serverTimestamp()
    });
   }catch(profileError){
    // Evita deixar uma conta órfã no Firebase Authentication.
    try{await deleteUser(createdUser)}catch{}
    throw profileError;
   }finally{
    await signOut(secondaryAuth).catch(()=>{});
   }

   const storeName=stores.find(s=>s.id===form.storeId)?.name||'loja selecionada';
   setMessage('');
   setCreated({name,email,storeName});
   setForm({name:'',email:'',password:'',storeId:form.storeId,isStoreOwner:false,permissions:[]});
  }catch(err:any){
   console.error('create access',err);
   const code=String(err?.code||'');
   if(code.includes('email-already-in-use'))setMessage('Este e-mail já possui uma conta no Firebase Authentication.');
   else if(code.includes('invalid-email'))setMessage('O e-mail informado é inválido.');
   else if(code.includes('weak-password'))setMessage('A senha precisa ter pelo menos 6 caracteres.');
   else if(code.includes('permission-denied'))setMessage('A conta foi criada, mas o Master não tem permissão para gravar o perfil. Confira as regras do Firestore.');
   else setMessage(String(err?.message||'Não foi possível criar o acesso.').replace('FirebaseError: ',''));
  }finally{setBusy(false)}
 }

 return <><div className="page-head"><div><h1>Acessos</h1><p>Crie o responsável da loja ou funcionários com permissões específicas.</p></div></div>{message&&<div className="notice">{message}</div>}<div className="panel"><form onSubmit={submit} className="form-grid">
 <label>Nome<input disabled={busy} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>E-mail<input disabled={busy} type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Senha inicial<input disabled={busy} type="password" minLength={6} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Loja<select disabled={busy||loadingStores} value={form.storeId} onChange={e=>setForm({...form,storeId:e.target.value})} required><option value="">{loadingStores?'Carregando lojas...':'Selecione...'}</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>{loadingStores&&<small className="muted">Buscando lojas disponíveis...</small>}</label>
 <label className="check-line span-2"><input disabled={busy} type="checkbox" checked={form.isStoreOwner} onChange={e=>setForm({...form,isStoreOwner:e.target.checked,permissions:e.target.checked?options.map(x=>x[0]):[]})}/> Responsável principal da loja</label>
 {!form.isStoreOwner&&<div className="span-2"><strong>Permissões do funcionário</strong><div className="permission-grid">{options.map(([p,label])=><label key={p}><input disabled={busy} type="checkbox" checked={form.permissions.includes(p)} onChange={()=>toggle(p)}/>{label}</label>)}</div></div>}
 <button disabled={busy||loadingStores||!stores.length} className="primary-btn">{busy?<LoaderCircle size={17} className="spin"/>:<UserPlus size={17}/>} {busy?'Criando acesso...':'Criar acesso'}</button></form></div>
 {created&&<div className="access-success-overlay" role="dialog" aria-modal="true" aria-labelledby="access-created-title"><div className="access-success-card"><button type="button" className="access-success-close" onClick={()=>setCreated(null)} aria-label="Fechar"><X size={18}/></button><div className="access-success-icon"><CheckCircle2 size={30}/></div><h2 id="access-created-title">Usuário criado com sucesso!</h2><p>O acesso de <strong>{created.name}</strong> foi criado e vinculado à loja <strong>{created.storeName}</strong>.</p><div className="access-success-email">{created.email}</div><p className="muted">O usuário já pode entrar no Vitrio com o e-mail e a senha cadastrados.</p><button type="button" className="primary-btn" onClick={()=>setCreated(null)}>Entendi</button></div></div>}
 </>;
}
