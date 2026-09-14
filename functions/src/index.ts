import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
if (getApps().length === 0) initializeApp();
const db = getFirestore();

async function writeAudit(storeId:string,userId:string,userName:string,action:string,entity:string,entityId:string,description:string){
  await db.collection('auditLogs').add({storeId,userId,userName,action,entity,entityId,description,createdAt:FieldValue.serverTimestamp()});
}

function timestampMillis(value:any){
  if(!value) return 0;
  if(typeof value?.toMillis==='function') return Number(value.toMillis()||0);
  if(typeof value?.toDate==='function') return Number(value.toDate()?.getTime?.()||0);
  const parsed=new Date(value).getTime();
  return Number.isFinite(parsed)?parsed:0;
}

function ensureStoreOperational(store:any){
  if(!store || store.active!==true) throw new HttpsError('failed-precondition','Esta loja está temporariamente indisponível.');
  const status=String(store.subscriptionStatus||'trial');
  if(['past_due','suspended','cancelled'].includes(status)) throw new HttpsError('failed-precondition','A assinatura desta loja precisa ser regularizada.');
  const now=Date.now();
  if(status==='trial'){
    const end=timestampMillis(store.trialEndsAt);
    if(end && end<=now) throw new HttpsError('failed-precondition','O período de teste desta loja terminou.');
  }
  if(status==='active'){
    const end=timestampMillis(store.subscriptionEndsAt);
    if(end && end<=now) throw new HttpsError('failed-precondition','A assinatura desta loja expirou.');
  }
}

async function requireStorePermission(request:any, storeId:string, permission:string){
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const snap=await db.doc(`users/${request.auth.uid}`).get();
  if(!snap.exists || snap.data()?.active!==true) throw new HttpsError('permission-denied','Acesso inválido.');
  const u=snap.data()!;
  if(u.role==='admin') return {uid:request.auth.uid,name:String(u.displayName||u.email||'Administrador'),...u};
  if(u.role!=='merchant' || u.storeId!==storeId) throw new HttpsError('permission-denied','Sem acesso a esta loja.');
  const storeSnap=await db.doc(`stores/${storeId}`).get();
  if(!storeSnap.exists) throw new HttpsError('not-found','Loja não encontrada.');
  ensureStoreOperational(storeSnap.data());
  const isOwner=u.isStoreOwner===true;
  const permissions=Array.isArray(u.permissions)?u.permissions.map(String):[];
  if(!isOwner && !permissions.includes(permission)) throw new HttpsError('permission-denied','Seu usuário não possui permissão para esta operação.');
  return {uid:request.auth.uid,name:String(u.displayName||u.email||'Usuário'),...u};
}


const ALL_PERMISSIONS = ['dashboard','products','categories','inventory','orders','returns','cash','customers','coupons','delivery','payments','reports','audit','store_settings','checkout_settings'];

async function requireAdmin(request:any){
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const snap=await db.doc(`users/${request.auth.uid}`).get();
  const data=snap.data();
  if(!snap.exists || data?.role!=='admin' || data?.active!==true) throw new HttpsError('permission-denied','Acesso administrativo necessário.');
  return {uid:request.auth.uid,...data};
}

export const getBillingSettings = onCall({region:'us-central1'}, async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const snap=await db.doc('platformSettings/billing').get();
  const d=snap.exists?snap.data()||{}:{};
  return {
    pixKey:String(d.pixKey||''),
    pixName:String(d.pixName||'VITRIO'),
    pixCity:String(d.pixCity||'QUIXERAMOBIM'),
    billingWhatsapp:String(d.billingWhatsapp||''),
    monthlyPrice:Number(d.monthlyPrice??d.starterPrice??0),
  };
});

export const adminSaveBillingSettings = onCall({region:'us-central1'}, async request=>{
  const admin:any=await requireAdmin(request);
  const data=request.data||{};
  const pixKey=String(data.pixKey||'').trim();
  const pixName=String(data.pixName||'').trim();
  const pixCity=String(data.pixCity||'').trim().toUpperCase();
  const billingWhatsapp=String(data.billingWhatsapp||'').replace(/\D/g,'');
  const monthlyPrice=Number(data.monthlyPrice||0);
  if(!pixKey||!pixName||!pixCity||billingWhatsapp.length<10||!Number.isFinite(monthlyPrice)||monthlyPrice<=0) throw new HttpsError('invalid-argument','Revise os dados de cobrança antes de salvar.');
  await db.doc('platformSettings/billing').set({pixKey,pixName,pixCity,billingWhatsapp,monthlyPrice,updatedAt:FieldValue.serverTimestamp(),updatedBy:admin.uid},{merge:true});
  await writeAudit('platform',admin.uid,String(admin.displayName||admin.email||'Administrador'),'billing_settings_update','platform_settings','billing','Dados da cobrança da plataforma atualizados.');
  return {ok:true};
});

export const adminListStores = onCall({region:'us-central1'}, async request=>{
  await requireAdmin(request);
  const snap=await db.collection('stores').get();
  const stores=snap.docs.map(d=>({id:d.id,name:String(d.data().name||d.id),slug:String(d.data().slug||d.id),active:d.data().active===true,subscriptionStatus:String(d.data().subscriptionStatus||'trial')}));
  stores.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  return {stores};
});


export const registerStore = onCall({ region:'us-central1' }, async request => {
  const data=request.data||{};
  const ownerName=String(data.ownerName||'').trim();
  const storeName=String(data.storeName||'').trim();
  const email=String(data.email||'').trim().toLowerCase();
  const phone=String(data.phone||'').trim();
  const password=String(data.password||'');
  const slug=String(data.slug||'').trim().toLowerCase();

  if(!ownerName||!storeName||!email||!email.includes('@')||password.length<6||!slug) throw new HttpsError('invalid-argument','Preencha os dados corretamente.');
  if(!/^[a-z0-9-]{3,55}$/.test(slug)) throw new HttpsError('invalid-argument','O link da loja é inválido.');

  const storeRef=db.doc(`stores/${slug}`);
  const existingStore=await storeRef.get();
  if(existingStore.exists) throw new HttpsError('already-exists','Esse nome de link já está em uso. Tente outro nome para a loja.');

  let user:any=null;
  try{
    user=await getAuth().createUser({email,password,displayName:ownerName});
    const trialEnds=new Date(); trialEnds.setDate(trialEnds.getDate()+30);

    await db.runTransaction(async tx=>{
      const freshStore=await tx.get(storeRef);
      if(freshStore.exists) throw new HttpsError('already-exists','Esse nome de link já está em uso.');
      tx.set(storeRef,{
        name:storeName,slug,whatsapp:phone,description:'',primaryColor:'#6d5dfc',
        ownerId:user.uid,ownerEmail:email,
        active:true,checkoutMode:'whatsapp',allowPix:true,allowCard:true,allowCash:true,
        allowPickup:true,allowDelivery:true,deliveryFee:0,showStock:true,
        plan:'monthly',subscriptionStatus:'trial',trialEndsAt:trialEnds,onboardingCompleted:false,
        createdBy:user.uid,createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
      });
      tx.set(db.doc(`users/${user.uid}`),{
        displayName:ownerName,email,role:'merchant',storeId:storeRef.id,active:true,
        isStoreOwner:true,permissions:ALL_PERMISSIONS,
        createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
      });
    });
  }catch(err:any){
    if(user?.uid){
      try{await getAuth().deleteUser(user.uid);}catch{}
    }
    if(err instanceof HttpsError) throw err;
    if(String(err?.code||'').includes('email-already-exists')) throw new HttpsError('already-exists','Este e-mail já possui uma conta.');
    console.error('registerStore',err);
    throw new HttpsError('internal','Não foi possível criar sua loja agora.');
  }

  try{
    await writeAudit(storeRef.id,user.uid,ownerName,'register_store','store',storeRef.id,`Loja ${storeName} criada pelo cadastro público.`);
  }catch(err){ console.error('registerStore audit',err); }

  return {uid:user.uid,storeId:storeRef.id,slug};
});


