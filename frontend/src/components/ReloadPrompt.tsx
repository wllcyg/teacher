import React, { useEffect } from "react";
import { App as AntApp, Button, Space } from "antd";
import { CloudDownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import { useRegisterSW } from "virtual:pwa-register/react";

export const ReloadPrompt: React.FC = () => {
  const { notification } = AntApp.useApp();

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (!registration) return;

      // 1. 每隔 30 分钟在后台静默检查一次是否有新版本
      const intervalId = setInterval(() => {
        registration.update().catch((err) => {
          console.warn("[PWA] 定时检查更新失败:", err);
        });
      }, 30 * 60 * 1000);

      // 2. 页面切回前台（例如手机解锁重新打开 PWA 或桌面切换应用）时主动检查一次
      const handleVisibilityChange = () => {
        if (document.visibilityState === "visible") {
          registration.update().catch((err) => {
            console.warn("[PWA] 切回前台检查更新失败:", err);
          });
        }
      };
      document.addEventListener("visibilitychange", handleVisibilityChange);

      return () => {
        clearInterval(intervalId);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    },
    onRegisterError(error) {
      console.error("[PWA] Service Worker 注册失败:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      const notifyKey = "pwa-update-notification";
      notification.info({
        key: notifyKey,
        message: "发现工作台新版本",
        description: "教师工作台已发布新版本，点击「立即刷新」即可体验最新功能。",
        icon: <CloudDownloadOutlined style={{ color: "#2f6fed" }} />,
        duration: 0, // 不会自动关闭，等待用户确认
        placement: "bottomRight",
        btn: (
          <Space>
            <Button size="small" onClick={() => setNeedRefresh(false)}>
              稍后
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => {
                // 唤醒新 Service Worker 跳过等待并执行重载
                updateServiceWorker(true);
              }}
            >
              立即刷新
            </Button>
          </Space>
        ),
        onClose: () => {
          setNeedRefresh(false);
        },
      });
    }
  }, [needRefresh, notification, setNeedRefresh, updateServiceWorker]);

  return null;
};
