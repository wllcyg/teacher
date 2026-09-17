import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WifiOutlined, DisconnectOutlined } from "@ant-design/icons";

/**
 * 全局离线与重连感知横幅
 * 自动监听浏览器 online / offline 事件，在断网时顶部弹出警示，恢复时给予积极反馈
 */
export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState<boolean>(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const showBanner = !isOnline || showRestored;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            overflow: "hidden",
            width: "100%",
          }}
        >
          <div
            style={{
              padding: "6px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontSize: 12.5,
              fontWeight: 500,
              background: !isOnline
                ? "linear-gradient(90deg, #fff7ed 0%, #ffedd5 100%)"
                : "linear-gradient(90deg, #f0fdf4 0%, #dcfce7 100%)",
              color: !isOnline ? "#c2410c" : "#15803d",
              borderBottom: !isOnline ? "1px solid #fed7aa" : "1px solid #bbf7d0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            {!isOnline ? (
              <>
                <DisconnectOutlined style={{ fontSize: 14 }} />
                <span>当前网络已断开，正处于离线模式。您的本地草稿安全，联网后将自动同步。</span>
              </>
            ) : (
              <>
                <WifiOutlined style={{ fontSize: 14 }} />
                <span>网络连接已恢复！数据已恢复正常同步。</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default OfflineBanner;
