import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, User } from "lucide-react";
import { getUserProfile } from "@/utils/auth";
import { usePromDate } from "@/hooks/usePromDate";
import { useMatchRequests } from "@/hooks/useMatchRequests";
import { usePromAsk } from "@/hooks/usePromAsk";
import { useMatches } from "@/hooks/useMatches";
import { useViewedMatches } from "@/hooks/useViewedMatches";
import { BADGE_REFRESH_EVENT } from "@/utils/badgeRefresh";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK, MATCHMAKING_ENABLED } from "@/config";

const discoverNavItems = [
  { path: "/discover/profile", label: "Discover", icon: Compass },
  { path: "/matches", label: "Matches", icon: Users, badgeKey: "matches" },
];

const matchmakingSoonNavItems = [
  { path: "/matchmaking-soon", label: "Coming soon", icon: Compass },
];

const client = generateClient<Schema>();

interface BottomNavProps {
  hideNav?: boolean; // e.g. while checking if user has prom date (to avoid flash on refresh)
}

export default function BottomNav({ hideNav = false }: BottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserEmail, setCurrentUserEmail] = useState<string>("");
  const { promDate } = usePromDate({ currentUserId });
  const { pendingRequests, refresh: refreshRequests } = useMatchRequests({ currentUserId, currentUserEmail });
  const { pendingToMe: promAskToMe, refresh: refreshPromAsk } = usePromAsk({ currentUserId });
  const { matches, refresh: refreshMatches } = useMatches({ currentUserId, currentUserEmail });
  const { viewedMatchIds } = useViewedMatches(currentUserId);

  // Refresh badge when Prom Ask or partner request is accepted/declined
  useEffect(() => {
    const handler = () => {
      refreshMatches();
      refreshRequests();
      refreshPromAsk();
    };
    window.addEventListener(BADGE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(BADGE_REFRESH_EVENT, handler);
  }, [refreshMatches, refreshRequests, refreshPromAsk]);

  // Badge: prom requests (Prom Ask + partner requests) + new matches (chat not yet opened)
  const unviewedMatchCount = matches.filter((m) => m.id && !viewedMatchIds.has(m.id)).length;
  const matchesBadgeCount =
    (pendingRequests?.length ?? 0) + (promAskToMe?.length ?? 0) + unviewedMatchCount;

  useEffect(() => {
    const load = async () => {
      const p = await getUserProfile();
      if (!p?.email) return;
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;
      const { data } = await client.models.UserProfile.list(
        { filter: { email: { eq: p.email } } },
        opts
      );
      const profile = data?.[0];
      setCurrentUserId(profile?.id ?? "");
      setCurrentUserEmail(profile?.email ?? p.email ?? "");
    };
    load();
  }, []);

  const hasPromDate = !!promDate;
  const isOnPromDatePage = location.pathname === "/prom-date";
  // Prom Date is a dead-end page – hide nav when on it, when matched, or while checking redirect
  if (hideNav || hasPromDate || isOnPromDatePage) return null;

  const navItems = MATCHMAKING_ENABLED
    ? [...discoverNavItems, { path: "/profile", label: "Profile", icon: User }]
    : [...matchmakingSoonNavItems, { path: "/profile", label: "Profile", icon: User }];

  const isActive = (path: string) => {
    if (path === "/discover/profile")
      return location.pathname === "/discover/profile" || location.pathname.startsWith("/discover/profile/");
    if (path === "/matchmaking-soon")
      return location.pathname === "/matchmaking-soon";
    if (path === "/prom-date")
      return location.pathname === "/prom-date";
    if (path === "/profile")
      return location.pathname === "/profile";
    return location.pathname === path;
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/20 bg-transparent safe-area-pb">
        <div className="max-w-[500px] mx-auto flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const badgeCount =
              "badgeKey" in item && item.badgeKey === "matches"
                ? matchesBadgeCount
                : 0;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path, { state: { refresh: true } })}
                className={`relative flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors min-w-0 ${
                  isActive(item.path)
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="relative inline-block">
                  <item.icon className="w-6 h-6" />
                  {badgeCount > 0 && (
                    <span
                      className={`absolute -top-2 -right-2 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground ${
                        badgeCount > 9 ? "px-1.5" : ""
                      }`}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </span>
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
