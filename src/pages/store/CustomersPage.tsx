import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { Search } from 'lucide-react'; import { db } from '../../lib/firebase'; import { useAuth } from '../../contexts/AuthContext'; import { Customer } from '../../types/models';
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export function CustomersPage(){const {profile}=useAuth();const [items,setItems]=useState<Customer[]>([]),[search,setSearch]=useState('');
useEffect(()=>{if(!profile?.storeId)return;return onSnapshot(query(collection(db,'customers'),where('storeId','==',profile.storeId)),s=>setItems(s.docs.map(d=>({id:d.id,...d.data()} as Customer))));},[profile?.storeId]);
const visible=useMemo(()=>items.filter(c=>`${c.name} ${c.phone} ${c.email||''}`.toLowerCase().includes(search.toLowerCase())),[items,search]);
return <><div className="page-head"><div><h1>Clientes</h1><p>Histórico básico de quem compra pelo checkout Vitrio.</p></div></div><div className="panel"><label className="search-box"><Search size={18}/><input placeholder="Buscar cliente" value={search} onChange={e=>setSearch(e.target.value)}/></label></div><div className="table-card"><table><thead><tr><th>Cliente</th><th>Contato</th><th>Pedidos</th><th>Total comprado</th></tr></thead><tbody>{visible.map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone}<br/><small>{c.email}</small></td><td>{c.ordersCount||0}</td><td>{money(c.totalSpent||0)}</td></tr>)}</tbody></table></div></>;}