export const adminUpdateStoreAccess = onCall({ region:'us-central1' }, async request => {
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const adminSnap=await db.doc(`users/${request.auth.uid}`).get();
  const admin=adminSnap.data();
  if(!adminSnap.exists || admin?.role!=='admin' || admin?.active!==true) throw new HttpsError('permission-denied','Apenas o Master pode alterar a assinatura.');

  const data=request.data||{};
  const storeId=String(data.storeId||'').trim();
  if(!storeId) throw new HttpsError('invalid-argument','Loja não informada.');
  const ref=db.doc(`stores/${storeId}`);
  const snap=await ref.get();
  if(!snap.exists) throw new HttpsError('not-found','Loja não encontrada.');

  const allowedStatuses=['trial','active','past_due','suspended','cancelled'];
  const allowedPlans=['monthly'];
  const updates:any={updatedAt:FieldValue.serverTimestamp()};
  if(Object.prototype.hasOwnProperty.call(data,'active')) updates.active=data.active===true;
  if(data.subscriptionStatus!==undefined){
    const status=String(data.subscriptionStatus);
    if(!allowedStatuses.includes(status)) throw new HttpsError('invalid-argument','Status inválido.');
    updates.subscriptionStatus=status;
  }
  if(data.plan!==undefined){
    const plan=String(data.plan);
    if(!allowedPlans.includes(plan)) throw new HttpsError('invalid-argument','Plano inválido.');
    updates.plan=plan;
  }
  for(const field of ['trialEndsAt','subscriptionEndsAt']){
    if(data[field]!==undefined){
      if(data[field]===null || data[field]==='') updates[field]=FieldValue.delete();
      else { const parsed=new Date(String(data[field])+'T23:59:59'); if(Number.isNaN(parsed.getTime())) throw new HttpsError('invalid-argument','Data inválida.'); updates[field]=Timestamp.fromDate(parsed); }
    }
  }
  await ref.update(updates);
  await writeAudit(storeId,request.auth.uid,String(admin?.displayName||admin?.email||'Master'),'admin_subscription_update','store',storeId,`Plano/acesso atualizado pelo Master.`);
  return {ok:true};
});

export const createStoreUser = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Faça login.');
  const caller = await db.doc(`users/${request.auth.uid}`).get();
  const callerData = caller.data();
  const isAdmin = caller.exists && callerData?.role === 'admin' && callerData?.active === true;
  const isOwner = caller.exists && callerData?.role === 'merchant' && callerData?.active === true && (callerData?.isStoreOwner === true || !Array.isArray(callerData?.permissions));
  if (!isAdmin && !isOwner) throw new HttpsError('permission-denied', 'Sem permissão para criar acessos.');

  const data=request.data||{};
  const name=String(data.name||'').trim();
  const email=String(data.email||'').trim().toLowerCase();
  const password=String(data.password||'');
  const storeId=String(data.storeId||'').trim();
  const permissions=data.permissions;
  const requestedOwner=data.isStoreOwner===true;
  if (!name || !email || !email.includes('@') || password.length<6 || !storeId) throw new HttpsError('invalid-argument', 'Preencha nome, e-mail, senha e loja corretamente.');
  if (isOwner && callerData?.storeId !== storeId) throw new HttpsError('permission-denied', 'Você só pode criar usuários da sua própria loja.');
  const store = await db.doc(`stores/${storeId}`).get();
  if (!store.exists) throw new HttpsError('not-found', 'Loja não encontrada.');

  const requested = Array.isArray(permissions) ? permissions.filter((p:string)=>ALL_PERMISSIONS.includes(p)) : [];
  const ownerFlag = isAdmin ? requestedOwner : false;
  const finalPermissions = ownerFlag ? ALL_PERMISSIONS : requested;

  let user:any=null;
  let stage='auth';
  try{
    // 1) Cria a conta no Firebase Authentication.
    user = await getAuth().createUser({ email, password, displayName:name });

    // 2) Vincula a conta à loja. Se esta etapa falhar, removemos apenas a conta
    // recém-criada do Authentication para não deixar usuário órfão.
    stage='profile';
    try{
      await db.doc(`users/${user.uid}`).set({
        displayName:name,
        email,
        role:'merchant',
        storeId,
        active:true,
        isStoreOwner:ownerFlag,
        permissions:finalPermissions,
        createdAt:FieldValue.serverTimestamp(),
        updatedAt:FieldValue.serverTimestamp()
      });
    }catch(profileErr){
      try{ await getAuth().deleteUser(user.uid); }catch(deleteErr){ console.error('createStoreUser rollback auth',deleteErr); }
      throw profileErr;
    }

    // 3) Auditoria é complementar: uma falha no log não pode desfazer um acesso
    // que já foi criado corretamente.
    stage='audit';
    try{
      await writeAudit(
        storeId,
        request.auth.uid,
        String(callerData?.displayName || callerData?.email || 'Administrador'),
        'create_user',
        'user',
        user.uid,
        `Acesso criado para ${name} (${ownerFlag ? 'responsável' : 'funcionário'}).`
      );
    }catch(auditErr){
      console.error('createStoreUser audit',auditErr);
    }

    return { uid:user.uid, storeId, email };
  }catch(err:any){
    const code=String(err?.code||'');
    console.error('createStoreUser',{stage,code,message:err?.message,stack:err?.stack});

    if(code.includes('email-already-exists')) throw new HttpsError('already-exists','Este e-mail já possui acesso no Vitrio.');
    if(code.includes('invalid-email')) throw new HttpsError('invalid-argument','O e-mail informado é inválido.');
    if(code.includes('invalid-password')||code.includes('password')) throw new HttpsError('invalid-argument','A senha deve ter pelo menos 6 caracteres.');
    if(code.includes('permission-denied')) throw new HttpsError('permission-denied','Não foi possível gravar o acesso desta loja.');
    if(code.includes('not-found')) throw new HttpsError('not-found','Não foi possível localizar os dados necessários para criar o acesso.');
    if(err instanceof HttpsError) throw err;

    const friendlyStage = stage==='auth'
      ? 'criar a conta de acesso'
      : stage==='profile'
        ? 'vincular o usuário à loja'
        : 'finalizar o cadastro';
    throw new HttpsError('internal',`Não foi possível ${friendlyStage}. Tente novamente.`);
  }
});

