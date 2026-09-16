import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ArrowRight, Clock3, MapPin, MessageCircle, Phone, Printer, Search, ShieldCheck, XCircle } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUi } from '../../contexts/UiContext';
import { Order, OrderStatus, PaymentStatus } from '../../types/models';
import { LoadingState } from '../../components/ui/LoadingState';

const labels:Record<OrderStatus,string>={pending_payment:'Aguardando pagamento',paid:'Pedido confirmado',preparing:'Em preparo',ready:'Pronto',out_for_delivery:'Saiu para entrega',completed:'Concluído',cancelled:'Cancelado'};
const payLabels:Record<PaymentStatus,string>={pending:'Pagamento pendente',paid:'Pagamento confirmado',failed:'Pagamento falhou',refunded:'Estornado'};
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const deliveryFlow:OrderStatus[]=['paid','preparing','ready','out_for_delivery','completed'];
const pickupFlow:OrderStatus[]=['paid','preparing','ready','completed'];
const orderFlow=(o:Order)=>o.fulfillment==='delivery'?deliveryFlow:pickupFlow;
const ageMinutes=(o:Order)=>o.createdAt?.seconds?Math.max(0,Math.floor((Date.now()-Number(o.createdAt.seconds)*1000)/60000)):0;
const age=(o:Order)=>{const min=ageMinutes(o);if(!o.createdAt?.seconds)return'';return min<60?`${min} min`:min<1440?`${Math.floor(min/60)}h ${min%60}min`:`${Math.floor(min/1440)}d`;};
const stepIndex=(o:Order)=>orderFlow(o).indexOf(o.status);
const isToday=(o:Order)=>{const d=o.createdAt?.toDate?.();if(!d)return false;const now=new Date();return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth()&&d.getDate()===now.getDate();};
const isOpenOrder=(o:Order)=>!['completed','cancelled'].includes(o.status);

