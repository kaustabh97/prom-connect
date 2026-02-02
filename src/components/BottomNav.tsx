import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Users, User, LogOut } from "lucide-react";
import { signOut } from "aws-amplify/auth";
import { getUserProfile, type UserProfile } from "@/utils/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isActive = (path: string) => {
    if (path === "/discover/profile")
      return location.pathname === "/discover/profile" || location.pathname.startsWith("/discover/profile/");
    return location.pathname === path;
  };

  useEffect(() => {
    if (profileOpen) {
      getUserProfile().then(setUserProfile);
    }
  }, [profileOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
      setProfileOpen(false);
      navigate("/auth");
    } catch (error) {
      console.error("Error signing out:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-lg safe-area-pb">
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
            <SheetTitle className="font-display">Profile</SheetTitle>
            <SheetDescription>Your account and settings</SheetDescription>
          </SheetHeader>
          <div className="py-6 space-y-6">
            {/* User profile card */}
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-primary/20">
                <AvatarImage src={userProfile?.picture} alt={userProfile?.name} />
                <AvatarFallback className="bg-primary/20 text-primary text-xl font-display">
                  {userProfile?.name?.charAt(0) ?? userProfile?.email?.charAt(0) ?? "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-display font-semibold text-lg truncate">
                  {userProfile?.name ?? "User"}
                </p>
                <p className="text-sm text-muted-foreground truncate">
                  {userProfile?.email ?? userProfile?.username ?? "—"}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2 text-muted-foreground hover:text-destructive hover:border-destructive"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  Log out
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
