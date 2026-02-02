import { useCallback, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SwipeCard, { type SwipeCardHandle } from "./SwipeCard";
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
  const topCardRef = useRef<SwipeCardHandle>(null);
  const topProfile = profiles[0] ?? null;
  const nextProfile = profiles[1] ?? null;

  const handleSwipe = useCallback(
    (action: "like" | "pass") => {
      if (!topProfile) return;
      topCardRef.current?.triggerSwipe(action);
    },
    [topProfile]
  );

  const onSwipeCallback = useCallback(
    (action: "like" | "pass") => {
      if (topProfile) onSwipe(topProfile.id, action);
    },
    [topProfile, onSwipe]
  );

  if (profiles.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center flex-1 py-12 px-4"
      >
        <p className="text-muted-foreground text-center">
          No more profiles right now. Try adjusting your filters.
        </p>
        <Button variant="outline" className="mt-4" onClick={onOpenFilters}>
          <Filter className="w-8 h-4 mr-2" />
          Filters
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Card stack: height from top card (in flow); next card absolute behind */}
      <div className="relative min-h-[400px] mx-2">
        {nextProfile && (
          <motion.div
            initial={false}
            className="absolute inset-0 top-2 left-2 right-2 bottom-2 rounded-2xl overflow-hidden bg-card border border-border opacity-90 scale-95"
            style={{ zIndex: 0 }}
          >
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              {nextProfile.photoUrls?.[0] ? (
                <img
                  src={nextProfile.photoUrls[0]}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className="text-2xl font-display text-primary/40">
                  {nextProfile.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white bg-gradient-to-t from-black/60 to-transparent">
              <p className="font-semibold text-sm">
                {nextProfile.name}, {nextProfile.age}
              </p>
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          {topProfile && (
            <motion.div
              key={topProfile.id}
              initial={false}
              className="relative w-full"
              style={{ zIndex: 1 }}
            >
              <SwipeCard
                ref={topCardRef}
                profile={topProfile}
                onSwipe={onSwipeCallback}
                isTop
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-center gap-6 py-4 px-4">
        <Button
          variant="outline"
          size="icon"
          className="h-14 w-14 rounded-full border-2 border-muted-foreground/50 hover:border-red-500 hover:bg-red-500/10"
          onClick={() => handleSwipe("pass")}
          disabled={!topProfile}
        >
          <X className="w-7 h-7 text-muted-foreground" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
          onClick={() => handleSwipe("like")}
          disabled={!topProfile}
        >
          <Heart className="w-7 h-7 fill-primary-foreground text-primary-foreground" />
        </Button>
      </div>
    </div>
  );
}
