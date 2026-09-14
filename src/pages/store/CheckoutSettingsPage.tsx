import { FormEvent, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { Store } from '../../types/models';

export function CheckoutSettingsPage(){
 const {profile}=useAuth();
 const [store,setStore]=useState<Partial<Store>>({checkoutMode:'whatsapp',allowPix:true,allowCard:true,allowCash:true,allowPickup:true,allowDelivery:true,deliveryFee:0});
 const [deliveryFee,setDeliveryFee]=useState('0');
 const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!profile?.storeId)return;getDoc(doc(db,'stores',profile.storeId)).then(s=>{if(!s.exists())return;const data={id:s.id,...s.data()} as Store;setStore(v=>({...v,...data}));setDeliveryFee(String(data.deliveryFee??0));});},[profile?.storeId]);
 async function save(e:FormEvent){e.preventDefault();if(!profile?.storeId)return;const fee=deliveryFee.trim()===''?0:Number(deliveryFee.replace(',','.'));await updateDoc(doc(db,'stores',profile.storeId),{checkoutMode:'whatsapp',allowPix:store.allowPix!==false,allowCard:store.allowCard!==false,allowCash:store.allowCash!==false,allowPickup:store.allowPickup!==false,allowDelivery:store.allowDelivery!==false,deliveryFee:Number.isFinite(fee)?fee:0});setSaved(true);setTimeout(()=>setSaved(false),2500)}
 return <><div className="page-head"><div><h1>Finalização da compra</h1><p>Escolha como seus clientes poderão concluir os pedidos.</p></div></div><form onSubmit={save}>
 <div className="checkout-mode-grid">
  <div className="mode-card selected"><MessageCircle/><strong>WhatsApp</strong><span>Os pedidos são registrados no Vitrio e a conversa com o cliente é concluída pelo WhatsApp.</span><CheckCircle2 className="mode-check"/></div>
 </div>
 <div className="notice">Pagamento integrado pelo sistema ficará disponível em uma etapa futura. Nesta versão, a finalização permanece pelo WhatsApp.</div>
 <div className="panel settings-panel"><h2>Formas disponíveis</h2><div className="toggle-grid"><label><input type="checkbox" checked={store.allowPix!==false} onChange={e=>setStore({...store,allowPix:e.target.checked})}/> Pix</label><label><input type="checkbox" checked={store.allowCard!==false} onChange={e=>setStore({...store,allowCard:e.target.checked})}/> Cartão</label><label><input type="checkbox" checked={store.allowCash!==false} onChange={e=>setStore({...store,allowCash:e.target.checked})}/> Dinheiro</label><label><input type="checkbox" checked={store.allowPickup!==false} onChange={e=>setStore({...store,allowPickup:e.target.checked})}/> Retirada na loja</label><label><input type="checkbox" checked={store.allowDelivery!==false} onChange={e=>setStore({...store,allowDelivery:e.target.checked})}/> Entrega</label><label>Taxa padrão de entrega <input type="number" min="0" step="0.01" inputMode="decimal" value={deliveryFee} onChange={e=>setDeliveryFee(e.target.value)}/></label></div><div className="save-row"><button className="primary-btn">Salvar configurações</button>{saved&&<span className="success-text">Configurações salvas ✓</span>}</div></div>
 </form></>;
}
