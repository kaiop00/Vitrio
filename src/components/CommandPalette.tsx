import { useEffect, useMemo, useState } from 'react';
import { Search, X, ArrowRight, Store, Package, ShoppingCart, Users, Settings, BarChart3, Boxes, TicketPercent, WalletCards, Bell, Building2, ShieldCheck, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type Command = { label:string; description:string; to:string; icon:any; keywords?:string };

const merchantCommands:Command[] = [
  {label:'Dashboard',description:'Resumo da operação',to:'/painel',icon:BarChart3,keywords:'inicio visão geral'},
  {label:'Novo produto',description:'Cadastrar ou editar catálogo',to:'/painel/produtos',icon:Package,keywords:'produto catálogo cadastro'},
  {label:'Pedidos',description:'Acompanhar vendas e status',to:'/painel/pedidos',icon:ShoppingCart,keywords:'venda pedido cliente'},
  {label:'Estoque',description:'Conferir saldos e reposição',to:'/painel/estoque',icon:Boxes,keywords:'inventario reposicao'},
  {label:'Clientes',description:'Base de compradores',to:'/painel/clientes',icon:Users,keywords:'crm comprador'},
  {label:'Cupons',description:'Criar descontos e campanhas',to:'/painel/cupons',icon:TicketPercent,keywords:'desconto promoção'},
  {label:'Caixa',description:'Abrir e fechar caixa',to:'/painel/caixa',icon:WalletCards,keywords:'financeiro movimento'},
  {label:'Atividade',description:'Pedidos, estoque e alterações recentes',to:'/painel/atividade',icon:Bell,keywords:'atividade histórico alertas'},
  {label:'Minha loja',description:'Logo, dados e identidade visual',to:'/painel/minha-loja',icon:Store,keywords:'configurar loja vitrine'},
  {label:'Divulgação',description:'Link e QR Code da vitrine',to:'/painel/divulgacao',icon:QrCode,keywords:'qrcode qr code compartilhar link marketing'},
  {label:'Configurações',description:'Checkout, entrega e pagamentos',to:'/painel/configuracoes',icon:Settings,keywords:'checkout pagamento entrega'},
];

const adminCommands:Command[] = [
  {label:'Visão geral',description:'Saúde da plataforma',to:'/admin',icon:BarChart3,keywords:'dashboard métricas'},
  {label:'Clientes e lojas',description:'Planos, testes e bloqueios',to:'/admin/lojas',icon:Building2,keywords:'cliente loja assinatura'},
  {label:'Acessos',description:'Usuários e permissões',to:'/admin/acessos',icon:ShieldCheck,keywords:'usuario perfil acesso'},
  {label:'Auditoria',description:'Ações administrativas recentes',to:'/admin/auditoria',icon:Bell,keywords:'log histórico'},
  {label:'Configurações',description:'Preferências da plataforma',to:'/admin/configuracoes',icon:Settings,keywords:'sistema plataforma'},
];

export function CommandPalette({open,onClose}:{open:boolean;onClose:()=>void}){
  const {profile}=useAuth();
  const navigate=useNavigate();
  const [q,setQ]=useState('');
  useEffect(()=>{if(open)setQ('')},[open]);
  useEffect(()=>{const fn=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',fn);return()=>window.removeEventListener('keydown',fn)},[onClose]);
  const commands=profile?.role==='admin'?adminCommands:merchantCommands;
  const filtered=useMemo(()=>{const needle=q.trim().toLowerCase();if(!needle)return commands;return commands.filter(c=>`${c.label} ${c.description} ${c.keywords||''}`.toLowerCase().includes(needle))},[q,commands]);
  if(!open)return null;
  return <div className="command-backdrop" onMouseDown={onClose}><div className="command-dialog" onMouseDown={e=>e.stopPropagation()}>
    <div className="command-search"><Search size={19}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="O que você quer fazer?"/><button onClick={onClose} aria-label="Fechar"><X size={18}/></button></div>
    <div className="command-list">{filtered.map(({label,description,to,icon:Icon})=><button key={to} onClick={()=>{navigate(to);onClose()}}><span className="command-icon"><Icon size={18}/></span><span><strong>{label}</strong><small>{description}</small></span><ArrowRight size={16}/></button>)}{filtered.length===0&&<div className="command-empty">Nenhum atalho encontrado.</div>}</div>
    <div className="command-footer"><span>Digite para buscar</span><span><kbd>Esc</kbd> fechar</span></div>
  </div></div>
}
