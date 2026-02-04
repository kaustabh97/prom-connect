import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import SparkleBackground from "@/components/SparkleBackground";
import DiscoverFeed from "@/components/discovery/DiscoverFeed";
import FiltersModal from "@/components/discovery/FiltersModal";
import { useFilters } from "@/hooks/useFilters";
import { useMatch } from "@/hooks/useMatch";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUrl } from "aws-amplify/storage";
import { getUserProfile } from "@/utils/auth";
import { GOOGLE_LOGIN_CHECK } from "@/config";

import {
  applyFilters,
  type DiscoveryProfileFull,
  mapSexualOrientationToGenders,
  FILTER_STORAGE_KEY,
} from "@/lib/dating";
import { Button } from "@/components/ui/button";
import { Filter, Heart } from "lucide-react";
import ShareWhatsAppButton from "@/components/ShareWhatsAppButton";
import { MatchPopup } from "@/components/discovery/MatchPopup";
import ReportFloatingButton from "@/components/ReportFloatingButton";
import ReportModal from "@/components/ReportModal";
import { usePromDate } from "@/hooks/usePromDate";

const client = generateClient<Schema>();


/**
 * Transform backend UserProfile to DiscoveryProfileFull format
 */
function transformBackendProfile(backendProfile: Schema["UserProfile"]["type"]): DiscoveryProfileFull {
  // Start empty; S3 URLs added in fetch loop when profilePicKey exists
  const photoUrls: string[] = [];

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
  
  if (backendProfile.intention === "Date for Prom" || backendProfile.intention === "In a relationship, looking for a prom date") {
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
    cohort: backendProfile.cohort || undefined,
    intention: backendProfile.intention || undefined,
    hometown: backendProfile.hometown || undefined,
    alcoholPreference: backendProfile.alcoholPreference || undefined,
    smokingPreference: backendProfile.smokingPreference || undefined,
    foodPreference: backendProfile.foodPreference || undefined,
    favouritePlace: backendProfile.favouritePlace || undefined,
    teaOrCoffee: backendProfile.teaOrCoffee || undefined,
    mountainOrBeach: backendProfile.mountainOrBeach || undefined,
    sexualOrientation: backendProfile.sexualOrientation || undefined,
    morningOrNightPerson: backendProfile.morningOrNightPerson || undefined,
    idealWeekend: backendProfile.idealWeekend || undefined,
    goToKaraokeSong: backendProfile.goToKaraokeSong || undefined,
    superpowerChoice: backendProfile.superpowerChoice || undefined,
    favouriteMovieGenre: backendProfile.favouriteMovieGenre || undefined,
    secretTalent: backendProfile.secretTalent || undefined,
    favouriteChaiSpot: backendProfile.favouriteChaiSpot || undefined,
    idealPromOutfit: backendProfile.idealPromOutfit || undefined,
    messOrOutside: backendProfile.messOrOutside || undefined,
    bestDateSpotOnCampus: backendProfile.bestDateSpotOnCampus || undefined,
    bollywoodOrEnglishAtProm: backendProfile.bollywoodOrEnglishAtProm || undefined,
    lateNightRitual: backendProfile.lateNightRitual || undefined,
    perfectSaturdayAtIIMA: backendProfile.perfectSaturdayAtIIMA || undefined,
    goToBollywoodSong: backendProfile.goToBollywoodSong || undefined,
    pollTniteOrStayIn: backendProfile.pollTniteOrStayIn || undefined,
    poll145Surprises: backendProfile.poll145Surprises || undefined,
    pollTeaPostOrNestle: backendProfile.pollTeaPostOrNestle || undefined,
    pollMaggiOrChai: backendProfile.pollMaggiOrChai || undefined,
    pollDormOrLibrary: backendProfile.pollDormOrLibrary || undefined,
    pollSectionOrBatch: backendProfile.pollSectionOrBatch || undefined,
    pollLKPOrHeritage: backendProfile.pollLKPOrHeritage || undefined,
    pollMorningOrAfternoon: backendProfile.pollMorningOrAfternoon || undefined,
    pollCROrLKP: backendProfile.pollCROrLKP || undefined,
    nonNegotiables,
  };
}

