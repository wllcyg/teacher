import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Spin } from "antd";
import AppLayout from "./layout/AppLayout";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { NotificationScheduler } from "./components/NotificationScheduler";
import { useAuthStore } from "./store/auth";

const Login = lazy(() => import("./pages/Login"));
const Today = lazy(() => import("./pages/Today"));
const QuickNote = lazy(() => import("./pages/QuickNote"));
const Roster = lazy(() => import("./pages/Roster"));
const Scores = lazy(() => import("./pages/Scores"));
const Summary = lazy(() => import("./pages/Summary"));
const Report = lazy(() => import("./pages/Report"));
const Schedule = lazy(() => import("./pages/Schedule"));
const LessonLogs = lazy(() => import("./pages/LessonLogs"));
const Seating = lazy(() => import("./pages/Seating"));
const Todos = lazy(() => import("./pages/Todos"));
const Attendance = lazy(() => import("./pages/Attendance"));
const Duties = lazy(() => import("./pages/Duties"));
const Comms = lazy(() => import("./pages/Comms"));
const Vault = lazy(() => import("./pages/Vault"));
const Sync = lazy(() => import("./pages/Sync"));
const Settings = lazy(() => import("./pages/Settings"));

function PageSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
      }}
    >
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  const token = useAuthStore((s) => s.token);

  // 未登录时只渲染全屏密码页，不渲染任何业务路由/发起任何业务请求；
  // Login 也懒加载，避免它的 antd 依赖被打包进主 chunk
  if (!token) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <Login />
      </Suspense>
    );
  }

  return (
    <>
      <ReloadPrompt />
      <NotificationScheduler />
      <Suspense fallback={<PageSkeleton />}>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/quicknote" element={<QuickNote />} />
            <Route path="/roster" element={<Roster />} />
            <Route path="/scores" element={<Scores />} />
            <Route path="/summary" element={<Summary />} />
            <Route path="/report" element={<Report />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/lesson-logs" element={<LessonLogs />} />
            <Route path="/seating" element={<Seating />} />
            <Route path="/todos" element={<Todos />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/duties" element={<Duties />} />
            <Route path="/comms" element={<Comms />} />
            <Route path="/vault" element={<Vault />} />
            <Route path="/sync" element={<Sync />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Routes>
      </Suspense>
    </>
  );
}
