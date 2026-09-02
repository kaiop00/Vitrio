import { useEffect, useMemo, useState } from 'react';
import { BadgeDollarSign, BarChart3, Bell, Boxes, Building2, ChevronDown, ContactRound, CreditCard, ExternalLink, FolderTree, Headphones, History, LayoutGrid, LineChart, LogOut, MapPinned, Menu, Package, Rocket, Search, Settings, ShoppingCart, Store as StoreIcon, TicketPercent, Users, WalletCards, X, RotateCcw, QrCode } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { Permission, Store } from '../types/models';
import { CommandPalette } from './CommandPalette';

type MerchantItem={to:string;icon:any;label:string;permission:Permission|'__public__'|'__owner__'};
type NavGroup={label:string;items:MerchantItem[]};

const merchantGroups:NavGroup[]=[
 {label:'Visão geral',items:[
  {to:'/painel',icon:BarChart3,label:'Dashboard',permission:'dashboard'},
  {to:'/painel/atividade',icon:Bell,label:'Atividade',permission:'__public__'},
  {to:'/painel/primeiros-passos',icon:Rocket,label:'Primeiros passos',permission:'__public__'},
 ]},
 {label:'Operação',items:[
  {to:'/painel/pedidos',icon:ShoppingCart,label:'Pedidos',permission:'orders'},
  {to:'/painel/produtos',icon:Package,label:'Produtos',permission:'products'},
  {to:'/painel/categorias',icon:FolderTree,label:'Categorias',permission:'categories'},
  {to:'/painel/estoque',icon:Boxes,label:'Estoque',permission:'inventory'},
  {to:'/painel/devolucoes',icon:RotateCcw,label:'Trocas e devoluções',permission:'returns'},
 ]},
 {label:'Relacionamento',items:[
  {to:'/painel/clientes',icon:ContactRound,label:'Clientes',permission:'customers'},
  {to:'/painel/cupons',icon:TicketPercent,label:'Cupons',permission:'coupons'},
  {to:'/painel/entregas',icon:MapPinned,label:'Entregas',permission:'delivery'},
 ]},
 {label:'Gestão',items:[
  {to:'/painel/caixa',icon:WalletCards,label:'Caixa',permission:'cash'},
  {to:'/painel/pagamentos',icon:CreditCard,label:'Pagamentos',permission:'payments'},
  {to:'/painel/relatorios',icon:LineChart,label:'Relatórios',permission:'reports'},
  {to:'/painel/equipe',icon:Users,label:'Equipe',permission:'__owner__'},
  {to:'/painel/auditoria',icon:History,label:'Auditoria',permission:'audit'},
 ]},
 {label:'Loja',items:[
  {to:'/painel/minha-loja',icon:StoreIcon,label:'Minha loja',permission:'store_settings'},
  {to:'/painel/divulgacao',icon:QrCode,label:'Divulgação',permission:'__public__'},
  {to:'/painel/configuracoes',icon:Settings,label:'Configurações',permission:'checkout_settings'},
  {to:'/painel/assinatura',icon:BadgeDollarSign,label:'Plano e assinatura',permission:'__public__'},
 ]},
];

const adminGroups=[
 {label:'Plataforma',items:[{to:'/admin',icon:BarChart3,label:'Visão geral'},{to:'/admin/lojas',icon:Building2,label:'Clientes e lojas'},{to:'/admin/acessos',icon:Users,label:'Acessos'}]},
 {label:'Controle',items:[{to:'/admin/auditoria',icon:History,label:'Auditoria'},{to:'/admin/configuracoes',icon:Settings,label:'Configurações'}]},
];

function pageTitle(path:string){
 const map:Record<string,string>={
  '/painel':'Dashboard','/painel/atividade':'Atividade','/painel/primeiros-passos':'Primeiros passos','/painel/avisos':'Avisos','/painel/produtos':'Produtos','/painel/categorias':'Categorias','/painel/estoque':'Estoque','/painel/pedidos':'Pedidos','/painel/devolucoes':'Trocas e devoluções','/painel/caixa':'Caixa','/painel/clientes':'Clientes','/painel/cupons':'Cupons','/painel/entregas':'Entregas','/painel/pagamentos':'Pagamentos','/painel/relatorios':'Relatórios','/painel/equipe':'Equipe','/painel/auditoria':'Auditoria','/painel/minha-loja':'Minha loja','/painel/divulgacao':'Divulgação','/painel/configuracoes':'Configurações','/painel/assinatura':'Plano e assinatura',
  '/admin':'Visão geral','/admin/lojas':'Clientes e lojas','/admin/acessos':'Acessos','/admin/auditoria':'Auditoria','/admin/configuracoes':'Configurações'
 };
 if(path.startsWith('/admin/suporte/'))return 'Central de suporte';
 return map[path]||'Vitrio';
}

