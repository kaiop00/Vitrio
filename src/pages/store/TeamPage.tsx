import { FormEvent, useEffect, useState } from 'react';
import { collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { AppUser, Permission } from '../../types/models';

const options:[Permission,string][]=[
 ['dashboard','Dashboard'],['products','Produtos'],['categories','Categorias'],['inventory','Estoque'],['orders','Pedidos'],['returns','Trocas/devoluções'],['cash','Caixa'],['customers','Clientes'],['coupons','Cupons'],['delivery','Entregas'],['reports','Relatórios'],['audit','Auditoria']
];

export function TeamPage(){
 const {profile}=useAuth();const [users,setUsers]=useState<AppUser[]>([]),[message,setMessage]=useState('');
 const [form,setForm]=useState({name:'',email:'',password:'',permissions:['dashboard','orders'] as Permission[]});
 useEffect(()=>{if(!profile?.storeId)return;return onSnapshot(query(collection(db,'users'),where('storeId','==',profile.storeId)),s=>setUsers(s.docs.map(d=>({uid:d.id,...d.data()} as AppUser))));},[profile?.storeId]);
 const toggle=(p:Permission)=>setForm({...form,permissions:form.permissions.includes(p)?form.permissions.filter(x=>x!==p):[...form.permissions,p]});
 async function submit(e:FormEvent){e.preventDefault();if(!profile?.storeId)return;setMessage('');try{const fn=httpsCallable(functions,'createStoreUser');await fn({...form,storeId:profile.storeId,isStoreOwner:false});setMessage('Funcionário criado com sucesso.');setForm({name:'',email:'',password:'',permissions:['dashboard','orders']});}catch(e:any){setMessage(e?.message||'Não foi possível criar o funcionário.');}}
 if(profile?.isStoreOwner!==true && profile?.permissions!==undefined)return <div className="screen-center">Somente o responsável principal da loja pode gerenciar a equipe.</div>;
 return <><div className="page-head"><div><h1>Equipe</h1><p>Crie acessos separados e escolha o que cada funcionário pode visualizar.</p></div></div>
 <div className="panel"><form className="form-grid" onSubmit={submit}><label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>E-mail<input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></label><label>Senha inicial<input type="password" minLength={6} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} required/></label><div className="span-2"><strong>Permissões</strong><div className="permission-grid">{options.map(([p,l])=><label key={p}><input type="checkbox" checked={form.permissions.includes(p)} onChange={()=>toggle(p)}/>{l}</label>)}</div></div><button className="primary-btn">Criar funcionário</button>{message&&<p>{message}</p>}</form></div>
 <div className="table-card"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Permissões</th><th>Status</th></tr></thead><tbody>{users.map(u=><tr key={u.uid}><td><strong>{u.displayName}</strong><br/><small>{u.email}</small></td><td>{u.isStoreOwner?'Responsável':'Funcionário'}</td><td>{u.isStoreOwner?'Acesso total':(u.permissions||[]).map(p=>options.find(x=>x[0]===p)?.[1]||p).join(', ')}</td><td>{u.isStoreOwner?<span className="status-chip ok">Ativo</span>:<button className="secondary-btn" onClick={()=>updateDoc(doc(db,'users',u.uid),{active:!u.active})}>{u.active?'Desativar':'Ativar'}</button>}</td></tr>)}</tbody></table></div></>;
}