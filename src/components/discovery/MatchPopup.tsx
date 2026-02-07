import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logInfo } from "@/utils/logger";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle } from "lucide-react";
import type { DiscoveryProfileFull } from "@/lib/dating";

interface MatchPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchedProfile: DiscoveryProfileFull | null;
  matchId?: string | null;
  onKeepSwiping?: () => void;
  onOpenChat?: () => void;
}

export function MatchPopup({
  open,
  onOpenChange,
  matchedProfile,
  matchId,
  onKeepSwiping,
  onOpenChat,
}: MatchPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card">
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50">
              <Heart className="w-8 h-8 fill-primary text-primary" />
            </div>
          </div>
          <DialogTitle className="font-display text-2xl font-bold text-primary">
            It's a match!
          </DialogTitle>
          {matchedProfile && (
            <p className="text-muted-foreground mt-2">
              You and {matchedProfile.name} liked each other.
            </p>
          )}
        </DialogHeader>
        {matchedProfile && (
          <div className="flex justify-center my-4">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 shrink-0">
              {matchedProfile.photoUrls?.[0] ? (
                <img
                  src={matchedProfile.photoUrls[0]}
                  alt={matchedProfile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <span className="text-2xl font-display text-primary/60">
                    {matchedProfile.name.charAt(0)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="default"
            className="bg-primary hover:bg-primary/90"
            onClick={() => {
              logInfo("MatchPopup: Open Chat clicked", { component: "MatchPopup", operation: "openChat", extra: { matchId } });
              onOpenChange(false);
              onOpenChat?.();
            }}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Open Chat
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              logInfo("MatchPopup: Keep Swiping clicked", { component: "MatchPopup", operation: "keepSwiping", extra: { matchId } });
              onOpenChange(false);
              onKeepSwiping?.();
            }}
          >
            Keep Swiping
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
