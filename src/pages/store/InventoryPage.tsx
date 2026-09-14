import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { AlertTriangle, Boxes, ChevronDown, ChevronRight, History, MinusCircle, PlusCircle, Search } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Product, ProductVariant, Store } from '../../types/models';

type Movement={id:string;productId?:string;productName:string;variantId?:string;type:'in'|'out';quantity:number;before:number;after:number;reason:string;source?:string;createdAt?:any};
type StockTarget={product:Product;variant?:ProductVariant};

const movementSource=(source?:string)=>source==='order'?'Venda':source==='order_cancel'?'Cancelamento':source==='return'?'Devolução':'Ajuste manual';
const when=(value:any)=>{const d=value?.toDate?.();return d?d.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'Agora'};
const productStock=(p:Product)=>{const vars=(p.variants||[]).filter(v=>v.active!==false);return vars.length?vars.reduce((sum,v)=>sum+Number(v.stock||0),0):Number(p.stock||0)};
const withinLast30Days=(value:any)=>{const d=value?.toDate?.();if(!d)return true;const cutoff=new Date();cutoff.setDate(cutoff.getDate()-30);cutoff.setHours(0,0,0,0);return d>=cutoff;};

export function InventoryPage(){
 const {profile}=useAuth();
 const [products,setProducts]=useState<Product[]>([]),[moves,setMoves]=useState<Movement[]>([]),[store,setStore]=useState<Store|null>(null);
 const [selected,setSelected]=useState(''),[qty,setQty]=useState('1'),[kind,setKind]=useState<'in'|'out'>('in'),[reason,setReason]=useState('');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<'all'|'low'|'out'|'variants'>('all'),[expanded,setExpanded]=useState<string[]>([]),[message,setMessage]=useState('');

 useEffect(()=>{if(!profile?.storeId)return;const a=onSnapshot(query(collection(db,'products'),where('storeId','==',profile.storeId)),s=>setProducts(s.docs.map(d=>({id:d.id,...d.data()} as Product))));const b=onSnapshot(query(collection(db,'inventoryMovements'),where('storeId','==',profile.storeId)),s=>setMoves(s.docs.map(d=>({id:d.id,...d.data()} as Movement)).filter(m=>withinLast30Days(m.createdAt)).sort((x,y)=>(y.createdAt?.seconds||0)-(x.createdAt?.seconds||0))));const c=onSnapshot(doc(db,'stores',profile.storeId),d=>d.exists()&&setStore({id:d.id,...d.data()} as Store));return()=>{a();b();c();}},[profile?.storeId]);
 const threshold=Math.max(1,Number(store?.lowStockThreshold||5));
 const targets=useMemo<StockTarget[]>(()=>products.flatMap<StockTarget>(p=>{const variants=(p.variants||[]).filter(v=>v.active!==false);return variants.length?variants.map(v=>({product:p,variant:v} as StockTarget)):[{product:p} as StockTarget];}),[products]);
 const low=useMemo(()=>targets.filter(t=>Number(t.variant?.stock??t.product.stock)<=threshold),[targets,threshold]);
 const totalUnits=useMemo(()=>products.reduce((s,p)=>s+productStock(p),0),[products]);
 const filtered=useMemo(()=>products.filter(p=>{const q=search.trim().toLowerCase();if(q&&!p.name.toLowerCase().includes(q))return false;if(filter==='out')return productStock(p)<=0;if(filter==='low')return productStock(p)<=threshold||(p.variants||[]).some(v=>v.active!==false&&v.stock<=threshold);if(filter==='variants')return (p.variants||[]).length>0;return true;}),[products,search,filter,threshold]);
 const selectedTarget=useMemo(()=>{if(!selected)return null;const [pid,vid]=selected.split('::');const product=products.find(p=>p.id===pid);if(!product)return null;const variant=vid?product.variants?.find(v=>v.id===vid):undefined;return {product,variant} as StockTarget;},[selected,products]);

 async function adjust(e:FormEvent){e.preventDefault();setMessage('');if(!profile?.storeId||!profile.uid||!selectedTarget||Number(qty)<=0)return;const {product,variant}=selectedTarget;const amount=Number(qty);const before=Number(variant?.stock??product.stock);const delta=kind==='in'?amount:-amount;const after=Math.max(0,before+delta);if(kind==='out'&&amount>before){setMessage('A saída não pode ser maior que o estoque disponível.');return;}
  if(variant){const variants=(product.variants||[]).map(v=>v.id===variant.id?{...v,stock:after}:v);const stock=variants.reduce((sum,v)=>sum+Number(v.stock||0),0);await updateDoc(doc(db,'products',product.id),{variants,stock,updatedAt:serverTimestamp()});}
  else await updateDoc(doc(db,'products',product.id),{stock:after,updatedAt:serverTimestamp()});
  await addDoc(collection(db,'inventoryMovements'),{storeId:profile.storeId,productId:product.id,productName:variant?`${product.name} - ${variant.name}`:product.name,variantId:variant?.id||null,type:kind,quantity:amount,before,after,reason:reason.trim()||'Ajuste manual',source:'manual',createdBy:profile.uid,createdAt:serverTimestamp()});
  setQty('1');setReason('');setMessage('Estoque atualizado com sucesso.');
 }
 function toggle(id:string){setExpanded(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);}

 return <><div className="page-head"><div><h1>Estoque</h1><p>Controle por produto e variação. A tela exibe as movimentações dos últimos 30 dias.</p></div></div>
 <div className="stock-health-grid">
  <div className="stock-health-card stock-health-card-units">
   <div className="stock-health-icon"><Boxes size={22}/></div>
   <div className="stock-health-copy"><small>Unidades disponíveis</small><strong>{totalUnits}</strong><span>Estoque atual da loja</span></div>
  </div>
  <div className="stock-health-card stock-health-card-alert">
   <div className="stock-health-icon"><AlertTriangle size={22}/></div>
   <div className="stock-health-copy"><small>Atenção de estoque</small><strong>{low.length}</strong><span>Limite: {threshold} un.</span></div>
  </div>
  <div className="stock-health-card stock-health-card-moves">
   <div className="stock-health-icon"><History size={22}/></div>
   <div className="stock-health-copy"><small>Movimentações</small><strong>{moves.length}</strong><span>Últimos 30 dias</span></div>
  </div>
 </div>
 <div className="panel stock-adjust-panel"><div className="panel-head"><div><h2>Ajustar estoque</h2><p>Escolha o produto ou uma variação específica.</p></div></div><form onSubmit={adjust} className="form-grid"><label>Produto / variação<select value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Selecione...</option>{products.map(p=><optgroup key={p.id} label={p.name}>{(p.variants||[]).filter(v=>v.active!==false).length?(p.variants||[]).filter(v=>v.active!==false).map(v=><option key={v.id} value={`${p.id}::${v.id}`}>{v.name}{v.sku?` · ${v.sku}`:''} · {v.stock} un.</option>):<option value={p.id}>{p.sku?`${p.sku} · `:''}{p.stock} un.</option>}</optgroup>)}</select></label><label>Movimento<select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="in">Entrada</option><option value="out">Saída</option></select></label><label>Quantidade<input type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)}/></label><label>Motivo<input placeholder="Compra, perda, correção..." value={reason} onChange={e=>setReason(e.target.value)}/></label><button className="primary-btn">{kind==='in'?<PlusCircle size={17}/>:<MinusCircle size={17}/>}Registrar ajuste</button>{message&&<span className="success-inline">{message}</span>}</form></div>
 <div className="panel inventory-toolbar"><label className="search-box"><Search size={17}/><input placeholder="Buscar produto" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="stock-filter-chips"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos</button><button className={filter==='low'?'active':''} onClick={()=>setFilter('low')}>Estoque baixo</button><button className={filter==='out'?'active':''} onClick={()=>setFilter('out')}>Esgotados</button><button className={filter==='variants'?'active':''} onClick={()=>setFilter('variants')}>Com variações</button></div></div>
 <div className="two-cols inventory-layout"><div className="table-card inventory-table"><table><thead><tr><th>Produto</th><th>SKU</th><th>Estoque</th><th>Situação</th></tr></thead><tbody>{filtered.map(p=>{const has=(p.variants||[]).length>0;const currentStock=productStock(p);const state=currentStock===0?'danger':currentStock<=threshold?'warning':'ok';return <Fragment key={p.id}><tr className="inventory-product-row"><td><button className="inventory-expand" onClick={()=>has&&toggle(p.id)}>{has?(expanded.includes(p.id)?<ChevronDown size={16}/>:<ChevronRight size={16}/>):<span/>}<strong>{p.name}</strong>{has&&<small>{p.variants!.length} variação(ões)</small>}</button></td><td>{p.sku||'—'}</td><td><strong>{currentStock}</strong></td><td><span className={`stock-badge ${state}`}>{currentStock===0?'Esgotado':currentStock<=threshold?'Baixo':'Disponível'}</span></td></tr>{has&&expanded.includes(p.id)&&(p.variants||[]).map(v=>{const vs=v.stock===0?'danger':v.stock<=threshold?'warning':'ok';return <tr className="inventory-variant-row" key={v.id}><td><span>{v.name}</span></td><td>{v.sku||'—'}</td><td>{v.stock}</td><td><span className={`stock-badge ${vs}`}>{v.stock===0?'Esgotado':v.stock<=threshold?'Baixo':'Disponível'}</span></td></tr>})}</Fragment>})}</tbody></table>{filtered.length===0&&<div className="empty-state"><h3>Nenhum item encontrado</h3><p>Altere a busca ou os filtros de estoque.</p></div>}</div>
 <div className="panel movement-panel"><div className="panel-head"><div><h2>Movimentações recentes</h2><p>Últimos 30 dias. O histórico antigo continua preservado nos dados.</p></div></div>{moves.length===0?<p className="muted">Nenhuma movimentação nos últimos 30 dias.</p>:moves.slice(0,18).map(m=><div className="movement-row" key={m.id}><div className={`movement-icon ${m.type}`}>{m.type==='in'?<PlusCircle size={16}/>:<MinusCircle size={16}/>}</div><div className="movement-copy"><strong>{m.productName}</strong><small>{m.reason} · {movementSource(m.source)}</small><span>{when(m.createdAt)} · {m.before} → {m.after}</span></div><b className={m.type}>{m.type==='in'?'+':'-'}{m.quantity}</b></div>)}</div></div></>;
}
