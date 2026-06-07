// Kill-switch service worker: clears all caches and deregisters
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async () => {
  const keys = await caches.keys();
  await Promise.all(keys.map(key => caches.delete(key)));
  await clients.claim();
  const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  allClients.forEach(client => client.navigate(client.url));
  await self.registration.unregister();
});
