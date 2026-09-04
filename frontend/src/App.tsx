import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import Today from "./pages/Today";
import QuickNote from "./pages/QuickNote";
import Roster from "./pages/Roster";
import Scores from "./pages/Scores";
import Summary from "./pages/Summary";
import Report from "./pages/Report";
import Schedule from "./pages/Schedule";
import Seating from "./pages/Seating";
import Todos from "./pages/Todos";
import Attendance from "./pages/Attendance";
import Duties from "./pages/Duties";
import Comms from "./pages/Comms";
import Vault from "./pages/Vault";
import Sync from "./pages/Sync";
import Settings from "./pages/Settings";
import { ReloadPrompt } from "./components/ReloadPrompt";
import { NotificationScheduler } from "./components/NotificationScheduler";

export default function App() {
  return (
    <>
      <ReloadPrompt />
      <NotificationScheduler />
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
    </>
  );
}
