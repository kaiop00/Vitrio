import { FormEvent, useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { Permission, Store } from '../../types/models';

const options:[Permission,string][]=[
 ['dashboard','Dashboard'],['products','Produtos'],['categories','Categorias'],['inventory','Estoque'],['orders','Pedidos'],['returns','Trocas/devoluções'],['cash','Caixa'],['customers','Clientes'],['coupons','Cupons'],['delivery','Entregas'],['payments','Pagamentos'],['reports','Relatórios'],['audit','Auditoria'],['store_settings','Minha loja'],['checkout_settings','Configurações']
];

export function AccessPage(){
 const [stores,setStores]=useState<Store[]>([]);const [form,setForm]=useState({name:'',email:'',password:'',storeId:'',isStoreOwner:true,permissions:options.map(x=>x[0]) as Permission[]});const [message,setMessage]=useState('');
 useEffect(()=>{getDocs(collection(db,'stores')).then(s=>setStores(s.docs.map(d=>({id:d.id,...d.data()} as Store))));},[]);
 const toggle=(p:Permission)=>setForm({...form,permissions:form.permissions.includes(p)?form.permissions.filter(x=>x!==p):[...form.permissions,p]});
 async function submit(e:FormEvent){e.preventDefault();setMessage('');try{const fn=httpsCallable(functions,'createStoreUser');await fn(form);setMessage('Acesso criado com sucesso.');setForm({...form,name:'',email:'',password:''});}catch(err:any){setMessage(err?.message||'Não foi possível criar o acesso.');}}
 return <><div className="page-head"><div><h1>Acessos</h1><p>Crie o responsável da loja ou funcionários com permissões específicas.</p></div></div><div className="panel"><form onSubmit={submit} className="form-grid">
 <label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Senha inicial<input type="password" minLength={6} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><label>Loja<select value={form.storeId} onChange={e=>setForm({...form,storeId:e.target.value})} required><option value="">Selecione...</option>{stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
 <label className="check-line span-2"><input type="checkbox" checked={form.isStoreOwner} onChange={e=>setForm({...form,isStoreOwner:e.target.checked,permissions:e.target.checked?options.map(x=>x[0]):form.permissions})}/> Responsável principal da loja</label>
 {!form.isStoreOwner&&<div className="span-2"><strong>Permissões do funcionário</strong><div className="permission-grid">{options.map(([p,label])=><label key={p}><input type="checkbox" checked={form.permissions.includes(p)} onChange={()=>toggle(p)}/>{label}</label>)}</div></div>}
 <button className="primary-btn">Criar acesso</button>{message&&<p>{message}</p>}</form></div></>;
}