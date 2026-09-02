import { FormEvent, useEffect, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { Plus, Power, Trash2 } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUi } from '../../contexts/UiContext';
import { Category } from '../../types/models';

export function CategoriesPage(){
 const {profile}=useAuth(); const {toast,confirm:confirmAction}=useUi(); const [name,setName]=useState(''); const [items,setItems]=useState<Category[]>([]);
 useEffect(()=>{if(!profile?.storeId)return;return onSnapshot(query(collection(db,'categories'),where('storeId','==',profile.storeId)),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()} as Category)).sort((a,b)=>a.name.localeCompare(b.name))));},[profile?.storeId]);
 async function create(e:FormEvent){e.preventDefault();if(!profile?.storeId||!name.trim())return;await addDoc(collection(db,'categories'),{storeId:profile.storeId,name:name.trim(),active:true,createdAt:serverTimestamp()});setName('');toast('Categoria adicionada.');}
 return <><div className="page-head"><div><h1>Categorias</h1><p>Organize o catálogo para o cliente encontrar os produtos rapidamente.</p></div></div><div className="panel"><form onSubmit={create} className="inline-form"><input placeholder="Ex.: Eletrônicos, Roupas, Casa..." value={name} onChange={e=>setName(e.target.value)}/><button className="primary-btn"><Plus size={17}/>Adicionar categoria</button></form></div><div className="category-list">{items.length===0?<div className="empty-state"><h3>Nenhuma categoria</h3><p>Crie a primeira categoria da sua loja.</p></div>:items.map(c=><div className="category-row" key={c.id}><div><strong>{c.name}</strong><small>{c.active?'Visível na loja':'Oculta'}</small></div><div className="row-actions"><button className="icon-btn" title="Ativar/desativar" onClick={()=>updateDoc(doc(db,'categories',c.id),{active:!c.active})}><Power size={17}/></button><button className="icon-btn danger-btn" title="Excluir" onClick={async()=>{const ok=await confirmAction({title:'Excluir categoria',message:`Excluir a categoria ${c.name}?`,confirmLabel:'Excluir',danger:true});if(ok){await deleteDoc(doc(db,'categories',c.id));toast('Categoria excluída.')}}}><Trash2 size={17}/></button></div></div>)}</div></>;
}
