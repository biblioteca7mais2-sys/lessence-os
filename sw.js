// L'Essence OS — Service Worker v1
const CACHE = 'lessence-v1';
const ASSETS = ['./index.html', './manifest.json'];

// ── Install: cache assets ─────────────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// ── Activate: clean old caches ────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: cache-first for app, network-first for Drive API ──────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Deixar chamadas externas (Drive, Google) passarem direto
  if (!url.origin.includes(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

// ── Push notifications ────────────────────────────────────────────────
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(data.title || "L'Essence OS", {
      body: data.body || 'Você tem OS vencidas.',
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: data.tag || 'lessence-notif',
      renotify: true,
      data: { url: data.url || './' }
    })
  );
});

// ── Notification click: abrir app ────────────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes('index.html') && 'focus' in c) return c.focus();
      }
      return clients.openWindow('./index.html');
    })
  );
});

// ── Background sync: verificar OS vencidas ───────────────────────────
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-vencidas') {
    e.waitUntil(verificarVencidasBackground());
  }
});

async function verificarVencidasBackground() {
  // Lê dados do localStorage via mensagem para o cliente ativo
  const allClients = await clients.matchAll({ includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients[0].postMessage({ type: 'CHECK_VENCIDAS' });
  }
}

// ── Mensagens do app → SW ────────────────────────────────────────────
self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIF_VENCIDAS') {
    const { count } = e.data;
    if (count > 0) {
      self.registration.showNotification("⏰ L'Essence OS", {
        body: `${count} ordem${count > 1 ? 'ns' : ''} de serviço vencida${count > 1 ? 's' : ''}. Verifique agora.`,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'lessence-vencidas',
        renotify: true,
        actions: [{ action: 'abrir', title: 'Abrir app' }]
      });
    }
  }
});
