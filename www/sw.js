/* =========================================================
   SW.JS - Service Worker
   จัดการ Offline Cache และรองรับการติดตั้งเป็น PWA
   กลยุทธ์: Cache First สำหรับไฟล์ static, fallback ไปยัง network
   ========================================================= */

const CACHE_NAME = "checklist-cache-v1";
const CACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/animation.js",
  "./js/sound.js",
  "./assets/icons/icon-72x72.png",
  "./assets/icons/icon-96x96.png",
  "./assets/icons/icon-128x128.png",
  "./assets/icons/icon-144x144.png",
  "./assets/icons/icon-152x152.png",
  "./assets/icons/icon-192x192.png",
  "./assets/icons/icon-384x384.png",
  "./assets/icons/icon-512x512.png",
];

/* ติดตั้ง Service Worker และ Cache ไฟล์หลักทั้งหมด */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* เปิดใช้งาน Service Worker ใหม่ และลบ Cache เวอร์ชันเก่าทิ้ง */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* สกัดกั้น Request: ตอบจาก Cache ก่อน ถ้าไม่มีค่อยไปดึงจาก Network */
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((networkResponse) => {
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== "basic"
          ) {
            return networkResponse;
          }
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        })
        .catch(() => {
          // Offline และไม่มีใน cache: ถ้าเป็น navigation request ให้ fallback เป็นหน้าแรก
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
          return undefined;
        });
    })
  );
});
