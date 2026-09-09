self.addEventListener('push', (event) => {
  event.waitUntil(showPushNotification(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(openNotificationUrl(event.notification.data && event.notification.data.url));
});

async function showPushNotification(event) {
  const payload = await parsePushPayload(event.data);
  const title = payload.title || 'Family Logistics Assistant';
  const options = {
    body: payload.body || 'New family notification',
    tag: payload.tag || undefined,
    data: {
      url: payload.url || '/',
    },
  };

  await self.registration.showNotification(title, options);
}

async function parsePushPayload(data) {
  if (!data) {
    return {};
  }

  try {
    return data.json();
  } catch {
    try {
      const text = await data.text();

      return text.trim() === '' ? {} : { body: text };
    } catch {
      return {};
    }
  }
}

async function openNotificationUrl(url) {
  const targetUrl = new URL(typeof url === 'string' ? url : '/', self.location.origin).href;
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });

  for (const client of windows) {
    const clientUrl = new URL(client.url);

    if (clientUrl.origin === self.location.origin && 'focus' in client) {
      if ('navigate' in client) {
        await client.navigate(targetUrl);
      }

      return client.focus();
    }
  }

  return clients.openWindow(targetUrl);
}