type CheckoutItem = { productId: string; quantity: number; variantId?: string; addonOptionIds?: string[] };

function normalizeItems(rawItems: CheckoutItem[]) {
  const normalized = new Map<string, {productId:string; variantId:string; addonOptionIds:string[]; quantity:number}>();
  for (const item of rawItems) {
    const productId = String(item?.productId || '');
    const variantId = String(item?.variantId || '');
    const addonOptionIds = [...new Set((Array.isArray(item?.addonOptionIds) ? item.addonOptionIds : []).map(String).filter(Boolean))].sort();
    const quantity = Math.floor(Number(item?.quantity || 0));
    if (!productId || quantity < 1 || quantity > 99 || addonOptionIds.length > 30) throw new HttpsError('invalid-argument', 'Carrinho inválido.');
    const key = `${productId}::${variantId}::${addonOptionIds.join(',')}`;
    const current = normalized.get(key);
    normalized.set(key, {productId, variantId, addonOptionIds, quantity:(current?.quantity || 0) + quantity});
  }
  return normalized;
}

async function calculateQuote(data: any) {
  const storeId = String(data.storeId || '');
  const fulfillment = data.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const couponCode = String(data.couponCode || '').trim().toUpperCase();
  const deliveryZoneId = String(data.deliveryZoneId || '');
  const rawItems: CheckoutItem[] = Array.isArray(data.items) ? data.items : [];
  if (!storeId || rawItems.length === 0) throw new HttpsError('invalid-argument', 'Carrinho vazio.');
  if (rawItems.length > 50) throw new HttpsError('invalid-argument', 'Carrinho acima do limite permitido.');

  const storeSnap = await db.doc(`stores/${storeId}`).get();
  if (!storeSnap.exists) throw new HttpsError('not-found', 'Loja indisponível.');
  const store = storeSnap.data()!;
  ensureStoreOperational(store);
  const normalized = normalizeItems(rawItems);
  const entries=[...normalized.values()];
  const productIds=[...new Set(entries.map(x=>x.productId))];
  const snapMap=new Map((await Promise.all(productIds.map(id=>db.doc(`products/${id}`).get()))).map(s=>[s.id,s]));

  let subtotal = 0;
  const items = entries.map(entry => {
    const snap=snapMap.get(entry.productId);
    if (!snap?.exists) throw new HttpsError('not-found', 'Um produto do carrinho não existe mais.');
    const p = snap.data()!; const quantity = entry.quantity;
    if (p.storeId !== storeId || p.active !== true) throw new HttpsError('failed-precondition', 'Um produto não está mais disponível.');
    if (fulfillment === 'pickup' && p.availableForPickup === false) throw new HttpsError('failed-precondition', `${p.name} não está disponível para retirada.`);
    if (fulfillment === 'delivery' && p.availableForDelivery === false) throw new HttpsError('failed-precondition', `${p.name} não está disponível para entrega.`);
    const maxPerOrder = Math.max(0, Number(p.maxPerOrder || 0));
    if (maxPerOrder > 0 && quantity > maxPerOrder) throw new HttpsError('failed-precondition', `Limite de ${maxPerOrder} unidade(s) por pedido para ${p.name}.`);
    const variants=Array.isArray(p.variants)?p.variants:[];
    const variant=entry.variantId?variants.find((v:any)=>String(v.id)===entry.variantId&&v.active!==false):null;
    if(variants.length>0&&!variant) throw new HttpsError('failed-precondition', `Escolha uma variação válida para ${p.name}.`);
    const availableStock=variant?Number(variant.stock||0):Number(p.stock||0);
    if (availableStock < quantity) throw new HttpsError('failed-precondition', `Estoque insuficiente para ${p.name}${variant?` - ${variant.name}`:''}.`);
    const groups=Array.isArray(p.addonGroups)?p.addonGroups:[];
    const requested=new Set(entry.addonOptionIds||[]);
    const addons:any[]=[];
    for(const group of groups){
      const activeOptions=Array.isArray(group.options)?group.options.filter((o:any)=>o?.active!==false):[];
      const chosen=activeOptions.filter((o:any)=>requested.has(String(o.id)));
      const max=Math.max(1,Number(group.maxSelections||1));
      if(group.required===true&&chosen.length===0) throw new HttpsError('failed-precondition', `Escolha uma opção em ${String(group.name||'opcional')}.`);
      if(chosen.length>max) throw new HttpsError('failed-precondition', `Seleção inválida em ${String(group.name||'opcional')}.`);
      for(const o of chosen)addons.push({groupId:String(group.id||''),groupName:String(group.name||''),optionId:String(o.id||''),optionName:String(o.name||''),price:Number(o.price||0)});
    }
    const validIds=new Set(addons.map(a=>a.optionId));
    if([...requested].some(id=>!validIds.has(id))) throw new HttpsError('failed-precondition','Um opcional selecionado não está mais disponível.');
    const addonPrice=addons.reduce((sum,a)=>sum+Number(a.price||0),0);
    const price = Number(p.price || 0)+Number(variant?.priceAdjustment||0)+addonPrice;
    const lineTotal = Number((price * quantity).toFixed(2)); subtotal += lineTotal;
    return { productId:snap.id,name:String(p.name||'Produto'),price,quantity,subtotal:lineTotal,variantId:variant?String(variant.id):'',variantName:variant?String(variant.name):'',variantSku:variant?String(variant.sku||''):'',addons };
  });
  subtotal = Number(subtotal.toFixed(2));

  let deliveryFee = 0, deliveryZoneName = '';
  if (fulfillment === 'delivery') {
    if (store.allowDelivery === false) throw new HttpsError('failed-precondition', 'Entrega não disponível.');
    if (deliveryZoneId) {
      const z = await db.doc(`deliveryZones/${deliveryZoneId}`).get();
      if (!z.exists || z.data()?.storeId !== storeId || z.data()?.active !== true) throw new HttpsError('invalid-argument','Área de entrega inválida.');
      deliveryFee = Number(z.data()?.fee || 0); deliveryZoneName = String(z.data()?.name || '');
    } else deliveryFee = Number(store.deliveryFee || 0);
  }

  let discount = 0, appliedCoupon = '';
  if (couponCode) {
    const q = await db.collection('coupons').where('storeId','==',storeId).where('code','==',couponCode).limit(1).get();
    if (q.empty) throw new HttpsError('not-found','Cupom não encontrado.');
    const c = q.docs[0].data();
    if (c.active !== true) throw new HttpsError('failed-precondition','Cupom indisponível.');
    if (Number(c.minOrder || 0) > subtotal) throw new HttpsError('failed-precondition',`Pedido mínimo de R$ ${Number(c.minOrder||0).toFixed(2)} para este cupom.`);
    if (Number(c.usageLimit || 0) > 0 && Number(c.uses || 0) >= Number(c.usageLimit)) throw new HttpsError('failed-precondition','Limite de uso do cupom atingido.');
    const exp = c.expiresAt?.toMillis?.() || 0;
    if (exp && exp < Date.now()) throw new HttpsError('failed-precondition','Cupom expirado.');
    discount = c.type === 'percent' ? subtotal * Math.min(100,Math.max(0,Number(c.value||0))) / 100 : Math.max(0,Number(c.value||0));
    discount = Number(Math.min(subtotal,discount).toFixed(2)); appliedCoupon = couponCode;
  }
  if(Number(store.minOrderValue||0)>0 && subtotal<Number(store.minOrderValue||0)) throw new HttpsError('failed-precondition',`Pedido mínimo de R$ ${Number(store.minOrderValue||0).toFixed(2)}.`);
  const total = Number(Math.max(0,subtotal - discount + deliveryFee).toFixed(2));
  return {store,items,subtotal,discount,couponCode:appliedCoupon,deliveryFee,deliveryZoneId:deliveryZoneId||'',deliveryZoneName,total};
}


