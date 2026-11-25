/* Firebase Cloud Messaging service worker (web push). Config is passed in the registration URL. */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

const config = JSON.parse(new URL(self.location).searchParams.get('config') || '{}')
firebase.initializeApp(config)
firebase.messaging()

// open the app (and the linked page) when a notification is clicked
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const link = event.notification?.data?.FCM_MSG?.data?.link || ''
  const base = new URL('./', self.location).href
  const target = base + (link ? '#' + link : '#/notifications')
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if (c.url.startsWith(base)) { c.navigate(target); return c.focus() }
    return clients.openWindow(target)
  }))
})
