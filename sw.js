const CACHE_NAME = 'animecloud-v2.5';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/app.js',
    '/js/api.js',
    '/js/ui.js',
    '/js/telegram.js',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://telegram.org/js/telegram-web-app.js',
    'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.css',
    'https://cdn.jsdelivr.net/npm/swiper@10/swiper-bundle.min.js',
    'https://cdn.plyr.io/3.7.8/plyr.css',
    'https://cdn.plyr.io/3.7.8/plyr.polyfilled.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Network first for API, Cache first for assets
    const url = new URL(event.request.url);
    
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request).catch(() => {
                // Return cached API response if available (optional, dangerous for fresh data)
                // For now, simpler to just fail or return custom offline JSON
                return new Response(JSON.stringify({error: "Offline"}), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request);
            })
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