export const getPublicStoreBySlug = onCall({region:'us-central1'}, async request=>{
  const slug=String(request.data?.slug||'').trim().toLowerCase();
  if(!slug) throw new HttpsError('invalid-argument','Loja não informada.');
  const snap=await db.collection('stores').where('slug','==',slug).where('active','==',true).limit(1).get();
  if(snap.empty) throw new HttpsError('not-found','Esta loja não está disponível no momento.');
  const doc=snap.docs[0];
  const store=doc.data();
  ensureStoreOperational(store);
  return {store:{
    id:doc.id,
    name:String(store.name||'Loja'),
    slug:String(store.slug||slug),
    logoUrl:String(store.logoUrl||''),
    bannerUrl:String(store.bannerUrl||''),
    description:String(store.description||''),
    whatsapp:String(store.whatsapp||''),
    instagram:String(store.instagram||''),
    address:String(store.address||''),
    primaryColor:String(store.primaryColor||'#6d5dfc'),
    checkoutMode:'whatsapp',
    allowPix:store.allowPix!==false,
    allowCard:store.allowCard!==false,
    allowCash:store.allowCash!==false,
    allowPickup:store.allowPickup!==false,
    allowDelivery:store.allowDelivery!==false,
    deliveryFee:Number(store.deliveryFee||0),
    bannerText:String(store.bannerText||''),
    businessHours:String(store.businessHours||''),
    showStock:store.showStock!==false,
    minOrderValue:Number(store.minOrderValue||0),
    preparationTime:String(store.preparationTime||''),
    orderPrefix:String(store.orderPrefix||''),
    returnPolicy:String(store.returnPolicy||''),
    supportPhone:String(store.supportPhone||'')
  }};
});

export const getCheckoutQuote = onCall({ region:'us-central1' }, async request => {
  const q = await calculateQuote(request.data || {});
  return {subtotal:q.subtotal,discount:q.discount,couponCode:q.couponCode,deliveryFee:q.deliveryFee,deliveryZoneName:q.deliveryZoneName,total:q.total};
});

