import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window { MercadoPago?: any; }
}

type Props = {
  publicKey:string;
  amount:number;
  payerEmail:string;
  onSubmit:(data:any)=>Promise<void>;
  onCancel:()=>void;
};

export function MercadoPagoCardBrick({publicKey,amount,payerEmail,onSubmit,onCancel}:Props){
 const controller=useRef<any>(null); const [error,setError]=useState('');
 useEffect(()=>{
   let active=true;
   (async()=>{
     try{
       if(!window.MercadoPago) throw new Error('SDK do Mercado Pago não carregou.');
       const mp=new window.MercadoPago(publicKey,{locale:'pt-BR'});
       const bricks=mp.bricks();
       controller.current=await bricks.create('cardPayment','mp-card-brick',{
         initialization:{amount,payer:{email:payerEmail}},
         callbacks:{
           onReady:()=>{},
           onError:(e:any)=>{console.error(e); if(active)setError('Não foi possível carregar o formulário do cartão.');},
           onSubmit:(formData:any)=>new Promise<void>(async(resolve,reject)=>{
             try{await onSubmit(formData);resolve();}catch(e){reject(e);}
           })
         }
       });
     }catch(e:any){if(active)setError(e?.message||'Erro ao carregar pagamento com cartão.');}
   })();
   return()=>{active=false;try{controller.current?.unmount?.();}catch{}};
 },[publicKey,amount,payerEmail,onSubmit]);
 return <div className="mp-card-wrap"><div className="mp-card-head"><div><h3>Pagamento com cartão</h3><p>Os dados do cartão são enviados de forma segura pelo Mercado Pago.</p></div><button type="button" className="secondary-btn" onClick={onCancel}>Voltar</button></div>{error&&<div className="error">{error}</div>}<div id="mp-card-brick"/></div>;
}
