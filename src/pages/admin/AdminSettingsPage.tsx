export function AdminSettingsPage(){
 return <><div className="page-head"><div><h1>Configurações da plataforma</h1><p>Estrutura comercial e integrações globais do Vitrio.</p></div></div>
 <div className="settings-grid">
  <div className="panel"><h2>Planos</h2><div className="plan-list">
   <div><strong>Starter</strong><span>Catálogo, WhatsApp e gestão essencial.</span></div>
   <div><strong>Pro</strong><span>Pedidos no sistema, estoque, caixa e relatórios.</span></div>
   <div><strong>Business</strong><span>Recursos avançados e futuras integrações.</span></div>
  </div></div>
  <div className="panel"><h2>Pagamentos online</h2><p>O Vitrio está preparado para Mercado Pago em modelo marketplace: cada lojista conecta a própria conta e o backend processa pagamentos em nome dele.</p><div className="notice">As credenciais privadas da aplicação devem ser configuradas somente nas Cloud Functions antes de liberar o botão de conexão.</div></div>
 </div></>;
}