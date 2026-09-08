// PWA 系统级离线消息推送与点击唤起脚本

// 1. 监听系统级 Web Push 事件
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('[SW Push] 收到空 Push 载荷');
    return;
  }

  let payload = {};
  try {
    payload = event.data.json();
  } catch (err) {
    payload = {
      title: '教师工作台提醒',
      body: event.data.text() || '您有一条新的教学待办',
    };
  }

  // 1.0 若收到的是系统发版更新推送 (SYSTEM_UPDATE)
  if (payload.type === 'SYSTEM_UPDATE') {
    // 立即在后台静默发起更新，拉取服务器最新的 sw.js 与静态代码资源
    self.registration.update();

    const updateOptions = {
      body: payload.body || '教师工作台全新功能已就绪，点击立即体验！',
      icon: '/pwa-192x192.svg',
      badge: '/favicon.svg',
      tag: 'system-update',
      renotify: true,
      data: {
        type: 'SYSTEM_UPDATE',
        url: payload.url || '/',
      },
      actions: [
        { action: 'open_update', title: '🚀 立即体验' },
        { action: 'dismiss', title: '稍后' },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(
        payload.title || '✨ 教师工作台系统更新',
        updateOptions
      )
    );
    return;
  }

  const {
    title = '教师工作台',
    body = '您有一条新的消息提醒',
    icon = '/pwa-192x192.svg',
    badge = '/favicon.svg',
    url = '/',
    badgeCount,
    tag = 'teacher-workbench-notice',
    actions = [],
    data = {},
  } = payload;

  // 1.1 联动更新桌面图标未读红点角标 (App Badging API)
  if ('setAppBadge' in navigator) {
    if (typeof badgeCount === 'number' && badgeCount > 0) {
      navigator.setAppBadge(badgeCount).catch(() => {});
    } else if (badgeCount === 0) {
      navigator.clearAppBadge().catch(() => {});
    }
  }

  // 1.2 弹出系统级原生通知卡片
  const notificationOptions = {
    body,
    icon,
    badge,
    tag,
    renotify: true,
    data: {
      url: data.url || url || '/',
      ...data,
    },
    actions: actions.length > 0 ? actions : [
      { action: 'open', title: '查看详情' },
      { action: 'dismiss', title: '知道了' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  );
});

// 2. 监听系统级通知点击事件：精准唤醒/聚焦 PWA 独立窗口
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // 若用户点击了“知道了/稍后”，直接返回
  if (event.action === 'dismiss') {
    return;
  }

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  const isSystemUpdate = event.notification.data?.type === 'SYSTEM_UPDATE';

  event.waitUntil(
    (async () => {
      // 若是系统升级，强制跳过等待，让新版本 Service Worker 立即接管客户端
      if (isSystemUpdate && self.skipWaiting) {
        try {
          await self.skipWaiting();
        } catch {}
      }

      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (isSystemUpdate) {
            // 系统升级直接刷新该窗口载入最新静态代码
            await client.navigate(client.url);
          } else if ('navigate' in client && targetUrl) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // 若没有已打开窗口，则直接打开最新版本独立窗口
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })()
  );
});


