import { Outlet } from "react-router-dom";
import BottomNav from "@/components/BottomNav";

/**
 * Layout for main app screens: content + persistent bottom nav only.
 */
export default function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col content-above-nav">
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
