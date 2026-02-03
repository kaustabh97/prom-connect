import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, User } from "lucide-react";

const navItems = [
  { path: "/discover/profile", label: "Discover", icon: Compass },
  { path: "/matches", label: "Matches", icon: Users },
  { path: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/discover/profile")
      return location.pathname === "/discover/profile" || location.pathname.startsWith("/discover/profile/");
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/30 bg-black/40 backdrop-blur-md safe-area-pb">
      <div className="max-w-[500px] mx-auto flex items-center justify-around h-16 px-2">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
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
  );
}
