import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

/**
 * Layout for main app screens: content + persistent bottom nav only.
 */
export default function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col content-above-nav w-full h-dvh max-h-dvh overflow-hidden">
      <main className="flex-1 min-h-0 w-full min-w-0 overflow-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
