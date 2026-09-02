import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { ArrowUpDown, BadgePercent, Check, Clock3, Copy, Heart, Info, Minus, Plus, Search, Share2, ShoppingBag, Star, X } from 'lucide-react';
import { db, functions } from '../../lib/firebase';
import { useUi } from '../../contexts/UiContext';
import { AddonSelection, CartItem, Category, Product, ProductVariant, Store, DeliveryZone } from '../../types/models';
import { useParams } from 'react-router-dom';
import { MercadoPagoCardBrick } from '../../components/MercadoPagoCardBrick';
import { LoadingState } from '../../components/ui/LoadingState';
import { ShareSheet } from '../../components/ShareSheet';

const money=(v:number)=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
type PixData={qrCode?:string;qrCodeBase64?:string;ticketUrl?:string};
type CardStage={orderId:string;total:number;publicKey:string;email:string};

export function StorefrontPage(){ const {confirm:confirmAction}=useUi();
 const checkoutLock=useRef(false);
 const {slug}=useParams();
 const [store,setStore]=useState<Store|null>(null),[products,setProducts]=useState<Product[]>([]),[categories,setCategories]=useState<Category[]>([]),[zones,setZones]=useState<DeliveryZone[]>([]);
 const [initialLoading,setInitialLoading]=useState(true),[storeLoadError,setStoreLoadError]=useState('');
 const [cart,setCart]=useState<CartItem[]>([]),[cartReady,setCartReady]=useState(false),[open,setOpen]=useState(false),[search,setSearch]=useState(''),[category,setCategory]=useState('all'),[selectedProduct,setSelectedProduct]=useState<Product|null>(null),[favorites,setFavorites]=useState<string[]>([]),[favoriteOnly,setFavoriteOnly]=useState(false),[galleryIndex,setGalleryIndex]=useState(0),[sort,setSort]=useState<'featured'|'price_asc'|'price_desc'|'name'>('featured');
 const [payment,setPayment]=useState('Pix'),[delivery,setDelivery]=useState<'pickup'|'delivery'>('pickup');
 const [customer,setCustomer]=useState({name:'',phone:'',email:'',address:'',notes:''}); const [deliveryZoneId,setDeliveryZoneId]=useState(''); const [couponCode,setCouponCode]=useState(''); const [quote,setQuote]=useState<any>(null); const [quoteMsg,setQuoteMsg]=useState('');
 const [sending,setSending]=useState(false),[done,setDone]=useState(''),[error,setError]=useState(''),[lastOrderId,setLastOrderId]=useState('');
 const [selectedVariant,setSelectedVariant]=useState<ProductVariant|null>(null);
 const [selectedAddons,setSelectedAddons]=useState<Record<string,string[]>>({});
 const [pix,setPix]=useState<PixData|null>(null),[pixCopied,setPixCopied]=useState(false),[cardStage,setCardStage]=useState<CardStage|null>(null);
 const [sharePayload,setSharePayload]=useState<{title:string;text:string;url:string}|null>(null);

 useEffect(()=>{let active=true;(async()=>{
   if(!slug){setStoreLoadError('Link da loja inválido.');setInitialLoading(false);return;}
   setInitialLoading(true);setStoreLoadError('');
   try{
     const s=await getDocs(query(collection(db,'stores'),where('slug','==',slug),where('active','==',true),limit(1)));
     if(!active)return;
     if(s.empty){setStoreLoadError('Esta loja não está disponível no momento.');return;}
     const st={id:s.docs[0].id,...s.docs[0].data()} as Store;setStore(st);
     const [p,c,z]=await Promise.all([
       getDocs(query(collection(db,'products'),where('storeId','==',st.id),where('active','==',true))),
       getDocs(query(collection(db,'categories'),where('storeId','==',st.id),where('active','==',true))),
       getDocs(query(collection(db,'deliveryZones'),where('storeId','==',st.id),where('active','==',true)))
     ]);
     if(!active)return;
     setProducts(p.docs.map(d=>({id:d.id,...d.data()} as Product)));
     setCategories(c.docs.map(d=>({id:d.id,...d.data()} as Category)).sort((a,b)=>a.name.localeCompare(b.name)));
     setZones(z.docs.map(d=>({id:d.id,...d.data()} as DeliveryZone)).sort((a,b)=>a.name.localeCompare(b.name)));
   }catch{if(active)setStoreLoadError('Não foi possível carregar a loja. Verifique sua conexão e tente novamente.');}
   finally{if(active)setInitialLoading(false);}
 })();return()=>{active=false};},[slug]);

 useEffect(()=>{if(!store||products.length===0||cartReady)return;try{const raw=localStorage.getItem(`vitrio:cart:${store.slug}`);if(raw){const saved=JSON.parse(raw) as {productId:string;variantId?:string;addonOptionIds?:string[];quantity:number}[];const restored=saved.map(i=>{const product=products.find(p=>p.id===i.productId);const variant=i.variantId?product?.variants?.find(v=>v.id===i.variantId&&v.active!==false):undefined;const ids=new Set(i.addonOptionIds||[]);const addons:AddonSelection[]=(product?.addonGroups||[]).flatMap(g=>(g.options||[]).filter(o=>o.active!==false&&ids.has(o.id)).map(o=>({groupId:g.id,groupName:g.name,optionId:o.id,optionName:o.name,price:Number(o.price||0)})));const stock=variant?variant.stock:product?.stock||0;return product&&product.active&&stock>0?{product,variant,addons,quantity:Math.min(Math.max(1,Number(i.quantity)||1),stock)}:null}).filter(Boolean) as CartItem[];setCart(restored)}}catch{}finally{setCartReady(true)}},[store,products,cartReady]);
 useEffect(()=>{if(!store||!cartReady)return;try{localStorage.setItem(`vitrio:cart:${store.slug}`,JSON.stringify(cart.map(i=>({productId:i.product.id,variantId:i.variant?.id||'',addonOptionIds:(i.addons||[]).map(a=>a.optionId),quantity:i.quantity}))))}catch{}},[cart,store,cartReady]);
 useEffect(()=>{if(!store)return;try{const raw=localStorage.getItem(`vitrio:favorites:${store.slug}`);setFavorites(raw?JSON.parse(raw):[])}catch{}},[store]);
 useEffect(()=>{if(!store)return;try{localStorage.setItem(`vitrio:favorites:${store.slug}`,JSON.stringify(favorites))}catch{}},[favorites,store]);
 useEffect(()=>{if(products.length===0)return;const id=new URLSearchParams(window.location.search).get('produto');if(!id)return;const p=products.find(x=>x.id===id);if(p){setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({});setSelectedProduct(p)}},[products]);

 const visible=useMemo(()=>{const list=products.filter(p=>(category==='all'||p.categoryId===category)&&(!favoriteOnly||favorites.includes(p.id))&&(p.name.toLowerCase().includes(search.toLowerCase())||p.description?.toLowerCase().includes(search.toLowerCase())||(p.sku||'').toLowerCase().includes(search.toLowerCase())||(p.tags||[]).join(' ').toLowerCase().includes(search.toLowerCase())));return [...list].sort((a,b)=>sort==='price_asc'?a.price-b.price:sort==='price_desc'?b.price-a.price:sort==='name'?a.name.localeCompare(b.name):(Number(!!b.featured)-Number(!!a.featured))||(Number(a.sortOrder??999999999)-Number(b.sortOrder??999999999))||(Number((b.createdAt as any)?.seconds||0)-Number((a.createdAt as any)?.seconds||0)));},[products,search,category,favoriteOnly,favorites,sort]);
 const featured=useMemo(()=>products.filter(p=>p.featured&&p.stock>0).slice(0,8),[products]);
 const offers=useMemo(()=>products.filter(p=>{if(!p.flashOffer||p.stock<=0)return false;const now=Date.now();const st=p.flashOfferStartsAt?.toDate?.()?.getTime?.()||0;const en=p.flashOfferEndsAt?.toDate?.()?.getTime?.()||0;return (!st||st<=now)&&(!en||en>=now)}),[products]);
 const addonTotal=(addons:AddonSelection[]|undefined)=>(addons||[]).reduce((sum,a)=>sum+Number(a.price||0),0);
 const itemPrice=(i:CartItem)=>i.product.price+Number(i.variant?.priceAdjustment||0)+addonTotal(i.addons);
 const cartKey=(p:Product,variant?:ProductVariant,addons:AddonSelection[]=[])=>`${p.id}::${variant?.id||''}::${addons.map(a=>a.optionId).sort().join(',')}`;
 const resolveAddons=(p:Product)=>{const selections:AddonSelection[]=[];for(const group of (p.addonGroups||[])){const ids=selectedAddons[group.id]||[];const active=(group.options||[]).filter(o=>o.active!==false);if(group.required&&ids.length===0)throw new Error(`Escolha uma opção em ${group.name}.`);if(ids.length>Math.max(1,Number(group.maxSelections||1)))throw new Error(`Escolha no máximo ${Math.max(1,Number(group.maxSelections||1))} opção(ões) em ${group.name}.`);for(const id of ids){const option=active.find(o=>o.id===id);if(option)selections.push({groupId:group.id,groupName:group.name,optionId:option.id,optionName:option.name,price:Number(option.price||0)});}}return selections;};
 const subtotal=useMemo(()=>cart.reduce((sum,i)=>sum+itemPrice(i)*i.quantity,0),[cart]);
 const selectedZone=zones.find(z=>z.id===deliveryZoneId); const fee=delivery==='delivery'?(selectedZone?Number(selectedZone.fee):Number(store?.deliveryFee||0)):0,total=subtotal+fee;
 const mode=store?.checkoutMode||'whatsapp';
 const onlineConnected=store?.paymentProviderConnected===true;

 const toggleFavorite=(id:string)=>setFavorites(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);
 function shareStore(){if(!store)return;const url=`${window.location.origin}/loja/${store.slug}`;setSharePayload({title:store.name,text:`Conheça a vitrine da ${store.name}`,url})}
 function shareProduct(p:Product){const url=`${window.location.origin}/loja/${store?.slug||slug}?produto=${encodeURIComponent(p.id)}`;setSharePayload({title:p.name,text:`${p.name} por ${money(p.price)} na ${store?.name||'Vitrio'}`,url})}
 const add=(p:Product,chosenVariant?:ProductVariant|null)=>{const activeVariants=(p.variants||[]).filter(v=>v.active!==false);const variant=chosenVariant||null;if(activeVariants.length>0&&!variant){setError('Escolha uma variação antes de adicionar ao carrinho.');setSelectedProduct(p);return}let addons:AddonSelection[]=[];try{addons=resolveAddons(p)}catch(e:any){setError(e.message);setSelectedProduct(p);return}const availableStock=variant?variant.stock:p.stock;if(availableStock<=0)return;if(delivery==='pickup'&&p.availableForPickup===false){setError('Este produto não está disponível para retirada.');return}if(delivery==='delivery'&&p.availableForDelivery===false){setError('Este produto não está disponível para entrega.');return}const cap=p.maxPerOrder&&p.maxPerOrder>0?Math.min(availableStock,p.maxPerOrder):availableStock;const key=cartKey(p,variant||undefined,addons);setCart(c=>{const f=c.find(i=>cartKey(i.product,i.variant,i.addons)===key);return f?c.map(i=>cartKey(i.product,i.variant,i.addons)===key?{...i,quantity:Math.min(i.quantity+1,cap)}:i):[...c,{product:p,variant:variant||undefined,addons,quantity:1}]});setSelectedProduct(null);setSelectedVariant(null);setSelectedAddons({});setOpen(true)};
 const change=(key:string,d:number)=>setCart(c=>c.map(i=>{const itemKey=cartKey(i.product,i.variant,i.addons);const stock=i.variant?i.variant.stock:i.product.stock;const cap=i.product.maxPerOrder&&i.product.maxPerOrder>0?Math.min(stock,i.product.maxPerOrder):stock;return itemKey===key?{...i,quantity:Math.max(0,Math.min(cap,i.quantity+d))}:i}).filter(i=>i.quantity>0));

 const whatsapp=()=>{
   if(!store?.whatsapp||cart.length===0)return;
   if(Number(store.minOrderValue||0)>0&&subtotal<Number(store.minOrderValue)){setError(`Pedido mínimo de ${money(Number(store.minOrderValue))}.`);setOpen(true);return;}
   const lines=cart.map(i=>`• ${i.quantity}x ${i.product.name}${i.variant?` (${i.variant.name})`:''}${(i.addons||[]).length?` [${i.addons!.map(a=>a.optionName).join(', ')}]`:''} — ${money(itemPrice(i)*i.quantity)}`);
   const text=[`Olá! Quero fazer um pedido na ${store.name}:`,'',...lines,'',`Subtotal: ${money(subtotal)}`,fee?`Entrega: ${money(fee)}`:'',`Total: ${money(total)}`,`Pagamento: ${payment}`,`Recebimento: ${delivery==='delivery'?'Entrega':'Retirada na loja'}`,customer.name?`Nome: ${customer.name}`:'',customer.phone?`Telefone: ${customer.phone}`:'',customer.address&&delivery==='delivery'?`Endereço: ${customer.address}`:'',customer.notes?`Observações: ${customer.notes}`:''].filter(Boolean).join('\n');
   const phone=store.whatsapp.replace(/\D/g,'');
   const appUrl=`whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`;
   const webUrl=`https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
   const started=Date.now();window.location.href=appUrl;
   window.setTimeout(()=>{if(document.visibilityState==='visible'&&Date.now()-started<2200)window.open(webUrl,'_blank','noopener,noreferrer')},1200);
 };

 async function createValidatedOrder(){
   if(!store)throw new Error('Loja indisponível.');
   const createOrder=httpsCallable(functions,'createOrder');
   const res:any=await createOrder({
     storeId:store.id,customerName:customer.name.trim(),customerPhone:customer.phone.trim(),
     fulfillment:delivery,address:delivery==='delivery'?customer.address.trim():'',
     paymentMethod:payment,customerEmail:customer.email.trim(),customerNotes:customer.notes.trim(),couponCode:couponCode.trim(),deliveryZoneId:delivery==='delivery'?deliveryZoneId:'',items:cart.map(i=>({productId:i.product.id,variantId:i.variant?.id||'',addonOptionIds:(i.addons||[]).map(a=>a.optionId),quantity:i.quantity}))
   });
   return {orderId:String(res.data.orderId),total:Number(res.data.total)};
 }

 async function refreshQuote(){
   if(!store||cart.length===0)return;
   setQuoteMsg('');
   try{
     const fn=httpsCallable(functions,'getCheckoutQuote');
     const res:any=await fn({storeId:store.id,fulfillment:delivery,deliveryZoneId:delivery==='delivery'?deliveryZoneId:'',couponCode:couponCode.trim(),items:cart.map(i=>({productId:i.product.id,variantId:i.variant?.id||'',addonOptionIds:(i.addons||[]).map(a=>a.optionId),quantity:i.quantity}))});
     setQuote(res.data);setQuoteMsg(res.data.couponCode?'Cupom aplicado ✓':'Valores atualizados');
   }catch(e:any){setQuote(null);setQuoteMsg(e?.message?.replace('FirebaseError: ','')||'Não foi possível aplicar o cupom.');}
 }
 const friendlyCheckoutError=(err:any)=>{const raw=String(err?.message||'').replace('FirebaseError: ','').toLowerCase();if(raw.includes('resource-exhausted')||raw.includes('too many'))return 'Muitas tentativas em pouco tempo. Aguarde alguns segundos e tente novamente.';if(raw.includes('unavailable')||raw.includes('network')||raw.includes('offline'))return 'Sem conexão com o serviço. Confira sua internet e tente novamente.';if(raw.includes('stock')||raw.includes('estoque'))return 'Um dos itens teve alteração de estoque. Revise o carrinho e tente novamente.';if(raw.includes('coupon')||raw.includes('cupom'))return 'O cupom informado não pôde ser aplicado. Confira o código e tente novamente.';return err?.message?.replace('FirebaseError: ','')||'Não foi possível concluir o pedido. Tente novamente.';};

 async function systemCheckout(e:FormEvent){
   e.preventDefault();
   if(checkoutLock.current)return;
   if(!store||!customer.name.trim()||!customer.phone.trim()||cart.length===0)return;
   if(Number(store.minOrderValue||0)>0&&subtotal<Number(store.minOrderValue)){setError(`O pedido mínimo desta loja é ${money(Number(store.minOrderValue))}.`);return;}
   if(delivery==='delivery'&&!customer.address.trim())return;
   if((payment==='Pix'||payment==='Cartão')&&!customer.email.trim()){setError('Informe seu e-mail para o pagamento online.');return;}
   if((payment==='Pix'||payment==='Cartão')&&!onlineConnected){setError('Esta loja ainda não conectou o Mercado Pago. Escolha outra forma ou finalize pelo WhatsApp.');return;}

   checkoutLock.current=true;setSending(true);setError('');setDone('');setPix(null);setCardStage(null);
   try{
     const order=await createValidatedOrder();setLastOrderId(order.orderId);
     if(payment==='Dinheiro'){
       setDone(`Pedido #${order.orderId.slice(0,6).toUpperCase()} recebido! Pagamento na entrega/retirada.`);
       setCart([]);return;
     }
     if(payment==='Pix'){
       const pay=httpsCallable(functions,'createMercadoPagoPayment');
       const res:any=await pay({orderId:order.orderId,payerEmail:customer.email.trim(),kind:'pix'});
       setPix(res.data.pix||null);
       setDone(`Pedido #${order.orderId.slice(0,6).toUpperCase()} criado. Faça o Pix para confirmar.`);
       setCart([]);return;
     }
     if(payment==='Cartão'){
       if(!store.mercadoPagoPublicKey)throw new Error('A conexão da loja precisa ser renovada para liberar o cartão.');
       setCardStage({orderId:order.orderId,total:order.total,publicKey:store.mercadoPagoPublicKey,email:customer.email.trim()});
     }
   }catch(err:any){
     setError(friendlyCheckoutError(err));
   }finally{checkoutLock.current=false;setSending(false)}
 }

 const submitCard=useCallback(async(formData:any)=>{
   if(!cardStage)return;
   setError('');
   try{
     const pay=httpsCallable(functions,'createMercadoPagoPayment');
     const res:any=await pay({
       orderId:cardStage.orderId,payerEmail:cardStage.email,kind:'card',
       card:{
         token:formData?.token,
         paymentMethodId:formData?.payment_method_id,
         installments:formData?.installments,
       }
     });
     if(res.data?.status==='paid'){
       setDone(`Pagamento aprovado! Pedido #${cardStage.orderId.slice(0,6).toUpperCase()} confirmado.`);
       setCart([]);setCardStage(null);
     }else{
       setDone(`Pagamento enviado. Pedido #${cardStage.orderId.slice(0,6).toUpperCase()} está sendo processado.`);
       setCart([]);setCardStage(null);
     }
   }catch(e:any){setError(e?.message?.replace('FirebaseError: ','')||'O cartão não pôde ser processado.');throw e;}
 },[cardStage]);

 async function copyPix(){
   if(!pix?.qrCode)return;
   await navigator.clipboard.writeText(pix.qrCode);setPixCopied(true);setTimeout(()=>setPixCopied(false),1800);
 }


 if(initialLoading)return <main className="storefront storefront-loading"><LoadingState rows={6} label="Carregando vitrine..."/></main>;
 if(storeLoadError||!store)return <main className="storefront storefront-state"><div className="empty-state storefront-empty"><ShoppingBag size={32}/><h2>Loja indisponível</h2><p>{storeLoadError||'Não foi possível abrir esta loja.'}</p><button className="secondary-btn" onClick={()=>window.location.reload()}>Tentar novamente</button></div></main>;

 const paymentOptions=[
   store.allowPix!==false&&'Pix',
   store.allowCard!==false&&'Cartão',
   store.allowCash!==false&&'Dinheiro'
 ].filter(Boolean) as string[];
 return <div className="storefront" style={{'--store-color':store.primaryColor||'#6d5dfc'} as React.CSSProperties}>
 <header className="store-header"><div className="store-brand">{store.logoUrl?<img src={store.logoUrl} alt={store.name}/>:<span>{store.name[0]}</span>}<div><h1>{store.name}</h1><p>{store.description||'Confira nosso catálogo.'}</p></div></div><div className="store-header-actions"><button className="share-store-btn" onClick={shareStore} aria-label="Compartilhar loja"><Share2 size={18}/><span>Compartilhar</span></button><button className="cart-btn" onClick={()=>setOpen(true)} aria-label="Abrir carrinho"><ShoppingBag size={20}/><span>{cart.reduce((s,i)=>s+i.quantity,0)}</span></button></div></header>

 <section className="store-trust-row"><span><Info size={16}/>{store.address||'Compra segura pela vitrine'}</span>{store.businessHours&&<span><Clock3 size={16}/>{store.businessHours}</span>}{store.preparationTime&&<span><ShoppingBag size={16}/>Preparo: {store.preparationTime}</span>}</section>

 <section className="hero" style={store.bannerUrl?{backgroundImage:`linear-gradient(90deg,rgba(7,12,24,.88),rgba(7,12,24,.35)),url(${store.bannerUrl})`,backgroundSize:'cover',backgroundPosition:'center'}:undefined}><div><span className="pill">Compre do seu jeito</span><h2>{store.bannerText||store.name}</h2><p>{store.description||'Escolha seus produtos, monte o carrinho e finalize em poucos passos.'}</p>{store.businessHours&&<small>{store.businessHours}</small>}</div></section>

 {featured.length>0&&<section className="featured-section"><div className="section-title"><Star/><div><h2>Destaques da loja</h2><p>Uma seleção especial para você.</p></div></div><div className="offer-scroll">{featured.map(p=><button key={p.id} className="offer-card" onClick={()=>{setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({});setSelectedProduct(p)}}>{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<span className="offer-placeholder">V</span>}<div><strong>{p.name}</strong><b>{money(p.price)}</b></div></button>)}</div></section>}

 {offers.length>0&&<section className="flash-section"><div className="section-title"><BadgePercent/><div><h2>Ofertas relâmpago</h2><p>Aproveite enquanto estiver disponível.</p></div></div><div className="offer-scroll">{offers.map(p=><button key={p.id} className="offer-card" onClick={()=>add(p)}>{p.imageUrl?<img src={p.imageUrl} alt={p.name}/>:<span className="offer-placeholder">V</span>}<div><strong>{p.name}</strong>{p.compareAtPrice&&p.compareAtPrice>p.price?<del>{money(p.compareAtPrice)}</del>:null}<b>{money(p.price)}</b></div></button>)}</div></section>}

 <main className="catalog"><div className="catalog-toolbar"><div><h2>Catálogo</h2><small>{visible.length} item(ns)</small></div><div className="catalog-search-actions"><label className="search-box"><Search size={18}/><input placeholder="Buscar produto, SKU ou tag" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className={`favorite-filter ${favoriteOnly?'active':''}`} onClick={()=>setFavoriteOnly(v=>!v)}><Heart size={18} fill={favoriteOnly?'currentColor':'none'}/><span>Favoritos</span>{favorites.length>0&&<b>{favorites.length}</b>}</button><label className="sort-select"><ArrowUpDown size={16}/><select value={sort} onChange={e=>setSort(e.target.value as any)}><option value="featured">Relevância</option><option value="price_asc">Menor preço</option><option value="price_desc">Maior preço</option><option value="name">A–Z</option></select></label></div></div>
 {categories.length>0&&<div className="category-chips"><button className={category==='all'?'active':''} onClick={()=>setCategory('all')}>Todos</button>{categories.map(c=><button key={c.id} className={category===c.id?'active':''} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>}
 <div className="catalog-grid">{visible.map(p=><article className="catalog-card" key={p.id}><button className={`favorite-button ${favorites.includes(p.id)?'active':''}`} onClick={()=>toggleFavorite(p.id)} aria-label="Favoritar produto"><Heart size={18} fill={favorites.includes(p.id)?'currentColor':'none'}/></button>{p.imageUrl?<button className="product-image-button" onClick={()=>{setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({});setSelectedProduct(p)}}><img src={p.imageUrl} alt={p.name}/></button>:<button className="product-image-button" onClick={()=>{setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({});setSelectedProduct(p)}}><div className="catalog-placeholder">V</div></button>}<div className="catalog-body"><div className="storefront-flags">{p.featured&&<span className="featured-chip"><Star size={12}/>Destaque</span>}{p.flashOffer&&<span className="offer-chip">Oferta relâmpago</span>}</div><button className="product-title-button" onClick={()=>{setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({});setSelectedProduct(p)}}><h3>{p.name}</h3></button><p>{p.description}</p><div className="store-price">{p.compareAtPrice&&p.compareAtPrice>p.price?<del>{money(p.compareAtPrice)}</del>:null}<strong>{money(p.price)}</strong></div><div className="price-row"><small>{store.showStock===false?(p.stock>0?'Disponível':'Esgotado'):(p.stock>0?`${p.stock} disponível(is)`:'Esgotado')}</small><button onClick={()=>add(p)} disabled={p.stock<=0}>{p.stock>0?'Adicionar':'Esgotado'}</button></div></div></article>)}{visible.length===0&&<div className="catalog-empty"><Search/><h3>Nenhum produto encontrado</h3><p>Tente outro termo ou escolha uma categoria diferente.</p><button onClick={()=>{setSearch('');setCategory('all')}}>Limpar filtros</button></div>}</div></main>

 {selectedProduct&&<div className="product-modal-backdrop" onMouseDown={()=>setSelectedProduct(null)}><div className="product-modal" onMouseDown={e=>e.stopPropagation()}><button className="product-modal-close" onClick={()=>setSelectedProduct(null)}><X size={19}/></button>{(selectedProduct.imageUrls?.length||selectedProduct.imageUrl)?<div className="product-gallery"><img src={(selectedProduct.imageUrls?.length?selectedProduct.imageUrls:[selectedProduct.imageUrl!])[galleryIndex]||selectedProduct.imageUrl} alt={selectedProduct.name}/>{(selectedProduct.imageUrls?.length||0)>1&&<div className="gallery-thumbs">{selectedProduct.imageUrls!.map((url,i)=><button key={url} className={i===galleryIndex?'active':''} onClick={()=>setGalleryIndex(i)}><img src={url} alt=""/></button>)}</div>}</div>:<div className="product-modal-placeholder">V</div>}<div className="product-modal-content">{selectedProduct.flashOffer&&<span className="offer-chip">Oferta relâmpago</span>}<div className="product-modal-title"><h2>{selectedProduct.name}</h2><div className="product-modal-actions"><button className="favorite-button inline" onClick={()=>shareProduct(selectedProduct)} title="Compartilhar produto"><Share2 size={19}/></button><button className={`favorite-button inline ${favorites.includes(selectedProduct.id)?'active':''}`} onClick={()=>toggleFavorite(selectedProduct.id)}><Heart size={19} fill={favorites.includes(selectedProduct.id)?'currentColor':'none'}/></button></div></div>{selectedProduct.sku&&<small>SKU {selectedProduct.sku}</small>}<p>{selectedProduct.description||'Produto disponível para compra.'}</p><div className="store-price large">{selectedProduct.compareAtPrice&&selectedProduct.compareAtPrice>selectedProduct.price?<del>{money(selectedProduct.compareAtPrice)}</del>:null}<strong>{money(selectedProduct.price)}</strong></div><small>{store.showStock===false?(selectedProduct.stock>0?'Disponível':'Esgotado'):(selectedProduct.stock>0?`${selectedProduct.stock} unidade(s) disponível(is)`:'Produto esgotado')}</small>{(selectedProduct.tags||[]).length>0&&<div className="mini-tags">{selectedProduct.tags!.map(t=><span key={t}>{t}</span>)}</div>}{selectedProduct.maxPerOrder&&selectedProduct.maxPerOrder>0?<small className="product-limit-note">Limite de {selectedProduct.maxPerOrder} unidade(s) por pedido</small>:null}<div className="fulfillment-badges">{selectedProduct.availableForPickup!==false&&<span>Retirada</span>}{selectedProduct.availableForDelivery!==false&&<span>Entrega</span>}</div>{(selectedProduct.variants||[]).filter(v=>v.active!==false).length>0&&<div className="variant-picker"><strong>Escolha uma variação</strong><div className="variant-options">{selectedProduct.variants!.filter(v=>v.active!==false).map(v=><button key={v.id} type="button" disabled={v.stock<=0} className={selectedVariant?.id===v.id?'active':''} onClick={()=>setSelectedVariant(v)}><span>{v.name}</span><small>{v.stock>0?`${v.stock} disponível(is)`:'Esgotado'}{Number(v.priceAdjustment||0)!==0?` · ${Number(v.priceAdjustment)>0?'+':''}${money(Number(v.priceAdjustment))}`:''}</small></button>)}</div></div>}{(selectedProduct.addonGroups||[]).length>0&&<div className="addon-picker"><strong>Personalize seu produto</strong>{selectedProduct.addonGroups!.map(group=>{const chosen=selectedAddons[group.id]||[];const max=Math.max(1,Number(group.maxSelections||1));return <div className="addon-group" key={group.id}><div className="addon-group-title"><span>{group.name}</span><small>{group.required?'Obrigatório':'Opcional'} · {max===1?'escolha 1':`até ${max}`}</small></div><div className="addon-options">{(group.options||[]).filter(o=>o.active!==false).map(option=>{const active=chosen.includes(option.id);return <button type="button" key={option.id} className={active?'active':''} onClick={()=>setSelectedAddons(current=>{const prev=current[group.id]||[];let next:string[];if(max===1)next=active?[]:[option.id];else next=active?prev.filter(id=>id!==option.id):(prev.length<max?[...prev,option.id]:prev);return {...current,[group.id]:next}})}><span>{option.name}</span><small>{Number(option.price||0)>0?`+ ${money(Number(option.price))}`:'Sem acréscimo'}</small></button>})}</div></div>})}</div>}{products.filter(x=>x.id!==selectedProduct.id&&x.categoryId&&x.categoryId===selectedProduct.categoryId&&x.stock>0).slice(0,3).length>0&&<div className="related-products"><strong>Você também pode gostar</strong>{products.filter(x=>x.id!==selectedProduct.id&&x.categoryId&&x.categoryId===selectedProduct.categoryId&&x.stock>0).slice(0,3).map(x=><button key={x.id} onClick={()=>{setSelectedProduct(x);setGalleryIndex(0);setSelectedVariant(null);setSelectedAddons({})}}><span>{x.name}</span><b>{money(x.price)}</b></button>)}</div>}<button className="primary-store-button" onClick={()=>add(selectedProduct,selectedVariant)} disabled={(selectedProduct.variants||[]).filter(v=>v.active!==false).length>0?!selectedVariant||selectedVariant.stock<=0:selectedProduct.stock<=0}>{(selectedProduct.variants||[]).filter(v=>v.active!==false).length>0&&!selectedVariant?'Escolha uma variação':((selectedVariant?selectedVariant.stock:selectedProduct.stock)>0?'Adicionar ao carrinho':'Produto esgotado')}</button></div></div></div>}

 {open&&<div className="drawer-backdrop" onMouseDown={()=>setOpen(false)}><aside className="drawer" onMouseDown={e=>e.stopPropagation()}>
   <div className="drawer-head"><div><h2>Seu carrinho</h2><small>{cart.reduce((s,i)=>s+i.quantity,0)} item(ns)</small></div><div className="drawer-head-actions">{cart.length>0&&<button className="clear-cart" onClick={async()=>{const ok=await confirmAction({title:'Limpar carrinho',message:'Remover todos os itens do carrinho?',confirmLabel:'Limpar carrinho',danger:true});if(ok)setCart([])}}>Limpar</button>}<button onClick={()=>setOpen(false)}><X/></button></div></div>
   {done&&<div className="checkout-success">{done}{lastOrderId&&<a className="tracking-link" href={`/acompanhar/${lastOrderId}`}>Acompanhar meu pedido</a>}</div>}{error&&<div className="error checkout-error">{error}</div>}

   {pix&&<div className="pix-result"><h3>Finalize seu Pix</h3><p>Após o pagamento, o pedido será confirmado automaticamente pelo Vitrio.</p>{pix.qrCodeBase64&&<img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code Pix"/>}{pix.qrCode&&<button type="button" className="primary-btn full" onClick={copyPix}>{pixCopied?<><Check size={17}/>Copiado</>:<><Copy size={17}/>Copiar Pix Copia e Cola</>}</button>}{pix.ticketUrl&&<a className="secondary-btn full centered" href={pix.ticketUrl} target="_blank" rel="noreferrer">Abrir instruções do Mercado Pago</a>}</div>}

   {cardStage?<MercadoPagoCardBrick publicKey={cardStage.publicKey} amount={cardStage.total} payerEmail={cardStage.email} onSubmit={submitCard} onCancel={()=>setCardStage(null)}/>:
   cart.length===0&&!pix?<div className="empty-cart"><ShoppingBag/><p>Seu carrinho está vazio.</p></div>:
   cart.length>0&&<form onSubmit={systemCheckout}>
     {cart.map(i=>{const key=cartKey(i.product,i.variant,i.addons);return <div className="cart-line" key={key}><div><strong>{i.product.name}</strong>{i.variant&&<small>{i.variant.name}{i.variant.sku?` · ${i.variant.sku}`:''}</small>}{(i.addons||[]).length>0&&<small className="cart-addons">{i.addons!.map(a=>`${a.groupName}: ${a.optionName}${a.price>0?` (+${money(a.price)})`:''}`).join(' · ')}</small>}<small>{money(itemPrice(i))}</small></div><div className="qty"><button type="button" onClick={()=>change(key,-1)}><Minus size={16}/></button><span>{i.quantity}</span><button type="button" onClick={()=>change(key,1)}><Plus size={16}/></button></div></div>})}
     <div className="checkout-fields">
       <label>Seu nome<input required={mode!=='whatsapp'} value={customer.name} onChange={e=>setCustomer({...customer,name:e.target.value})}/></label>
       <label>WhatsApp<input required={mode!=='whatsapp'} inputMode="tel" value={customer.phone} onChange={e=>setCustomer({...customer,phone:e.target.value})}/></label>
       {(mode==='online'||mode==='both')&&<label>E-mail<input type="email" value={customer.email} onChange={e=>setCustomer({...customer,email:e.target.value})} placeholder="Para pagamento online"/></label>}
       <label>Recebimento<select value={delivery} onChange={e=>{setDelivery(e.target.value as 'pickup'|'delivery');setQuote(null)}}>{store.allowPickup!==false&&<option value="pickup">Retirada na loja</option>}{store.allowDelivery!==false&&<option value="delivery">Entrega</option>}</select></label>{delivery==='delivery'&&zones.length>0&&<label>Bairro / região<select value={deliveryZoneId} onChange={e=>{setDeliveryZoneId(e.target.value);setQuote(null)}} required><option value="">Selecione...</option>{zones.map(z=><option value={z.id} key={z.id}>{z.name} · {money(z.fee)}</option>)}</select></label>}
       {delivery==='delivery'&&<label>Endereço de entrega<textarea required={mode!=='whatsapp'} value={customer.address} onChange={e=>setCustomer({...customer,address:e.target.value})}/></label>}<label>Observações do pedido<textarea maxLength={500} value={customer.notes} onChange={e=>setCustomer({...customer,notes:e.target.value})} placeholder="Ex.: entregar na portaria, sem embalagem para presente..."/></label>
       <label>Forma de pagamento<select value={payment} onChange={e=>setPayment(e.target.value)}>{paymentOptions.map(p=><option key={p}>{p}</option>)}</select></label>
     </div>
     <div className="coupon-row storefront-coupon-row"><input placeholder="Cupom de desconto" value={couponCode} onChange={e=>{setCouponCode(e.target.value.toUpperCase());setQuote(null)}}/><button type="button" className="secondary-btn" onClick={refreshQuote}>Aplicar</button></div>{quoteMsg&&<small className="integration-note">{quoteMsg}</small>}{Number(store.minOrderValue||0)>0&&subtotal<Number(store.minOrderValue)&&<div className="minimum-order-note">Faltam {money(Number(store.minOrderValue)-subtotal)} para atingir o pedido mínimo de {money(Number(store.minOrderValue))}.</div>}<div className="totals"><span>Subtotal <strong>{money(quote?.subtotal??subtotal)}</strong></span>{Number(quote?.discount||0)>0&&<span>Desconto <strong>- {money(Number(quote.discount))}</strong></span>}{Number(quote?.deliveryFee??fee)>0&&<span>Entrega <strong>{money(Number(quote?.deliveryFee??fee))}</strong></span>}<span className="grand-total">Total <strong>{money(Number(quote?.total??total))}</strong></span></div>
     <div className="checkout-actions">
       {(mode==='whatsapp'||mode==='both')&&<button type="button" className="whatsapp-btn" onClick={whatsapp}>Finalizar pelo WhatsApp</button>}
       {(mode==='online'||mode==='both')&&<button className="primary-btn full" disabled={sending}>{sending?'Processando...':payment==='Dinheiro'?'Fazer pedido':'Pagar pelo Vitrio'}</button>}
     </div>
     {(payment==='Pix'||payment==='Cartão')&&(mode==='online'||mode==='both')&&<small className="integration-note">{onlineConnected?'Pagamento processado diretamente na conta Mercado Pago desta loja.':'Esta loja precisa conectar o Mercado Pago para receber pagamentos online.'}</small>}
   </form>}
 </aside></div>}
 <ShareSheet payload={sharePayload} onClose={()=>setSharePayload(null)}/>
 </div>;
}
