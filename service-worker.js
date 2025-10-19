/* cache-first for app shell, network-first for JSON（今回はJSON外部取得なし想定） */
const CACHE_NAME = 'othello-trainer-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './service-worker.js',
  // 画像や音声、分離したCSS/JSがあればここに追記:
  // './style.css', './app.js', './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // もし今後JSON等を外部から取得する場合はここで network-first にする
  if (url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // それ以外（アプリ本体）は cache-first
  e.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
});
