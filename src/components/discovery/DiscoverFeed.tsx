import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SwipeCard from "./SwipeCard";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { Heart, X, Filter } from "lucide-react";

interface DiscoverFeedProps {
  profiles: DiscoveryProfileFull[];
  onSwipe: (profileId: string, action: "like" | "pass") => void;
  onOpenFilters: () => void;
}

export default function DiscoverFeed({
  profiles,
  onSwipe,
  onOpenFilters,
}: DiscoverFeedProps) {
  const currentProfile = profiles[0] ?? null;

  const handleSwipe = useCallback(
    (action: "like" | "pass") => {
      if (!currentProfile) return;
      console.log("[DiscoverFeed] Button clicked:", {
        action,
        profileId: currentProfile.id,
        profileName: currentProfile.name,
      });
      // Immediately remove profile from queue
      onSwipe(currentProfile.id, action);
    },
    [currentProfile, onSwipe]
  );

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-12 px-4">
        <p className="text-muted-foreground text-center">
          No more profiles right now. Try adjusting your filters.
        </p>
        <Button variant="outline" className="mt-4" onClick={onOpenFilters}>
          <Filter className="w-8 h-4 mr-2" />
          Filters
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Card display */}
      <div className="relative min-h-[400px] mx-2">
        {/* Current profile card with fade transition */}
        <AnimatePresence mode="wait">
          {currentProfile && (
            <motion.div
              key={currentProfile.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full"
            >
              <SwipeCard profile={currentProfile} isTop />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Like / Pass buttons */}
      <div className="flex items-center justify-center gap-6 py-4 px-4">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-2 border-muted-foreground/50 hover:border-red-500 hover:bg-red-500/10"
          onClick={() => handleSwipe("pass")}
          disabled={!currentProfile}
        >
          <X className="w-7 h-7 text-muted-foreground" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
          onClick={() => handleSwipe("like")}
          disabled={!currentProfile}
        >
          <Heart className="w-7 h-7 fill-primary-foreground text-primary-foreground" />
        </Button>
      </div>
    </div>
  );
}
