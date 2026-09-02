import { FormEvent, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, CreditCard, MessageCircle, Smartphone } from 'lucide-react';
import { db } from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { CheckoutMode, Store } from '../../types/models';

export function CheckoutSettingsPage(){
 const {profile}=useAuth(); const [store,setStore]=useState<Partial<Store>>({checkoutMode:'whatsapp',allowPix:true,allowCard:true,allowCash:true,allowPickup:true,allowDelivery:true,deliveryFee:0}); const [saved,setSaved]=useState(false);
 useEffect(()=>{if(!profile?.storeId)return;getDoc(doc(db,'stores',profile.storeId)).then(s=>s.exists()&&setStore(v=>({...v,id:s.id,...s.data()} as Store)));},[profile?.storeId]);
 const choose=(checkoutMode:CheckoutMode)=>setStore({...store,checkoutMode});
 async function save(e:FormEvent){e.preventDefault();if(!profile?.storeId)return;await updateDoc(doc(db,'stores',profile.storeId),{checkoutMode:store.checkoutMode||'whatsapp',allowPix:store.allowPix!==false,allowCard:store.allowCard!==false,allowCash:store.allowCash!==false,allowPickup:store.allowPickup!==false,allowDelivery:store.allowDelivery!==false,deliveryFee:Number(store.deliveryFee||0)});setSaved(true);setTimeout(()=>setSaved(false),2500)}
 return <><div className="page-head"><div><h1>Finalização da compra</h1><p>Escolha como seus clientes poderão concluir os pedidos.</p></div></div><form onSubmit={save}>
 <div className="checkout-mode-grid">
  <button type="button" className={`mode-card ${store.checkoutMode==='whatsapp'?'selected':''}`} onClick={()=>choose('whatsapp')}><MessageCircle/><strong>WhatsApp</strong><span>Fluxo simples. O carrinho vira uma mensagem pronta para sua loja.</span>{store.checkoutMode==='whatsapp'&&<CheckCircle2 className="mode-check"/>}</button>
  <button type="button" className={`mode-card ${store.checkoutMode==='online'?'selected':''}`} onClick={()=>choose('online')}><CreditCard/><strong>Pelo sistema</strong><span>O pedido entra no painel e pode receber pagamento integrado.</span>{store.checkoutMode==='online'&&<CheckCircle2 className="mode-check"/>}</button>
  <button type="button" className={`mode-card ${store.checkoutMode==='both'?'selected':''}`} onClick={()=>choose('both')}><Smartphone/><strong>Oferecer os dois</strong><span>O consumidor escolhe entre WhatsApp ou finalizar no Vitrio.</span>{store.checkoutMode==='both'&&<CheckCircle2 className="mode-check"/>}</button>
 </div>
 <div className="panel settings-panel"><h2>Formas disponíveis</h2><div className="toggle-grid"><label><input type="checkbox" checked={store.allowPix!==false} onChange={e=>setStore({...store,allowPix:e.target.checked})}/> Pix</label><label><input type="checkbox" checked={store.allowCard!==false} onChange={e=>setStore({...store,allowCard:e.target.checked})}/> Cartão / pagamento online</label><label><input type="checkbox" checked={store.allowCash!==false} onChange={e=>setStore({...store,allowCash:e.target.checked})}/> Dinheiro</label><label><input type="checkbox" checked={store.allowPickup!==false} onChange={e=>setStore({...store,allowPickup:e.target.checked})}/> Retirada na loja</label><label><input type="checkbox" checked={store.allowDelivery!==false} onChange={e=>setStore({...store,allowDelivery:e.target.checked})}/> Entrega</label><label>Taxa padrão de entrega <input type="number" min="0" step="0.01" value={store.deliveryFee||0} onChange={e=>setStore({...store,deliveryFee:Number(e.target.value)})}/></label></div><div className="save-row"><button className="primary-btn">Salvar configurações</button>{saved&&<span className="success-text">Configurações salvas ✓</span>}</div></div>
 </form></>;
}
