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
import { getUserProfileFromCognito } from "@/utils/auth";
import { getIdFromEmail } from "@/utils/userId";
import { logError, logInfo, logWarn } from "@/utils/logger";
import { GOOGLE_LOGIN_CHECK, APP_URL } from "@/config";

import {
  applyFilters,
  type DiscoveryProfileFull,
  mapSexualOrientationToGenders,
  FILTER_STORAGE_KEY,
} from "@/lib/dating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Heart, Flower2, Loader2 } from "lucide-react";
import ShareWhatsAppButton from "@/components/ShareWhatsAppButton";
import { MatchPopup } from "@/components/discovery/MatchPopup";
import ReportFloatingButton from "@/components/ReportFloatingButton";
import ReportModal from "@/components/ReportModal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PendingPartnerRequestView from "@/components/PendingPartnerRequestView";
import WithdrawModal, { type WithdrawFormData } from "@/components/WithdrawModal";
import { usePromDate } from "@/hooks/usePromDate";
import { useDailyLikeCount } from "@/hooks/useDailyLikeCount";
import { useToast } from "@/hooks/use-toast";

const client = generateClient<Schema>();


/**
 * Transform backend UserProfile to DiscoveryProfileFull format
 */
function transformBackendProfile(backendProfile: Schema["UserProfile"]["type"]): DiscoveryProfileFull {
  // Start empty; S3 URLs added in fetch loop when profilePicKey exists
  const photoUrls: string[] = [];

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
    poll145Surprises: backendProfile.poll145Surprises || undefined,
    pollMaggiOrChai: backendProfile.pollMaggiOrChai || undefined,
    pollSectionOrBatch: backendProfile.pollSectionOrBatch || undefined,
    pollDormOrLibrary: backendProfile.pollDormOrLibrary || undefined,
    pollNetflixOrGoingOut: backendProfile.pollNetflixOrGoingOut || undefined,
    pollTextingOrCalling: backendProfile.pollTextingOrCalling || undefined,
    pollSurpriseOrPlanned: backendProfile.pollSurpriseOrPlanned || undefined,
    pollDeepOrSilly: backendProfile.pollDeepOrSilly || undefined,
    pollBoredInRoom: backendProfile.pollBoredInRoom || undefined,
    pollCasualOrDressed: backendProfile.pollCasualOrDressed || undefined,
  };
}

