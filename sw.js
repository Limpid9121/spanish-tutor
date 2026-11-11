// service worker：第一次開啟就把 App 需要的檔案全部快取起來，之後離線也能用。
// 改了任何要快取的檔案，就把 VERSION 加 1，手機才會抓新版（tests/sw-version.test.mjs 會檢查，忘了就失敗）。
// 加完 1 之後執行 node tools/stamp-sw.mjs 更新 tests/sw-manifest.json。這是 App 版本號唯一定義的地方，設定頁也是讀這裡。
const VERSION = "v14";
const CACHE = `spanish-tutor-${VERSION}`;

const PRECACHE = [
  "./",
  "index.html",
  "app.css",
  "manifest.webmanifest",
  "CREDITS.md",
  "vendor/ts-fsrs.umd.js",
  "content/vocab/core300.json",
  "content/vocab/social-abbr.json",
  "js/main.js",
  "js/data.js",
  "js/store.js",
  "js/session.js",
  "js/srs.js",
  "js/backup.js",
  "js/speech.js",
  "js/ui.js",
  "js/words.js",
  "js/reports.js",
  "js/exporter.js",
  "js/backupFlow.js",
  "js/sieve.js",
  "js/viewport.js",
  "js/errors.js",
  "js/version.js",
  "js/views/card.js",
  "js/views/today.js",
  "js/views/vocab.js",
  "js/views/review.js",
  "js/views/settings.js",
  "js/views/credits.js",
  "js/views/report.js",
  "js/views/sheet.js",
  "js/views/sieve.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((u) => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("spanish-tutor-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).catch(() => (req.mode === "navigate" ? caches.match("index.html") : Response.error()));
    }),
  );
});
