import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/BottomNav";
import { getPromDateRedirectPath } from "@/lib/promDateRedirect";

const PROM_DATE_CHECK_ROUTES = ["/discover", "/matches", "/profile", "/matchmaking-soon"];

/**
 * When user has a prom date (IIMA match or outside partner), redirect from discover/matches/profile to prom-date.
 */
function PromDateGate({
  onCheckingChange,
}: {
  onCheckingChange: (checking: boolean) => void;
}) {
  const location = useLocation();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const isOnPromDatePage = location.pathname === "/prom-date";
  const isMatchesWithChat =
    location.pathname === "/matches" &&
    new URLSearchParams(location.search).get("matchId");
  const shouldCheck =
    !isOnPromDatePage &&
    !isMatchesWithChat &&
    PROM_DATE_CHECK_ROUTES.some(
      (p) => location.pathname === p || location.pathname.startsWith(p + "/")
    );

  useEffect(() => {
    onCheckingChange(shouldCheck && !checked);
  }, [shouldCheck, checked, onCheckingChange]);

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
  const isRequestPending = location.pathname === "/request-pending";
  const isChatFromPromDate =
    location.pathname === "/matches" &&
    new URLSearchParams(location.search).get("matchId") &&
    (location.state as { fromPromDate?: boolean } | null)?.fromPromDate;
  const hideNavForPage = isPromDate || isRequestPending || !!isChatFromPromDate;
  const [isCheckingPromDateRedirect, setIsCheckingPromDateRedirect] = useState(false);

  return (
    <div className={`min-h-dvh flex flex-col w-full h-dvh max-h-dvh overflow-hidden ${hideNavForPage ? "" : "content-above-nav"}`}>
      <main id="app-main" className={`flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-auto`}>
        <PromDateGate onCheckingChange={setIsCheckingPromDateRedirect} />
      </main>
      <BottomNav hideNav={isCheckingPromDateRedirect || hideNavForPage} />
    </div>
  );
}
