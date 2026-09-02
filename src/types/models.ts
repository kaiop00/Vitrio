export type Role = 'admin' | 'merchant';
export type CheckoutMode = 'whatsapp' | 'online' | 'both';
export type FulfillmentType = 'pickup' | 'delivery';
export type OrderStatus = 'pending_payment' | 'paid' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type Permission = 'dashboard'|'products'|'categories'|'inventory'|'orders'|'returns'|'cash'|'customers'|'coupons'|'delivery'|'payments'|'reports'|'audit'|'store_settings'|'checkout_settings';
export interface AppUser { uid:string; email:string; displayName?:string; role:Role; storeId?:string; active:boolean; permissions?:Permission[]; isStoreOwner?:boolean; }
export interface Store {
  id:string; name:string; slug:string; logoUrl?:string; bannerUrl?:string; description?:string; whatsapp?:string; instagram?:string; address?:string; primaryColor?:string; active:boolean; createdAt?:unknown; ownerId?:string; ownerEmail?:string; plan?:SubscriptionPlan; subscriptionStatus?:SubscriptionStatus; trialEndsAt?:any; subscriptionEndsAt?:any; onboardingCompleted?:boolean; onboardingCompletedAt?:any;
  checkoutMode?:CheckoutMode; allowPix?:boolean; allowCard?:boolean; allowCash?:boolean; allowPickup?:boolean; allowDelivery?:boolean; deliveryFee?:number; lowStockThreshold?:number; paymentProviderConnected?:boolean; mercadoPagoPublicKey?:string; bannerText?:string; businessHours?:string; showStock?:boolean; minOrderValue?:number; preparationTime?:string; orderPrefix?:string; returnPolicy?:string; supportPhone?:string; monthlySalesGoal?:number;
}
export interface Category { id:string; storeId:string; name:string; active:boolean; createdAt?:unknown; }
export interface ProductVariant { id:string; name:string; sku?:string; stock:number; priceAdjustment?:number; active?:boolean; }
export interface ProductAddonOption { id:string; name:string; price:number; active?:boolean; }
export interface ProductAddonGroup { id:string; name:string; required?:boolean; maxSelections?:number; options:ProductAddonOption[]; }
export interface AddonSelection { groupId:string; groupName:string; optionId:string; optionName:string; price:number; }
export interface Product { id:string; storeId:string; categoryId?:string; name:string; description?:string; sku?:string; tags?:string[]; price:number; compareAtPrice?:number; stock:number; imageUrl?:string; imageUrls?:string[]; active:boolean; featured?:boolean; sortOrder?:number; flashOffer?:boolean; flashOfferStartsAt?:any; flashOfferEndsAt?:any; availableForPickup?:boolean; availableForDelivery?:boolean; maxPerOrder?:number; variants?:ProductVariant[]; addonGroups?:ProductAddonGroup[]; createdAt?:unknown; updatedAt?:unknown; }
export interface CartItem { product:Product; quantity:number; variant?:ProductVariant; addons?:AddonSelection[]; }
export interface OrderItem { productId:string; name:string; price:number; quantity:number; subtotal:number; variantId?:string; variantName?:string; variantSku?:string; addons?:AddonSelection[]; }
export interface Order {
  id:string; storeId:string; customerName:string; customerPhone:string; customerEmail?:string; fulfillment:FulfillmentType; address?:string; paymentMethod:string; items:OrderItem[]; subtotal:number; discount?:number; couponCode?:string; deliveryFee:number; deliveryZoneId?:string; deliveryZoneName?:string; total:number; status:OrderStatus; paymentStatus:PaymentStatus; mercadoPagoOrderId?:string; pix?:{qrCode?:string;qrCodeBase64?:string;ticketUrl?:string}; customerNotes?:string; merchantNotes?:string; createdAt?:any;
}
export interface CashRegister { id:string; storeId:string; openedBy:string; status:'open'|'closed'; openingAmount:number; closingAmount?:number; openedAt?:any; closedAt?:any; }
export interface CashMovement { id:string; storeId:string; cashRegisterId:string; type:'income'|'expense'; amount:number; description:string; createdAt?:any; createdBy:string; }


export type SubscriptionPlan = 'starter' | 'pro' | 'business';
export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';

export type StoreSubscription = {
  plan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  trialEndsAt?: any;
  subscriptionEndsAt?: any;
};

export type PaymentProviderStatus = {
  provider?: 'mercadopago';
  connected?: boolean;
  mercadoPagoUserId?: string;
  connectedAt?: any;
};

export interface Coupon {
  id:string; storeId:string; code:string; type:'percent'|'fixed'; value:number; minOrder?:number; active:boolean; usageLimit?:number; uses?:number; expiresAt?:any; createdAt?:any;
}
export interface DeliveryZone {
  id:string; storeId:string; name:string; fee:number; active:boolean; createdAt?:any;
}
export interface Customer {
  id:string; storeId:string; name:string; phone:string; email?:string; ordersCount:number; totalSpent:number; lastOrderAt?:any; createdAt?:any;
}

export interface ReturnRecord {
  id:string; storeId:string; orderId:string; type:'return'|'exchange'; items:{productId:string;name:string;quantity:number;unitPrice:number;total:number}[]; total:number; reason:string; status:'received'|'refunded'|'exchanged'; createdBy:string; createdAt?:any;
}
export interface AuditLog {
  id:string; storeId:string; userId:string; userName?:string; action:string; entity:string; entityId?:string; description:string; createdAt?:any;
}