export const createOrder = onCall({ region: 'us-central1' }, async (request) => {
  const data = request.data || {};
  const storeId = String(data.storeId || '');
  const customerName = String(data.customerName || '').trim();
  const customerPhone = String(data.customerPhone || '').replace(/[^0-9+]/g, '').trim();
  const customerEmail = String(data.customerEmail || '').trim().toLowerCase();
  const fulfillment = data.fulfillment === 'delivery' ? 'delivery' : 'pickup';
  const address = String(data.address || '').trim();
  const paymentMethod = String(data.paymentMethod || '');
  const checkoutSource = data.checkoutSource === 'whatsapp' ? 'whatsapp' : 'system';
  const cashChangeFor = String(data.cashChangeFor || '').trim().slice(0, 30);
  const customerNotes = String(data.customerNotes || '').trim().slice(0, 500);
  const rawItems: CheckoutItem[] = Array.isArray(data.items) ? data.items : [];
  if (!storeId || !customerName || !customerPhone || rawItems.length === 0) throw new HttpsError('invalid-argument', 'Preencha seus dados e adicione produtos ao carrinho.');
  if (fulfillment === 'delivery' && !address) throw new HttpsError('invalid-argument', 'Informe o endereço para entrega.');

  const quote = await calculateQuote(data);
  const configuredMode = quote.store.checkoutMode || 'whatsapp';
  if (checkoutSource === 'whatsapp') {
    if (!['whatsapp','both'].includes(configuredMode)) throw new HttpsError('failed-precondition','Esta loja não está configurada para receber pedidos pelo WhatsApp.');
  } else {
    if (!['online','both'].includes(configuredMode)) throw new HttpsError('failed-precondition','Esta loja recebe pedidos somente pelo WhatsApp.');
  }
  if (fulfillment === 'pickup' && quote.store.allowPickup === false) throw new HttpsError('failed-precondition','Retirada não disponível.');

  if (paymentMethod === 'Dinheiro' && cashChangeFor) {
    const parsedChange = Number(cashChangeFor.replace(/\./g,'').replace(',','.'));
    if (!Number.isFinite(parsedChange) || parsedChange < Number(quote.total || 0)) {
      throw new HttpsError('invalid-argument', `O valor para troco deve ser igual ou maior que R$ ${Number(quote.total || 0).toFixed(2).replace('.',',')}.`);
    }
  }

  const allowedPayments=[quote.store.allowPix!==false&&'Pix',quote.store.allowCard!==false&&'Cartão',quote.store.allowCash!==false&&'Dinheiro'].filter(Boolean);
  if (!allowedPayments.includes(paymentMethod)) throw new HttpsError('invalid-argument','Forma de pagamento indisponível.');

  const orderRef=db.collection('orders').doc();
  await db.runTransaction(async tx=>{
    const productIds=[...new Set(quote.items.map((item:any)=>String(item.productId)))];
    const refs=productIds.map(id=>db.doc(`products/${id}`));
    const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
    const byId=new Map(snaps.map(s=>[s.id,s]));
    const needs=new Map<string,{productId:string;variantId:string;quantity:number;name:string;variantName:string}>();
    for(const item of quote.items){
      const key=`${item.productId}::${item.variantId||''}`;
      const cur=needs.get(key);
      needs.set(key,{productId:item.productId,variantId:item.variantId||'',quantity:(cur?.quantity||0)+Number(item.quantity||0),name:item.name,variantName:item.variantName||''});
    }
    const updates=new Map<string,{ref:any;data:any;originalStock:number}>();
    for(const need of needs.values()){
      const snap=byId.get(need.productId);
      if(!snap?.exists || snap.data()?.active!==true || snap.data()?.storeId!==storeId) throw new HttpsError('failed-precondition','Produto indisponível.');
      const productData=updates.get(need.productId)?.data || {...snap.data()};
      const stock=Number(productData.stock||0);
      const variants=Array.isArray(productData.variants)?productData.variants.map((v:any)=>({...v})):[];
      if(need.variantId){
        const idx=variants.findIndex((v:any)=>String(v.id)===String(need.variantId)&&v.active!==false);
        if(idx<0||Number(variants[idx].stock||0)<need.quantity) throw new HttpsError('failed-precondition',`Estoque insuficiente para ${need.name} - ${need.variantName}.`);
        const before=Number(variants[idx].stock||0);
        variants[idx]={...variants[idx],stock:before-need.quantity};
        productData.variants=variants;productData.stock=Math.max(0,stock-need.quantity);
        const move=db.collection('inventoryMovements').doc();
        tx.set(move,{storeId,productId:need.productId,productName:`${need.name} - ${need.variantName}`,variantId:need.variantId,type:'out',quantity:need.quantity,before,after:before-need.quantity,reason:`Pedido #${orderRef.id.slice(0,6).toUpperCase()}`,source:'order',orderId:orderRef.id,createdBy:'system',createdAt:FieldValue.serverTimestamp()});
      }else{
        if(stock<need.quantity) throw new HttpsError('failed-precondition',`Estoque insuficiente para ${need.name}.`);
        productData.stock=stock-need.quantity;
        const move=db.collection('inventoryMovements').doc();
        tx.set(move,{storeId,productId:need.productId,productName:need.name,type:'out',quantity:need.quantity,before:stock,after:stock-need.quantity,reason:`Pedido #${orderRef.id.slice(0,6).toUpperCase()}`,source:'order',orderId:orderRef.id,createdBy:'system',createdAt:FieldValue.serverTimestamp()});
      }
      updates.set(need.productId,{ref:db.doc(`products/${need.productId}`),data:productData,originalStock:Number(snap.data()?.stock||0)});
    }
    for(const u of updates.values())tx.update(u.ref,{stock:u.data.stock,variants:u.data.variants||[],updatedAt:FieldValue.serverTimestamp()});
    const whatsappSale = checkoutSource === 'whatsapp';
    tx.set(orderRef,{storeId,customerName,customerPhone,customerEmail,fulfillment,address:fulfillment==='delivery'?address:'',paymentMethod,cashChangeFor:paymentMethod==='Dinheiro'?cashChangeFor:'',customerNotes,items:quote.items,subtotal:quote.subtotal,discount:quote.discount,couponCode:quote.couponCode,deliveryFee:quote.deliveryFee,deliveryZoneId:quote.deliveryZoneId,deliveryZoneName:quote.deliveryZoneName,total:quote.total,status:whatsappSale?'paid':'pending_payment',paymentStatus:whatsappSale?'paid':'pending',paidAt:whatsappSale?FieldValue.serverTimestamp():null,source:whatsappSale?'whatsapp_checkout':'vitrio_checkout',financialAppliedAt:whatsappSale?FieldValue.serverTimestamp():null,createdAt:FieldValue.serverTimestamp()});
  });

  if(quote.couponCode){
    const cq=await db.collection('coupons').where('storeId','==',storeId).where('code','==',quote.couponCode).limit(1).get();
    if(!cq.empty) await cq.docs[0].ref.update({uses:FieldValue.increment(1),updatedAt:FieldValue.serverTimestamp()});
  }

  const customerId=`${storeId}_${customerPhone.replace(/\D/g,'')}`.slice(0,180);
  const customerRef=db.doc(`customers/${customerId}`); const customerSnap=await customerRef.get(); const previous=customerSnap.exists?customerSnap.data()!:{};
  const whatsappSale = checkoutSource === 'whatsapp';
  await customerRef.set({storeId,name:customerName,phone:customerPhone,email:customerEmail,ordersCount:Number(previous.ordersCount||0)+1,totalSpent:Number((Number(previous.totalSpent||0)+(whatsappSale?Number(quote.total||0):0)).toFixed(2)),lastOrderAt:FieldValue.serverTimestamp(),createdAt:previous.createdAt||FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});

  if (whatsappSale) {
    const open = await db.collection('cashRegisters').where('storeId','==',storeId).where('status','==','open').limit(1).get();
    if (!open.empty) {
      const movementRef = db.doc(`cashMovements/cash_${orderRef.id}`);
      await movementRef.set({
        storeId,
        cashRegisterId:open.docs[0].id,
        type:'income',
        amount:Number(quote.total||0),
        description:`Venda WhatsApp #${orderRef.id.slice(0,6).toUpperCase()}`,
        source:'whatsapp_order',
        orderId:orderRef.id,
        paymentMethod,
        createdBy:'system',
        createdAt:FieldValue.serverTimestamp()
      },{merge:false}).catch(()=>{});
    }

    await writeAudit(storeId,'system','Checkout WhatsApp','whatsapp_sale','order',orderRef.id,`Venda pelo WhatsApp #${orderRef.id.slice(0,6).toUpperCase()} registrada automaticamente.`);
  }

  return {orderId:orderRef.id,total:quote.total,discount:quote.discount,deliveryFee:quote.deliveryFee,financialApplied:whatsappSale};
});


