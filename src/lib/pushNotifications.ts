import { deleteToken, getToken } from 'firebase/messaging';
import { httpsCallable } from 'firebase/functions';
import { functions, getFirebaseMessaging } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function enablePushNotifications(storeId: string) {
  if (!storeId) throw new Error('Loja não identificada.');
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador não suporta notificações em segundo plano.');
  }
  if (!('Notification' in window)) {
    throw new Error('Este navegador não suporta notificações.');
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error('Permissão de notificações não concedida.');
  }

  const messaging = await getFirebaseMessaging();
  if (!messaging) {
    throw new Error('Firebase Messaging não é suportado neste navegador.');
  }

  if (!VAPID_KEY) {
    throw new Error('VITE_FIREBASE_VAPID_KEY não configurada.');
  }

  const registration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js'
  );

  await navigator.serviceWorker.ready;

  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration
  });

  if (!token) {
    throw new Error('Não foi possível gerar o token deste aparelho.');
  }

  const register = httpsCallable(functions, 'registerPushDevice');

  await register({
    storeId,
    token,
    userAgent: navigator.userAgent,
    platform: navigator.platform || '',
    language: navigator.language || 'pt-BR'
  });

  localStorage.setItem('vitrio-push-enabled', 'true');

  return token;
}

export async function disablePushNotifications(storeId: string) {
  const messaging = await getFirebaseMessaging();

  if (messaging) {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY
    }).catch(() => '');

    if (token) {
      const unregister = httpsCallable(functions, 'unregisterPushDevice');
      await unregister({ storeId, token });
      await deleteToken(messaging);
    }
  }

  localStorage.removeItem('vitrio-push-enabled');
}
