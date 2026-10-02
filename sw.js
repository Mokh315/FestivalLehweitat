/* عامل الخدمة — يجعل المنصة تعمل دون إنترنت بعد أول زيارة
   القاعدة: الشبكة أولاً دائماً لملف المنصة، والذاكرة احتياط عند انقطاع الإنترنت فقط. */
var CACHE = "hweitat-2026-10-02";
var FILES = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./apple-touch-icon.png","./og.jpg"];
/* ملفات لا تُخزَّن أبداً — تُجلب من الشبكة دائماً */
var NEVER = ["version.json", "data.json"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (f) { return c.add(f).catch(function () {}); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* رسالة من الصفحة: امسح كل شيء (زر «تحديث المنصة») */
self.addEventListener("message", function (e) {
  if (!e.data || e.data.cmd !== "purge") return;
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.map(function (k) { return caches.delete(k); }));
  }));
});

function isNever(url) {
  for (var i = 0; i < NEVER.length; i++) { if (url.indexOf(NEVER[i]) >= 0) return true; }
  return false;
}

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = e.request.url;

  /* version.json و data.json: الشبكة فقط، ولا تُخزَّن إطلاقاً */
  if (isNever(url)) {
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(function () {
      return new Response("", { status: 504 });
    }));
    return;
  }

  /* صفحة المنصة نفسها: الشبكة أولاً بمهلة، والذاكرة عند فشل الشبكة فقط */
  e.respondWith(
    new Promise(function (resolve) {
      var settled = false;
      var fromCache = function () {
        caches.match(e.request).then(function (m) {
          if (settled) return;
          settled = true;
          resolve(m || caches.match("./index.html").then(function (i) {
            return i || new Response("", { status: 504 });
          }));
        });
      };
      var timer = setTimeout(fromCache, 6000);   /* شبكة بطيئة جداً ← اعرض المخزَّن */
      fetch(e.request).then(function (r) {
        clearTimeout(timer);
        if (settled) { /* عُرض المخزَّن، لكن حدِّث الذاكرة للمرة القادمة */ }
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () {}); });
        if (!settled) { settled = true; resolve(r); }
      }).catch(function () {
        clearTimeout(timer);
        fromCache();
      });
    })
  );
});
