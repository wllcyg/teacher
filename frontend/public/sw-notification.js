// PWA 系统级通知点击唤起与页面定位脚本
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 若已有工作台窗口，则激活聚焦并跳转对应页面
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // 若没有打开的窗口，则直接新窗口打开
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
