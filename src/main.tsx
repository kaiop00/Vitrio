import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { UiProvider } from './contexts/UiContext';
import './styles.css';
import './v29.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><UiProvider><AuthProvider><App/></AuthProvider></UiProvider></BrowserRouter></React.StrictMode>);

/* Vitrio PWA */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration =
        await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      await registration.update();

      console.log('Vitrio PWA ativo:', registration.scope);
    } catch (error) {
      console.error('Falha ao registrar Vitrio PWA:', error);
    }
  });
}
