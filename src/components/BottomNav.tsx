import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, User } from "lucide-react";
import { getUserProfile } from "@/utils/auth";
import { usePromDate } from "@/hooks/usePromDate";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";

const discoverNavItems = [
  { path: "/discover/profile", label: "Discover", icon: Compass },
  { path: "/matches", label: "Matches", icon: Users },
];

const client = generateClient<Schema>();

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const { promDate } = usePromDate({ currentUserId });

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
      setCurrentUserId(data?.[0]?.id ?? "");
    };
    load();
  }, []);

  const hasPromDate = !!promDate;
  const isOnPromDatePage = location.pathname === "/prom-date";
  // Prom Date is a dead-end page – hide nav when on it or when matched (prevents nav after chat)
  if (hasPromDate || isOnPromDatePage) return null;

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
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path, { state: { refresh: true } })}
              className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors min-w-0 ${
                isActive(item.path)
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="w-6 h-6" />
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
