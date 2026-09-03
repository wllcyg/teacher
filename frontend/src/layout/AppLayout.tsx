import { useState } from "react";
import { Layout, Menu, Grid, Drawer, Tag } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { NAV_GROUPS, ALL_ITEMS } from "../nav";
import AppLogo from "../components/AppLogo";
import { getSettings } from "../api";
import { useAppStore } from "../store/app";

const { Sider, Content, Header } = Layout;

// 移动端底部固定展示的入口，其余收进「更多」抽屉
const MOBILE_TABS = ["/today", "/quicknote", "/scores", "/report"];

function currentPageLabel(pathname: string): string {
  const key = pathname === "/" ? "/today" : pathname;
  return ALL_ITEMS.find((it) => it.key === key)?.label ?? "教师工作台";
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

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
    navigate(key);
    setMoreOpen(false);
  };

  if (isMobile) {
    const tabItems = NAV_GROUPS.flatMap((g) => g.items).filter((it) =>
      MOBILE_TABS.includes(it.key)
    );
    const moreActive = !MOBILE_TABS.includes(selectedKey);

    return (
      <Layout style={{ minHeight: "100vh" }}>
        <Header
          className="app-header"
          style={{
            background: "#fff",
            padding: "0 12px",
            height: 48,
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
        <Content style={{ background: "transparent" }}>
          <Outlet />
        </Content>

        {/* 更多功能抽屉 */}
        <Drawer
          title="全部功能"
          placement="bottom"
          height="70vh"
          open={moreOpen}
          onClose={() => setMoreOpen(false)}
          bodyStyle={{ padding: "8px 4px", overflowY: "auto" }}
        >
          {NAV_GROUPS.map((g) => (
            <div key={g.title} style={{ marginBottom: 8 }}>
              <div style={{ color: "#999", fontSize: 12, padding: "8px 12px 4px" }}>{g.title}</div>
              {g.items.map((it) => (
                <div
                  key={it.key}
                  onClick={() => go(it.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px",
                    borderRadius: 8,
                    background: selectedKey === it.key ? "#f0f5ff" : "transparent",
                    color: selectedKey === it.key ? "#2f6fed" : "#333",
                    fontSize: 15,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{it.icon}</span>
                  {it.label}
                </div>
              ))}
            </div>
          ))}
        </Drawer>

        {/* 底部 Tab 栏 */}
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
              }}
            >
              <div style={{ fontSize: 20 }}>{it.icon}</div>
              <div>{it.label}</div>
            </div>
          ))}
          <div
            onClick={() => setMoreOpen(true)}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "8px 0 6px",
              fontSize: 11,
              color: moreActive ? "#2f6fed" : "#666",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 20 }}>
              <MoreOutlined />
            </div>
            <div>更多</div>
          </div>
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
        <Content style={{ padding: 20, background: "transparent", overflow: "auto", minHeight: "100vh" }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
