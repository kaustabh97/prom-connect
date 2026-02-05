import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { getPromDateRedirectPath } from "@/lib/promDateRedirect";

/**
 * When user has a prom date (IIMA match or outside partner), redirect from discover/matches/profile to prom-date.
 */
function PromDateGate() {
  const location = useLocation();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const isOnPromDatePage = location.pathname === "/prom-date";
  const shouldCheck =
    !isOnPromDatePage &&
    ["/discover", "/matches", "/profile", "/matchmaking-soon"].some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/")
    );

  useEffect(() => {
    if (!shouldCheck) {
      setChecked(true);
      return;
    }
    let cancelled = false;
    getPromDateRedirectPath().then((path) => {
      if (!cancelled && path) setRedirectPath(path);
      if (!cancelled) setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [shouldCheck, location.pathname]);

  if (shouldCheck && checked && redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }
  return <Outlet />;
}

/**
 * Layout for main app screens: content + persistent bottom nav only.
 */
export default function AppLayout() {
  const location = useLocation();
  const isPromDate = location.pathname === "/prom-date";

  return (
    <div className={`min-h-dvh flex flex-col w-full h-dvh max-h-dvh overflow-hidden ${isPromDate ? "" : "content-above-nav"}`}>
      <main id="app-main" className={`flex-1 min-h-0 w-full min-w-0 overflow-x-hidden ${isPromDate ? "overflow-hidden" : "overflow-auto"}`}>
        <PromDateGate />
      </main>
      <BottomNav />
    </div>
  );
}
