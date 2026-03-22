// L'Essence OS — Service Worker v2
const CACHE = 'lessence-v2';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

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

// ── Fetch: cache-first para assets do app, rede para externos ─────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Deixar chamadas externas (Drive, Google, fontes) passarem direto
  if (url.origin !== self.location.origin) return;

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

// ── Notification click: abrir app ─────────────────────────────────────
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

// ── Background sync: verificar OS vencidas ────────────────────────────
// Nota: periodicsync só funciona no Chrome Android com app instalado.
// O fallback principal é feito pelo próprio app ao abrir (no index.html).
self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-vencidas') {
    e.waitUntil(verificarVencidasBackground());
  }
});

async function verificarVencidasBackground() {
  // Só envia mensagem se o app estiver aberto — se fechado, não há o que fazer aqui.
  // A verificação offline é responsabilidade do app ao inicializar.
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  if (allClients.length > 0) {
    allClients[0].postMessage({ type: 'CHECK_VENCIDAS' });
  }
}

// ── Mensagens do app → SW ─────────────────────────────────────────────
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

  // Permite forçar atualização do SW via app (ex: após deploy)
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
