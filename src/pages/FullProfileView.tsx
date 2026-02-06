import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { useScrollWheel } from "@/hooks/useScrollWheel";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, X, ArrowLeft, Wine, Cigarette, Utensils, Coffee, Mountain, MapPin, Sparkles, Vote } from "lucide-react";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { useMatch } from "@/hooks/useMatch";
import { MatchPopup } from "@/components/discovery/MatchPopup";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUrl } from "aws-amplify/storage";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import SparkleBackground from "@/components/SparkleBackground";
import ReportFloatingButton from "@/components/ReportFloatingButton";
import { logError } from "@/utils/logger";

const client = generateClient<Schema>();

/** Transform backend UserProfile to DiscoveryProfileFull (matches Discover.tsx logic) */
function transformBackendProfile(backendProfile: Schema["UserProfile"]["type"]): DiscoveryProfileFull {
  const photoUrls: string[] = [];
  const nonNegotiables: string[] = [];
  if (backendProfile.smokingPreference === "Never") nonNegotiables.push("Non-smoking");
  else if (["Passively", "Sometimes", "Regularly"].includes(backendProfile.smokingPreference || "")) nonNegotiables.push("Smoking okay");
  if (backendProfile.alcoholPreference === "Never") nonNegotiables.push("No alcohol");
  else if (backendProfile.alcoholPreference === "Sometimes" || backendProfile.alcoholPreference === "Regularly") nonNegotiables.push("Alcohol okay");
  if (backendProfile.intention === "Date for Prom" || backendProfile.intention === "In a relationship, looking for a prom date") nonNegotiables.push("Serious intent");
  else if (backendProfile.intention === "Not Sure") nonNegotiables.push("Casual / open");
  if (backendProfile.foodPreference === "Veg") nonNegotiables.push("Veg only");
  else nonNegotiables.push("No dietary preference");

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
    nonNegotiables,
  };
}

