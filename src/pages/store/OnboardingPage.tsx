import { FormEvent,useEffect,useState } from 'react';
import { Bell,CheckCircle2,ExternalLink,MoreVertical,Rocket,Share2,Smartphone,Store as StoreIcon } from 'lucide-react';
import { doc,getDoc,serverTimestamp,updateDoc } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { db } from '../../lib/firebase'; import { useAuth } from '../../contexts/AuthContext'; import { Store } from '../../types/models';
export function OnboardingPage(){const {profile}=useAuth();const [store,setStore]=useState<Partial<Store>>({});const [saved,setSaved]=useState(false);useEffect(()=>{if(!profile?.storeId)return;getDoc(doc(db,'stores',profile.storeId)).then(s=>s.exists()&&setStore({id:s.id,...s.data()} as Store));},[profile?.storeId]);async function save(e:FormEvent){e.preventDefault();if(!profile?.storeId)return;await updateDoc(doc(db,'stores',profile.storeId),{description:store.description||'',whatsapp:store.whatsapp||'',instagram:store.instagram||'',address:store.address||'',businessHours:store.businessHours||'',onboardingCompleted:true,onboardingCompletedAt:serverTimestamp(),updatedAt:serverTimestamp()});setSaved(true);setStore({...store,onboardingCompleted:true} as any)}return <><div className="page-head"><div><h1>Primeiros passos</h1><p>Configure o essencial para começar a divulgar sua vitrine.</p></div>{store.onboardingCompleted&&<span className="status-chip ok"><CheckCircle2 size={14}/> Configuração concluída</span>}</div><div className="onboarding-grid"><div className="panel"><div className="step-badge">1</div><h2>Informações básicas</h2><form className="form-grid" onSubmit={save}><label className="span-2">Descrição da loja<textarea value={store.description||''} onChange={e=>setStore({...store,description:e.target.value})} placeholder="Conte em poucas linhas o que sua loja vende."/></label><label>WhatsApp<input value={store.whatsapp||''} onChange={e=>setStore({...store,whatsapp:e.target.value})}/></label><label>Instagram<input value={store.instagram||''} onChange={e=>setStore({...store,instagram:e.target.value})}/></label><label className="span-2">Endereço<input value={store.address||''} onChange={e=>setStore({...store,address:e.target.value})}/></label><label className="span-2">Horário de funcionamento<input value={store.businessHours||''} onChange={e=>setStore({...store,businessHours:e.target.value})}/></label><button className="primary-btn">{saved?'Configuração salva ✓':'Salvar e concluir etapa'}</button></form></div><div className="onboarding-steps"><Link to="/painel/minha-loja"><span>2</span><div><strong>Personalize sua marca</strong><small>Logo, banner, cores e informações comerciais.</small></div><StoreIcon/></Link><Link to="/painel/produtos"><span>3</span><div><strong>Cadastre os primeiros produtos</strong><small>Adicione preço, estoque, foto e categoria.</small></div><Rocket/></Link><a href={store.slug?`/loja/${store.slug}`:'#'} target="_blank" rel="noreferrer"><span>4</span><div><strong>Veja sua vitrine pública</strong><small>Confira como o cliente vai enxergar sua loja.</small></div><ExternalLink/></a></div></div>

<section className="install-guide">
  <div className="install-guide-heading">
    <div className="install-guide-icon">
      <Smartphone size={24}/>
    </div>
    <div>
      <span className="install-eyebrow">Vitrio no celular</span>
      <h2>Instale o Vitrio como aplicativo</h2>
      <p>
        Tenha acesso rápido ao painel e receba os novos pedidos
        diretamente no celular.
      </p>
    </div>
  </div>

  <div className="install-platforms">

    <article className="install-platform-card">
      <div className="platform-title">
        <span className="platform-symbol"></span>
        <div>
          <strong>iPhone / iPad</strong>
          <small>Instalação pelo Safari</small>
        </div>
      </div>

      <ol className="install-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Abra no Safari</strong>
            <small>Acesse o Vitrio usando o navegador Safari.</small>
          </div>
        </li>

        <li>
          <span>2</span>
          <div>
            <strong>Toque em Compartilhar</strong>
            <small>
              Procure o botão <Share2 size={14}/> na barra do Safari.
            </small>
          </div>
        </li>

        <li>
          <span>3</span>
          <div>
            <strong>Adicionar à Tela de Início</strong>
            <small>Escolha essa opção no menu de compartilhamento.</small>
          </div>
        </li>

        <li>
          <span>4</span>
          <div>
            <strong>Confirme em Adicionar</strong>
            <small>O ícone do Vitrio aparecerá junto aos seus aplicativos.</small>
          </div>
        </li>
      </ol>
    </article>

    <article className="install-platform-card">
      <div className="platform-title">
        <span className="android-symbol">A</span>
        <div>
          <strong>Android</strong>
          <small>Instalação pelo Chrome</small>
        </div>
      </div>

      <ol className="install-steps">
        <li>
          <span>1</span>
          <div>
            <strong>Abra no Google Chrome</strong>
            <small>Acesse o Vitrio usando o navegador Chrome.</small>
          </div>
        </li>

        <li>
          <span>2</span>
          <div>
            <strong>Abra o menu</strong>
            <small>
              Toque nos três pontos <MoreVertical size={14}/> do Chrome.
            </small>
          </div>
        </li>

        <li>
          <span>3</span>
          <div>
            <strong>Instale o aplicativo</strong>
            <small>
              Escolha “Instalar app” ou “Adicionar à tela inicial”.
            </small>
          </div>
        </li>

        <li>
          <span>4</span>
          <div>
            <strong>Confirme a instalação</strong>
            <small>Depois, abra o Vitrio pelo novo ícone.</small>
          </div>
        </li>
      </ol>
    </article>

  </div>

  <div className="notification-guide">
    <div className="notification-guide-icon">
      <Bell size={23}/>
    </div>

    <div className="notification-guide-content">
      <span className="install-eyebrow">Etapa importante</span>
      <h3>Ative as notificações de novos pedidos</h3>
      <p>
        Depois de instalar e abrir o Vitrio pelo ícone da Tela de Início,
        ative as notificações para ser avisado mesmo quando o aplicativo
        estiver fechado ou em segundo plano.
      </p>

      <div className="notification-howto">
        <span className="notification-demo">
          <Smartphone size={17}/>
          <small>Notificações</small>
          <strong>OFF</strong>
        </span>

        <span className="notification-arrow">→</span>

        <span className="notification-demo active">
          <Smartphone size={17}/>
          <small>Notificações</small>
          <strong>ON</strong>
        </span>
      </div>

      <ol>
        <li>Abra o Vitrio pelo ícone instalado no celular.</li>
        <li>Na barra superior, toque em <strong>Notificações OFF</strong>.</li>
        <li>Quando o celular solicitar permissão, escolha <strong>Permitir</strong>.</li>
        <li>Confirme que o botão passou a mostrar <strong>Notificações ON</strong>.</li>
      </ol>

      <div className="device-notice">
        <CheckCircle2 size={18}/>
        <span>
          <strong>Vai usar o Vitrio em mais de um celular?</strong>
          Instale o aplicativo e ative as notificações em cada aparelho
          que deverá receber os novos pedidos.
        </span>
      </div>
    </div>
  </div>
</section>

</>}