export const confirmOfflinePayment = onCall({region:'us-central1'}, async request=>{
  const orderId=String(request.data?.orderId||'');
  if(!orderId) throw new HttpsError('invalid-argument','Pedido inválido.');
  const orderRef=db.doc(`orders/${orderId}`),snap=await orderRef.get();
  if(!snap.exists) throw new HttpsError('not-found','Pedido não encontrado.');
  const order=snap.data()!,user=await requireStorePermission(request,String(order.storeId),'orders');
  if(order.paymentMethod!=='Dinheiro') throw new HttpsError('failed-precondition','Confirmação manual disponível somente para pagamento offline.');
  if(order.status==='cancelled') throw new HttpsError('failed-precondition','Pedido cancelado.');
  if(order.paymentStatus==='paid') return {ok:true};

  const customerId=`${order.storeId}_${String(order.customerPhone||'').replace(/\D/g,'')}`.slice(0,180);
  const customerRef=db.doc(`customers/${customerId}`);
  await db.runTransaction(async tx=>{
    const fresh=await tx.get(orderRef); if(!fresh.exists||fresh.data()?.paymentStatus==='paid')return;
    const data=fresh.data()!;
    const customer=await tx.get(customerRef);
    if(customer.exists && !data.customerSpentAppliedAt){
      tx.update(customerRef,{totalSpent:Number((Number(customer.data()?.totalSpent||0)+Number(data.total||0)).toFixed(2)),updatedAt:FieldValue.serverTimestamp()});
    }
    tx.update(orderRef,{paymentStatus:'paid',status:data.status==='pending_payment'?'paid':data.status,paidAt:FieldValue.serverTimestamp(),customerSpentAppliedAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  });

  const open=await db.collection('cashRegisters').where('storeId','==',order.storeId).where('status','==','open').limit(1).get();
  if(!open.empty){
    const movementRef=db.doc(`cashMovements/cash_${orderId}`);
    await movementRef.set({storeId:order.storeId,cashRegisterId:open.docs[0].id,type:'income',amount:Number(order.total||0),description:`Venda #${orderId.slice(0,6).toUpperCase()}`,source:'order',orderId,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()},{merge:false}).catch(()=>{});
  }
  await writeAudit(order.storeId,user.uid,user.name,'confirm_payment','order',orderId,`Pagamento em dinheiro confirmado no pedido #${orderId.slice(0,6).toUpperCase()}.`);
  return {ok:true};
});

export const cancelOrder = onCall({region:'us-central1'}, async request=>{
  const orderId=String(request.data?.orderId||'');
  const reason=String(request.data?.reason||'').trim();
  if(!orderId) throw new HttpsError('invalid-argument','Pedido inválido.');
  const orderRef=db.doc(`orders/${orderId}`);
  const orderSnap=await orderRef.get();
  if(!orderSnap.exists) throw new HttpsError('not-found','Pedido não encontrado.');
  const order=orderSnap.data()!;
  const user=await requireStorePermission(request,String(order.storeId),'orders');
  if(order.status==='cancelled') return {ok:true};
  if(order.paymentStatus==='paid'){
    throw new HttpsError('failed-precondition','Este pedido já foi pago. Use Trocas e devoluções para manter estoque e financeiro consistentes.');
  }

  await db.runTransaction(async tx=>{
    const fresh=await tx.get(orderRef);
    if(!fresh.exists || fresh.data()?.status==='cancelled') return;
    const data=fresh.data()!;
    if(!data.stockRestoredAt){
      const productIds=[...new Set((data.items||[]).map((i:any)=>String(i.productId)))];
      const refs=productIds.map(id=>db.doc(`products/${id}`));
      const snaps=await Promise.all(refs.map(ref=>tx.get(ref)));
      const byId=new Map(snaps.map(s=>[s.id,s]));
      const needs=new Map<string,{productId:string;variantId:string;quantity:number;name:string;variantName:string}>();
      for(const item of data.items||[]){const key=`${item.productId}::${item.variantId||''}`;const cur=needs.get(key);needs.set(key,{productId:item.productId,variantId:item.variantId||'',quantity:(cur?.quantity||0)+Number(item.quantity||0),name:item.name,variantName:item.variantName||''});}
      const updates=new Map<string,{ref:any;data:any}>();
      for(const need of needs.values()){
        const snap=byId.get(need.productId);if(!snap?.exists)continue;
        const productData=updates.get(need.productId)?.data||{...snap.data()};
        const stock=Number(productData.stock||0);
        if(need.variantId){const variants=Array.isArray(productData.variants)?productData.variants.map((v:any)=>({...v})):[];const idx=variants.findIndex((v:any)=>String(v.id)===need.variantId);if(idx>=0){const before=Number(variants[idx].stock||0);variants[idx]={...variants[idx],stock:before+need.quantity};productData.variants=variants;productData.stock=stock+need.quantity;const mv=db.collection('inventoryMovements').doc();tx.set(mv,{storeId:data.storeId,productId:need.productId,productName:`${need.name}${need.variantName?` - ${need.variantName}`:''}`,variantId:need.variantId,type:'in',quantity:need.quantity,before,after:before+need.quantity,reason:`Cancelamento #${orderId.slice(0,6).toUpperCase()}`,source:'order_cancel',orderId,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()});}}
        else{productData.stock=stock+need.quantity;const mv=db.collection('inventoryMovements').doc();tx.set(mv,{storeId:data.storeId,productId:need.productId,productName:need.name,type:'in',quantity:need.quantity,before:stock,after:stock+need.quantity,reason:`Cancelamento #${orderId.slice(0,6).toUpperCase()}`,source:'order_cancel',orderId,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()});}
        updates.set(need.productId,{ref:db.doc(`products/${need.productId}`),data:productData});
      }
      for(const u of updates.values())tx.update(u.ref,{stock:u.data.stock,variants:u.data.variants||[],updatedAt:FieldValue.serverTimestamp()});
    }
    tx.update(orderRef,{status:'cancelled',cancelReason:reason||'Cancelado pela loja',cancelledAt:FieldValue.serverTimestamp(),cancelledBy:user.uid,stockRestoredAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  });
  await writeAudit(order.storeId,user.uid,user.name,'cancel_order','order',orderId,`Pedido #${orderId.slice(0,6).toUpperCase()} cancelado${reason?`: ${reason}`:''}.`);
  return {ok:true};
});

export const registerReturn = onCall({region:'us-central1'}, async request=>{
  const orderId=String(request.data?.orderId||'');
  const type=request.data?.type==='exchange'?'exchange':'return';
  const reason=String(request.data?.reason||'').trim();
  const rawItems=Array.isArray(request.data?.items)?request.data.items:[];
  if(!orderId||rawItems.length===0) throw new HttpsError('invalid-argument','Selecione ao menos um item.');
  if(!reason) throw new HttpsError('invalid-argument','Informe o motivo da troca/devolução.');

  const orderRef=db.doc(`orders/${orderId}`),orderSnap=await orderRef.get();
  if(!orderSnap.exists) throw new HttpsError('not-found','Pedido não encontrado.');
  const order=orderSnap.data()!;
  const user=await requireStorePermission(request,String(order.storeId),'returns');
  if(order.status==='cancelled') throw new HttpsError('failed-precondition','Pedido cancelado não aceita devolução.');

  const prior=await db.collection('returns').where('orderId','==',orderId).get();
  const already=new Map<number,number>();
  prior.docs.forEach(d=>(d.data()?.items||[]).forEach((x:any)=>{
    const idx=Number(x.orderItemIndex);
    if(Number.isInteger(idx)) already.set(idx,(already.get(idx)||0)+Number(x.quantity||0));
  }));

  const retItems:any[]=[];let total=0;
  for(const r of rawItems){
    const idx=Math.floor(Number(r.orderItemIndex));
    const qty=Math.floor(Number(r.quantity||0));
    const soldItem:any=Array.isArray(order.items)?order.items[idx]:null;
    if(!Number.isInteger(idx)||!soldItem||qty<1||qty+Number(already.get(idx)||0)>Number(soldItem.quantity||0))
      throw new HttpsError('invalid-argument','Quantidade de devolução excede o que ainda pode ser devolvido.');
    const unitPrice=Number(soldItem.price||0),line=Number((unitPrice*qty).toFixed(2));total+=line;
    retItems.push({orderItemIndex:idx,productId:String(soldItem.productId||''),name:String(soldItem.name||'Produto'),variantId:String(soldItem.variantId||''),variantName:String(soldItem.variantName||''),quantity:qty,unitPrice,total:line});
  }
  total=Number(total.toFixed(2));
  const isRefund=type==='return';
  const isPaid=order.paymentStatus==='paid';

  let cashRegisterId='';
  if(isRefund&&isPaid){
    const open=await db.collection('cashRegisters').where('storeId','==',order.storeId).where('status','==','open').limit(1).get();
    if(open.empty) throw new HttpsError('failed-precondition','Abra o caixa antes de registrar uma devolução de pedido pago. O estorno precisa ficar registrado no financeiro.');
    cashRegisterId=open.docs[0].id;
  }

  const returnRef=db.collection('returns').doc();
  const productIds=[...new Set(retItems.map(i=>i.productId).filter(Boolean))];
  const productRefs=productIds.map(id=>db.doc(`products/${id}`));
  const customerId=`${order.storeId}_${String(order.customerPhone||'').replace(/\D/g,'')}`.slice(0,180);
  const customerRef=db.doc(`customers/${customerId}`);

  await db.runTransaction(async tx=>{
    // Firestore exige todas as leituras antes das escritas.
    const productSnaps=new Map<string,any>();
    for(const ref of productRefs){const snap=await tx.get(ref);productSnaps.set(ref.id,snap);}
    const customerSnap=isRefund&&isPaid?await tx.get(customerRef):null;

    const productData=new Map<string,any>();
    for(const item of retItems){
      const snap=productSnaps.get(item.productId);
      if(!snap?.exists) throw new HttpsError('not-found',`Produto ${item.name} não encontrado no estoque.`);
      const data=productData.get(item.productId)||{...snap.data(),variants:Array.isArray(snap.data()?.variants)?snap.data().variants.map((v:any)=>({...v})):[]};
      if(item.variantId){
        const idx=data.variants.findIndex((v:any)=>String(v.id)===item.variantId);
        if(idx<0) throw new HttpsError('failed-precondition',`A variação ${item.variantName||item.name} não existe mais no produto.`);
        const before=Number(data.variants[idx].stock||0),after=before+item.quantity;
        data.variants[idx]={...data.variants[idx],stock:after};
        data.stock=Number(data.stock||0)+item.quantity;
        const mv=db.collection('inventoryMovements').doc();
        tx.set(mv,{storeId:order.storeId,productId:item.productId,productName:`${item.name} - ${item.variantName}`,variantId:item.variantId,type:'in',quantity:item.quantity,before,after,reason:`${type==='exchange'?'Troca':'Devolução'} #${orderId.slice(0,6).toUpperCase()} · ${reason}`,source:'return',orderId,returnId:returnRef.id,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()});
      }else{
        const before=Number(data.stock||0),after=before+item.quantity;data.stock=after;
        const mv=db.collection('inventoryMovements').doc();
        tx.set(mv,{storeId:order.storeId,productId:item.productId,productName:item.name,type:'in',quantity:item.quantity,before,after,reason:`${type==='exchange'?'Troca':'Devolução'} #${orderId.slice(0,6).toUpperCase()} · ${reason}`,source:'return',orderId,returnId:returnRef.id,createdBy:user.uid,createdAt:FieldValue.serverTimestamp()});
      }
      productData.set(item.productId,data);
    }
    for(const [id,data] of productData) tx.update(db.doc(`products/${id}`),{stock:data.stock,variants:data.variants,updatedAt:FieldValue.serverTimestamp()});

    if(isRefund&&isPaid&&cashRegisterId){
      tx.set(db.doc(`cashMovements/return_${returnRef.id}`),{storeId:order.storeId,cashRegisterId,type:'expense',amount:total,description:`Devolução #${orderId.slice(0,6).toUpperCase()} · ${reason}`,source:'return',orderId,returnId:returnRef.id,paymentMethod:String(order.paymentMethod||''),createdBy:user.uid,createdAt:FieldValue.serverTimestamp()});
      if(customerSnap?.exists){
        tx.update(customerRef,{totalSpent:Math.max(0,Number((Number(customerSnap.data()?.totalSpent||0)-total).toFixed(2))),updatedAt:FieldValue.serverTimestamp()});
      }
    }

    tx.set(returnRef,{storeId:order.storeId,orderId,orderShortId:orderId.slice(0,6).toUpperCase(),customerName:String(order.customerName||''),customerPhone:String(order.customerPhone||''),paymentMethod:String(order.paymentMethod||''),type,items:retItems,total,reason,status:type==='exchange'?'exchanged':'refunded',stockRestored:true,financialApplied:isRefund&&isPaid,cashRegisterId:cashRegisterId||null,createdBy:user.uid,createdByName:user.name,createdAt:FieldValue.serverTimestamp()});
    tx.update(orderRef,{hasReturns:true,returnedAmount:FieldValue.increment(isRefund?total:0),lastReturnAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()});
  });
  await writeAudit(order.storeId,user.uid,user.name,type==='exchange'?'exchange_items':'return_items','return',returnRef.id,`${type==='exchange'?'Troca':'Devolução'} do pedido #${orderId.slice(0,6).toUpperCase()} · R$ ${total.toFixed(2)} · ${reason}.`);
  return {returnId:returnRef.id,total,stockRestored:true,financialApplied:isRefund&&isPaid};
});

export const updateOrderOperation = onCall({region:'us-central1'}, async request=>{
  const orderId=String(request.data?.orderId||''),status=String(request.data?.status||''),merchantNotes=String(request.data?.merchantNotes??'');
  const orderRef=db.doc(`orders/${orderId}`),snap=await orderRef.get();
  if(!snap.exists) throw new HttpsError('not-found','Pedido não encontrado.');
  const order=snap.data()!,user=await requireStorePermission(request,String(order.storeId),'orders');
  const allowed=['pending_payment','paid','preparing','ready','out_for_delivery','completed'];
  const updates:any={updatedAt:FieldValue.serverTimestamp()};
  if(status){
    if(!allowed.includes(status)) throw new HttpsError('invalid-argument','Status inválido.');
    if(status==='paid' && order.paymentStatus!=='paid') throw new HttpsError('failed-precondition','Pagamento ainda não confirmado.');
    updates.status=status;
  }
  if(request.data && Object.prototype.hasOwnProperty.call(request.data,'merchantNotes')) updates.merchantNotes=merchantNotes;
  await orderRef.update(updates);
  await writeAudit(order.storeId,user.uid,user.name,'update_order','order',orderId,`Pedido #${orderId.slice(0,6).toUpperCase()} atualizado${status?` para ${status}`:''}.`);
  return {ok:true};
});


// Mercado Pago temporariamente desativado. Reative após configurar os secrets.
/*
export {
  getMercadoPagoConnectUrl,
  mercadoPagoOauthCallback,
  testMercadoPagoBackendCredential,
} from './mercadoPago';
export { createMercadoPagoPayment, mercadoPagoWebhook, cleanupAbandonedOrders } from './payments';
*/

// Consulta pública protegida pelo telefone informado no pedido.
// Retorna somente os dados necessários para acompanhamento pelo consumidor.
export const getPublicOrderTracking = onCall({region:'us-central1'}, async request=>{
  const orderId=String(request.data?.orderId||'').trim();
  const phone=String(request.data?.phone||'').replace(/\D/g,'');
  if(!orderId || phone.length<8) throw new HttpsError('invalid-argument','Informe o pedido e o telefone usado na compra.');
  const snap=await db.doc(`orders/${orderId}`).get();
  if(!snap.exists) throw new HttpsError('not-found','Pedido não encontrado.');
  const order=snap.data()!;
  const savedPhone=String(order.customerPhone||'').replace(/\D/g,'');
  if(!savedPhone || savedPhone.slice(-8)!==phone.slice(-8)) throw new HttpsError('permission-denied','Telefone não confere com este pedido.');
  const storeSnap=await db.doc(`stores/${String(order.storeId||'')}`).get();
  const store=storeSnap.exists?storeSnap.data()!:{};
  const toLabel=(v:any)=>{const d=v?.toDate?.();return d?d.toLocaleString('pt-BR',{timeZone:'America/Fortaleza'}):''};
  return {
    shortId:orderId.slice(0,6).toUpperCase(),storeName:String(store.name||'Loja'),customerName:String(order.customerName||'Cliente').split(' ')[0],
    status:String(order.status||'pending_payment'),paymentStatus:String(order.paymentStatus||'pending'),fulfillment:String(order.fulfillment||'pickup'),
    address:order.fulfillment==='delivery'?String(order.address||''):'',total:Number(order.total||0),
    items:(order.items||[]).map((i:any)=>({productId:String(i.productId||''),name:String(i.name||'Produto'),quantity:Number(i.quantity||0),subtotal:Number(i.subtotal||0),variantName:String(i.variantName||''),addons:Array.isArray(i.addons)?i.addons.map((a:any)=>({groupName:String(a.groupName||''),optionName:String(a.optionName||'')})):[]})),
    createdLabel:toLabel(order.createdAt),updatedLabel:toLabel(order.updatedAt),supportPhone:String(store.supportPhone||store.whatsapp||'')
  };
});


export const createSupportTicket = onCall({region:'us-central1'}, async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login para abrir um chamado.');
  const userSnap=await db.doc(`users/${request.auth.uid}`).get();
  if(!userSnap.exists) throw new HttpsError('permission-denied','Usuário não encontrado.');
  const user=userSnap.data()!;
  if(user.active!==true || user.role!=='merchant' || !user.storeId) throw new HttpsError('permission-denied','Seu acesso não permite abrir chamados.');
  const subject=String(request.data?.subject||'').trim();
  const message=String(request.data?.message||'').trim();
  const rawPriority=String(request.data?.priority||'normal');
  const priority=['low','normal','high'].includes(rawPriority)?rawPriority:'normal';
  if(subject.length<2 || subject.length>120) throw new HttpsError('invalid-argument','Informe um assunto válido.');
  if(message.length<2 || message.length>5000) throw new HttpsError('invalid-argument','Informe uma mensagem válida.');
  const ref=db.collection('supportTickets').doc();
  await ref.set({
    storeId:String(user.storeId),
    userId:request.auth.uid,
    userName:String(user.displayName||user.email||'Lojista'),
    userEmail:String(user.email||''),
    subject,message,priority,status:'open',
    createdAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()
  });
  try{await writeAudit(String(user.storeId),request.auth.uid,String(user.displayName||user.email||'Lojista'),'create_support_ticket','support_ticket',ref.id,`Chamado aberto: ${subject}.`);}catch(err){console.error('support ticket audit',err);}
  return {ok:true,ticketId:ref.id};
});

export const adminListSupportTickets = onCall({region:'us-central1'}, async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const adminSnap=await db.doc(`users/${request.auth.uid}`).get();
  const admin=adminSnap.data();
  if(!adminSnap.exists || admin?.role!=='admin' || admin?.active!==true) throw new HttpsError('permission-denied','Apenas o Master pode consultar chamados.');

  const snap=await db.collection('supportTickets').orderBy('createdAt','desc').limit(300).get();
  const storeIds=[...new Set(snap.docs.map(d=>String(d.data()?.storeId||'')).filter(Boolean))];
  const storeSnaps=await Promise.all(storeIds.map(id=>db.doc(`stores/${id}`).get()));
  const stores=new Map(storeSnaps.filter(x=>x.exists).map(x=>[x.id,String(x.data()?.name||x.id)]));

  const tickets=snap.docs.map(d=>{
    const data=d.data();
    const createdAt=data.createdAt?.toMillis?.()||0;
    const updatedAt=data.updatedAt?.toMillis?.()||0;
    return {
      id:d.id,
      storeId:String(data.storeId||''),
      storeName:stores.get(String(data.storeId||''))||String(data.storeId||'Loja'),
      userId:String(data.userId||''),
      userName:String(data.userName||'Lojista'),
      userEmail:String(data.userEmail||''),
      subject:String(data.subject||''),
      message:String(data.message||''),
      priority:String(data.priority||'normal'),
      status:String(data.status||'open'),
      adminReply:String(data.adminReply||''),
      createdAtMillis:createdAt,
      updatedAtMillis:updatedAt
    };
  });
  return {tickets};
});

export const adminAnswerSupportTicket = onCall({region:'us-central1'}, async request=>{
  if(!request.auth) throw new HttpsError('unauthenticated','Faça login.');
  const adminSnap=await db.doc(`users/${request.auth.uid}`).get();
  const admin=adminSnap.data();
  if(!adminSnap.exists || admin?.role!=='admin' || admin?.active!==true) throw new HttpsError('permission-denied','Apenas o Master pode responder chamados.');

  const ticketId=String(request.data?.ticketId||'').trim();
  const reply=String(request.data?.reply||'').trim();
  const statusRaw=String(request.data?.status||'in_progress');
  const status=['open','in_progress','closed'].includes(statusRaw)?statusRaw:'in_progress';
  if(!ticketId) throw new HttpsError('invalid-argument','Chamado não informado.');
  if(status!=='closed' && reply.length<2) throw new HttpsError('invalid-argument','Digite uma resposta para o lojista.');
  if(reply.length>5000) throw new HttpsError('invalid-argument','A resposta é muito longa.');

  const ref=db.doc(`supportTickets/${ticketId}`);
  const snap=await ref.get();
  if(!snap.exists) throw new HttpsError('not-found','Chamado não encontrado.');
  const ticket=snap.data()!;
  const update:any={status,updatedAt:FieldValue.serverTimestamp(),answeredBy:request.auth.uid,answeredByName:String(admin?.displayName||admin?.email||'Master')};
  if(reply) update.adminReply=reply;
  if(status==='closed') update.closedAt=FieldValue.serverTimestamp();
  await ref.update(update);
  try{await writeAudit(String(ticket.storeId||''),request.auth.uid,String(admin?.displayName||admin?.email||'Master'),'answer_support_ticket','support_ticket',ticketId,`${status==='closed'?'Chamado resolvido':'Chamado respondido'}: ${String(ticket.subject||ticketId)}.`);}catch(err){console.error('support answer audit',err);}
  return {ok:true};
});

