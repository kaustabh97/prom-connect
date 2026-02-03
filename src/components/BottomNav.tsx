import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, User, LogOut } from "lucide-react";
import { signOut } from "aws-amplify/auth";
import { Button } from "@/components/ui/button";
import { clearTestUser } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

const navItems = [
  { path: "/discover/profile", label: "Discover", icon: Compass },
  { path: "/matches", label: "Matches", icon: Users },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isActive = (path: string) => {
    if (path === "/discover/profile")
      return location.pathname === "/discover/profile" || location.pathname.startsWith("/discover/profile/");
    return location.pathname === path;
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (GOOGLE_LOGIN_CHECK) {
        // Normal logout: use Amplify signOut
        await signOut();
      } else {
        // Test mode: clear test user from localStorage
        clearTestUser();
      }
      setProfileOpen(false);
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still clear test user and navigate even if signOut fails
      if (!GOOGLE_LOGIN_CHECK) {
        clearTestUser();
      }
      setProfileOpen(false);
      navigate("/auth");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
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
          <button
            onClick={() => setProfileOpen(true)}
            className="flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-lg transition-colors min-w-0 text-muted-foreground hover:text-foreground"
          >
            <User className="w-6 h-6" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>

      <Sheet open={profileOpen} onOpenChange={setProfileOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl safe-area-pb">
          <SheetHeader className="text-left pb-4 border-b border-border/50">
            <SheetTitle className="font-display">Menu</SheetTitle>
            <SheetDescription>Your account options</SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-3">
            {/* Profile button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4 px-4"
              onClick={() => {
                setProfileOpen(false);
                navigate("/profile");
              }}
            >
              <User className="w-5 h-5" />
              <span className="font-medium">Profile</span>
            </Button>

            {/* Logout button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4 px-4 text-muted-foreground hover:text-destructive hover:border-destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span className="font-medium">Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Logout</span>
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