export default function Discover() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [profiles, setProfiles] = useState<DiscoveryProfileFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { filters, setFilters } = useFilters();
  const { recordSwipe, loadLikesFromBackend, hasPassed, hasLiked, tick } = useMatch();
  const [matchPopupOpen, setMatchPopupOpen] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<DiscoveryProfileFull | null>(null);
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);
  const [skippedProfileIds, setSkippedProfileIds] = useState<Set<string>>(new Set());
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentProfileId, setCurrentProfileId] = useState<string>("");

  const [reportOpen, setReportOpen] = useState(false);
  const [pendingOutgoingRequest, setPendingOutgoingRequest] = useState<{
    toEmail: string;
    fromName?: string;
  } | null>(null);

  // When user clicks Discover in nav (or same tab), refetch profiles and clear refresh state
  useEffect(() => {
    if (location.state?.refresh) {
      setRefreshKey((k) => k + 1);
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state?.refresh, location.pathname, navigate]);

  // When arriving from onboarding (or link with ?openFilters=1), open filters first and clean URL
  useEffect(() => {
    if (searchParams.get("openFilters") === "1") {
      setFiltersOpen(true);
      searchParams.delete("openFilters");
      setSearchParams(searchParams, { replace: true });
    }
  }, []);

  // Sync filters from current user's profile whenever profile is loaded (after sign-in or refresh)
  useEffect(() => {
    const syncFiltersFromProfile = async () => {
      try {
        const currentUser = await getUserProfile();
        if (!currentUser?.email) {
          setFiltersInitialized(true);
          return;
        }

        const listFilters = { filter: { email: { eq: currentUser.email } } };
        let result;
        if (!GOOGLE_LOGIN_CHECK) {
          // @ts-expect-error - authMode option not in generated types yet
          result = await client.models.UserProfile.list(listFilters, { authMode: 'apiKey' });
        } else {
          result = await client.models.UserProfile.list(listFilters);
        }

        const userProfiles = result.data;
        if (!userProfiles || userProfiles.length === 0) {
          setFiltersInitialized(true);
          return;
        }

        const userProfile = userProfiles[0];
        const gendersInterestedIn = mapSexualOrientationToGenders(
          userProfile.sexualOrientation,
          userProfile.gender
        );

        setFilters((prev) => ({
          ...prev,
          gendersInterestedIn,
        }));

        const filtersInitializedKey = `${FILTER_STORAGE_KEY}-initialized`;
        const hasBeenInitialized = localStorage.getItem(filtersInitializedKey) === "true";
        if (!hasBeenInitialized) {
          localStorage.setItem(filtersInitializedKey, "true");
          setFiltersOpen(true);
        }
        setFiltersInitialized(true);
      } catch (err) {
        console.error("[Discover] Error syncing filters from profile:", err);
        setFiltersInitialized(true);
      }
    };

    syncFiltersFromProfile();
  }, [setFilters]);

  const { promDate } = usePromDate({ currentUserId: currentProfileId });
  useEffect(() => {
    if (currentProfileId && promDate) {
      navigate("/prom-date", { replace: true });
    }
  }, [currentProfileId, promDate, navigate]);

  // Fetch profiles from backend
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        setPendingOutgoingRequest(null);

        // Load already-liked profile ids so we exclude them from the feed
        await loadLikesFromBackend();
        
        console.log("[Discover] Fetching profiles from backend...");
        
        // Get current user to exclude their profile
        const currentUser = await getUserProfile();
        const currentUserEmail = currentUser?.email;

        // Check for pending outgoing partner request (sender has requested, waiting for partner to accept)
        const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
        const opts = authMode ? { authMode } : undefined;
        const { data: myProfiles } = await client.models.UserProfile.list(
          { filter: { email: { eq: currentUserEmail } } },
          opts
        );
        const myProfileId = myProfiles?.[0]?.id;
        setCurrentProfileId(myProfileId ?? "");
        if (myProfileId) {
          try {
            const { data: outgoing } = await client.models.MatchRequest.listMatchRequestByFromUserId(
              { fromUserId: myProfileId },
              opts
            );
            const pending = (outgoing ?? []).find((r) => r.status === "pending");
            if (pending) {
              setPendingOutgoingRequest({
                toEmail: pending.toEmail ?? "",
                fromName: pending.fromName ?? undefined,
              });
            }
          } catch (_) {}
        }
        
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

        // Filter: exclude current user and only completed onboarding
        const filteredBackend = backendProfiles.filter(
          (p) =>
            p.email !== currentUserEmail &&
            p.onboardingCompleted === true
        );

        // Transform to DiscoveryProfileFull format (same length as filteredBackend)
        const transformedProfiles = filteredBackend.map(transformBackendProfile);

        // Resolve S3 URLs for profile photos (profilePicKey → presigned getUrl)
        for (let i = 0; i < filteredBackend.length; i++) {
          const profilePicKey = filteredBackend[i].profilePicKey;
          if (profilePicKey) {
            try {
              const { url } = await getUrl({
                path: profilePicKey,
                options: { bucket: "userPhotos" },
              });
              transformedProfiles[i].photoUrls = [url];
            } catch (e) {
              console.warn("[Discover] Failed to get photo URL for profile", filteredBackend[i].id, e);
            }
          }
        }

        const validProfiles = transformedProfiles.filter((p) => p.id && p.name);

        console.log("[Discover] Transformed profiles:", {
          total: backendProfiles.length,
          afterExcludingCurrent: validProfiles.length,
          profileIds: validProfiles.map((p) => p.id),
        });

        setProfiles(validProfiles);
      } catch (err) {
        console.error("[Discover] Error fetching profiles:", err);
        setError(err instanceof Error ? err.message : "Failed to load profiles");
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [refreshKey]); // Fetch on mount and when nav requests refresh

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

  // Queue: exclude already passed/liked and skipped profiles so we don't show them again
  // Include 'tick' in dependencies so queue recomputes when swipes are recorded
  const displayQueue = useMemo(() => {
    return filteredProfiles.filter(
      (p) => !hasPassed(p.id) && !hasLiked(p.id) && !skippedProfileIds.has(p.id)
    );
  }, [filteredProfiles, hasPassed, hasLiked, tick, skippedProfileIds]);

  const handleSwipe = async (profileId: string, action: "like" | "pass") => {
    const profile = displayQueue.find((p) => p.id === profileId);
    const result = await recordSwipe(profileId, action);
    if (result.isMatch && profile) {
      setMatchedProfile(profile);
      setMatchedMatchId(result.matchId || null);
      setMatchPopupOpen(true);
    }
  };

  // Scroll to top so user sees top of card (photo, name) not bottom
  const scrollToTop = useCallback(() => {
    const main = document.getElementById("app-main");
    if (main) {
      main.scrollTop = 0;
      main.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  // Handle "Next" (arrow) - skip for now, can loop back later
  const handleNext = useCallback(() => {
    if (displayQueue.length === 0) return;
    const currentProfile = displayQueue[0];
    if (!currentProfile) return;
    
    setSkippedProfileIds((prev) => new Set(prev).add(currentProfile.id));
    scrollToTop();
  }, [displayQueue, scrollToTop]);

  // When all profiles done, loop back: show profiles that were only "next'd" (not passed)
  useEffect(() => {
    if (displayQueue.length === 0 && skippedProfileIds.size > 0) {
      setSkippedProfileIds(new Set());
      scrollToTop();
    }
  }, [displayQueue.length, skippedProfileIds.size, scrollToTop]);

  const handleProfileChange = useCallback((_profileId: string) => {
    const main = document.getElementById("app-main");
    if (main && main.scrollTop > 0) {
      requestAnimationFrame(() => {
        main.scrollTop = 0;
      });
    }
  }, []);

  // Scroll to top when profile changes so user sees top of new card (photo, name)
  useEffect(() => {
    const topId = displayQueue[0]?.id;
    if (!topId) return;
    const main = document.getElementById("app-main");
    if (!main) return;
    main.scrollTop = 0;
    main.scrollTo({ top: 0, behavior: "instant" });
  }, [displayQueue[0]?.id]);

  return (
    <div className="min-h-dvh bg-gradient-midnight relative flex flex-col w-full">
      <SparkleBackground />

      <div className="relative z-10 flex flex-col w-full max-w-[500px] mx-auto min-h-dvh">
        {/* Fixed header */}
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 shrink-0">
          <h1 className="font-display text-3xl font-bold text-foreground">
            Discover
          </h1>
          <div className="flex items-center gap-2">
            <ShareWhatsAppButton
              variant="outline"
              size="sm"
              className="gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium shadow-sm"
              label="Refer"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFiltersOpen(true)}
              className="gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium shadow-sm"
              title="Adjust discovery filters"
            >
              <Filter className="w-4 h-4" />
              Filters
            </Button>
          </div>
        </header>

        {/* Card area - content flows, main scrolls (no nested scroll) */}
        <div className="flex flex-col flex-1 min-h-0 w-full min-w-0">
          {loading ? (
            <div className="flex-1 flex items-center justify-center min-h-0 py-12">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center min-h-0 py-12 px-4">
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
          ) : pendingOutgoingRequest ? (
            <div className="flex-1 flex items-center justify-center min-h-0 py-12 px-4">
              <div className="text-center max-w-sm">
                <Heart className="w-14 h-14 text-primary/60 mx-auto mb-4" />
                <h3 className="font-display text-lg font-semibold mb-2">Request pending</h3>
                <p className="text-muted-foreground mb-2">
                  Your prom invitation is pending with{" "}
                  <span className="text-primary font-medium">
                    {pendingOutgoingRequest.fromName || pendingOutgoingRequest.toEmail.split("@")[0] || "your partner"}
                  </span>
                  .
                </p>
                <p className="text-sm text-muted-foreground">
                  When they accept, you&apos;ll be matched and can chat from the Matches tab.
                </p>
              </div>
            </div>
          ) : displayQueue.length === 0 ? (
            <div className="flex-1 flex items-center justify-center min-h-0 py-12 px-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  {filteredProfiles.length === 0
                    ? "No profiles available for your preferences right now."
                    : "You've seen all available profiles. Check back later!"}
                </p>
                <p className="text-sm text-muted-foreground/80">
                  {filteredProfiles.length === 0
                    ? "Try adjusting your filters to see more profiles."
                    : "You can adjust filters to change who you see next time."}
                </p>
                <Button
                  variant="outline"
                  onClick={() => setFiltersOpen(true)}
                  className="mt-2"
                >
                  Adjust filters
                </Button>
              </div>
            </div>
          ) : (
            <DiscoverFeed
              profiles={displayQueue}
              onSwipe={handleSwipe}
              onNext={handleNext}
              onOpenFilters={() => setFiltersOpen(true)}
              onProfileChange={handleProfileChange}
              scrollToTop={scrollToTop}
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

      {!loading && displayQueue.length > 0 && displayQueue[0] && (
        <>
          <ReportFloatingButton onClick={() => setReportOpen(true)} />
          <ReportModal
            open={reportOpen}
            onOpenChange={setReportOpen}
            personName={displayQueue[0].name}
            personId={displayQueue[0].id}
            context="Discover"
          />
        </>
      )}

      <MatchPopup
        open={matchPopupOpen}
        onOpenChange={setMatchPopupOpen}
        matchedProfile={matchedProfile}
        matchId={matchedMatchId}
        onKeepSwiping={() => {
          setMatchedProfile(null);
          setMatchedMatchId(null);
        }}
        onOpenChat={() => {
          if (matchedMatchId) {
            navigate(`/matches?matchId=${matchedMatchId}`);
          } else {
            navigate("/matches");
          }
        }}
      />
    </div>
  );
}