import { useState, useEffect, useMemo } from "react";
import SparkleBackground from "@/components/SparkleBackground";
import DiscoverFeed from "@/components/discovery/DiscoverFeed";
import FiltersModal from "@/components/discovery/FiltersModal";
import { useFilters } from "@/hooks/useFilters";
import { useMatch } from "@/hooks/useMatch";
import { useScrollWheel } from "@/hooks/useScrollWheel";
import {
  MOCK_DISCOVERY_PROFILES_FULL,
  applyFilters,
  type DiscoveryProfileFull,
} from "@/lib/dating";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

export default function Discover() {
  const [profiles, setProfiles] = useState<DiscoveryProfileFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { filters, setFilters } = useFilters();
  const { recordSwipe, hasPassed, hasLiked } = useMatch();
  const scrollRef = useScrollWheel();

  // Load and filter profiles (deterministic per session)
  useEffect(() => {
    setLoading(true);
    const filtered = applyFilters(MOCK_DISCOVERY_PROFILES_FULL, filters);
    setProfiles(filtered);
    setLoading(false);
  }, [filters]);

  // Queue: exclude already passed/liked so we don't show them again
  const displayQueue = useMemo(
    () =>
      profiles.filter(
        (p) => !hasPassed(p.id) && !hasLiked(p.id)
      ),
    [profiles, hasPassed, hasLiked]
  );

  const handleSwipe = (profileId: string, action: "like" | "pass") => {
    recordSwipe(profileId, action);
  };

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-[500px] mx-auto w-full">
        {/* Single full-page scroll: header + feed (card + buttons) */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col scroll-touch outline-none pb-4"
          tabIndex={0}
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
            <h1 className="font-display text-xl font-bold text-foreground">
              Discover
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setFiltersOpen(true)}
              className="text-muted-foreground"
            >
              <Filter className="w-5 h-5" />
            </Button>
          </header>

          {/* Content - card and buttons scroll together */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <DiscoverFeed
            profiles={displayQueue}
            onSwipe={handleSwipe}
            onOpenFilters={() => setFiltersOpen(true)}
          />
          )}
        </div>
      </div>

      <FiltersModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onSave={setFilters}
      />
    </div>
  );
}
