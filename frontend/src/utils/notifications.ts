/**
 * PWA 消息通知与系统级提醒工具库
 *
 * 支持：
 * 1. 跨平台系统级通知（Mac / Windows / Android / iOS 16.4+ PWA）；
 * 2. Service Worker 后台通知与锁屏唤醒；
 * 3. 课前提醒（提前 5 / 10 / 15 分钟）、晨间寄语与今日待办提醒；
 * 4. 离线及本地持久化偏好配置。
 */

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export interface NotificationSettings {
  lessonRemindEnabled: boolean;
  lessonRemindMinutes: number;
  morningGreetingEnabled: boolean;
  todoRemindEnabled: boolean;
}

export const DEFAULT_NOTIF_SETTINGS: NotificationSettings = {
  lessonRemindEnabled: true,
  lessonRemindMinutes: 5,
  morningGreetingEnabled: true,
  todoRemindEnabled: true,
};

const STORAGE_KEY = "teacher_workbench_notif_settings";

export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
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

  // 1. 优先通过 Service Worker 的 showNotification 发送（支持锁屏、后台显示与点击事件）
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
