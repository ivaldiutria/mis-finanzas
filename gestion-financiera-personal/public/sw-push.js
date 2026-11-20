/* eslint-disable no-restricted-globals */
/**
 * Service Worker Push & Reminder Extension for Mis Finanzas (PWA)
 * Integrado con Workbox (vite-plugin-pwa) mediante importScripts('/sw-push.js')
 */

self.__cachedReminders = [];

/**
 * Construye las opciones estándar de notificación nativa para el Service Worker
 */
function buildNotificationOptions(payload) {
  const section = payload.section || 'dashboard';
  const actionLabel =
    section === 'app_credits'
      ? 'Ver Crédito de App'
      : section === 'subscriptions'
        ? 'Ver Suscripción'
        : 'Abrir Mis Finanzas';

  return {
    body: payload.body || 'Tienes un vencimiento próximo en Mis Finanzas.',
    icon: payload.icon || '/pwa-192x192.png',
    badge: payload.badge || '/pwa-192x192.png',
    tag: payload.tag || 'mis-finanzas-reminder-' + Date.now(),
    renotify: Boolean(payload.renotify ?? true),
    requireInteraction: Boolean(payload.requireInteraction ?? false),
    vibrate: [180, 90, 180],
    data: {
      section,
      itemId: payload.itemId || null,
      kind: payload.kind || 'generic',
      dueDate: payload.dueDate || null,
      url: payload.url || '/',
      timestamp: Date.now(),
    },
    actions: [
      {
        action: 'open_section',
        title: actionLabel,
      },
      {
        action: 'dismiss',
        title: 'Cerrar',
      },
    ],
  };
}

/**
 * 1. Escucha eventos Push estándar (Web Push API / DevTools Push / Background Push)
 */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Recordatorio · Mis Finanzas',
    body: 'Revisa tus próximos vencimientos de Créditos de Apps y Suscripciones.',
    section: 'dashboard',
    tag: 'mis-finanzas-push',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = { ...payload, ...parsed };
    } catch {
      const text = event.data.text();
      if (text) {
        payload.body = text;
      }
    }
  }

  const title = payload.title || 'Recordatorio · Mis Finanzas';
  const options = buildNotificationOptions(payload);

  event.waitUntil(self.registration.showNotification(title, options));
});

/**
 * 2. Comunicación bidireccional con la aplicación cliente (postMessage)
 * Permite disparar notificaciones reales desde el Service Worker y sincronizar
 * la cola de vencimientos de Créditos de Apps y Suscripciones.
 */
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'SHOW_PUSH_NOTIFICATION' && data.payload) {
    const payload = data.payload;
    const title = payload.title || 'Recordatorio · Mis Finanzas';
    const options = buildNotificationOptions(payload);

    event.waitUntil(
      self.registration
        .showNotification(title, options)
        .then(() => {
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({
              type: 'SW_NOTIFICATION_DISPATCHED',
              tag: options.tag,
              timestamp: Date.now(),
            });
          }
        })
        .catch((err) => {
          if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({
              type: 'SW_NOTIFICATION_ERROR',
              error: String(err && err.message ? err.message : err),
            });
          }
        })
    );
  }

  if (data.type === 'SYNC_PUSH_REMINDERS' && Array.isArray(data.reminders)) {
    self.__cachedReminders = data.reminders;
  }

  if (data.type === 'CHECK_CACHED_REMINDERS') {
    const urgent = (self.__cachedReminders || []).filter(
      (r) => r.urgency === 'overdue' || r.urgency === 'due_today'
    );
    if (urgent.length > 0) {
      const first = urgent[0];
      const title =
        urgent.length === 1
          ? first.title
          : `Tienes ${urgent.length} vencimientos urgentes hoy`;
      const body =
        urgent.length === 1
          ? first.body
          : urgent.map((u) => `• ${u.shortLabel}`).join('\n');
      const options = buildNotificationOptions({
        title,
        body,
        section: first.section,
        itemId: first.itemId,
        tag: 'mis-finanzas-periodic-summary',
      });
      event.waitUntil(self.registration.showNotification(title, options));
    }
  }
});

/**
 * 3. Soporte para Periodic Background Sync (si el navegador/PWA instalada lo habilita)
 */
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'mis-finanzas-reminders-sync') {
    const reminders = self.__cachedReminders || [];
    if (reminders.length > 0) {
      const first = reminders[0];
      const title =
        reminders.length === 1
          ? first.title
          : `${reminders.length} pagos próximos · Mis Finanzas`;
      const body =
        reminders.length === 1
          ? first.body
          : reminders
              .slice(0, 3)
              .map((r) => `• ${r.shortLabel}`)
              .join('\n');
      const options = buildNotificationOptions({
        title,
        body,
        section: first.section,
        itemId: first.itemId,
        tag: 'mis-finanzas-bg-sync',
      });
      event.waitUntil(self.registration.showNotification(title, options));
    }
  }
});

/**
 * 4. Manejo de clic en la notificación Push del sistema operativo / navegador
 * Enfoca la ventana abierta de la PWA y navega directamente a Créditos de Apps o Suscripciones.
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  const notifData = event.notification.data || {};
  const targetSection = notifData.section || 'dashboard';
  const targetItemId = notifData.itemId || null;
  const targetUrl =
    targetSection === 'app_credits'
      ? '/?section=app_credits'
      : targetSection === 'subscriptions'
        ? '/?section=subscriptions'
        : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            client.postMessage({
              type: 'SW_NOTIFICATION_CLICK',
              section: targetSection,
              itemId: targetItemId,
            });
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});
