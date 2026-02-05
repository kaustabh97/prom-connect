import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import Discover from "./pages/Discover";
import FullProfileView from "./pages/FullProfileView";
import Matches from "./pages/Matches";
import TestChat from "./pages/TestChat";
import Profile from "./pages/Profile";
import PromDate from "./pages/PromDate";
import RequestPending from "./pages/RequestPending";
import MatchmakingComingSoon from "./pages/MatchmakingComingSoon";
import NotFound from "./pages/NotFound";
import { MATCHMAKING_ENABLED } from "@/config";

import { useEffect } from "react";
import { Amplify } from "aws-amplify";
import outputs from "../amplify_outputs.json";
import { captureInviteFromUrl } from "@/utils/invite";
import "@aws-amplify/ui-react/styles.css";

try {
  Amplify.configure(outputs);
} catch (e) {
  console.error("[App] Amplify configure failed:", e);
}

/** Captures ?invite=email from URL on load and route changes */
function InviteCapture() {
  const location = useLocation();
  useEffect(() => {
    captureInviteFromUrl();
  }, [location.search]);
  return null;
}

/** Redirects /couple-complete to /prom-date, preserving partnerName and adding outside=1 */
function CoupleCompleteRedirect() {
  const [searchParams] = useSearchParams();
  const partnerName = searchParams.get("partnerName");
  const search = partnerName
    ? `?partnerName=${encodeURIComponent(partnerName)}&outside=1`
    : "?outside=1";
  return <Navigate to={`/prom-date${search}`} replace />;
}

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <InviteCapture />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/couple-complete" element={<CoupleCompleteRedirect />} />
          <Route element={<AppLayout />}>
            <Route path="/discover" element={<Navigate to={MATCHMAKING_ENABLED ? "/discover/profile" : "/matchmaking-soon"} replace />} />
            <Route path="/discover/profile" element={MATCHMAKING_ENABLED ? <Discover /> : <Navigate to="/matchmaking-soon" replace />} />
            <Route path="/discover/profile/:profileId" element={MATCHMAKING_ENABLED ? <FullProfileView /> : <Navigate to="/matchmaking-soon" replace />} />
            <Route path="/matches" element={MATCHMAKING_ENABLED ? <Matches /> : <Navigate to="/matchmaking-soon" replace />} />
            <Route path="/matchmaking-soon" element={<MatchmakingComingSoon />} />
            <Route path="/prom-date" element={<PromDate />} />
            <Route path="/request-pending" element={<RequestPending />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
          <Route path="/test-chat" element={<TestChat />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
