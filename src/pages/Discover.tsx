import { useState, useEffect, useMemo, useCallback } from "react";
import SparkleBackground from "@/components/SparkleBackground";
import DiscoverFeed from "@/components/discovery/DiscoverFeed";
import FiltersModal from "@/components/discovery/FiltersModal";
import { useFilters } from "@/hooks/useFilters";
import { useMatch } from "@/hooks/useMatch";
import { useScrollWheel } from "@/hooks/useScrollWheel";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK } from "@/config";

import {
  applyFilters,
  type DiscoveryProfileFull,
  getProfilePhotoUrl,
} from "@/lib/dating";
import { Button } from "@/components/ui/button";
import { Filter, Heart, X } from "lucide-react";

const client = generateClient<Schema>();


/**
 * Transform backend UserProfile to DiscoveryProfileFull format
 */
function transformBackendProfile(backendProfile: Schema["UserProfile"]["type"]): DiscoveryProfileFull {
  // Build photo URLs from profilePicKey (if available)
  const photoUrls: string[] = [];
  if (backendProfile.profilePicKey) {
    // If profilePicKey exists, you might want to construct S3 URL here
    // For now, using placeholder approach
    photoUrls.push(getProfilePhotoUrl(backendProfile.id || "default"));
  } else {
    // Use profile ID to get placeholder photo
    photoUrls.push(getProfilePhotoUrl(backendProfile.id || "default"));
  }

  // Build non-negotiables from lifestyle preferences
  const nonNegotiables: string[] = [];
  if (backendProfile.smokingPreference === "Never") {
    nonNegotiables.push("Non-smoking");
  } else if (backendProfile.smokingPreference === "Sometimes" || backendProfile.smokingPreference === "Regularly") {
    nonNegotiables.push("Smoking okay");
  }
  
  if (backendProfile.alcoholPreference === "Never") {
    nonNegotiables.push("No alcohol");
  } else if (backendProfile.alcoholPreference === "Sometimes" || backendProfile.alcoholPreference === "Regularly") {
    nonNegotiables.push("Alcohol okay");
  }
  
  if (backendProfile.intention === "Date for Prom") {
    nonNegotiables.push("Serious intent");
  } else if (backendProfile.intention === "Not Sure") {
    nonNegotiables.push("Casual / open");
  }
  
  if (backendProfile.foodPreference === "Veg") {
    nonNegotiables.push("Veg only");
  } else {
    nonNegotiables.push("No dietary preference");
  }

  return {
    id: backendProfile.id || "",
    name: backendProfile.name || "Anonymous",
    age: backendProfile.age || 0,
    gender: backendProfile.gender || "",
    bio: backendProfile.bio || "",
    tags: backendProfile.tags || [],
    photoUrls,
    alcoholPreference: backendProfile.alcoholPreference || undefined,
    smokingPreference: backendProfile.smokingPreference || undefined,
    foodPreference: backendProfile.foodPreference || undefined,
    favouritePlace: backendProfile.favouritePlace || undefined,
    teaOrCoffee: backendProfile.teaOrCoffee || undefined,
    mountainOrBeach: backendProfile.mountainOrBeach || undefined,
    sexualOrientation: backendProfile.sexualOrientation || undefined,
    nonNegotiables,
  };
}

