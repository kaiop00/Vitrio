import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeDollarSign, BarChart3, Bell, Smartphone, Boxes, Building2, ContactRound, CreditCard, ExternalLink, FolderTree, Headphones, History, LineChart, LogOut, MapPinned, Menu, MessageCircle, Package, Rocket, Search, Settings, ShoppingCart, Store as StoreIcon, TicketPercent, Users, WalletCards, X, RotateCcw, QrCode } from 'lucide-react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';import { useAuth } from '../contexts/AuthContext';import { db } from '../lib/firebase';import { Order, Permission, Store } from '../types/models';import { CommandPalette } from './CommandPalette';
import { enablePushNotifications, disablePushNotifications } from '../lib/pushNotifications';
type MerchantItem={to:string;icon:any;label:string;permission:Permission|'__public__'|'__owner__'};type NavGroup={label:string;items:MerchantItem[]};
const merchantGroups:NavGroup[]=[
 {label:'Visão geral',items:[{to:'/painel',icon:BarChart3,label:'Dashboard',permission:'dashboard'},{to:'/painel/atividade',icon:Bell,label:'Atividade',permission:'__public__'},{to:'/painel/primeiros-passos',icon:Rocket,label:'Primeiros passos',permission:'__public__'}]},
 {label:'Operação',items:[{to:'/painel/pedidos',icon:ShoppingCart,label:'Pedidos',permission:'orders'},{to:'/painel/produtos',icon:Package,label:'Produtos',permission:'products'},{to:'/painel/categorias',icon:FolderTree,label:'Categorias',permission:'categories'},{to:'/painel/estoque',icon:Boxes,label:'Estoque',permission:'inventory'},{to:'/painel/devolucoes',icon:RotateCcw,label:'Trocas e devoluções',permission:'returns'}]},
 {label:'Relacionamento',items:[{to:'/painel/clientes',icon:ContactRound,label:'Clientes',permission:'customers'},{to:'/painel/cupons',icon:TicketPercent,label:'Cupons',permission:'coupons'},{to:'/painel/entregas',icon:MapPinned,label:'Entregas',permission:'delivery'}]},
 {label:'Gestão',items:[{to:'/painel/caixa',icon:WalletCards,label:'Caixa',permission:'cash'},{to:'/painel/pagamentos',icon:CreditCard,label:'Pagamentos',permission:'payments'},{to:'/painel/relatorios',icon:LineChart,label:'Relatórios',permission:'reports'},{to:'/painel/equipe',icon:Users,label:'Equipe',permission:'__owner__'},{to:'/painel/auditoria',icon:History,label:'Auditoria',permission:'audit'}]},
 {label:'Loja',items:[{to:'/painel/minha-loja',icon:StoreIcon,label:'Minha loja',permission:'store_settings'},{to:'/painel/divulgacao',icon:QrCode,label:'Divulgação',permission:'__public__'},{to:'/painel/configuracoes',icon:Settings,label:'Configurações',permission:'checkout_settings'},{to:'/painel/assinatura',icon:BadgeDollarSign,label:'Plano e assinatura',permission:'__public__'},{to:'/painel/mensagens',icon:MessageCircle,label:'Mensagens do pedido',permission:'__public__'},{to:'/painel/suporte',icon:Headphones,label:'Suporte',permission:'__public__'}]},
];
const adminGroups=[{label:'Plataforma',items:[{to:'/admin',icon:BarChart3,label:'Visão geral'},{to:'/admin/lojas',icon:Building2,label:'Clientes e lojas'},{to:'/admin/acessos',icon:Users,label:'Acessos'}]},{label:'Controle',items:[{to:'/admin/chamados',icon:Headphones,label:'Suporte'},{to:'/admin/auditoria',icon:History,label:'Auditoria'},{to:'/admin/configuracoes',icon:Settings,label:'Configurações'}]}];

