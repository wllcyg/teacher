/**
 * PWA 消息通知与系统级提醒工具库
 *
 * 支持：
 * 1. 跨平台系统级通知（Mac / Windows / Android / iOS 16.4+ PWA）；
 * 2. Service Worker 后台通知与锁屏唤醒；
 * 3. Web Push API 系统级离线消息推送（VAPID 协议 + 订阅持久化）；
 * 4. App Badging API 桌面图标角标红点；
 * 5. 课前提醒（提前 5 / 10 / 15 分钟）、晨间寄语与今日待办提醒；
 * 6. 离线及本地持久化偏好配置。
 */

import { api } from "../api/client";

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export interface NotificationSettings {
  lessonRemindEnabled: boolean;
  lessonRemindMinutes: number;
  lessonEndRemindEnabled: boolean;
  morningGreetingEnabled: boolean;
  todoRemindEnabled: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  lessonRemindEnabled: true,
  lessonRemindMinutes: 5,
  lessonEndRemindEnabled: true,
  morningGreetingEnabled: true,
  todoRemindEnabled: true,
};

const STORAGE_KEY = "teacher_workbench_notif_settings";

/**
 * 将 Base64 字符串转换为 PushManager.subscribe 所需的 Uint8Array (ArrayBuffer)
 */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}


export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!isNotificationSupported()) return "unsupported";
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn("[Notification] 申请通知权限失败:", err);
    return Notification.permission || "denied";
  }
}

export function getStoredNotificationSettings(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_NOTIF_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_NOTIF_SETTINGS;
}

export function saveStoredNotificationSettings(settings: NotificationSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * 清除应用桌面图标上的未读红点角标
 */
export async function clearAppBadge(): Promise<void> {
  if (typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
    try {
      await navigator.clearAppBadge();
    } catch {}
  }
}

/**
 * 设置应用桌面图标上的未读数字角标
 */
export async function setAppBadge(count: number): Promise<void> {
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    try {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    } catch {}
  }
}

// -------------------------------------------------------------
// Web Push 核心交互方法
// -------------------------------------------------------------

/**
 * 从后端获取 Base64 格式的 VAPID 公钥
 */
export async function getVapidPublicKey(): Promise<string> {
  const res = await api.get<{ publicKey: string }>("/push/vapid-public-key");
  return res.data.publicKey;
}

/**
 * 获取当前设备已有的 Web Push 订阅对象
 */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.warn("[WebPush] 获取本地订阅失败:", err);
    return null;
  }
}

/**
 * 完整注册流程：申请通知权限 -> 拉取公钥 -> 注册系统推送 -> 上报后端持久化
 */
export async function subscribePushNotification(): Promise<PushSubscription> {
  if (!isPushSupported()) {
    throw new Error("当前浏览器或系统不支持 Web Push 服务");
  }

  // 1. 确保系统通知权限
  const perm = await requestNotificationPermission();
  if (perm !== "granted") {
    throw new Error("未授予通知权限，无法开启后台推送");
  }

  // 2. 等待 Service Worker 就绪
  const reg = await navigator.serviceWorker.ready;

  // 3. 拉取后端 VAPID 公钥
  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error("服务端未能提供有效的 VAPID 公钥");
  }

  // 4. 向系统/厂商推送服务发起订阅（已存在则复用）
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    const appKeyArray = urlBase64ToUint8Array(publicKey);
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appKeyArray as unknown as BufferSource,
    });

  }

  // 5. 序列化 keys 并上报到后端
  const rawSub = subscription.toJSON();
  if (!rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
    throw new Error("生成的推送凭据不完整");
  }

  await api.post("/push/subscribe", {
    endpoint: rawSub.endpoint,
    keys: {
      p256dh: rawSub.keys.p256dh,
      auth: rawSub.keys.auth,
    },
    user_agent: navigator.userAgent || "Unknown Device",
  });

  return subscription;
}

/**
 * 取消当前设备的 Web Push 订阅
 */
export async function unsubscribePushNotification(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.post("/push/unsubscribe", { endpoint });
    }
    return true;
  } catch (err) {
    console.warn("[WebPush] 取消订阅失败:", err);
    return false;
  }
}

/**
 * 触发后端向当前设备（或全部设备）发送真实 Web Push 测试
 */
export async function sendBackendTestPush(params?: {
  title?: string;
  body?: string;
  url?: string;
  badgeCount?: number;
  onlyCurrentDevice?: boolean;
}): Promise<{ ok: boolean; message: string }> {
  let endpoint: string | undefined = undefined;

  if (params?.onlyCurrentDevice !== false) {
    const currentSub = await getPushSubscription();
    if (currentSub) {
      endpoint = currentSub.endpoint;
    }
  }

  const res = await api.post<{ ok: boolean; message: string }>("/push/send-test", {
    title: params?.title || "【教师工作台】系统测试通知",
    body: params?.body || "系统级离线推送已成功接通！即使关闭页面也能准时收到提醒。",
    url: params?.url || "/settings",
    badgeCount: params?.badgeCount ?? 1,
    endpoint,
  });

  return res.data;
}

/**
 * 查询后端推送服务状态与设备总数
 */
export async function getPushStatus(): Promise<{ enabled: boolean; subscribedDevices: number }> {
  const res = await api.get<{ enabled: boolean; subscribedDevices: number }>("/push/status");
  return res.data;
}

// -------------------------------------------------------------
// 本地页面通知兜底方案
// -------------------------------------------------------------

export async function sendNotification(
  title: string,
  options?: NotificationOptions & { data?: { url?: string } }
): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("[Notification] 当前浏览器不支持 Notification API");
    return false;
  }

  if (Notification.permission !== "granted") {
    console.warn("[Notification] 未获得系统通知权限");
    return false;
  }

  const notifOptions: NotificationOptions = {
    icon: "/pwa-192x192.svg",
    badge: "/favicon.svg",
    ...options,
  };

  // 1. 优先通过 Service Worker 的 showNotification 发送
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) {
        await reg.showNotification(title, notifOptions);
        return true;
      }
    }
  } catch (err) {
    console.warn("[Notification] SW showNotification 降级:", err);
  }

  // 2. 兜底使用页面 window.Notification
  try {
    const n = new Notification(title, notifOptions);
    const targetUrl = options?.data?.url;
    if (targetUrl) {
      n.onclick = () => {
        window.focus();
        window.location.href = targetUrl;
        n.close();
      };
    }
    return true;
  } catch (err) {
    console.error("[Notification] 发送通知异常:", err);
    return false;
  }
}
