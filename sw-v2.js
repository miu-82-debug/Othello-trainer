/* PWA v2: 即時更新・確実な置換用 */
const CACHE_NAME = 'othello-trainer-v2';   // ← バージョン名も変更
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw-v2.js',
  // もしCSS/JS/画像を別ファイルで使っていたらここに追記:
  // './style.css', './app.js', './icons/icon-192.png', './icons/icon-512.png'
];

// インストール時に即座に次のSWへ切替できる設定
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

// アクティブ化で旧キャッシュを破棄し、即制御権を取る
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // JSON等はネット優先（初回取得後はキャッシュ）
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

  // それ以外のアプリ本体はキャッシュ優先
  e.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
