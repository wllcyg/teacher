import { useState, useRef } from "react";
import { Layout, Menu, Tag } from "antd";
import { useLocation, useNavigate, useOutlet, Outlet } from "react-router-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { NAV_GROUPS, ALL_ITEMS } from "../nav";
import AppLogo from "../components/AppLogo";
import { getSettings } from "../api";
import { useAppStore } from "../store/app";
import { useIsMobileOrTablet } from "../hooks";
import { triggerHaptic } from "../utils/haptics";
import { OfflineBanner } from "../components/OfflineBanner";
import { ErrorBoundary } from "../components/ErrorBoundary";

const { Sider, Content, Header } = Layout;

// 移动端底部固定展示的 5 个一级入口
const MOBILE_TABS = ["/today", "/quicknote", "/todos", "/roster", "/more"];

function currentPageLabel(pathname: string): string {
  const key = pathname === "/" ? "/today" : pathname;
  return ALL_ITEMS.find((it) => it.key === key)?.label ?? "教师工作台";
}

// Framer Motion 移动端进出场过渡配置
const pageVariants: Variants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir === 0 ? 0 : dir > 0 ? 20 : -20,
  }),
  animate: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.16,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir === 0 ? 0 : dir > 0 ? -16 : 16,
    transition: {
      duration: 0.12,
      ease: "easeOut",
    },
  }),
};

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const outlet = useOutlet();
  const isMobile = useIsMobileOrTablet();

  // 移动端 Tab 左右滑动动效方向判定 (1: 前进, -1: 后退, 0: 同级/其他)
  const prevPathRef = useRef(location.pathname);
  const [direction, setDirection] = useState<number>(0);

  if (prevPathRef.current !== location.pathname) {
    const prevKey = prevPathRef.current === "/" ? "/today" : prevPathRef.current;
    const currentKey = location.pathname === "/" ? "/today" : location.pathname;
    const prevIdx = MOBILE_TABS.indexOf(prevKey);
    const currIdx = MOBILE_TABS.indexOf(currentKey);

    let nextDir = 0;
    if (prevIdx !== -1 && currIdx !== -1 && prevIdx !== currIdx) {
      nextDir = currIdx > prevIdx ? 1 : -1;
    }
    prevPathRef.current = location.pathname;
    setDirection(nextDir);
  }

  // 跨端同步：启动时从 SQLite 数据库拉取全局配置（称呼/学期/作息）
  const set称呼 = useAppStore((s) => s.set称呼);
  const set学期 = useAppStore((s) => s.set学期);
  const setPeriods = useAppStore((s) => s.setPeriods);

  useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const data = await getSettings();
      if (data.称呼) set称呼(data.称呼);
      if (data.学期 !== undefined) set学期(data.学期);
      if (data.periods && Array.isArray(data.periods) && data.periods.length > 0) {
        setPeriods(data.periods);
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const selectedKey = location.pathname === "/" ? "/today" : location.pathname;

  const menuItems = NAV_GROUPS.map((g) => ({
    key: g.title,
    label: g.title,
    type: "group" as const,
    children: g.items.map((it) => ({ key: it.key, label: it.label, icon: it.icon })),
  }));

  const go = (key: string) => {
    triggerHaptic("light");
    navigate(key);
  };

  if (isMobile) {
    const tabItems = MOBILE_TABS.map((key) =>
      ALL_ITEMS.find((it) => it.key === key)
    ).filter((it): it is (typeof ALL_ITEMS)[number] => Boolean(it));

    return (
      <Layout style={{ minHeight: "100vh" }}>
        <OfflineBanner />
        <Header
          className="app-header"
          style={{
            background: "#fff",
            padding: "0 12px",
            paddingTop: "env(safe-area-inset-top, 0px)",
            height: "calc(48px + env(safe-area-inset-top, 0px))",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
            position: "sticky",
            top: 0,
            zIndex: 90,
          }}
        >
          <AppLogo isMobile />
          <Tag color="blue" style={{ margin: 0, fontWeight: 500 }}>
            {currentPageLabel(location.pathname)}
          </Tag>
        </Header>

        <Content
          style={{
            background: "transparent",
            overflowX: "hidden",
            minHeight: "calc(100vh - 48px - 60px)",
            paddingBottom: "calc(76px + env(safe-area-inset-bottom, 16px))",
            boxSizing: "border-box",
          }}
        >
          <ErrorBoundary>
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              {outlet && (
                <motion.div
                  key={location.pathname}
                  custom={direction}
                  variants={pageVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  style={{
                    width: "100%",
                    minHeight: "100%",
                  }}
                >
                  {outlet}
                </motion.div>
              )}
            </AnimatePresence>
          </ErrorBoundary>
        </Content>

        {/* 底部 Tab 栏（5个等分一级入口） */}
        <div
          className="app-bottom-bar"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            background: "#fff",
            borderTop: "1px solid #eee",
            display: "flex",
            zIndex: 100,
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {tabItems.map((it) => (
            <div
              key={it.key}
              onClick={() => go(it.key)}
              style={{
                flex: 1,
                textAlign: "center",
                padding: "8px 0 6px",
                fontSize: 11,
                color: selectedKey === it.key ? "#2f6fed" : "#666",
                cursor: "pointer",
                transition: "color 0.15s ease",
              }}
            >
              <div style={{ fontSize: 20 }}>{it.icon}</div>
              <div style={{ fontWeight: selectedKey === it.key ? 600 : 400 }}>{it.label}</div>
            </div>
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={200} theme="light">
        <div style={{ borderBottom: "1px solid #f1f5f9", marginBottom: 4 }}>
          <AppLogo collapsed={collapsed} />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <OfflineBanner />
        <Content style={{ padding: 20, background: "transparent", overflow: "auto", minHeight: "100vh" }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </Content>
      </Layout>
    </Layout>
  );
}