export function AppShell(){
 const {profile,logout}=useAuth(); const location=useLocation();
 const [store,setStore]=useState<Store|null>(null),[mobile,setMobile]=useState(false),[palette,setPalette]=useState(false);
 useEffect(()=>{if(!profile?.storeId){setStore(null);return}return onSnapshot(doc(db,'stores',profile.storeId),s=>setStore(s.exists()?({id:s.id,...s.data()} as Store):null))},[profile?.storeId]);
 useEffect(()=>{setMobile(false)},[location.pathname]);
 useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPalette(v=>!v)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
 const allowed=(p:MerchantItem['permission'])=>(profile?.isStoreOwner===true||profile?.permissions===undefined)||p==='__public__'||(p!=='__owner__'&&(profile?.permissions||[]).includes(p as Permission));
 const groups=useMemo(()=>profile?.role==='admin'?adminGroups:merchantGroups.map(g=>({...g,items:g.items.filter(i=>allowed(i.permission))})).filter(g=>g.items.length),[profile?.role,profile?.isStoreOwner,profile?.permissions]);
 const title=pageTitle(location.pathname);
 return <div className="app-shell-v2">
  <aside className={`sidebar-v2 ${mobile?'open':''}`}>
   <div className="sidebar-brand"><span className="brand-mark">V</span><div><strong>Vitrio</strong><small>{profile?.role==='admin'?'Administração':'Gestão da loja'}</small></div><button className="mobile-close" onClick={()=>setMobile(false)} aria-label="Fechar menu"><X size={18}/></button></div>
   {profile?.role==='merchant'&&store&&<div className="sidebar-store"><span>{store.logoUrl?<img src={store.logoUrl} alt=""/>:store.name.slice(0,1).toUpperCase()}</span><div><strong>{store.name}</strong><small>{store.subscriptionStatus==='trial'?'Período de teste':store.subscriptionStatus==='active'?'Assinatura ativa':'Atenção na assinatura'}</small></div><ChevronDown size={15}/></div>}
   <nav className="sidebar-nav">{(groups as any[]).map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map((item:any)=>{const Icon=item.icon;return <NavLink key={item.to} to={item.to} end={item.to==='/painel'||item.to==='/admin'} className={({isActive})=>`nav-item-v2 ${isActive?'active':''}`}><Icon size={18}/><span>{item.label}</span></NavLink>})}</div>)}</nav>
   <div className="sidebar-bottom">{profile?.role==='merchant'&&store&&<a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="sidebar-preview"><ExternalLink size={16}/>Ver minha vitrine</a>}<button className="nav-item-v2 logout-v2" onClick={logout}><LogOut size={18}/><span>Sair da conta</span></button></div>
  </aside>
  {mobile&&<button className="sidebar-overlay" onClick={()=>setMobile(false)} aria-label="Fechar menu"/>}
  <div className="workspace">
   <header className="topbar-v2"><div className="topbar-left"><button className="menu-button" onClick={()=>setMobile(true)} aria-label="Abrir menu"><Menu size={20}/></button><div><span className="crumb">{profile?.role==='admin'?'Administração':'Minha loja'}</span><strong>{title}</strong></div></div><div className="topbar-actions"><button className="command-trigger" onClick={()=>setPalette(true)} aria-label="Abrir busca rápida"><Search size={17}/><span>Buscar ou ir para...</span><kbd>⌘ K</kbd></button>{profile?.role==='merchant'&&<Link to="/painel/avisos" className="top-icon" title="Avisos"><Bell size={19}/></Link>}<div className="profile-chip"><span>{(profile?.displayName||profile?.email||'V').slice(0,1).toUpperCase()}</span><div><strong>{profile?.displayName||'Minha conta'}</strong><small>{profile?.role==='admin'?'Master':'Lojista'}</small></div></div></div></header>
   <main className="content-v2"><Outlet/></main>
  </div>
  <CommandPalette open={palette} onClose={()=>setPalette(false)}/>
 </div>;
}
