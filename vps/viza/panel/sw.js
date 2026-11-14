// Viza Panel: service worker minimal agar bisa dipasang sebagai aplikasi.
// Tidak menyimpan cache supaya perubahan panel langsung terlihat.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
