import { FormEvent, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { MessageCircle, RotateCcw, Save, Sparkles } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useUi } from '../../contexts/UiContext';

type Templates = {
  paid:string;
  preparing:string;
  ready:string;
  out_for_delivery:string;
  completed:string;
};

const defaults:Templates={
  paid:'Olá, {cliente}! 💜 Recebemos seu pedido #{pedido} na {loja}. Ficamos felizes por ter você aqui! Já vamos preparar tudo com carinho.',
  preparing:'Olá, {cliente}! ✨ Seu pedido #{pedido} na {loja} já está em preparação. Estamos cuidando de tudo para que chegue perfeito até você.',
  ready:'Olá, {cliente}! 🎉 Seu pedido #{pedido} na {loja} está prontinho! Obrigado por comprar com a gente. 💜',
  out_for_delivery:'Olá, {cliente}! 🛵 Seu pedido #{pedido} na {loja} saiu para entrega e já está a caminho. Daqui a pouco ele chega até você!',
  completed:'Olá, {cliente}! 💜 Seu pedido #{pedido} foi concluído. Esperamos que você ame sua compra! Foi um prazer ter você com a gente na {loja}.'
};

const labels:Record<keyof Templates,string>={
  paid:'Pedido confirmado',
  preparing:'Em preparação',
  ready:'Pedido pronto',
  out_for_delivery:'Saiu para entrega',
  completed:'Pedido concluído'
};

export function OrderMessagesPage(){
  const {profile}=useAuth();
  const {toast}=useUi();
  const [templates,setTemplates]=useState<Templates>(defaults);
  const [enabled,setEnabled]=useState(true);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{
    if(!profile?.storeId)return;
    getDoc(doc(db,'stores',profile.storeId)).then(s=>{
      if(!s.exists())return;
      const d=s.data() as any;
      if(d.orderStatusMessages)setTemplates({...defaults,...d.orderStatusMessages});
      setEnabled(d.orderStatusMessagesEnabled!==false);
    });
  },[profile?.storeId]);

  async function save(e:FormEvent){
    e.preventDefault();
    if(!profile?.storeId)return;
    await updateDoc(doc(db,'stores',profile.storeId),{
      orderStatusMessages:templates,
      orderStatusMessagesEnabled:enabled
    });
    setSaved(true);
    toast('Mensagens de acompanhamento salvas.');
    setTimeout(()=>setSaved(false),2500);
  }

  return <>
    <div className="page-head">
      <div>
        <h1>Mensagens do pedido</h1>
        <p>Personalize as mensagens que serão usadas para avisar seus clientes no WhatsApp.</p>
      </div>
    </div>

    <form onSubmit={save} className="order-message-settings">
      <section className="panel message-settings-intro">
        <div className="section-title-icon">
          <MessageCircle/>
          <div>
            <h2>Atualizações pelo WhatsApp</h2>
            <p>Ao mudar o status do pedido, o Vitrio poderá abrir a conversa do cliente com a mensagem correspondente pronta para envio.</p>
          </div>
        </div>
        <label className="check-line">
          <input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>
          Ativar mensagens de acompanhamento dos pedidos
        </label>
        <div className="message-vars">
          <strong>Variáveis disponíveis</strong>
          <span><code>{'{cliente}'}</code> nome do cliente</span>
          <span><code>{'{pedido}'}</code> código do pedido</span>
          <span><code>{'{loja}'}</code> nome da loja</span>
          <span><code>{'{total}'}</code> valor total</span>
        </div>
      </section>

      <div className="message-template-grid">
        {(Object.keys(labels) as (keyof Templates)[]).map(key=>
          <section className="panel message-template-card" key={key}>
            <div className="message-template-head">
              <div>
                <span className="eyebrow">{labels[key]}</span>
                <h2>{labels[key]}</h2>
              </div>
              <Sparkles size={20}/>
            </div>
            <textarea
              rows={6}
              value={templates[key]}
              onChange={e=>setTemplates({...templates,[key]:e.target.value})}
            />
            <div className="message-preview">
              <strong>Prévia</strong>
              <p>{templates[key]
                .split('{cliente}').join('Thalia')
                .split('{pedido}').join('A1B2C3')
                .split('{loja}').join('Dona Fitness')
                .split('{total}').join('R$ 230,00')}</p>
            </div>
            <button type="button" className="secondary-btn" onClick={()=>setTemplates({...templates,[key]:defaults[key]})}>
              <RotateCcw size={16}/> Restaurar padrão
            </button>
          </section>
        )}
      </div>

      <div className="panel message-settings-save">
        <button className="primary-btn"><Save size={17}/> Salvar mensagens</button>
        {saved&&<span className="success-text">Salvo ✓</span>}
      </div>
    </form>
  </>;
}
