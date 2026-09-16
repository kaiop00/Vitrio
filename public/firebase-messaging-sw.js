
// Arquivo gerado automaticamente. Não editar manualmente.

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js');

firebase.initializeApp({"apiKey":"AIzaSyDLsUhF-oqKSYCx3MBxsTpOR6QnwFt7rJs","authDomain":"teia-c860e.firebaseapp.com","projectId":"teia-c860e","storageBucket":"teia-c860e.firebasestorage.app","messagingSenderId":"377137050701","appId":"1:377137050701:web:99a9589b22584bf12a9804"});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'Vitrio — Novo pedido';

  const options = {
    body: data.body || 'Você recebeu um novo pedido.',
    data: {
      url: data.url || '/painel/pedidos'
    },
    tag: data.orderId
      ? 'vitrio-order-' + data.orderId
      : 'vitrio-new-order'
  };

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data?.url ||
    '/painel/pedidos';

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      return clients.openWindow(targetUrl);
    })
  );
});