export function OrdersPage(){
 const {profile}=useAuth(); const {toast,prompt:promptAction,confirm:confirmAction}=useUi();const [orders,setOrders]=useState<Order[]>([]),[filter,setFilter]=useState<'all'|OrderStatus>('all'),[search,setSearch]=useState('');
 const [notifications,setNotifications]=useState(typeof Notification!=='undefined'&&Notification.permission==='granted');const known=useState(()=>new Set<string>())[0];
 const [message,setMessage]=useState(''); const [loading,setLoading]=useState(true); const [busyIds,setBusyIds]=useState<Record<string,boolean>>({});
 const [storeName,setStoreName]=useState('Sua loja');
 const [messageEnabled,setMessageEnabled]=useState(true);
 const [messageTemplates,setMessageTemplates]=useState<Record<string,string>>({});
 useEffect(()=>{if(!profile?.storeId)return;getDoc(doc(db,'stores',profile.storeId)).then(s=>{if(!s.exists())return;const d=s.data() as any;setStoreName(d.name||'Sua loja');setMessageEnabled(d.orderStatusMessagesEnabled!==false);setMessageTemplates(d.orderStatusMessages||{});});},[profile?.storeId]);
 useEffect(()=>{if(!profile?.storeId)return;let first=true;return onSnapshot(query(collection(db,'orders'),where('storeId','==',profile.storeId)),s=>{const next=s.docs.map(d=>({id:d.id,...d.data()} as Order)).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));next.forEach(x=>known.add(x.id));first=false;setOrders(next);setLoading(false);},()=>{setLoading(false);setMessage('Não foi possível carregar os pedidos. Confira sua conexão.');});},[profile?.storeId,notifications]);

 const defaultMessages:Record<string,string>={
  pending_payment:'Olá, {cliente}! Recebemos seu pedido #{pedido} na {loja}. O pagamento ainda está pendente. Se precisar, podemos continuar o atendimento por aqui.',
  paid:'Olá, {cliente}! 💜 Recebemos seu pedido #{pedido} na {loja}. Ficamos felizes por ter você aqui!',
  preparing:'Olá, {cliente}! ✨ Seu pedido #{pedido} já está em preparação na {loja}.',
  ready:'Olá, {cliente}! 🎉 Seu pedido #{pedido} está prontinho!',
  out_for_delivery:'Olá, {cliente}! 🛵 Seu pedido #{pedido} saiu para entrega e já está a caminho.',
  completed:'Olá, {cliente}! 💜 Seu pedido #{pedido} foi concluído. Esperamos que você ame sua compra!'
 };
 function isIntegratedPayment(o:Order){
   return o.source==='vitrio_checkout' &&
     (Boolean(o.mercadoPagoOrderId)||Boolean(o.mercadoPagoPaymentId));
 }

 function whatsappUrl(o:Order,status:OrderStatus){
   const raw=(o.customerPhone||'').replace(/\D/g,'').replace(/^0+/,'');
   const phone=(raw.length===10||raw.length===11)?`55${raw}`:raw;
   if(phone.length<12)return'';
   const template=messageTemplates[status]||defaultMessages[status]||'';
   if(!template)return'';
   const msg=template
    .split('{cliente}').join(o.customerName||'cliente')
    .split('{pedido}').join(o.id.slice(0,6).toUpperCase())
    .split('{loja}').join(storeName)
    .split('{total}').join(money(Number(o.total||0)));
   return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
 }
 function sendStatusWhatsapp(o:Order,status:OrderStatus){
   if(!messageEnabled)return;
   const url=whatsappUrl(o,status);
   if(!url){toast('WhatsApp do cliente inválido ou mensagem não configurada.','error');return;}
   window.open(url,'_blank','noopener,noreferrer');
 }

 async function update(id:string,data:{status?:OrderStatus;merchantNotes?:string}){if(busyIds[id])return;setBusyIds(v=>({...v,[id]:true}));setMessage('');try{const fn=httpsCallable(functions,'updateOrderOperation');await fn({orderId:id,...data});if(data.status){toast('Status do pedido atualizado.');}}catch(e:any){const m=e?.message?.replace('FirebaseError: ','')||'Não foi possível atualizar o pedido.';setMessage(m);toast(m,'error');}finally{setBusyIds(v=>({...v,[id]:false}))}}
 async function confirmManualPayment(id:string){if(busyIds[id])return;setBusyIds(v=>({...v,[id]:true}));setMessage('');try{const fn=httpsCallable(functions,'confirmOfflinePayment');await fn({orderId:id});setMessage('Pagamento confirmado e lançado no caixa aberto, quando houver.');toast('Pagamento confirmado.');}catch(e:any){const m=e?.message?.replace('FirebaseError: ','')||'Não foi possível confirmar o pagamento.';setMessage(m);toast(m,'error');}finally{setBusyIds(v=>({...v,[id]:false}))}}
 async function cancel(id:string){const reason=await promptAction({title:'Cancelar pedido',message:'Informe o motivo do cancelamento. O estoque será devolvido automaticamente.',inputLabel:'Motivo do cancelamento',inputPlaceholder:'Ex.: cliente solicitou cancelamento',requireInput:true,confirmLabel:'Continuar',danger:true});if(reason===null)return;const ok=await confirmAction({title:'Confirmar cancelamento',message:'Deseja realmente cancelar este pedido e devolver os itens ao estoque?',confirmLabel:'Cancelar pedido',danger:true});if(!ok||busyIds[id])return;setBusyIds(v=>({...v,[id]:true}));setMessage('');try{const fn=httpsCallable(functions,'cancelOrder');await fn({orderId:id,reason});setMessage('Pedido cancelado e estoque devolvido.');toast('Pedido cancelado e estoque devolvido.');}catch(e:any){const m=e?.message?.replace('FirebaseError: ','')||'Não foi possível cancelar.';setMessage(m);toast(m,'error');}finally{setBusyIds(v=>({...v,[id]:false}))}}
 const stats=useMemo(()=>({open:orders.filter(o=>!['completed','cancelled'].includes(o.status)).length,preparing:orders.filter(o=>o.status==='preparing').length,ready:orders.filter(o=>o.status==='ready').length,today:orders.filter(o=>{const d=o.createdAt?.toDate?.();return d&&d.toDateString()===new Date().toDateString()}).reduce((sum,o)=>sum+Number(o.total||0),0)}),[orders]);
 const operationalOrders=useMemo(()=>orders.filter(o=>isToday(o)||isOpenOrder(o)),[orders]);
 const visible=useMemo(()=>operationalOrders.filter(o=>(filter==='all'||o.status===filter)&&`${o.customerName} ${o.customerPhone} ${o.id}`.toLowerCase().includes(search.toLowerCase())),[operationalOrders,filter,search]);

 function printOrder(o:Order){const w=window.open('','_blank','width=480,height=700');if(!w)return;w.document.write(`<!doctype html><html><head><title>Pedido ${o.id}</title><style>body{font:14px Arial;padding:22px;color:#111}h1{font-size:20px}hr{border:0;border-top:1px dashed #aaa}.row{display:flex;justify-content:space-between;margin:8px 0}.muted{color:#666}</style></head><body><h1>Pedido #${o.id.slice(0,6).toUpperCase()}</h1><div>${o.customerName}</div><div>${o.customerPhone}</div><div>${o.fulfillment==='delivery'?'Entrega':'Retirada'} ${o.deliveryZoneName?`· ${o.deliveryZoneName}`:''}</div>${o.address?`<div>${o.address}</div>`:''}<hr>${o.items.map(i=>`<div class="row"><span>${i.quantity}x ${i.name}${i.variantName?` (${i.variantName})`:''}${(i.addons||[]).length?`<br><small>${i.addons!.map(a=>`${a.groupName}: ${a.optionName}`).join(' · ')}</small>`:''}</span><b>${money(i.subtotal)}</b></div>`).join('')}<hr><div class="row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>${o.discount?`<div class="row"><span>Desconto</span><b>-${money(o.discount)}</b></div>`:''}${o.deliveryFee?`<div class="row"><span>Entrega</span><b>${money(o.deliveryFee)}</b></div>`:''}<div class="row"><strong>Total</strong><strong>${money(o.total)}</strong></div><p>Pagamento: ${o.paymentMethod} · ${payLabels[o.paymentStatus]}</p>${o.customerNotes?`<p><b>Observação do cliente:</b> ${o.customerNotes}</p>`:''}${o.merchantNotes?`<p><b>Observação interna:</b> ${o.merchantNotes}</p>`:''}<script>window.onload=()=>window.print()</script></body></html>`);w.document.close();}
 async function enableNotifications(){if(typeof Notification==='undefined')return;const permission=await Notification.requestPermission();setNotifications(permission==='granted');}
 function nextStatus(o:Order):OrderStatus|null{
  if(o.status==='pending_payment')return o.paymentStatus==='paid'?'paid':null;
  const flow=orderFlow(o);
  const i=flow.indexOf(o.status);
  return i>=0&&i<flow.length-1?flow[i+1]:null;
}


 return <><div className="page-head"><div><h1>Pedidos</h1><p>Operação do dia: pedidos de hoje e pendências anteriores. Consulte o histórico em Relatórios.</p></div><button className="secondary-btn" onClick={enableNotifications}>{notifications?'Notificações ativas':'Ativar notificações'}</button></div>
 {message&&<div className="panel"><strong>{message}</strong></div>}
 {loading?<LoadingState rows={5} label="Carregando pedidos..."/>:<><div className="order-summary-grid"><div className="order-summary-card"><small>Em andamento</small><strong>{stats.open}</strong></div><div className="order-summary-card"><small>Em preparo</small><strong>{stats.preparing}</strong></div><div className="order-summary-card"><small>Prontos</small><strong>{stats.ready}</strong></div><div className="order-summary-card"><small>Vendas de hoje</small><strong>{money(stats.today)}</strong></div></div>
 <div className="panel order-toolbar polished"><label className="search-box"><Search size={18}/><input placeholder="Buscar cliente, telefone ou pedido" value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="order-filter-chips"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos</button>{(['paid','preparing','ready','out_for_delivery','completed'] as OrderStatus[]).map(v=><button key={v} className={filter===v?'active':''} onClick={()=>setFilter(v)}>{labels[v]}</button>)}</div></div>
 <div className="order-list">{visible.length===0?<div className="empty-state"><h3>Nenhum pedido para a operação de hoje</h3><p>Novos pedidos aparecerão aqui em tempo real. Pedidos antigos finalizados ficam disponíveis em Relatórios.</p></div>:visible.map(o=><article className={`order-card ${ageMinutes(o)>=30&&!["completed","cancelled"].includes(o.status)?"order-needs-attention":""}`} key={o.id}>
   <div className="order-top"><div><small>Pedido #{o.id.slice(0,6).toUpperCase()} {age(o)&&<span className="order-age"><Clock3 size={12}/>{age(o)}</span>}{ageMinutes(o)>=30&&!['completed','cancelled'].includes(o.status)&&<span className="attention-chip">Atenção</span>}</small><h3>{o.customerName}</h3><span>{o.fulfillment==='delivery'?'Entrega':'Retirada'} · {o.paymentMethod}</span></div><div className="order-total-actions"><strong>{money(o.total)}</strong><button className="icon-btn" title="Imprimir pedido" onClick={()=>printOrder(o)}><Printer size={17}/></button></div></div>
   {!['pending_payment','cancelled'].includes(o.status)&&<div className="order-progress" aria-label="Progresso do pedido">{orderFlow(o).map((st,i)=><span key={st} className={i<=stepIndex(o)?'done':''} title={labels[st]} />)}</div>}
   <div className="customer-meta"><span><Phone size={15}/>{o.customerPhone}</span>{o.fulfillment==='delivery'&&o.address&&<span><MapPin size={15}/>{o.address}</span>}</div>
   <div className="order-items">{o.items.map((i,index)=><span key={`${i.productId}-${i.variantId||''}-${index}`}>{i.quantity}x {i.name}{i.variantName?` · ${i.variantName}`:''}{(i.addons||[]).length?<small>{i.addons!.map(a=>`${a.groupName}: ${a.optionName}`).join(' · ')}</small>:null}</span>)}</div>
   <div className="payment-server-status"><ShieldCheck size={17}/><div><small>Pagamento</small><strong>{payLabels[o.paymentStatus]}</strong></div>{!isIntegratedPayment(o)&&o.paymentStatus==='pending'&&o.status!=='cancelled'&&<button className="secondary-btn" disabled={busyIds[o.id]} onClick={()=>confirmManualPayment(o.id)}>{busyIds[o.id]?'Processando...':'Confirmar pagamento'}</button>}</div>
   {o.customerNotes&&<div className="customer-order-note"><strong>Observação do cliente</strong><p>{o.customerNotes}</p></div>}<label className="order-note">Observação interna<textarea placeholder="Ex.: cliente pediu para ligar antes da entrega" value={o.merchantNotes||''} onChange={e=>setOrders(xs=>xs.map(x=>x.id===o.id?{...x,merchantNotes:e.target.value}:x))} onBlur={e=>update(o.id,{merchantNotes:e.target.value})}/></label>
   <div className="order-controls">
    <label>Status do pedido
      <select
        value={o.status}
        disabled={o.status==='cancelled'||(isIntegratedPayment(o)&&o.paymentStatus!=='paid')||busyIds[o.id]}
        onChange={e=>update(o.id,{status:e.target.value as OrderStatus})}
      >
        {o.status==='pending_payment'&&<option value="pending_payment">Aguardando pagamento</option>}
        {Object.entries(labels)
          .filter(([v])=>v!=='cancelled'&&v!=='pending_payment'&&(o.fulfillment==='delivery'||v!=='out_for_delivery'))
          .map(([v,l])=><option value={v} key={v}>{l}</option>)}
      </select>
    </label>
    {o.paymentStatus==='paid'&&nextStatus(o)&&<button className="primary-btn quick-status" disabled={busyIds[o.id]} onClick={()=>update(o.id,{status:nextStatus(o)!})}>Avançar para {labels[nextStatus(o)!]} <ArrowRight size={16}/></button>}
    {messageEnabled&&o.status!=='cancelled'&&<button className="secondary-btn" type="button" onClick={()=>sendStatusWhatsapp(o,o.paymentStatus==='paid'?o.status:'pending_payment')}><MessageCircle size={17}/>Enviar WhatsApp</button>}
    {o.status!=='cancelled'&&<button className="secondary-btn danger-action" disabled={busyIds[o.id]} onClick={()=>cancel(o.id)}><XCircle size={17}/>Cancelar pedido</button>}
   </div>
 </article>)}</div></>} </>;
}