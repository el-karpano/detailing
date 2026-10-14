/* Push-обработчик для generateSW (importScripts). */
self.addEventListener('push', (event) => {
  let data = { title: 'Напоминание о визите', body: '', url: '/my' }
  try {
    if (event.data) data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Напоминание', {
      body: data.body || '',
      tag: data.tag || 'visit',
      data: { url: data.url || '/' },
      // eslint-disable-next-line
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
