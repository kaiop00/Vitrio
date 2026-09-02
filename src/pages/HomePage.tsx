import { ArrowRight, BarChart3, Boxes, CheckCircle2, Package, QrCode, ShoppingBag, Store, TicketPercent, Truck, Users, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const features = [
  [ShoppingBag, 'Vitrine digital', 'Uma loja bonita e responsiva para vender por um único link.'],
  [Package, 'Produtos e categorias', 'Cadastre produtos, fotos, preços, categorias e ofertas em poucos passos.'],
  [Boxes, 'Estoque integrado', 'Acompanhe entradas, saídas, estoque baixo e movimentações por pedido.'],
  [Truck, 'Entrega e retirada', 'Configure bairros, regiões, taxas de entrega e retirada na loja.'],
  [TicketPercent, 'Cupons e ofertas', 'Crie promoções, cupons e ofertas relâmpago com validade.'],
  [BarChart3, 'Gestão e relatórios', 'Pedidos, clientes, caixa e indicadores em uma visão simples.'],
];

export function HomePage(){
  const { profile } = useAuth();
  const panel = profile?.role === 'admin' ? '/admin' : '/painel';

  return <div className="marketing-page">
    <header className="marketing-nav">
      <Link className="marketing-brand" to="/"><span>V</span><strong>Vitrio</strong></Link>
      <nav>
        <a href="#recursos">Recursos</a>
        <a href="#como-funciona">Como funciona</a>
      </nav>
      <div className="marketing-actions">
        {profile
          ? <Link className="secondary-btn" to={panel}>Ir para o painel</Link>
          : <><Link className="nav-login" to="/login">Entrar</Link><Link className="primary-btn" to="/cadastro">Criar minha loja</Link></>}
      </div>
    </header>

    <main>
      <section className="marketing-hero">
        <div className="hero-copy">
          <span className="marketing-pill"><Zap size={15}/> Sua loja pronta para vender online</span>
          <h1>Seu comércio em um link. <em>Simples de vender, fácil de gerenciar.</em></h1>
          <p>Crie sua vitrine digital, receba pedidos, controle estoque, organize entregas e acompanhe sua operação em um único lugar.</p>
          <div className="hero-actions">
            <Link className="primary-btn big" to="/cadastro">Criar minha loja <ArrowRight size={18}/></Link>
            <Link className="secondary-btn big" to="/login">Já tenho uma conta</Link>
          </div>
          <div className="hero-trust"><span><CheckCircle2/> Sem complicação</span><span><CheckCircle2/> Funciona no celular</span><span><CheckCircle2/> Link próprio da loja</span></div>
        </div>

        <div className="product-preview">
          <div className="preview-window">
            <div className="preview-top"><span/><span/><span/><small>vitrio.app/loja/sua-loja</small></div>
            <div className="preview-store-head"><div className="preview-logo">S</div><div><strong>Sua Loja</strong><small>Catálogo online</small></div><ShoppingBag size={20}/></div>
            <div className="preview-banner"><span>OFERTA DA SEMANA</span><strong>Produtos que seus clientes vão amar.</strong></div>
            <div className="preview-chips"><span>Todos</span><span>Novidades</span><span>Ofertas</span></div>
            <div className="preview-products">
              <article><div className="preview-image">01</div><strong>Produto em destaque</strong><small>R$ 49,90</small></article>
              <article><div className="preview-image">02</div><strong>Mais vendido</strong><small>R$ 79,90</small></article>
            </div>
          </div>
          <div className="floating-card floating-orders"><ShoppingBag/><div><strong>+12 pedidos</strong><small>hoje na sua loja</small></div></div>
          <div className="floating-card floating-stock"><Boxes/><div><strong>Estoque organizado</strong><small>em tempo real</small></div></div>
        </div>
      </section>

      <section className="marketing-strip">
        <span>Catálogo</span><span>Pedidos</span><span>Estoque</span><span>Clientes</span><span>Cupons</span><span>Entregas</span><span>Caixa</span><span>Relatórios</span>
      </section>

      <section className="marketing-section" id="recursos">
        <div className="section-intro"><span>Feito para o comércio real</span><h2>Tudo que sua loja precisa para vender e organizar a operação.</h2><p>Do primeiro produto cadastrado até o acompanhamento da venda.</p></div>
        <div className="feature-grid">{features.map(([Icon,title,text]:any)=><article className="feature-card" key={title}><div className="feature-icon"><Icon/></div><h3>{title}</h3><p>{text}</p></article>)}</div>
      </section>

      <section className="marketing-section steps-section" id="como-funciona">
        <div className="section-intro"><span>Comece rápido</span><h2>Da criação da conta à primeira venda.</h2></div>
        <div className="steps-grid">
          <article><b>01</b><Store/><h3>Crie sua loja</h3><p>Informe seus dados e receba seu painel administrativo.</p></article>
          <article><b>02</b><Package/><h3>Cadastre os produtos</h3><p>Adicione fotos, preços, estoque, categorias e promoções.</p></article>
          <article><b>03</b><QrCode/><h3>Compartilhe seu link</h3><p>Divulgue no Instagram, WhatsApp ou onde seus clientes estiverem.</p></article>
          <article><b>04</b><Users/><h3>Gerencie tudo</h3><p>Pedidos, clientes, equipe, caixa e relatórios no mesmo painel.</p></article>
        </div>
      </section>

      <section className="marketing-cta">
        <div><span>Pronto para começar?</span><h2>Transforme seu catálogo em uma vitrine que vende.</h2><p>Crie sua loja no Vitrio e comece a organizar suas vendas.</p></div>
        <Link className="primary-btn big" to="/cadastro">Criar minha loja <ArrowRight size={18}/></Link>
      </section>
    </main>

    <footer className="marketing-footer"><div className="marketing-brand"><span>V</span><strong>Vitrio</strong></div><small>Seu comércio em um link.</small></footer>
  </div>
}