export default function Discover() {
  const navigate = useNavigate();
  useEffect(() => {
    logInfo("Discover page loaded", { component: "Discover", operation: "mount" });
  }, []);
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
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [currentProfileId, setCurrentProfileId] = useState<string>("");
  const [currentUserGender, setCurrentUserGender] = useState<string | undefined>(undefined);

  const { toast } = useToast();
  const dailyLikeInfo = useDailyLikeCount(currentProfileId, currentUserGender, tick);

  const [reportOpen, setReportOpen] = useState(false);
  const [pendingOutgoingRequest, setPendingOutgoingRequest] = useState<{
    id: string;
    toEmail: string;
    partnerDisplayName: string;
  } | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showRoseButton, setShowRoseButton] = useState(false);
  const [showRoseModal, setShowRoseModal] = useState(false);
  const [roseEmail, setRoseEmail] = useState("");
  const [roseSending, setRoseSending] = useState(false);
  const [roseError, setRoseError] = useState<string | null>(null);

  // When user clicks Discover in nav (or same tab), refetch profiles and clear refresh state
  useEffect(() => {
    if (location.state?.refresh) {
      setRefreshKey((k) => k + 1);
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state?.refresh, location.pathname, navigate]);

  // When arriving from onboarding (or link with ?openFilters=1), open filters first and clean URL
  // But skip if user is in couple flow (they already have a partner)
  useEffect(() => {
    const checkAndOpenFilters = async () => {
      if (searchParams.get("openFilters") === "1") {
        try {
          const currentUser = await getUserProfileFromCognito();
          if (currentUser?.email) {
            const profileId = getIdFromEmail(currentUser.email.trim());
            const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
            const { data: userProfile } = await client.models.UserProfile.get(
              { id: profileId },
              opts
            );
            if (userProfile) {
              const isCoupleFlow = (userProfile.partnerStatus ?? "") === "Already found my plus-one ✨" ||
                                  ((userProfile.partnerEmail ?? "").trim() !== "");
              if (!isCoupleFlow) {
                setFiltersOpen(true);
              }
            } else {
              setFiltersOpen(true);
            }
          } else {
            setFiltersOpen(true);
          }
        } catch (err) {
          logError(err, { component: "Discover", operation: "checkProfileForFilters" });
          setFiltersOpen(true);
        }
        searchParams.delete("openFilters");
        setSearchParams(searchParams, { replace: true });
      }
    };
    checkAndOpenFilters();
  }, [searchParams, setSearchParams]);

  // Sync filters from current user's profile whenever profile is loaded (after sign-in or refresh)
  useEffect(() => {
    const syncFiltersFromProfile = async () => {
      try {
        const currentUser = await getUserProfileFromCognito();
        if (!currentUser?.email) {
          setFiltersInitialized(true);
          return;
        }

        const profileId = getIdFromEmail(currentUser.email.trim());
        const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
        const { data: userProfile } = await client.models.UserProfile.get(
          { id: profileId },
          opts
        );

        if (!userProfile) {
          setFiltersInitialized(true);
          return;
        }

        const isCoupleFlow = (userProfile.partnerStatus ?? "") === "Already found my plus-one ✨" ||
                            ((userProfile.partnerEmail ?? "").trim() !== "");

        const sexualOrientation = userProfile.sexualOrientation?.trim() || "Straight";
        const gendersInterestedIn = mapSexualOrientationToGenders(
          sexualOrientation,
          userProfile.gender
        );

        setFilters((prev) => ({
          ...prev,
          gendersInterestedIn,
        }));

        const filtersInitializedKey = `${FILTER_STORAGE_KEY}-initialized`;
        const hasBeenInitialized = localStorage.getItem(filtersInitializedKey) === "true";

        if (!hasBeenInitialized && !isCoupleFlow) {
          localStorage.setItem(filtersInitializedKey, "true");
          setFiltersOpen(true);
        } else if (!hasBeenInitialized) {
          localStorage.setItem(filtersInitializedKey, "true");
        }
        setShowRoseButton(!isCoupleFlow);
        setFiltersInitialized(true);
      } catch (err) {
        logError(err, { component: "Discover", operation: "syncFiltersFromProfile" });
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
        logInfo("Fetching discovery profiles", { component: "Discover", operation: "fetchProfiles" });

        // Load already-liked profile ids so we exclude them from the feed
        await loadLikesFromBackend();
        
        // Get current user to exclude their profile
        const currentUser = await getUserProfileFromCognito();
        const currentUserEmail = currentUser?.email;

        // Check for pending outgoing partner request (sender has requested, waiting for partner to accept)
        const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
        const opts = authMode ? { authMode } : undefined;
        const myProfileId = currentUserEmail ? getIdFromEmail(currentUserEmail.trim()) : null;
        const { data: myProfile } = myProfileId
          ? await client.models.UserProfile.get({ id: myProfileId }, opts)
          : { data: null };
        const resolvedMyProfileId = myProfile?.id ?? "";
        setCurrentProfileId(resolvedMyProfileId);
        setCurrentUserGender(myProfile?.gender ?? undefined);
        if (resolvedMyProfileId) {
          try {
            const { data: outgoing } =
              // @ts-ignore - Amplify list accepts (input, options)
              await client.models.MatchRequest.listMatchRequestByFromUserId(
                { fromUserId: resolvedMyProfileId },
                opts
              );
            const pending = (outgoing ?? []).find((r) => r.status === "pending");
            if (pending) {
              const toEmail = pending.toEmail ?? "";
              setPendingOutgoingRequest({
                id: pending.id ?? "",
                toEmail,
                partnerDisplayName: toEmail.split("@")[0] || "your partner",
              });
            }
          } catch (err) {
            logError(err, { component: "Discover", operation: "fetchPendingRequest", extra: { profileId: resolvedMyProfileId } });
          }
        }

        // Fetch all MatchRequests with status pending (users in "request pending" – exclude from discovery)
        let requestPendingUserIds = new Set<string>();
        try {
          // @ts-ignore - list(options) second arg for authMode
        const { data: matchRequests } = await client.models.MatchRequest.list({}, opts);
          (matchRequests ?? [])
            .filter((r) => r.status === "pending" && r.fromUserId)
            .forEach((r) => requestPendingUserIds.add(r.fromUserId!));
        } catch (err) {
          logError(err, { component: "Discover", operation: "fetchMatchRequests" });
        }

        // Fetch all profiles with pagination; filter for completed onboarding client-side
        const listOpts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
        const allProfiles: NonNullable<Awaited<ReturnType<typeof client.models.UserProfile.list>>["data"]> = [];
        let nextToken: string | undefined;
        do {
          // @ts-ignore - list(options) second arg for authMode
          const res = await client.models.UserProfile.list({ nextToken }, listOpts);
          if (res.errors?.length) {
            logError(res.errors[0], { component: "Discover", operation: "fetchProfiles", extra: { errors: res.errors } });
            setError("Failed to load profiles. Please try again.");
            setProfiles([]);
            return;
          }
          allProfiles.push(...(res.data ?? []));
          nextToken = res.nextToken ?? undefined;
        } while (nextToken);

        const backendProfiles = allProfiles;

        if (backendProfiles.length === 0) {
          setProfiles([]);
          return;
        }

        // Filter: exclude current user, only completed onboarding, exclude prom date & request pending
        const filteredBackend = backendProfiles.filter(
          (p) =>
            p.email !== currentUserEmail &&
            p.onboardingCompleted === true &&
            p.excludeFromDiscovery !== true &&
            !p.bio?.trim().startsWith("Partner:") &&
            !requestPendingUserIds.has(p.id ?? "")
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
            } catch (err) {
              logWarn("Profile photo URL unavailable", { component: "Discover", operation: "fetchProfiles", extra: { profileId: filteredBackend[i]?.id, profilePicKey } });
            }
          }
        }

        const validProfiles = transformedProfiles.filter((p) => p.id && p.name);
        setProfiles(validProfiles);
        logInfo("Discovery profiles loaded", { component: "Discover", operation: "fetchProfiles", extra: { count: validProfiles.length } });
      } catch (err) {
        logError(err, { component: "Discover", operation: "fetchProfiles" });
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
    return applyFilters(profiles, filters);
  }, [profiles, filters]);

  // Queue: exclude already passed/liked and skipped profiles so we don't show them again
  // Include 'tick' in dependencies so queue recomputes when swipes are recorded
  const displayQueue = useMemo(() => {
    return filteredProfiles.filter(
      (p) => !hasPassed(p.id) && !hasLiked(p.id)
    );
  }, [filteredProfiles, hasPassed, hasLiked, tick]);

  const handleSwipe = async (profileId: string, action: "like" | "pass") => {
    logInfo("Discover: swipe", { component: "Discover", operation: "handleSwipe", extra: { profileId, action } });
    if (action === "like" && dailyLikeInfo.hasLimit && dailyLikeInfo.atLimit) {
      toast({
        title: "Daily likes used",
        description: "You have finished likes for today. You can still browse profiles but you need to come back tomorrow for more likes.",
        variant: "destructive",
      });
      return;
    }
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

  const handleProfileChange = useCallback((_profileId: string) => {
    const main = document.getElementById("app-main");
    if (main && main.scrollTop > 0) {
      requestAnimationFrame(() => {
        main.scrollTop = 0;
      });
    }
  }, []);

  const handleSendRose = async () => {
    const to = roseEmail.trim();
    if (!to) return;
    if (!currentProfileId) {
      setRoseError("Please sign in to send a rose.");
      return;
    }
    setRoseSending(true);
    setRoseError(null);
    try {
      const opts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
      const { data, errors } = await client.queries.sendRoseEmail({
        currentUserId: currentProfileId,
        toEmail: to,
        appUrl: APP_URL,
      }, opts);
      if (errors?.length) {
        const msg = errors[0]?.message ?? "Failed to send";
        setRoseError(msg);
        return;
      }
      if ((data as { success?: boolean })?.success) {
        setShowRoseModal(false);
        setRoseEmail("");
      } else {
        setRoseError("Failed to send");
      }
    } catch (err) {
      logError(err, { component: "Discover", operation: "sendRoseEmail" });
      const message = err instanceof Error ? err.message : "Failed to send. Please try again.";
      setRoseError(message);
    } finally {
      setRoseSending(false);
    }
  };

  // Scroll to top when profile changes so user sees top of new card (photo, name)
  useEffect(() => {
    const topId = displayQueue[0]?.id;
    if (!topId) return;
    const main = document.getElementById("app-main");
    if (!main) return;
    main.scrollTop = 0;
    main.scrollTo({ top: 0, behavior: "instant" });
  }, [displayQueue[0]?.id]);

  const handleWithdrawConfirm = async (data: WithdrawFormData) => {
    if (!pendingOutgoingRequest?.id) return;
    setWithdrawing(true);
    try {
      const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
      const opts = authMode ? { authMode } : undefined;
      await client.models.MatchRequest.update(
        { id: pendingOutgoingRequest.id, status: "withdrawn" },
        opts
      );
      const currentUser = await getUserProfileFromCognito();
      const myProfileId = currentUser?.email ? getIdFromEmail(currentUser.email.trim()) : null;
      if (myProfileId) {
        const { data: myProfile } = await client.models.UserProfile.get({ id: myProfileId }, opts);
        if (myProfile?.id) {
          await client.models.UserProfile.update(
            {
              id: myProfile.id,
            bio: undefined,
            partnerStatus: "Still looking for my prom date 💫",
            partnerEmail: "",
            partnerName: "",
            sexualOrientation: data.sexualOrientation,
            intention: data.intention,
            hometown: data.hometown,
            foodPreference: "Flexible",
            onboardingCompleted: true,
          },
          opts
        );
        }
      }
      setPendingOutgoingRequest(null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      logError(e, { component: "Discover", operation: "withdraw" });
      throw e;
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gradient-midnight relative flex flex-col w-full">
      <SparkleBackground />

      <div className="relative z-10 flex flex-col w-full max-w-[500px] mx-auto min-h-dvh">
        {/* Fixed header */}
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/50 shrink-0">
          <div className="flex flex-col gap-0.5">
            <h1 className="font-display text-3xl font-bold text-foreground">
              {pendingOutgoingRequest ? "Your Prom Invite ✨" : "Discover"}
            </h1>
            {dailyLikeInfo.hasLimit && !pendingOutgoingRequest && (
              <p className="text-xs text-muted-foreground">
                {dailyLikeInfo.count ?? 0}/{dailyLikeInfo.limit ?? 10} likes used today
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ShareWhatsAppButton
              variant="outline"
              size="sm"
              className="gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium shadow-sm"
              label="Refer"
            />
            {!pendingOutgoingRequest && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { logInfo("Discover: filters opened", { component: "Discover", operation: "openFilters" }); setFiltersOpen(true); }}
                className="gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary font-medium shadow-sm"
                title="Adjust discovery filters"
              >
                <Filter className="w-4 h-4" />
                Filters
              </Button>
            )}
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
            <div className="flex-1 flex flex-col min-h-0">
              <PendingPartnerRequestView
                partnerDisplayName={pendingOutgoingRequest.partnerDisplayName}
                onWithdraw={() => setShowWithdrawModal(true)}
                onShare={() => {}}
                isWithdrawing={withdrawing}
              />
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
              dailyLikeInfo={dailyLikeInfo}
              onOpenFilters={() => { logInfo("Discover: filters opened from feed", { component: "Discover", operation: "openFilters" }); setFiltersOpen(true); }}
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

      {showRoseButton && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-20 left-4 z-40 h-12 w-12 rounded-full border-2 border-rose-400/60 bg-rose-50/90 shadow-lg backdrop-blur-sm hover:border-rose-500 hover:bg-rose-100/90"
          onClick={() => { setRoseError(null); setRoseEmail(""); setShowRoseModal(true); }}
          title="Send a rose"
          aria-label="Send a rose"
        >
          <Flower2 className="h-6 w-6 text-rose-600" />
        </Button>
      )}

      {!loading && displayQueue.length > 0 && displayQueue[0] && (
        <>
          <ReportFloatingButton onClick={() => { logInfo("Discover: report opened", { component: "Discover", operation: "openReport", extra: { profileId: displayQueue[0]?.id } }); setReportOpen(true); }} />
          <ReportModal
            open={reportOpen}
            onOpenChange={setReportOpen}
            personName={displayQueue[0].name}
            personId={displayQueue[0].id}
            context="Discover"
          />
        </>
      )}

      <Dialog open={showRoseModal} onOpenChange={(open) => { if (!open) setRoseError(null); setShowRoseModal(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700">
              <Flower2 className="h-5 w-5" />
              Send a rose
            </DialogTitle>
            <DialogDescription>
              Send an anonymous email from Starlit by the Brick. They’ll see that someone wants to go to Prom with them and get a link to join. They’ll never know who sent it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label htmlFor="rose-email" className="text-sm font-medium text-foreground">
              Their email
            </label>
            <Input
              id="rose-email"
              type="email"
              placeholder="name@iima.ac.in"
              value={roseEmail}
              onChange={(e) => setRoseEmail(e.target.value)}
              className="border-rose-200 focus-visible:ring-rose-400"
              disabled={roseSending}
            />
            {roseError && (
              <p className="text-sm text-destructive">{roseError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoseModal(false)} disabled={roseSending}>
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleSendRose}
              disabled={roseSending || !roseEmail.trim()}
            >
              {roseSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                <>
                  <Flower2 className="h-4 w-4 mr-2" />
                  Send rose
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      <WithdrawModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        onConfirm={handleWithdrawConfirm}
      />
    </div>
  );
}