export default function FullProfileView() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { recordSwipe } = useMatch();
  const scrollRef = useScrollWheel();
  const [matchPopupOpen, setMatchPopupOpen] = useState(false);
  const [matchedMatchId, setMatchedMatchId] = useState<string | null>(null);

  const state = location.state as { profile?: DiscoveryProfileFull; fromChat?: boolean };
  const fromChat = state?.fromChat === true;

  const [profile, setProfile] = useState<DiscoveryProfileFull | null>(
    () => state?.profile ?? null
  );
  const [loading, setLoading] = useState(!state?.profile);
  const [error, setError] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  // Fetch profile from backend when not passed via state
  useEffect(() => {
    if (!profileId || profile) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
        // @ts-ignore - authMode type
        const { data, errors } = await client.models.UserProfile.get({ id: profileId }, authMode ? { authMode } : undefined);

        if (errors || !data) {
          setError("Profile not found.");
          setProfile(null);
          return;
        }

        const transformed = transformBackendProfile(data);
        if (data.profilePicKey) {
          try {
            const { url } = await getUrl({ path: data.profilePicKey, options: { bucket: "userPhotos" } });
            transformed.photoUrls = [url.toString()];
          } catch (err) {
            logError(err, { component: "FullProfileView", operation: "fetchProfilePic", extra: { profileId, profilePicKey: data.profilePicKey } });
          }
        }
        setProfile(transformed);
      } catch (err) {
        logError(err, { component: "FullProfileView", operation: "fetchProfile", extra: { profileId } });
        setError("Failed to load profile.");
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [profileId, profile]);

  const handleLike = useCallback(async () => {
    if (!profile) return;
    const result = await recordSwipe(profile.id, "like");
    if (result.isMatch) {
      setMatchedMatchId(result.matchId || null);
      setMatchPopupOpen(true);
    } else {
      navigate("/discover/profile");
    }
  }, [profile, recordSwipe, navigate]);

  const handlePass = useCallback(() => {
    if (profile) {
      recordSwipe(profile.id, "pass");
      navigate("/discover/profile");
    }
  }, [profile, recordSwipe, navigate]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center w-full">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3 mx-auto" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center p-4 w-full">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <p className="text-muted-foreground mb-4">{error ?? "Profile not found."}</p>
          <Button variant="outline" onClick={() => navigate("/discover/profile")}>
            Back to Discover
          </Button>
        </div>
      </div>
    );
  }

  const aboutItems: { icon?: React.ElementType; label: string }[] = [];
  if (profile.alcoholPreference) aboutItems.push({ icon: Wine, label: profile.alcoholPreference });
  if (profile.smokingPreference) aboutItems.push({ icon: Cigarette, label: profile.smokingPreference });
  if (profile.foodPreference) aboutItems.push({ icon: Utensils, label: profile.foodPreference });
  if (profile.teaOrCoffee) aboutItems.push({ icon: Coffee, label: profile.teaOrCoffee });
  if (profile.mountainOrBeach) aboutItems.push({ icon: Mountain, label: profile.mountainOrBeach });
  if (profile.favouritePlace) aboutItems.push({ icon: MapPin, label: profile.favouritePlace });

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col w-full">
      <SparkleBackground />

      <ReportFloatingButton onClick={() => setReportOpen(true)} />
      <ReportModal
        open={reportOpen}
        onOpenChange={setReportOpen}
        personName={profile.name}
        personId={profile.id}
        context="Profile"
      />
      
      <div className="relative z-10 flex flex-col flex-1 min-h-0 w-full max-w-[500px] mx-auto">
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scroll-touch outline-none pb-4"
          tabIndex={0}
        >
          <header className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-background/95 backdrop-blur-md shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/discover/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-display font-semibold">Profile</span>
          <div className="w-10" />
        </header>

        {/* Photo */}
        <div className="aspect-[4/5] bg-muted flex items-center justify-center shrink-0">
          {profile.photoUrls?.[0] ? (
            <img src={profile.photoUrls[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-6xl font-display text-primary/40">{profile.name.charAt(0)}</span>
          )}
        </div>

        <div className="p-4 space-y-6 max-w-[500px] mx-auto">
          {/* Name, age */}
          <section>
            <h1 className="font-display text-2xl font-bold">
              {profile.name}, {profile.age}
            </h1>
          </section>

          {/* Basic info: Gender, Sexual Orientation, Cohort, Hometown, Dating Intention */}
          {(profile.gender || profile.sexualOrientation || profile.cohort || profile.hometown || profile.intention) && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">About</h2>
              <div className="flex flex-wrap gap-2">
                {profile.gender && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.gender}
                  </span>
                )}
                {profile.sexualOrientation && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.sexualOrientation}
                  </span>
                )}
                {profile.cohort && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.cohort}
                  </span>
                )}
                {profile.hometown && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.hometown}
                  </span>
                )}
                {profile.intention && (
                  <span className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-medium border border-primary/20">
                    {profile.intention}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Bio */}
          {profile.bio && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">About</h2>
              <p className="text-foreground">{profile.bio}</p>
            </section>
          )}

          {/* Lifestyle preferences */}
          {aboutItems.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Lifestyle</h2>
              <div className="flex flex-wrap gap-2">
                {aboutItems.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted/80 text-foreground text-sm border border-border/50"
                  >
                    {item.icon && <item.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                    {item.label}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Fun answers */}
          {(profile.perfectSaturdayAtIIMA || profile.secretTalent || profile.bestDateSpotOnCampus ||
            profile.favouriteMovieGenre || profile.lateNightRitual || profile.goToKaraokeSong || profile.superpowerChoice) && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Fun answers
              </h2>
              <ul className="space-y-2 text-sm">
                {profile.perfectSaturdayAtIIMA && (
                  <li><span className="text-muted-foreground">Perfect weekend:</span> {profile.perfectSaturdayAtIIMA}</li>
                )}
                {profile.secretTalent && (
                  <li><span className="text-muted-foreground">Secret talent:</span> {profile.secretTalent}</li>
                )}
                {profile.bestDateSpotOnCampus && (
                  <li><span className="text-muted-foreground">Date spot:</span> {profile.bestDateSpotOnCampus}</li>
                )}
                {profile.favouriteMovieGenre && (
                  <li><span className="text-muted-foreground">Favourite movie genre:</span> {profile.favouriteMovieGenre}</li>
                )}
                {profile.lateNightRitual && (
                  <li><span className="text-muted-foreground">Late-night ritual:</span> {profile.lateNightRitual}</li>
                )}
                {profile.goToKaraokeSong && (
                  <li><span className="text-muted-foreground">Karaoke song:</span> {profile.goToKaraokeSong}</li>
                )}
                {profile.superpowerChoice && (
                  <li><span className="text-muted-foreground">Superpower:</span> {profile.superpowerChoice}</li>
                )}
              </ul>
            </section>
          )}

          {/* This or That polls */}
          {(profile.poll145Surprises || profile.pollMaggiOrChai || profile.pollSectionOrBatch ||
            profile.pollDormOrLibrary || profile.pollNetflixOrGoingOut || profile.pollTextingOrCalling ||
            profile.pollSurpriseOrPlanned || profile.pollDeepOrSilly || profile.pollBoredInRoom || profile.pollCasualOrDressed) && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Vote className="w-4 h-4" />
                This or That
              </h2>
              <ul className="space-y-1.5 text-sm">
                {profile.pollTextingOrCalling && (
                  <li><span className="text-muted-foreground">Reach out:</span> {profile.pollTextingOrCalling}</li>
                )}
                {profile.poll145Surprises && (
                  <li><span className="text-muted-foreground">1:45 surprises:</span> {profile.poll145Surprises}</li>
                )}
                {profile.pollSurpriseOrPlanned && (
                  <li><span className="text-muted-foreground">Planning style:</span> {profile.pollSurpriseOrPlanned}</li>
                )}
                {profile.pollMaggiOrChai && (
                  <li><span className="text-muted-foreground">2am craving:</span> {profile.pollMaggiOrChai}</li>
                )}
                {profile.pollDeepOrSilly && (
                  <li><span className="text-muted-foreground">Conversation vibe:</span> {profile.pollDeepOrSilly}</li>
                )}
                {profile.pollSectionOrBatch && (
                  <li><span className="text-muted-foreground">Party vibe:</span> {profile.pollSectionOrBatch}</li>
                )}
                {profile.pollDormOrLibrary && (
                  <li><span className="text-muted-foreground">Late-night grind:</span> {profile.pollDormOrLibrary}</li>
                )}
                {profile.pollBoredInRoom && (
                  <li><span className="text-muted-foreground">Bored in your room:</span> {profile.pollBoredInRoom}</li>
                )}
                {profile.pollNetflixOrGoingOut && (
                  <li><span className="text-muted-foreground">Perfect evening:</span> {profile.pollNetflixOrGoingOut}</li>
                )}
                {profile.pollCasualOrDressed && (
                  <li><span className="text-muted-foreground">Going-out look:</span> {profile.pollCasualOrDressed}</li>
                )}
              </ul>
            </section>
          )}

          {/* Campus / lifestyle */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Campus & lifestyle
            </h2>
            <ul className="space-y-1 text-sm">
              {profile.favouritePlace && (
                <li>Happy place: {profile.favouritePlace}</li>
              )}
              {profile.teaOrCoffee && (
                <li>Your poison: {profile.teaOrCoffee}</li>
              )}
              {profile.mountainOrBeach && (
                <li>Vacation vibes: {profile.mountainOrBeach}</li>
              )}
              {profile.foodPreference && (
                <li>Food: {profile.foodPreference}</li>
              )}
            </ul>
          </section>

          {/* Non-negotiables */}
          {profile.nonNegotiables?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">I'm looking for</h2>
              <div className="flex flex-wrap gap-2">
                {profile.nonNegotiables.map((n) => (
                  <span key={n} className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-medium border border-primary/20">
                    {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Interests */}
          {profile.tags?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Interests</h2>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span key={tag} className="px-3 py-1.5 rounded-full bg-muted text-foreground text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {!fromChat && <div className="h-24" />}
        </div>
      </div>

      {/* Fixed Like / Pass - only when viewing from Discover, not from chat */}
      {!fromChat && (
        <div className="fixed bottom-16 left-0 right-0 max-w-[500px] mx-auto px-4 py-3 border-t border-border/50 bg-background/95 backdrop-blur-md flex items-center justify-center gap-6 safe-area-pb z-20">
          <Button variant="outline" size="icon" className="h-12 w-12 rounded-full" onClick={handlePass}>
            <X className="w-6 h-6" />
          </Button>
          <Button variant="default" size="icon" className="h-12 w-12 rounded-full bg-primary" onClick={handleLike}>
            <Heart className="w-6 h-6 fill-primary-foreground text-primary-foreground" />
          </Button>
        </div>
      )}
    </div>

    <MatchPopup
        open={matchPopupOpen}
        onOpenChange={setMatchPopupOpen}
        matchedProfile={profile}
        matchId={matchedMatchId}
        onKeepSwiping={() => {
          setMatchedMatchId(null);
          navigate("/discover/profile");
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
