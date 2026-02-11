import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { GOOGLE_LOGIN_CHECK, APP_URL, DISCOVERY_HIDDEN_PROFILE_EMAILS } from "@/config";

import {
  applyFilters,
  type DiscoveryProfileFull,
  mapSexualOrientationToGenders,
  FILTER_STORAGE_KEY,
  areSexualPreferencesMutuallyCompatible,
} from "@/lib/dating";
import { sortDiscoveryProfiles, applyTieredRandomization, seedFromProfileIds } from "@/lib/discoveryScore";
import { getUserProfileById } from "@/lib/dataAccess";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, Heart, Flower2, Loader2 } from "lucide-react";
import ShareWhatsAppButton from "@/components/ShareWhatsAppButton";
import { MatchPopup } from "@/components/discovery/MatchPopup";
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
import { useToast } from "@/hooks/use-toast";

const client = generateClient<Schema>();


/**
 * Transform backend UserProfile to DiscoveryProfileFull format.
 * Photos start empty — resolved progressively in background after profiles are displayed.
 */
function transformBackendProfile(backendProfile: Schema["UserProfile"]["type"]): DiscoveryProfileFull {
  return {
    id: backendProfile.id || "",
    name: backendProfile.name || "Anonymous",
    age: backendProfile.age || 0,
    gender: backendProfile.gender || "",
    bio: backendProfile.bio || "",
    tags: backendProfile.tags || [],
    photoUrls: [],
    email: backendProfile.email ?? undefined,
    profilePicKey: backendProfile.profilePicKey || undefined,
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
    discoveryScore: backendProfile.discoveryScore ?? undefined,
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedMeIds, setLikedMeIds] = useState<Set<string>>(new Set());

  const { toast } = useToast();

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
            const { data: userProfile } = await getUserProfileById(profileId, opts);
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
        const { data: userProfile } = await getUserProfileById(profileId, opts);

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

  // Track photo resolution so we can cancel it when a new fetch starts
  const photoResolutionCancelRef = useRef<() => void>(() => {});

  // Fetch profiles from backend — parallelized for speed
  useEffect(() => {
    // Cancel any in-flight photo resolution from a previous fetch
    photoResolutionCancelRef.current();
    let cancelled = false;
    photoResolutionCancelRef.current = () => { cancelled = true; };

    const fetchProfiles = async () => {
      try {
        setLoading(true);
        setError(null);
        setPendingOutgoingRequest(null);
        logInfo("Fetching discovery profiles", { component: "Discover", operation: "fetchProfiles" });
        const t0 = performance.now();

        // ── Step 1: Get current user (needed by everything) ────────────
        const currentUser = await getUserProfileFromCognito();
        const currentUserEmail = currentUser?.email;
        const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
        const opts = authMode ? { authMode } : undefined;
        const listOpts = !GOOGLE_LOGIN_CHECK ? { authMode: "apiKey" as const } : undefined;
        const myProfileId = currentUserEmail ? getIdFromEmail(currentUserEmail.trim()) : null;

        // ── Step 2: Run ALL independent fetches in parallel ────────────
        // Previously these ran sequentially — parallelising them is the biggest win.
        const [
          _likesLoaded,
          myProfileResult,
          allProfilesResult,
          matchRequestPendingIds,
          outgoingPending,
          likedMeResult,
          reportedIds,
        ] = await Promise.all([
          // 1. Load already-liked profile IDs (populates module-level Set in useMatch)
          loadLikesFromBackend().catch((err) => {
            logError(err, { component: "Discover", operation: "loadLikes" });
          }),

          // 2. My profile
          myProfileId
            ? getUserProfileById(myProfileId, opts).then((r) => r.data ?? null).catch((err) => {
                logError(err, { component: "Discover", operation: "fetchMyProfile" });
                return null;
              })
            : Promise.resolve(null),

          // 3. ALL user profiles (paginated) — the single heaviest call
          (async () => {
            type ProfileRow = NonNullable<Awaited<ReturnType<typeof client.models.UserProfile.list>>["data"]>[number];
            const all: ProfileRow[] = [];
            let nextToken: string | undefined;
            let pages = 0;
            do {
              // @ts-ignore - list(options) second arg for authMode
              const res = await client.models.UserProfile.list({ nextToken }, listOpts);
              if (res.errors?.length) throw res.errors[0];
              all.push(...(res.data ?? []));
              nextToken = res.nextToken ?? undefined;
              pages++;
            } while (nextToken);
            logInfo("Fetched all profiles", { component: "Discover", operation: "fetchProfiles", extra: { total: all.length, pages } });
            return all;
          })(),

          // 4. ALL match requests → pending user IDs (to exclude from feed)
          (async () => {
            const ids = new Set<string>();
            try {
              let nextToken: string | undefined;
              do {
                // @ts-ignore
                const { data, nextToken: nt } = await client.models.MatchRequest.list({ nextToken }, opts);
                (data ?? []).filter((r: { status?: string; fromUserId?: string }) => r.status === "pending" && r.fromUserId)
                  .forEach((r: { fromUserId: string }) => ids.add(r.fromUserId));
                nextToken = nt ?? undefined;
              } while (nextToken);
            } catch (err) {
              logError(err, { component: "Discover", operation: "fetchMatchRequests" });
            }
            return ids;
          })(),

          // 5. My outgoing match request
          myProfileId
            ? (async () => {
                try {
                  // @ts-ignore
                  const { data } = await client.models.MatchRequest.listMatchRequestByFromUserId({ fromUserId: myProfileId }, opts);
                  return (data ?? []).find((r: { status?: string }) => r.status === "pending") ?? null;
                } catch (err) {
                  logError(err, { component: "Discover", operation: "fetchPendingRequest" });
                  return null;
                }
              })()
            : Promise.resolve(null),

          // 6. Who liked me (for reciprocity sort boost)
          myProfileId
            ? (async () => {
                try {
                  const { data } = await client.models.Like.listLikeByToUserId({ toUserId: myProfileId }, opts);
                  return new Set((data ?? []).map((l) => l.fromUserId).filter(Boolean) as string[]);
                } catch (err) {
                  logError(err, { component: "Discover", operation: "fetchLikedMe" });
                  return new Set<string>();
                }
              })()
            : Promise.resolve(new Set<string>()),

          // 7. My reports (to exclude reported profiles)
          myProfileId
            ? (async () => {
                try {
                  const { data } = await client.models.Report.listReportByReporterUserId({ reporterUserId: myProfileId }, listOpts);
                  const ids = new Set<string>();
                  (data ?? []).forEach((r) => { if (r.reportedProfileId) ids.add(r.reportedProfileId); });
                  return ids;
                } catch (err) {
                  logError(err, { component: "Discover", operation: "fetchMyReports" });
                  return new Set<string>();
                }
              })()
            : Promise.resolve(new Set<string>()),
        ]);

        if (cancelled) return;

        // ── Step 3: Process parallel results ───────────────────────────
        const myProfile = myProfileResult;
        setCurrentProfileId(myProfile?.id ?? "");

        if (outgoingPending) {
          const toEmail = (outgoingPending as { toEmail?: string }).toEmail ?? "";
          setPendingOutgoingRequest({
            id: (outgoingPending as { id?: string }).id ?? "",
            toEmail,
            partnerDisplayName: toEmail.split("@")[0] || "your partner",
          });
        }

        setLikedMeIds(likedMeResult);

        if (allProfilesResult.length === 0) {
          setProfiles([]);
          return;
        }

        // ── Step 4: Filter, transform, set profiles WITHOUT photos ─────
        const filteredBackend = allProfilesResult.filter((p) => {
          if (
            p.email === currentUserEmail ||
            p.onboardingCompleted !== true ||
            p.excludeFromDiscovery === true ||
            (p.email != null && DISCOVERY_HIDDEN_PROFILE_EMAILS.includes(p.email.trim())) ||
            p.bio?.trim().startsWith("Partner:") ||
            matchRequestPendingIds.has(p.id ?? "") ||
            reportedIds.has(p.id ?? "")
          ) return false;
          if (!myProfile) return true;
          return areSexualPreferencesMutuallyCompatible(
            myProfile.gender ?? null, myProfile.sexualOrientation ?? null,
            p.gender ?? null, p.sexualOrientation ?? null,
          );
        });

        const validProfiles = filteredBackend.map(transformBackendProfile).filter((p) => p.id && p.name);
        setProfiles(validProfiles);
        // ↑ UI now shows profile cards (with placeholder initials for photos)

        const elapsed = Math.round(performance.now() - t0);
        logInfo("Discovery profiles loaded — photos loading in background", {
          component: "Discover", operation: "fetchProfiles",
          extra: { count: validProfiles.length, elapsedMs: elapsed },
        });
      } catch (err) {
        logError(err, { component: "Discover", operation: "fetchProfiles" });
        setError(err instanceof Error ? err.message : "Failed to load profiles");
        setProfiles([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
    return () => { cancelled = true; };
  }, [refreshKey]); // Fetch on mount and when nav requests refresh

  // ── Progressive photo resolution (runs AFTER profiles are displayed) ──
  // Resolves S3 presigned URLs in batches so the user sees cards immediately
  // while photos stream in. First batch (visible cards) loads fastest.
  useEffect(() => {
    if (loading || profiles.length === 0) return;

    // Collect profiles that still need a photo resolved
    const needsPhoto = profiles.filter((p) => p.profilePicKey && p.photoUrls.length === 0);
    if (needsPhoto.length === 0) return;

    let cancelled = false;
    // Wire into the cancel ref so a new data-fetch aborts this too
    const prevCancel = photoResolutionCancelRef.current;
    photoResolutionCancelRef.current = () => { cancelled = true; prevCancel(); };

    const FIRST_BATCH = 5;   // visible / near-visible cards
    const BATCH_SIZE  = 10;  // subsequent batches

    const resolveOne = async (profilePicKey: string) => {
      const { url } = await getUrl({ path: profilePicKey, options: { bucket: "userPhotos" } });
      return url.toString();
    };

    const applyBatch = (resolved: Map<string, string>) => {
      if (resolved.size === 0 || cancelled) return;
      setProfiles((prev) =>
        prev.map((p) => {
          const url = resolved.get(p.id);
          return url ? { ...p, photoUrls: [url] } : p;
        })
      );
    };

    const resolveAll = async () => {
      const ids = needsPhoto.map((p) => p.id);
      const keyMap = new Map(needsPhoto.map((p) => [p.id, p.profilePicKey!]));

      for (let i = 0; i < ids.length; ) {
        if (cancelled) return;
        const batchSize = i === 0 ? FIRST_BATCH : BATCH_SIZE;
        const batch = ids.slice(i, i + batchSize);
        i += batchSize;

        const results = await Promise.allSettled(
          batch.map(async (id) => ({ id, url: await resolveOne(keyMap.get(id)!) }))
        );
        if (cancelled) return;

        const resolved = new Map<string, string>();
        for (const r of results) {
          if (r.status === "fulfilled") resolved.set(r.value.id, r.value.url);
        }
        applyBatch(resolved);
      }
    };

    resolveAll().catch((err) =>
      logWarn("Background photo resolution error", { component: "Discover", operation: "resolvePhotos", extra: { error: String(err) } })
    );

    return () => { cancelled = true; };
    // Only trigger when loading transitions to false or profile count changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profiles.length]);

  // Create stable filter dependencies to avoid unnecessary re-sorting
  // Serialize filter values that affect sorting (not the entire object reference)
  const filterSortKey = useMemo(() => {
    return JSON.stringify({
      preferredCohorts: filters.preferredCohorts?.sort() || [],
      preferredIntention: filters.preferredIntention || null,
    });
  }, [filters.preferredCohorts, filters.preferredIntention]);

  // Stable likedMeIds key to avoid re-sorting when Set reference changes but contents don't
  const likedMeIdsKey = useMemo(() => {
    return Array.from(likedMeIds).sort().join(',');
  }, [likedMeIds]);

  // Apply filters then sort per viewer: combined score (global + their prefs), liked-me, per-viewer tie-breaker
  // Filters applied: gender (based on user's sexual orientation), age range, cohort/intention preferences
  // Gender filtering: Women see Men (if straight), Men see Women (if straight), etc.
  // All applicable profiles are shown after filtering by user's preferences
  // Use stable dependencies to avoid re-sorting on every render
  const filteredProfiles = useMemo(() => {
    if (profiles.length === 0) return [];
    // applyFilters filters by gendersInterestedIn (set from user's sexual orientation + gender)
    // This ensures: Straight women see men, Straight men see women, Gay/Lesbian see same gender, Bisexual/Queer see all
    const filtered = applyFilters(profiles, filters);
    // Use lower preference weight (0.25) for better balance between global quality and preferences
    const sorted = sortDiscoveryProfiles(filtered, filters, {
      likedMeIds,
      viewerId: currentProfileId,
      preferenceWeight: 0.25, // 25% preference, 75% global quality (tunable)
    });
    // Seed from profile IDs so the same set of IDs gets the same shuffle. This keeps order
    // stable when only profile data (e.g. photoUrls) updates, avoiding a brief wrong-profile blip.
    const seed = seedFromProfileIds(sorted.map((p) => p.id));
    return applyTieredRandomization(sorted, seed);
  }, [profiles, filters, filterSortKey, likedMeIds, likedMeIdsKey, currentProfileId]);

  // Queue: exclude already passed/liked and skipped profiles so we don't show them again
  // Include 'tick' in dependencies so queue recomputes when swipes are recorded
  const displayQueue = useMemo(() => {
    return filteredProfiles.filter(
      (p) => !hasPassed(p.id) && !hasLiked(p.id)
    );
  }, [filteredProfiles, hasPassed, hasLiked, tick]);

  // Clamp currentIndex when queue shrinks (e.g. after pass/like)
  useEffect(() => {
    if (displayQueue.length === 0) return;
    setCurrentIndex((i) => Math.min(i, displayQueue.length - 1));
  }, [displayQueue.length]);

  const handleSwipe = async (profileId: string, action: "like" | "pass") => {
    logInfo("Discover: swipe", { component: "Discover", operation: "handleSwipe", extra: { profileId, action } });
    const profile = displayQueue.find((p) => p.id === profileId);
    const result = await recordSwipe(profileId, action);
    if (result.isMatch && profile) {
      setMatchedProfile(profile);
      setMatchedMatchId(result.matchId || null);
      setMatchPopupOpen(true);
    }
  };

  const currentDisplayProfile = displayQueue[currentIndex] ?? displayQueue[0] ?? null;

  // Scroll to top so user sees top of card (photo, name) not bottom
  const scrollToTop = useCallback(() => {
    const main = document.getElementById("app-main");
    if (main) {
      main.scrollTop = 0;
      main.scrollTo({ top: 0, behavior: "instant" });
    }
  }, []);

  const handleNext = useCallback(() => {
    if (displayQueue.length === 0) return;
    setCurrentIndex((i) => (i + 1) % displayQueue.length);
    scrollToTop();
  }, [displayQueue.length, scrollToTop]);

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
    const topId = currentDisplayProfile?.id;
    if (!topId) return;
    const main = document.getElementById("app-main");
    if (!main) return;
    main.scrollTop = 0;
    main.scrollTo({ top: 0, behavior: "instant" });
  }, [currentDisplayProfile?.id]);

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
        const { data: myProfile } = await getUserProfileById(myProfileId, opts);
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
            {/* No like counter anymore */}
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
              <div className="flex flex-col items-center gap-5">
                {/* Heart with fill-up animation: outline always visible, fill sweeps up in sync */}
                <div className="relative w-14 h-14 animate-heartbeat drop-shadow-[0_0_20px_hsl(43_74%_66%_/_0.45)]">
                  {/* Outline heart (always visible) */}
                  <Heart
                    className="absolute inset-0 w-full h-full text-gold-400"
                    fill="none"
                    strokeWidth={1.8}
                  />
                  {/* Filled heart that sweeps upward */}
                  <Heart
                    className="absolute inset-0 w-full h-full text-gold-400 animate-heart-fill"
                    fill="currentColor"
                    strokeWidth={1.8}
                  />
                </div>
                <p className="text-sm font-medium tracking-wide text-gold-300/80">
                  Matching you with someone special…
                </p>
              </div>
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
                currentIndex={currentIndex}
                onNext={handleNext}
                onSwipe={handleSwipe}
                onOpenFilters={() => { logInfo("Discover: filters opened from feed", { component: "Discover", operation: "openFilters" }); setFiltersOpen(true); }}
                onProfileChange={handleProfileChange}
                scrollToTop={scrollToTop}
                onReportClick={currentDisplayProfile ? () => { logInfo("Discover: report opened", { component: "Discover", operation: "openReport", extra: { profileId: currentDisplayProfile.id } }); setReportOpen(true); } : undefined}
                onRoseClick={() => { setRoseError(null); setRoseEmail(""); setShowRoseModal(true); }}
                showRoseButton={false}
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

      {!loading && displayQueue.length > 0 && currentDisplayProfile && (
        <>
          <ReportModal
            open={reportOpen}
            onOpenChange={setReportOpen}
            personName={currentDisplayProfile.name}
            personId={currentDisplayProfile.id}
            context="Discover"
            reporterUserId={currentProfileId || undefined}
            onReportCreated={() => setRefreshKey((k) => k + 1)}
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