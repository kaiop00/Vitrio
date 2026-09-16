import { FormEvent, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { ArrowDownCircle, ArrowUpCircle, CalendarRange, FileDown, LockKeyhole, WalletCards } from 'lucide-react';
import { db } from '../../lib/firebase';import { useAuth } from '../../contexts/AuthContext';import { CashMovement, CashRegister, Order } from '../../types/models';import { jsPDF } from 'jspdf';
const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const iso=(d:Date)=>d.toISOString().slice(0,10); const ts=(v:any)=>v?.toDate?.()||null;
export function CashPage(){
 const {profile}=useAuth();const [register,setRegister]=useState<CashRegister|null>(null),[movements,setMovements]=useState<CashMovement[]>([]),[allMovements,setAllMovements]=useState<CashMovement[]>([]),[orders,setOrders]=useState<Order[]>([]);
 const [opening,setOpening]=useState(''),[movement,setMovement]=useState({type:'income' as 'income'|'expense',amount:'',description:''}),[closing,setClosing]=useState('');
 const now=new Date(),past=new Date(Date.now()-29*86400000);const [from,setFrom]=useState(iso(past)),[to,setTo]=useState(iso(now));
 useEffect(()=>{if(!profile?.storeId)return;return onSnapshot(query(collection(db,'cashRegisters'),where('storeId','==',profile.storeId),where('status','==','open')),s=>setRegister(s.empty?null:({id:s.docs[0].id,...s.docs[0].data()} as CashRegister)));},[profile?.storeId]);
 useEffect(()=>{if(!profile?.storeId)return;const a=onSnapshot(query(collection(db,'cashMovements'),where('storeId','==',profile.storeId)),s=>setAllMovements(s.docs.map(d=>({id:d.id,...d.data()} as CashMovement))));const b=onSnapshot(query(collection(db,'orders'),where('storeId','==',profile.storeId)),s=>setOrders(s.docs.map(d=>({id:d.id,...d.data()} as Order))));return()=>{a();b()}},[profile?.storeId]);
 useEffect(()=>setMovements(register?allMovements.filter(m=>m.cashRegisterId===register.id):[]),[allMovements,register?.id]);
 const balance=useMemo(()=>Number(register?.openingAmount||0)+movements.reduce((s,m)=>s+(m.type==='income'?m.amount:-m.amount),0),[register,movements]);
 const report=useMemo(()=>{
  const start=new Date(`${from}T00:00:00`),end=new Date(`${to}T23:59:59.999`);
  const inRange=(v:any)=>{const d=ts(v);return d&&d>=start&&d<=end};

  const sales=orders.filter(o=>
   inRange(o.createdAt)&&
   o.status!=='cancelled'&&
   (o.paymentStatus==='paid'||o.status==='completed')
  );

  const moves=allMovements.filter(m=>inRange(m.createdAt));

  // Entradas geradas automaticamente por vendas já estão representadas em salesTotal.
  // Elas permanecem no histórico, mas não entram novamente no resultado financeiro.
  const isSaleIncome=(m:CashMovement)=>{
   if(m.type!=='income')return false;
   const description=String(m.description||'').trim().toLowerCase();
   return /^venda(?:\s+online|\s+whatsapp)?\s+#/i.test(description);
  };

  const manualIncomeMoves=moves.filter(m=>m.type==='income'&&!isSaleIncome(m));
  const expenseMoves=moves.filter(m=>m.type==='expense');

  const income=manualIncomeMoves.reduce((sum,m)=>sum+Number(m.amount||0),0);
  const expense=expenseMoves.reduce((sum,m)=>sum+Number(m.amount||0),0);
  const salesTotal=sales.reduce((sum,o)=>sum+Number(o.total||0),0);

  return{
   sales,
   moves,
   manualIncomeMoves,
   expenseMoves,
   income,
   expense,
   salesTotal,
   total:salesTotal+income-expense
  };
 },[from,to,orders,allMovements]);
 async function openCash(e:FormEvent){e.preventDefault();if(!profile?.storeId||!profile.uid)return;await addDoc(collection(db,'cashRegisters'),{storeId:profile.storeId,openedBy:profile.uid,status:'open',openingAmount:Number(opening||0),openedAt:serverTimestamp()});setOpening('');}
 async function addMovement(e:FormEvent){e.preventDefault();if(!profile?.storeId||!profile.uid||!register||!movement.description.trim()||Number(movement.amount)<=0)return;await addDoc(collection(db,'cashMovements'),{storeId:profile.storeId,cashRegisterId:register.id,type:movement.type,amount:Number(movement.amount),description:movement.description.trim(),createdAt:serverTimestamp(),createdBy:profile.uid});setMovement({type:'income',amount:'',description:''});}
 async function closeCash(e:FormEvent){e.preventDefault();if(!register)return;await updateDoc(doc(db,'cashRegisters',register.id),{status:'closed',closingAmount:Number(closing||balance),closedAt:serverTimestamp()});setClosing('');}
 function exportFinancialPdf(){
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const w=pdf.internal.pageSize.getWidth();
  const h=pdf.internal.pageSize.getHeight();
  const m=14;
  const contentWidth=w-(m*2);
  const valueWidth=35;
  const labelWidth=contentWidth-valueWidth-5;
  const bottomLimit=h-18;
  let y=18;

  const ensureSpace=(height:number)=>{
   if(y+height>bottomLimit){
    pdf.addPage();
    y=18;
   }
  };

  const line=(label:string,value:string)=>{
   pdf.setFont('helvetica','normal');
   pdf.setFontSize(9.5);

   const labelLines=pdf.splitTextToSize(label,labelWidth) as string[];
   const lineHeight=4.8;
   const blockHeight=Math.max(7,labelLines.length*lineHeight+2);

   ensureSpace(blockHeight);

   pdf.setTextColor(85);
   pdf.text(labelLines,m,y);

   if(value){
    pdf.setFont('helvetica','bold');
    pdf.setTextColor(25);
    pdf.text(value,w-m,y,{align:'right'});
   }

   y+=blockHeight;
  };

  const section=(title:string)=>{
   ensureSpace(13);
   pdf.setFont('helvetica','bold');
   pdf.setFontSize(12.5);
   pdf.setTextColor(25);
   pdf.text(title,m,y);
   y+=7;
   pdf.setDrawColor(225);
   pdf.line(m,y-3,w-m,y-3);
  };

  pdf.setFont('helvetica','bold');
  pdf.setFontSize(20);
  pdf.setTextColor(30);
  pdf.text('Relatório financeiro',m,y);
  y+=8;

  pdf.setFont('helvetica','normal');
  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(
   `Período: ${new Date(from+'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(to+'T12:00:00').toLocaleDateString('pt-BR')}`,
   m,
   y
  );
  y+=10;

  section('Resumo do período');
  line('Vendas recebidas',money(report.salesTotal));
  line('Entradas manuais',money(report.income));
  line('Saídas',money(report.expense));
  line('Resultado do período',money(report.total));
  y+=4;

  section('Vendas recebidas');

  if(report.sales.length===0){
   line('Nenhuma venda no período','');
  }else{
   report.sales
    .slice()
    .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    .forEach(o=>{
     const d=o.createdAt?.toDate?.()?.toLocaleString(
      'pt-BR',
      {dateStyle:'short',timeStyle:'short'}
     )||'';

     line(
      `#${o.id.slice(0,6).toUpperCase()} · ${o.customerName||'Cliente'} · ${d}`,
      money(Number(o.total||0))
     );
    });
  }

  y+=4;

  section('Movimentações');

  if(report.moves.length===0){
   line('Nenhuma movimentação no período','');
  }else{
   report.moves
    .slice()
    .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0))
    .forEach(x=>{
     const d=x.createdAt?.toDate?.()?.toLocaleString(
      'pt-BR',
      {dateStyle:'short',timeStyle:'short'}
     )||'';

     line(
      `${x.type==='income'?'Entrada':'Saída'} · ${x.description||'Movimentação'} · ${d}`,
      `${x.type==='income'?'+':'-'} ${money(Number(x.amount||0))}`
     );
    });
  }

  const pages=pdf.getNumberOfPages();

  for(let i=1;i<=pages;i++){
   pdf.setPage(i);
   pdf.setDrawColor(235);
   pdf.line(m,h-13,w-m,h-13);
   pdf.setFont('helvetica','normal');
   pdf.setFontSize(8);
   pdf.setTextColor(140);
   pdf.text(
    `Vitrio · Relatório financeiro · Página ${i} de ${pages}`,
    m,
    h-8
   );
  }

  pdf.save(`vitrio-caixa-${from}-a-${to}.pdf`);
 }
 return <><div className="page-head"><div><h1>Caixa</h1><p>Operação diária e relatório financeiro por período.</p></div>{register&&<span className="status-chip ok">Caixa aberto</span>}</div>
 {!register?<div className="panel compact-panel"><WalletCards size={34}/><h2>Caixa fechado</h2><form onSubmit={openCash} className="inline-form"><label>Valor de abertura<input type="number" min="0" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)} placeholder="0,00"/></label><button className="primary-btn">Abrir caixa</button></form></div>:<>
 <div className="stats"><div className="stat"><span>Abertura</span><strong>{money(register.openingAmount)}</strong></div><div className="stat"><span>Entradas</span><strong>{money(movements.filter(m=>m.type==='income').reduce((s,m)=>s+m.amount,0))}</strong></div><div className="stat"><span>Saídas</span><strong>{money(movements.filter(m=>m.type==='expense').reduce((s,m)=>s+m.amount,0))}</strong></div><div className="stat"><span>Saldo esperado</span><strong>{money(balance)}</strong></div></div>
 <div className="two-cols"><div className="panel"><h2>Nova movimentação</h2><form onSubmit={addMovement} className="form-grid"><label>Tipo<select value={movement.type} onChange={e=>setMovement({...movement,type:e.target.value as any})}><option value="income">Entrada / suprimento</option><option value="expense">Saída / sangria</option></select></label><label>Valor<input type="number" min="0.01" step="0.01" value={movement.amount} onChange={e=>setMovement({...movement,amount:e.target.value})}/></label><label className="span-2">Descrição<input value={movement.description} onChange={e=>setMovement({...movement,description:e.target.value})}/></label><button className="primary-btn">Registrar</button></form></div><div className="panel"><h2>Fechar caixa</h2><p>Saldo esperado: <strong>{money(balance)}</strong></p><form onSubmit={closeCash} className="inline-form"><input type="number" min="0" step="0.01" value={closing} onChange={e=>setClosing(e.target.value)} placeholder={balance.toFixed(2)}/><button className="secondary-btn"><LockKeyhole/> Fechar caixa</button></form></div></div></>}
 <section className="panel cash-report"><div className="steps-head"><div><h2>Relatório financeiro</h2><p>Selecione qualquer período, inclusive os últimos 30 dias.</p></div><button className="secondary-btn" onClick={exportFinancialPdf}><FileDown/> Gerar PDF</button></div><div className="date-range"><label><CalendarRange/> Data inicial<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label><CalendarRange/> Data final<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div><div className="stats report-stats"><div className="stat"><span>Vendas recebidas</span><strong>{money(report.salesTotal)}</strong></div><div className="stat"><span>Entradas manuais</span><strong>{money(report.income)}</strong></div><div className="stat"><span>Saídas</span><strong>{money(report.expense)}</strong></div><div className="stat"><span>Resultado do período</span><strong>{money(report.total)}</strong></div></div><div className="report-detail"><h3>Resumo</h3><p>{report.sales.length} venda(s) recebida(s) e {report.moves.length} movimentação(ões) manual(is) no período selecionado.</p></div></section>
 </>;
}
