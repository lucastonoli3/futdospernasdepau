// Balaio de Gato FC — Service Worker — Network-First com fallback offline
// Versão: auto-invalidante via timestamp de deploy
const CACHE_NAME = 'bgfc-v1';
const STATIC_ASSETS = [
    '/manifest.json',
    '/icon-512.png',
    '/no_photo.jpg'
];

// Install: cacheia apenas assets estáticos (ícones/manifest)
self.addEventListener('install', (event) => {
    self.skipWaiting(); // Ativa imediatamente, sem esperar abas fecharem
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

// Activate: limpa TODOS os caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        }).then(() => {
            return self.clients.claim(); // Assume controle de todas as abas abertas
        })
    );
});

// Fetch: Network-first para TUDO exceto assets estáticos
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Requisições de navegação (HTML) e scripts: SEMPRE network-first
    if (event.request.mode === 'navigate' ||
        event.request.destination === 'script' ||
        event.request.destination === 'style' ||
        url.pathname === '/' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cacheia a resposta fresca para fallback offline
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline: tenta servir do cache
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Assets estáticos (imagens, fontes): cache-first com fallback network
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cacheia assets estáticos para offline
                if (response.ok && STATIC_ASSETS.some(a => url.pathname.endsWith(a.replace('/', '')))) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            });
        })
    );
});
