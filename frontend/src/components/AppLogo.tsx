import { useNavigate } from "react-router-dom";
import { Tooltip } from "antd";

interface AppLogoProps {
  collapsed?: boolean;
  isMobile?: boolean;
}

export default function AppLogo({ collapsed = false, isMobile = false }: AppLogoProps) {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/");
  };

  return (
    <Tooltip title="点击快速回到首页" placement={collapsed ? "right" : "bottom"}>
      <div
        onClick={handleGoHome}
        style={{
          height: isMobile ? 40 : 56,
          padding: collapsed ? "0" : "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.2s ease-in-out",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = "1";
        }}
      >
        {/* 矢量 Logo 图标 */}
        <div
          style={{
            width: isMobile ? 28 : 32,
            height: isMobile ? 28 : 32,
            flexShrink: 0,
            borderRadius: isMobile ? 7 : 8,
            background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #38bdf8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 6px rgba(79, 70, 229, 0.35)",
            transition: "transform 0.2s ease",
          }}
        >
          <svg
            width={isMobile ? "18" : "20"}
            height={isMobile ? "18" : "20"}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Open Book Wings */}
            <path
              d="M13 33C17 31.8 21 33 24 35.5V19.5C21 17 17 15.8 13 17V33Z"
              fill="white"
              fillOpacity="0.95"
            />
            <path
              d="M35 33C31 31.8 27 33 24 35.5V19.5C27 17 31 15.8 35 17V33Z"
              fill="white"
              fillOpacity="0.82"
            />
            {/* Knowledge Star Spark */}
            <path
              d="M24 10L25.8 13.8L30 14.5L27 17.5L27.7 22L24 19.8L20.3 22L21 17.5L18 14.5L22.2 13.8L24 10Z"
              fill="#FCD34D"
            />
          </svg>
        </div>

        {/* 文字 Logo 标题 */}
        {!collapsed && (
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: isMobile ? 15 : 16,
                  color: "#0f172a",
                  letterSpacing: -0.2,
                }}
              >
                教师工作台
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: "rgba(99, 102, 241, 0.1)",
                  color: "#4f46e5",
                  letterSpacing: 0.2,
                }}
              >
                PRO
              </span>
            </div>
            {!isMobile && (
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, marginTop: 2 }}>
                2026 秋季学期
              </span>
            )}
          </div>
        )}
      </div>
    </Tooltip>
  );
}
