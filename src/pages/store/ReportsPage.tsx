import { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Order, ReturnRecord, Store } from '../../types/models';
import { jsPDF } from 'jspdf';
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const dateOf=(v:any)=>v?.toDate?.()||null;
const statusLabel=(v:string)=>({pending_payment:'Aguardando pagamento',paid:'Pago / confirmado',preparing:'Em preparo',ready:'Pronto',out_for_delivery:'Saiu para entrega',completed:'Concluído',cancelled:'Cancelado'} as Record<string,string>)[v]||v;
const paymentLabel=(v:string)=>({pix:'Pix',cash:'Dinheiro',card:'Cartão',credit:'Cartão',debit:'Cartão'} as Record<string,string>)[String(v||'').toLowerCase()]||v||'—';
export function ReportsPage(){const {profile}=useAuth();const [orders,setOrders]=useState<Order[]>([]),[returns,setReturns]=useState<ReturnRecord[]>([]),[store,setStore]=useState<Store|null>(null),[period,setPeriod]=useState('30');
useEffect(()=>{if(!profile?.storeId)return;const a=onSnapshot(query(collection(db,'orders'),where('storeId','==',profile.storeId)),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()} as Order))));const b=onSnapshot(query(collection(db,'returns'),where('storeId','==',profile.storeId)),s=>setReturns(s.docs.map(d=>({id:d.id,...d.data()} as ReturnRecord))));const c=onSnapshot(doc(db,'stores',profile.storeId),s=>s.exists()&&setStore({id:s.id,...s.data()} as Store));return()=>{a();b();c()}},[profile?.storeId]);
const inPeriod=(v:any)=>{const days=Number(period);if(!days)return true;const cutoff=new Date();cutoff.setDate(cutoff.getDate()-days);cutoff.setHours(0,0,0,0);const d=dateOf(v);return !!d&&d>=cutoff};
const filtered=useMemo(()=>orders.filter(o=>inPeriod(o.createdAt)),[orders,period]);const filteredReturns=useMemo(()=>returns.filter(r=>inPeriod(r.createdAt)),[returns,period]);
const valid=filtered.filter(o=>o.status!=='cancelled'),paid=valid.filter(o=>o.paymentStatus==='paid'),grossRevenue=paid.reduce((s,o)=>s+Number(o.total||0),0),refunds=filteredReturns.filter(r=>r.type==='return').reduce((s,r)=>s+Number(r.total||0),0),revenue=Math.max(0,grossRevenue-refunds),ticket=paid.length?revenue/paid.length:0,discounts=valid.reduce((s,o)=>s+Number(o.discount||0),0),delivery=valid.reduce((s,o)=>s+Number(o.deliveryFee||0),0);
const productMap=new Map<string,{name:string,qty:number,total:number}>();valid.forEach(o=>o.items.forEach(i=>{const v=productMap.get(i.productId)||{name:i.name,qty:0,total:0};v.qty+=i.quantity;v.total+=i.subtotal;productMap.set(i.productId,v)}));filteredReturns.forEach(r=>r.items.forEach(i=>{const v=productMap.get(i.productId);if(v){v.qty=Math.max(0,v.qty-i.quantity);v.total=Math.max(0,v.total-i.total)}}));const top=[...productMap.values()].sort((a,b)=>b.qty-a.qty).slice(0,8);

