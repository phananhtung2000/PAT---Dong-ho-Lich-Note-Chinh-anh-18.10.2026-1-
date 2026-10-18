/* Service worker - Đồng hồ kim Seiko. Chỉ cache tài nguyên tĩnh (app shell + thư viện/font ngoài).
   Không can thiệp localStorage/IndexedDB, không đụng POST và các API (giờ, Google Calendar...). */
const APP_PREFIX = 'dong-ho-kim-seiko-cache-';
const CACHE_NAME = APP_PREFIX + 'v1'; // nâng v1 -> v2 khi phát hành bản mới

const LOCAL_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
// Thư viện/font ngoài đã dùng trong file gốc (cache nếu tải được, không làm hỏng việc cài đặt nếu lỗi mạng)
const CDN_SHELL = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Playfair+Display:wght@500;600;700&display=swap'
];
const APP_SHELL = LOCAL_SHELL.concat(CDN_SHELL);
const FONT_HOSTS = ['fonts.gstatic.com']; // file font woff2, chỉ là tài nguyên tĩnh

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(LOCAL_SHELL).then(() =>
        Promise.all(CDN_SHELL.map((u) => cache.add(u).catch(() => {})))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n.startsWith(APP_PREFIX) && n !== CACHE_NAME) // chỉ cache của app này
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const isShell = APP_SHELL.some((p) => new URL(p, self.location).href === url.href);
  const isFont = FONT_HOSTS.indexOf(url.hostname) !== -1;
  if (!isShell && !isFont && req.mode !== 'navigate') return; // để trình duyệt xử lý bình thường

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(req, { ignoreSearch: req.mode === 'navigate' }).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          if (isFont && res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).catch(() => {});
          return res;
        }).catch(() => {
          if (req.mode === 'navigate') return cache.match('./index.html');
          return Response.error();
        });
      })
    )
  );
});
