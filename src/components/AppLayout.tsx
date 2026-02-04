import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

/**
 * Layout for main app screens: content + persistent bottom nav only.
 */
export default function AppLayout() {
  const location = useLocation();
  const isPromDate = location.pathname === "/prom-date";

  return (
    <div className={`min-h-dvh flex flex-col w-full h-dvh max-h-dvh overflow-hidden ${isPromDate ? "" : "content-above-nav"}`}>
      <main id="app-main" className={`flex-1 min-h-0 w-full min-w-0 overflow-x-hidden ${isPromDate ? "overflow-hidden" : "overflow-auto"}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
