import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import SwipeCard from "./SwipeCard";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DiscoverFeedProps {
  profiles: DiscoveryProfileFull[];
  onSwipe: (profileId: string, action: "like" | "pass") => void;
  onOpenFilters: () => void;
  onProfileChange?: (profileId: string) => void;
  scrollToTop?: () => void;
}

export default function DiscoverFeed({
  profiles,
  onSwipe,
  onOpenFilters,
  onProfileChange,
  scrollToTop,
}: DiscoverFeedProps) {
  const currentProfile = profiles[0] ?? null;
  
  // Notify parent when profile changes (for scroll-to-top)
  useEffect(() => {
    if (currentProfile?.id && onProfileChange) {
      onProfileChange(currentProfile.id);
    }
  }, [currentProfile?.id, onProfileChange]);

  const handleSwipe = useCallback(
    (action: "like" | "pass") => {
      if (!currentProfile) return;
      console.log("[DiscoverFeed] Button clicked:", {
        action,
        profileId: currentProfile.id,
        profileName: currentProfile.name,
      });
      // Scroll to top immediately when button is clicked (before profile changes)
      // This ensures we're at the top when the new profile appears
      if (scrollToTop) {
        scrollToTop();
      }
      // Immediately remove profile from queue
      onSwipe(currentProfile.id, action);
    },
    [currentProfile, onSwipe, scrollToTop]
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
    <div className="flex flex-col flex-1 min-h-0 px-2 py-2">
      {/* Full-screen card display */}
      <div className="relative flex-1 min-h-0">
        {/* Current profile card with fade transition */}
        <AnimatePresence mode="wait">
          {currentProfile && (
            <motion.div
              key={currentProfile.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="relative w-full h-full"
            >
              <SwipeCard profile={currentProfile} isTop />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
