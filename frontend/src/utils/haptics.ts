/**
 * 移动端触觉反馈工具（Web Vibration API）
 * 在支持震动的移动端设备（如 Android 手机、各类支持的 PWA 运行环境）上提供机械按键质感。
 * iOS Safari 或不支持的环境会自动安全跳过，无任何运行时副作用。
 */

export type HapticType = "light" | "medium" | "heavy" | "success" | "warning";

export function triggerHaptic(type: HapticType = "light") {
  if (typeof window === "undefined" || !("vibrate" in navigator)) {
    return;
  }

  try {
    switch (type) {
      case "light":
        // 轻触：打分、单点过关、加减分
        navigator.vibrate(12);
        break;
      case "medium":
        // 中度：重置小组、状态切换
        navigator.vibrate(25);
        break;
      case "heavy":
        // 重度：重要确认、清空
        navigator.vibrate(40);
        break;
      case "success":
        // 成功双击脉冲：本组全过、全班完成
        navigator.vibrate([12, 40, 15]);
        break;
      case "warning":
        // 警告双击：删除、撤销
        navigator.vibrate([30, 40, 30]);
        break;
      default:
        navigator.vibrate(15);
    }
  } catch {
    // 忽略任何设备权限或调用异常
  }
}