function exportPdf(){
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
 const pageWidth=pdf.internal.pageSize.getWidth();
 const margin=14;
 let y=16;
 const periodLabel=period==='0'?'Todo o período':`${period} dias`;
 const generatedAt=new Date().toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
 const line=(label:string,value:string)=>{pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(90);pdf.text(label,margin,y);pdf.setFont('helvetica','bold');pdf.setTextColor(20);pdf.text(value,margin+52,y);y+=6;};
 const section=(title:string)=>{if(y>270){pdf.addPage();y=16;}pdf.setFont('helvetica','bold');pdf.setFontSize(12);pdf.setTextColor(25);pdf.text(title,margin,y);y+=7;pdf.setDrawColor(220);pdf.line(margin,y-3,pageWidth-margin,y-3);};
 const row=(left:string,right:string)=>{if(y>278){pdf.addPage();y=16;}pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(55);const safeLeft=pdf.splitTextToSize(left,pageWidth-margin*2-48);pdf.text(safeLeft,margin,y);pdf.setFont('helvetica','bold');pdf.setTextColor(25);pdf.text(right,pageWidth-margin,y,{align:'right'});y+=Math.max(6,safeLeft.length*4.2);};

 pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.setTextColor(35);pdf.text('Relatório Vitrio',margin,y);y+=7;
 pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.setTextColor(90);pdf.text(store?.name||'Minha loja',margin,y);y+=8;
 line('Período',periodLabel);line('Gerado em',generatedAt);y+=3;
 section('Resumo');
 row('Pedidos válidos',String(valid.length));
 row('Pedidos pagos',String(paid.length));
 row('Faturamento bruto',money(grossRevenue));
 row('Devoluções',money(refunds));
 row('Faturamento líquido',money(revenue));
 row('Ticket médio líquido',money(ticket));
 row('Descontos',money(discounts));
 row('Taxas de entrega',money(delivery));
 y+=4;
 section('Produtos mais vendidos');
 if(top.length===0)row('Nenhum produto no período','');else top.forEach((p,i)=>row(`${i+1}. ${p.name} · ${p.qty} unidade(s)`,money(p.total)));
 y+=4;
 section('Formas de pagamento');
 if(methods.length===0)row('Nenhum pagamento no período','');else methods.forEach(([method,count])=>row(method,`${count} pedido(s)`));
 y+=4;
 section('Devoluções e trocas');
 if(filteredReturns.length===0)row('Nenhum registro no período','');else filteredReturns.forEach(r=>{const d=dateOf(r.createdAt)?.toLocaleDateString('pt-BR')||'';row(`${r.type==='return'?'Devolução':'Troca'} · #${r.orderId.slice(0,6).toUpperCase()} · ${d}${r.reason?` · ${r.reason}`:''}`,money(Number(r.total||0)));});
 y+=4;
 section('Pedidos do período');
 if(filtered.length===0)row('Nenhum pedido no período','');else filtered.slice().sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).forEach(o=>{const d=dateOf(o.createdAt)?.toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})||'';row(`#${o.id.slice(0,6).toUpperCase()} · ${o.customerName} · ${d} · ${paymentLabel(o.paymentMethod)} · ${statusLabel(o.status)}`,money(Number(o.total||0)));});

 const pages=pdf.getNumberOfPages();for(let i=1;i<=pages;i++){pdf.setPage(i);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(130);pdf.text(`Vitrio · ${store?.name||'Loja'} · Página ${i} de ${pages}`,margin,291);}
 pdf.save(`vitrio-relatorio-${new Date().toISOString().slice(0,10)}.pdf`);
}

function exportCsv(){const rows=[['Tipo','Pedido','Data','Cliente','Pagamento','Status/Motivo','Subtotal','Desconto','Entrega','Total'],...filtered.map(o=>['Venda',o.id,dateOf(o.createdAt)?.toLocaleString('pt-BR')||'',o.customerName,paymentLabel(o.paymentMethod),statusLabel(o.status),o.subtotal,o.discount||0,o.deliveryFee||0,o.total]),...filteredReturns.map(r=>[r.type==='return'?'Devolução':'Troca',r.orderId,dateOf(r.createdAt)?.toLocaleString('pt-BR')||'',r.customerName||'',r.paymentMethod||'',r.reason,0,0,0,-Number(r.total||0)])];const csv=rows.map(row=>row.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(';')).join('\n');const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`vitrio-relatorio-${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url);}
const methods=[...valid.reduce((m,o)=>{m.set(paymentLabel(o.paymentMethod),(m.get(paymentLabel(o.paymentMethod))||0)+1);return m},new Map<string,number>()).entries()].sort((a,b)=>b[1]-a[1]);
return <><div className="page-head"><div><h1>Relatórios</h1><p>Analise vendas, devoluções e operação por período.</p></div><div className="report-actions"><label>Período<select value={period} onChange={e=>setPeriod(e.target.value)}><option value="7">7 dias</option><option value="30">30 dias</option><option value="90">90 dias</option><option value="0">Todo período</option></select></label><button className="secondary-btn" onClick={exportCsv}>Exportar CSV</button><button className="primary-btn" onClick={exportPdf}>Exportar PDF</button></div></div><div className="stats"><div className="stat"><span>Pedidos</span><strong>{valid.length}</strong></div><div className="stat"><span>Faturamento bruto</span><strong>{money(grossRevenue)}</strong></div><div className="stat"><span>Devoluções</span><strong>{money(refunds)}</strong></div><div className="stat"><span>Faturamento líquido</span><strong>{money(revenue)}</strong></div><div className="stat"><span>Ticket médio líquido</span><strong>{money(ticket)}</strong></div><div className="stat"><span>Taxas de entrega</span><strong>{money(delivery)}</strong></div></div><div className="two-cols"><div className="panel"><h2>Produtos mais vendidos no período</h2>{top.length===0?<p className="muted">Ainda não há dados suficientes.</p>:<div className="ranking-list">{top.map((p,i)=><div key={p.name}><span>{i+1}</span><div><strong>{p.name}</strong><small>{p.qty} unidade(s) líquida(s)</small></div><b>{money(p.total)}</b></div>)}</div>}</div><div className="panel"><h2>Devoluções e trocas</h2>{filteredReturns.length===0?<p className="muted">Nenhuma no período.</p>:filteredReturns.slice(0,10).map(r=><div className="mini-row" key={r.id}><div><strong>{r.type==='return'?'Devolução':'Troca'} · #{r.orderId.slice(0,6).toUpperCase()}</strong><small>{r.reason}</small></div><b>{money(r.total)}</b></div>)}</div></div></>;}