export default function Discover() {
  const [profiles, setProfiles] = useState<DiscoveryProfileFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { filters, setFilters } = useFilters();
  const { recordSwipe, hasPassed, hasLiked, tick } = useMatch();
  const scrollRef = useScrollWheel();

  // Fetch profiles from backend
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log("[Discover] Fetching profiles from backend...");
        
        // Get current user to exclude their profile
        const currentUser = await getUserProfile();
        const currentUserEmail = currentUser?.email;
        
        // Fetch all profiles - we'll filter for completed onboarding client-side
        // Note: Amplify Data client list() doesn't support boolean filters well,
        // so we fetch all and filter client-side
        // Use API key auth mode when Google login is disabled
        let result;
        if (!GOOGLE_LOGIN_CHECK) {
          // @ts-ignore - TypeScript types don't match runtime behavior for authMode
          result = await client.models.UserProfile.list({}, { authMode: 'apiKey' });
        } else {
          result = await client.models.UserProfile.list({});
        }
        const backendProfiles = result.data;
        const errors = result.errors;

        if (errors) {
          console.error("[Discover] Error fetching profiles:", errors);
          setError("Failed to load profiles. Please try again.");
          setProfiles([]);
          return;
        }

        if (!backendProfiles || backendProfiles.length === 0) {
          console.log("[Discover] No profiles found in backend");
          setProfiles([]);
          return;
        }

        console.log("[Discover] Fetched profiles from backend:", {
          count: backendProfiles.length,
          currentUserEmail,
        });

        // Transform backend profiles to DiscoveryProfileFull format
        // Exclude current user, users in partner match (excludeFromDiscovery), and only completed onboarding
        const transformedProfiles = backendProfiles
          .filter((p) => 
            p.email !== currentUserEmail && // Exclude current user
            p.onboardingCompleted === true && // Only completed profiles
            p.excludeFromDiscovery !== true // Exclude users in confirmed partner match
          )
          .map(transformBackendProfile)
          .filter((p) => p.id && p.name); // Filter out invalid profiles

        console.log("[Discover] Transformed profiles:", {
          total: backendProfiles.length,
          afterExcludingCurrent: transformedProfiles.length,
          profileIds: transformedProfiles.map(p => p.id),
        });

        setProfiles(transformedProfiles);
      } catch (err) {
        console.error("[Discover] Error fetching profiles:", err);
        setError(err instanceof Error ? err.message : "Failed to load profiles");
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []); // Fetch once on mount

  // Apply filters to fetched profiles
  const filteredProfiles = useMemo(() => {
    if (profiles.length === 0) return [];
    console.log("[Discover] Applying filters:", {
      filters,
      totalProfiles: profiles.length,
    });
    const filtered = applyFilters(profiles, filters);
    console.log("[Discover] Filtered profiles:", {
      count: filtered.length,
      profileIds: filtered.map(p => p.id),
    });
    return filtered;
  }, [profiles, filters]);

  // Queue: exclude already passed/liked so we don't show them again
  // Include 'tick' in dependencies so queue recomputes when swipes are recorded
  const displayQueue = useMemo(() => {
    const filtered = filteredProfiles.filter(
      (p) => !hasPassed(p.id) && !hasLiked(p.id)
    );
    console.log("[Discover] displayQueue computed:", {
      inputProfilesCount: filteredProfiles.length,
      outputQueueCount: filtered.length,
      excludedCount: filteredProfiles.length - filtered.length,
      queueProfileIds: filtered.map(p => p.id),
      excludedProfileIds: filteredProfiles
        .filter(p => hasPassed(p.id) || hasLiked(p.id))
        .map(p => p.id),
      tick, // Log tick to verify it's changing
    });
    return filtered;
  }, [filteredProfiles, hasPassed, hasLiked, tick]);

  const handleSwipe = (profileId: string, action: "like" | "pass") => {
    console.log("[Discover] handleSwipe called:", {
      profileId,
      action,
      displayQueueCount: displayQueue.length,
      currentTopProfile: displayQueue[0]?.id,
    });
    console.log("[Discover] handleSwipe called:", {
      profileId,
      action,
      displayQueueCount: displayQueue.length,
      currentTopProfile: displayQueue[0]?.id,
    });
    recordSwipe(profileId, action);
    console.log("[Discover] handleSwipe complete - queue will update on next render");
  };

  // Scroll function to pass to DiscoverFeed - scrolls immediately
  const scrollToTop = useCallback(() => {
    if (scrollRef.current) {
      console.log("[Discover] scrollToTop called, current scrollTop:", scrollRef.current.scrollTop);
      // Use instant scroll for immediate effect
      scrollRef.current.scrollTop = 0;
      // Also try scrollTo as backup
      scrollRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
  }, [scrollRef]);

  // Scroll to top when a new profile loads (backup - also scrolls on button click)
  const handleProfileChange = useCallback((profileId: string) => {
    if (scrollRef.current) {
      console.log("[Discover] Profile changed, ensuring scroll to top:", {
        profileId,
        currentScrollTop: scrollRef.current.scrollTop,
      });
      // Use requestAnimationFrame to ensure DOM is updated, then scroll
      requestAnimationFrame(() => {
        if (scrollRef.current && scrollRef.current.scrollTop > 0) {
          console.log("[Discover] Scrolling to top (profile change callback)");
          scrollRef.current.scrollTop = 0;
        }
      });
    }
  }, [scrollRef]);

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 max-w-[500px] mx-auto w-full">
        {/* Fixed header */}
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

        {/* Full-screen card area - scrollable */}
        <div
          ref={scrollRef}
          data-scroll-container
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain flex flex-col scroll-touch outline-none"
          tabIndex={0}
        >
          {loading ? (
            <div className="flex-1 flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center py-12 px-4">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </div>
            </div>
          ) : displayQueue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-12 px-4">
              <div className="text-center">
                <p className="text-muted-foreground mb-2">
                  {filteredProfiles.length === 0
                    ? "No profiles match your filters. Try adjusting your preferences."
                    : "You've seen all available profiles. Check back later!"}
                </p>
                {filteredProfiles.length === 0 && (
                  <Button
                    variant="outline"
                    onClick={() => setFiltersOpen(true)}
                  >
                    Adjust Filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <DiscoverFeed
              profiles={displayQueue}
              onSwipe={handleSwipe}
              onOpenFilters={() => setFiltersOpen(true)}
              onProfileChange={handleProfileChange}
              scrollToTop={scrollToTop}
            />
          )}
        </div>

        {/* Fixed Like/Pass buttons at bottom */}
        {!loading && displayQueue.length > 0 && (
          <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-6 py-4 px-4">
              <Button
                variant="outline"
                size="icon"
                className="h-14 w-14 rounded-full border-2 border-muted-foreground/50 hover:border-red-500 hover:bg-red-500/10"
                onClick={() => handleSwipe(displayQueue[0]?.id, "pass")}
                disabled={displayQueue.length === 0}
              >
                <X className="w-7 h-7 text-muted-foreground" />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-14 w-14 rounded-full bg-primary hover:bg-primary/90"
                onClick={() => handleSwipe(displayQueue[0]?.id, "like")}
                disabled={displayQueue.length === 0}
              >
                <Heart className="w-7 h-7 fill-primary-foreground text-primary-foreground" />
              </Button>
            </div>
          </div>
        )}
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