function storeSubscriptionStatus(store:Store){
 const raw=store.subscriptionStatus||'trial';
 const trialEnd=(store.trialEndsAt as any)?.toDate?.()||((store.trialEndsAt as any)?new Date(store.trialEndsAt as any):null);
 const expired=raw==='trial'&&trialEnd instanceof Date&&!Number.isNaN(trialEnd.getTime())&&trialEnd.getTime()<Date.now();
 if(expired)return {label:'Teste expirado',tone:'warning'};
 if(raw==='trial')return {label:'Período de teste',tone:'trial'};
 if(raw==='active')return {label:'Assinatura ativa',tone:'ok'};
 if(raw==='past_due')return {label:'Pagamento pendente',tone:'warning'};
 if(raw==='suspended')return {label:'Bloqueado por falta de pagamento',tone:'danger'};
 if(raw==='cancelled')return {label:'Assinatura cancelada',tone:'danger'};
 if(store.active===false)return {label:'Acesso bloqueado',tone:'danger'};
 return {label:'Atenção na assinatura',tone:'warning'};
}
function pageTitle(path:string){const map:Record<string,string>={'/painel':'Dashboard','/painel/atividade':'Atividade','/painel/primeiros-passos':'Primeiros passos','/painel/avisos':'Avisos','/painel/produtos':'Produtos','/painel/categorias':'Categorias','/painel/estoque':'Estoque','/painel/pedidos':'Pedidos','/painel/devolucoes':'Trocas e devoluções','/painel/caixa':'Caixa','/painel/clientes':'Clientes','/painel/cupons':'Cupons','/painel/entregas':'Entregas','/painel/pagamentos':'Pagamentos','/painel/relatorios':'Relatórios','/painel/equipe':'Equipe','/painel/auditoria':'Auditoria','/painel/minha-loja':'Minha loja','/painel/divulgacao':'Divulgação','/painel/configuracoes':'Configurações','/painel/assinatura':'Plano e assinatura','/painel/mensagens':'Mensagens do pedido','/painel/suporte':'Suporte','/admin':'Visão geral','/admin/lojas':'Clientes e lojas','/admin/acessos':'Acessos','/admin/chamados':'Suporte','/admin/auditoria':'Auditoria','/admin/configuracoes':'Configurações'};if(path.startsWith('/admin/suporte/'))return'Central de suporte';return map[path]||'Vitrio';}
export function AppShell(){const {profile,logout}=useAuth();const location=useLocation();const [store,setStore]=useState<Store|null>(null),[mobile,setMobile]=useState(false),[palette,setPalette]=useState(false);
 const [pendingOrders,setPendingOrders]=useState(0);
 const [newOrderAlert,setNewOrderAlert]=useState<Order|null>(null);
 const [notificationPermission,setNotificationPermission]=useState<NotificationPermission>(
   'Notification' in window ? Notification.permission : 'denied'
 );
 const [orderSoundEnabled,setOrderSoundEnabled]=useState(
   ()=>localStorage.getItem('vitrio-order-sound')==='on'
 );
 const [pushEnabled,setPushEnabled]=useState(
   ()=>localStorage.getItem('vitrio-push-enabled')==='true'
 );
 const [pushBusy,setPushBusy]=useState(false);
 const [pushError,setPushError]=useState('');

 const ordersInitialized=useRef(false);
 const audioContextRef=useRef<AudioContext|null>(null);
 const knownOrderIds=useRef<Set<string>>(new Set());
 useEffect(()=>{if(!profile?.storeId){setStore(null);return}return onSnapshot(doc(db,'stores',profile.storeId),s=>setStore(s.exists()?({id:s.id,...s.data()} as Store):null))},[profile?.storeId]);useEffect(()=>setMobile(false),[location.pathname]);useEffect(()=>{const fn=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPalette(v=>!v)}};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[]);
 useEffect(()=>{
  if(profile?.role!=='merchant'||!profile.storeId){
    setPendingOrders(0);
    knownOrderIds.current.clear();
    ordersInitialized.current=false;
    return;
  }

  ordersInitialized.current=false;
  knownOrderIds.current.clear();

  const q=query(
    collection(db,'orders'),
    where('storeId','==',profile.storeId)
  );

  return onSnapshot(q,snapshot=>{
    const orders=snapshot.docs.map(d=>({id:d.id,...d.data()} as Order));

    setPendingOrders(
      orders.filter(o=>o.status!=='completed'&&o.status!=='cancelled').length
    );

    if(!ordersInitialized.current){
      knownOrderIds.current=new Set(orders.map(o=>o.id));
      ordersInitialized.current=true;
      return;
    }

    const newOrders=orders.filter(o=>!knownOrderIds.current.has(o.id));

    orders.forEach(o=>knownOrderIds.current.add(o.id));

    if(!newOrders.length)return;

    const newest=newOrders
      .slice()
      .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))[0];

    setNewOrderAlert(newest);
    if(orderSoundEnabled)playNewOrderSound();

    if('Notification' in window&&Notification.permission==='granted'){




    }
  });
 },[profile?.role,profile?.storeId,orderSoundEnabled]);

 function playNewOrderSound(){
  try{
    const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;
    if(!AudioContextClass)return;

    const ctx=audioContextRef.current||new AudioContextClass();
    audioContextRef.current=ctx;

    if(ctx.state==='suspended'){
      void ctx.resume();
    }

    const now=ctx.currentTime;
    const gain=ctx.createGain();
    gain.connect(ctx.destination);

    const beep=(frequency:number,start:number,duration:number)=>{
      const oscillator=ctx.createOscillator();
      oscillator.connect(gain);
      oscillator.frequency.value=frequency;
      oscillator.start(now+start);
      oscillator.stop(now+start+duration);
    };

    gain.gain.setValueAtTime(0.0001,now);
    gain.gain.exponentialRampToValueAtTime(0.18,now+0.02);
    gain.gain.setValueAtTime(0.18,now+0.30);
    gain.gain.exponentialRampToValueAtTime(0.0001,now+0.65);

    beep(880,0,0.18);
    beep(1174,0.24,0.30);
  }catch(error){
    console.debug('Som de novo pedido indisponível.',error);
  }
 }
 async function togglePushNotifications(){
  if(!profile?.storeId || pushBusy)return;

  setPushBusy(true);
  setPushError('');

  try{
    if(pushEnabled){
      await disablePushNotifications(profile.storeId);
      setPushEnabled(false);
    }else{
      await enablePushNotifications(profile.storeId);
      setPushEnabled(true);
      setNotificationPermission(
        'Notification' in window ? Notification.permission : 'denied'
      );
    }
  }catch(error:any){
    console.error('Push Vitrio:',error);
    setPushError(
      error?.message ||
      'Não foi possível configurar as notificações neste aparelho.'
    );
  }finally{
    setPushBusy(false);
  }
 }

 async function toggleOrderSound(){
  const next=!orderSoundEnabled;

  if(next){
    try{
      const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;
      if(!AudioContextClass)return;

      const ctx=audioContextRef.current||new AudioContextClass();
      audioContextRef.current=ctx;

      if(ctx.state==='suspended')await ctx.resume();

      // Confirma visualmente e com um toque curto que o som foi habilitado.
      const oscillator=ctx.createOscillator();
      const gain=ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value=880;
      gain.gain.setValueAtTime(0.08,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.15);
      oscillator.start();
      oscillator.stop(ctx.currentTime+0.15);

      localStorage.setItem('vitrio-order-sound','on');
      setOrderSoundEnabled(true);
    }catch(error){
      console.debug('Não foi possível habilitar o som.',error);
    }
  }else{
    localStorage.setItem('vitrio-order-sound','off');
    setOrderSoundEnabled(false);
  }
 }

 async function enableOrderNotifications(){
  // O navegador exige interação do usuário para liberar áudio.
  try{
    const AudioContextClass=window.AudioContext||(window as any).webkitAudioContext;
    if(AudioContextClass){
      const ctx=audioContextRef.current||new AudioContextClass();
      audioContextRef.current=ctx;
      if(ctx.state==='suspended')await ctx.resume();

      // Beep discreto confirma que o som foi habilitado.
      const oscillator=ctx.createOscillator();
      const gain=ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.06,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.12);
      oscillator.frequency.value=880;
      oscillator.start();
      oscillator.stop(ctx.currentTime+0.12);
    }
  }catch(error){
    console.debug('Não foi possível habilitar o áudio.',error);
  }

  if(!('Notification' in window))return;

  if(Notification.permission==='default'){
    const permission=await Notification.requestPermission();
    setNotificationPermission(permission);
    return;
  }

  setNotificationPermission(Notification.permission);
 }

 const subscriptionState=store?storeSubscriptionStatus(store):null;
 const allowed=(p:MerchantItem['permission'])=>profile?.isStoreOwner===true || (p!=='__public__' && p!=='__owner__' && Array.isArray(profile?.permissions) && profile.permissions.includes(p as Permission));const groups=useMemo(()=>profile?.role==='admin'?adminGroups:merchantGroups.map(g=>({...g,items:g.items.filter(i=>allowed(i.permission))})).filter(g=>g.items.length),[profile?.role,profile?.isStoreOwner,profile?.permissions]);const title=pageTitle(location.pathname);
 return <div className="app-shell-v2"><aside className={`sidebar-v2 ${mobile?'open':''}`}><div className="sidebar-brand"><span className="brand-mark">V</span><div><strong>Vitrio</strong><small>{profile?.role==='admin'?'Administração':'Gestão da loja'}</small></div><button className="mobile-close" onClick={()=>setMobile(false)}><X size={18}/></button></div>
 {profile?.role==='merchant'&&store&&subscriptionState&&<div className={`sidebar-store subscription-${subscriptionState.tone}`}><span>{store.logoUrl?<img src={store.logoUrl} alt=""/>:store.name.slice(0,1).toUpperCase()}</span><div><strong>{store.name}</strong><small className="sidebar-subscription-label">{subscriptionState.label}</small></div></div>}
 <nav className="sidebar-nav">{(groups as any[]).map(group=><div className="nav-group" key={group.label}><small>{group.label}</small>{group.items.map((item:any)=>{const Icon=item.icon;return <NavLink key={item.to} to={item.to} end={item.to==='/painel'||item.to==='/admin'} className={({isActive})=>`nav-item-v2 ${isActive?'active':''}`}><Icon size={18}/><span>{item.label}</span>{item.to==='/painel/pedidos'&&pendingOrders>0&&<b className="order-nav-badge">{pendingOrders>99?'99+':pendingOrders}</b>}</NavLink>})}</div>)}</nav><div className="sidebar-bottom">{profile?.role==='merchant'&&store&&<a href={`/loja/${store.slug}`} target="_blank" rel="noreferrer" className="sidebar-preview"><ExternalLink size={16}/>Ver minha vitrine</a>}<button className="nav-item-v2 logout-v2" onClick={logout}><LogOut size={18}/><span>Sair da conta</span></button></div></aside>
 {mobile&&<button className="sidebar-overlay" onClick={()=>setMobile(false)}/>}<div className="workspace"><header className="topbar-v2"><div className="topbar-left"><button className="menu-button" onClick={()=>setMobile(true)}><Menu size={20}/></button><div><span className="crumb">{profile?.role==='admin'?'Administração':'Minha loja'}</span><strong>{title}</strong></div></div><div className="topbar-actions"><button className="command-trigger" onClick={()=>setPalette(true)}><Search size={17}/><span>Buscar ou ir para...</span><kbd>⌘ K</kbd></button>{profile?.role==='merchant'&&<>
  <button
    type="button"
    className={`notification-enable mobile-push-control ${pushEnabled?'push-on':'push-off'}`}
    onClick={togglePushNotifications}
    disabled={pushBusy}
    aria-pressed={pushEnabled}
    aria-label={pushEnabled?'Desativar notificações neste aparelho':'Ativar notificações neste aparelho'}
    title={pushEnabled?'Desativar notificações neste aparelho':'Ativar notificações neste aparelho'}
  >
    <Smartphone size={18}/>
    <span className="push-control-text">
      <small>Notificações</small>
      <strong>{pushBusy?'...':pushEnabled?'ON':'OFF'}</strong>
    </span>
  </button>

  <button
    type="button"
    className={`notification-enable ${orderSoundEnabled?'sound-on':''}`}
    onClick={toggleOrderSound}
    title={orderSoundEnabled?'Desativar som de novos pedidos':'Ativar som de novos pedidos'}
  >
    <Bell size={17}/>
    <span>{orderSoundEnabled?'Som ligado':'Ativar som'}</span>
  </button>
  {notificationPermission==='default'&&
    <button
      type="button"
      className="notification-enable"
      onClick={enableOrderNotifications}
      title="Ativar notificações de novos pedidos"
    >
      <Bell size={17}/>
      <span>Ativar notificações</span>
    </button>
  }
  <Link
    to="/painel/avisos"
    className="top-icon alerts-control"
    title="Central de avisos"
    aria-label="Abrir central de avisos"
  >
    <Bell size={19}/>
    <span className="alerts-label">Avisos</span>
    {pendingOrders>0&&<span className="top-order-dot"/>}
  </Link>
</>}<div className="profile-chip"><span>{(profile?.displayName||profile?.email||'V').slice(0,1).toUpperCase()}</span><div><strong>{profile?.displayName||'Minha conta'}</strong><small>{profile?.role==='admin'?'Master':'Lojista'}</small></div></div></div></header><main className="content-v2">{pushError&&<div className="new-order-alert"><Bell size={18}/><div><strong>Notificações no celular</strong><span>{pushError}</span></div><button type="button" onClick={()=>setPushError('')} aria-label="Fechar"><X size={17}/></button></div>}{newOrderAlert&&<div className="new-order-alert"><ShoppingCart size={20}/><div><strong>Novo pedido recebido!</strong><span>#{newOrderAlert.id.slice(0,6).toUpperCase()} · {newOrderAlert.customerName} · {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(newOrderAlert.total||0))}</span></div><Link to="/painel/pedidos" onClick={()=>setNewOrderAlert(null)}>Ver pedido</Link><button type="button" onClick={()=>setNewOrderAlert(null)} aria-label="Fechar"><X size={17}/></button></div>}<Outlet/></main></div><CommandPalette open={palette} onClose={()=>setPalette(false)}/></div>;
}
