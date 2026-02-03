import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile } from "@/utils/auth";
import { ENABLE_BACKEND_PROFILE_FETCH, GOOGLE_LOGIN_CHECK } from "@/config";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowLeft, User, Mail, Heart, Tag, Coffee, Mountain, Utensils, Wine, Cigarette, MapPin, Sparkles, Loader2, Vote } from "lucide-react";
import SparkleBackground from "@/components/SparkleBackground";

const client = generateClient<Schema>();

type UserProfileData = {
  id: string;
  email: string;
  name?: string | null;
  age?: number | null;
  gender?: string | null;
  sexualOrientation?: string | null;
  bio?: string | null;
  tags?: string[] | null;
  alcoholPreference?: string | null;
  smokingPreference?: string | null;
  foodPreference?: string | null;
  favouritePlace?: string | null;
  teaOrCoffee?: string | null;
  mountainOrBeach?: string | null;
  morningOrNightPerson?: string | null;
  idealWeekend?: string | null;
  goToKaraokeSong?: string | null;
  superpowerChoice?: string | null;
  favouriteMovieGenre?: string | null;
  secretTalent?: string | null;
  favouriteChaiSpot?: string | null;
  idealPromOutfit?: string | null;
  messOrOutside?: string | null;
  bestDateSpotOnCampus?: string | null;
  bollywoodOrEnglishAtProm?: string | null;
  lateNightRitual?: string | null;
  perfectSaturdayAtIIMA?: string | null;
  goToBollywoodSong?: string | null;
  pollTniteOrStayIn?: string | null;
  poll145Surprises?: string | null;
  pollTeaPostOrNestle?: string | null;
  pollMaggiOrChai?: string | null;
  pollDormOrLibrary?: string | null;
  pollSectionOrBatch?: string | null;
  pollLKPOrHeritage?: string | null;
  pollMorningOrAfternoon?: string | null;
  pollCROrLKP?: string | null;
  onboardingCompleted?: boolean | null;
};

// This or That polls - IIMA specific
const POLLS: { key: keyof UserProfileData; optionA: string; optionB: string; label: string }[] = [
  { key: "pollTniteOrStayIn", optionA: "Tnite", optionB: "Stay in", label: "Tuesday night?" },
  { key: "poll145Surprises", optionA: "Love them", optionB: "Avoid them", label: "1:45 surprises?" },
  { key: "pollTeaPostOrNestle", optionA: "Tea Post", optionB: "Nestlé", label: "Chai spot?" },
  { key: "pollMaggiOrChai", optionA: "Maggi", optionB: "Chai", label: "2am craving?" },
  { key: "pollDormOrLibrary", optionA: "Dorm", optionB: "Library", label: "Late-night grind?" },
  { key: "pollSectionOrBatch", optionA: "Section party", optionB: "Batch party", label: "Party vibe?" },
  { key: "pollLKPOrHeritage", optionA: "LKP", optionB: "Heritage walk", label: "Evening stroll?" },
  { key: "pollMorningOrAfternoon", optionA: "Morning class", optionB: "Afternoon class", label: "Preferred slot?" },
  { key: "pollCROrLKP", optionA: "CR", optionB: "LKP", label: "Weekend hangout?" },
];

const FUN_QUESTIONS: { key: keyof UserProfileData; label: string; placeholder: string }[] = [
  // IIMA-specific
  { key: "favouriteChaiSpot", label: "Favourite chai adda on campus?", placeholder: "e.g. Tea Post, Nestlé, Room chai" },
  { key: "messOrOutside", label: "Mess loyalist or outside foodie?", placeholder: "e.g. Mess loyalist, Depends on the day" },
  { key: "bestDateSpotOnCampus", label: "Best spot for a date on campus?", placeholder: "e.g. Heritage walk, Tea Post" },
  { key: "lateNightRitual", label: "Late-night ritual at IIMA?", placeholder: "e.g. Maggi run, 2am chai at Tea Post" },
  { key: "perfectSaturdayAtIIMA", label: "Perfect Saturday at IIMA looks like?", placeholder: "e.g. Sleep in, chai, then section party" },
  // Indian prom themed
  { key: "idealPromOutfit", label: "Ideal prom outfit?", placeholder: "e.g. Saree, Kurta, Western, Fusion" },
  { key: "bollywoodOrEnglishAtProm", label: "Bollywood or English at prom?", placeholder: "e.g. Bollywood, Both" },
  { key: "goToBollywoodSong", label: "Go-to Bollywood song for the dance floor?", placeholder: "e.g. Pehla Nasha" },
  // General fun
  { key: "morningOrNightPerson", label: "Morning person or night owl?", placeholder: "e.g. Night owl" },
  { key: "secretTalent", label: "Secret talent nobody knows", placeholder: "e.g. I can quote SRK dialogues" },
];

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [authProfile, setAuthProfile] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFunEditSheet, setShowFunEditSheet] = useState(false);
  const [showPollsEditSheet, setShowPollsEditSheet] = useState(false);
  const [funEditValues, setFunEditValues] = useState<Record<string, string>>({});
  const [pollEditValues, setPollEditValues] = useState<Record<string, string>>({});
  const [savingFun, setSavingFun] = useState(false);
  const [savingPolls, setSavingPolls] = useState(false);

  const authMode = GOOGLE_LOGIN_CHECK ? undefined : ("apiKey" as const);

  const openFunEdit = () => {
    const vals: Record<string, string> = {};
    FUN_QUESTIONS.forEach(({ key }) => {
      vals[key] = profile?.[key]?.toString() || "";
    });
    setFunEditValues(vals);
    setShowFunEditSheet(true);
  };

  const openPollsEdit = () => {
    const vals: Record<string, string> = {};
    POLLS.forEach(({ key }) => {
      vals[key] = profile?.[key]?.toString() || "";
    });
    setPollEditValues(vals);
    setShowPollsEditSheet(true);
  };

  const savePolls = async () => {
    if (!profile?.id) return;
    setSavingPolls(true);
    try {
      const pollData: Record<string, string | undefined> = {};
      POLLS.forEach(({ key }) => {
        pollData[key] = pollEditValues[key] || undefined;
      });
      // @ts-ignore - authMode
      const { errors } = await client.models.UserProfile.update(
        { id: profile.id, email: profile.email, ...pollData },
        authMode ? { authMode } : undefined
      );
      if (errors) throw new Error(errors[0]?.message);
      setProfile((prev) => prev ? { ...prev, ...pollEditValues } : null);
      setShowPollsEditSheet(false);
    } catch (err) {
      console.error("Failed to save polls:", err);
    } finally {
      setSavingPolls(false);
    }
  };

  const saveFunAnswers = async () => {
    if (!profile?.id) return;
    setSavingFun(true);
    try {
      // @ts-ignore - authMode
      const { errors } = await client.models.UserProfile.update(
        {
          id: profile.id,
          email: profile.email,
          morningOrNightPerson: funEditValues.morningOrNightPerson || undefined,
          idealWeekend: funEditValues.idealWeekend || undefined,
          goToKaraokeSong: funEditValues.goToKaraokeSong || undefined,
          superpowerChoice: funEditValues.superpowerChoice || undefined,
          favouriteMovieGenre: funEditValues.favouriteMovieGenre || undefined,
          secretTalent: funEditValues.secretTalent || undefined,
          favouriteChaiSpot: funEditValues.favouriteChaiSpot || undefined,
          idealPromOutfit: funEditValues.idealPromOutfit || undefined,
          messOrOutside: funEditValues.messOrOutside || undefined,
          bestDateSpotOnCampus: funEditValues.bestDateSpotOnCampus || undefined,
          bollywoodOrEnglishAtProm: funEditValues.bollywoodOrEnglishAtProm || undefined,
          lateNightRitual: funEditValues.lateNightRitual || undefined,
          perfectSaturdayAtIIMA: funEditValues.perfectSaturdayAtIIMA || undefined,
          goToBollywoodSong: funEditValues.goToBollywoodSong || undefined,
        },
        authMode ? { authMode } : undefined
      );
      if (errors) throw new Error(errors[0]?.message);
      setProfile((prev) => prev ? { ...prev, ...funEditValues } : null);
      setShowFunEditSheet(false);
    } catch (err) {
      console.error("Failed to save fun answers:", err);
    } finally {
      setSavingFun(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError(null);

        // Get authenticated user info
        const authUser = await getUserProfile();
        if (!authUser || !authUser.email) {
          setError("Not authenticated. Please sign in.");
          return;
        }

        setAuthProfile({
          email: authUser.email,
          name: authUser.name,
          picture: authUser.picture,
        });

        // Check if backend profile fetch is enabled
        if (!ENABLE_BACKEND_PROFILE_FETCH) {
          console.log("[Config] Backend profile fetch is disabled. Showing auth profile only.");
          setError("Profile fetching is currently disabled. Please complete onboarding.");
          return;
        }

        // Fetch user profile from backend
        const { data: profiles, errors } = await client.models.UserProfile.list({
          filter: {
            email: {
              eq: authUser.email,
            },
          },
        });

        if (errors) {
          console.error("Error fetching profile:", errors);
          setError("Failed to load profile. Please try again.");
          return;
        }

        if (profiles && profiles.length > 0) {
          setProfile(profiles[0] as UserProfileData);
        } else {
          setError("Profile not found. Please complete onboarding first.");
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
        setError("An error occurred while loading your profile.");
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  if (loading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center w-full">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center p-4 w-full">
        <SparkleBackground />
        <div className="relative z-10 w-full max-w-md">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={() => navigate("/discover/profile")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Discover
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center p-4 w-full">
        <SparkleBackground />
        <div className="relative z-10 w-full max-w-md">
          <div className="glass rounded-2xl p-6 text-center">
            <p className="text-muted-foreground mb-4">Profile not found.</p>
            <Button variant="outline" onClick={() => navigate("/onboarding")}>
              Complete Onboarding
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col w-full">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col min-h-0 w-full max-w-[500px] mx-auto">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-border/50 bg-background/95 backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/discover/profile")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="font-display text-xl font-bold flex-1">My Profile</h1>
            <div className="flex gap-1">
              <Sheet open={showPollsEditSheet} onOpenChange={setShowPollsEditSheet}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={openPollsEdit} title="This or That">
                    <Vote className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle>This or That</SheetTitle>
                  </SheetHeader>
                  <p className="text-sm text-muted-foreground mt-2 mb-6">
                    IIMA-specific polls. Pick your side for each!
                  </p>
                  <div className="space-y-6">
                    {POLLS.map(({ key, label, optionA, optionB }) => (
                      <div key={key}>
                        <Label className="text-sm mb-2 block">{label}</Label>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant={pollEditValues[key] === optionA ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setPollEditValues((v) => ({ ...v, [key]: optionA }))}
                          >
                            {optionA}
                          </Button>
                          <Button
                            type="button"
                            variant={pollEditValues[key] === optionB ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setPollEditValues((v) => ({ ...v, [key]: optionB }))}
                          >
                            {optionB}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-8">
                    <Button variant="outline" onClick={() => setShowPollsEditSheet(false)} className="flex-1">
                      Cancel
                    </Button>
                    <Button onClick={savePolls} disabled={savingPolls} className="flex-1">
                      {savingPolls ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
              <Sheet open={showFunEditSheet} onOpenChange={setShowFunEditSheet}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={openFunEdit} title="Fun Answers">
                    <Sparkles className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Fun Answers</SheetTitle>
                </SheetHeader>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Add optional fun answers to help others get to know you better.
                </p>
                <div className="space-y-4">
                  {FUN_QUESTIONS.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label htmlFor={key} className="text-sm">{label}</Label>
                      <Input
                        id={key}
                        value={funEditValues[key] ?? ""}
                        onChange={(e) => setFunEditValues((v) => ({ ...v, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-8">
                  <Button variant="outline" onClick={() => setShowFunEditSheet(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={saveFunAnswers} disabled={savingFun} className="flex-1">
                    {savingFun ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto scroll-touch">
          <div className="max-w-2xl mx-auto p-4 space-y-6 pb-8">
            {/* Profile Header Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-6"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <Avatar className="h-24 w-24 border-4 border-primary/20 mb-4">
                  <AvatarImage src={authProfile?.picture} alt={profile.name || "Profile"} />
                  <AvatarFallback className="bg-primary/20 text-primary text-3xl font-display">
                    {profile.name?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <h2 className="font-display text-2xl font-bold mb-1">
                  {profile.name || "Anonymous"}
                </h2>
                {profile.age && (
                  <p className="text-muted-foreground text-sm mb-2">
                    {profile.age} years old
                  </p>
                )}
                {profile.gender && (
                  <p className="text-muted-foreground text-sm">
                    {profile.gender}
                    {profile.sexualOrientation && ` • ${profile.sexualOrientation}`}
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground pt-4 border-t border-border/50">
                <Mail className="w-4 h-4" />
                <span className="truncate">{profile.email}</span>
              </div>
            </motion.div>

            {/* Bio */}
            {profile.bio && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  About Me
                </h3>
                <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
              </motion.div>
            )}

            {/* Tags/Interests */}
            {profile.tags && profile.tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-primary" />
                  Interests
                </h3>
                <div className="flex flex-wrap gap-2">
                  {profile.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Fun Answers */}
            {(profile.morningOrNightPerson || profile.idealWeekend || profile.goToKaraokeSong ||
              profile.superpowerChoice || profile.favouriteMovieGenre || profile.secretTalent ||
              profile.favouriteChaiSpot || profile.idealPromOutfit || profile.messOrOutside ||
              profile.bestDateSpotOnCampus || profile.bollywoodOrEnglishAtProm || profile.lateNightRitual ||
              profile.perfectSaturdayAtIIMA || profile.goToBollywoodSong) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Fun Answers
                  </span>
                  <Button variant="ghost" size="sm" onClick={openFunEdit}>
                    Edit
                  </Button>
                </h3>
                <div className="space-y-3">
                  {profile.favouriteChaiSpot && (
                    <div>
                      <span className="text-xs text-muted-foreground">Favourite chai adda</span>
                      <p className="text-sm font-medium">{profile.favouriteChaiSpot}</p>
                    </div>
                  )}
                  {profile.messOrOutside && (
                    <div>
                      <span className="text-xs text-muted-foreground">Mess or outside?</span>
                      <p className="text-sm font-medium">{profile.messOrOutside}</p>
                    </div>
                  )}
                  {profile.bestDateSpotOnCampus && (
                    <div>
                      <span className="text-xs text-muted-foreground">Best date spot on campus</span>
                      <p className="text-sm font-medium">{profile.bestDateSpotOnCampus}</p>
                    </div>
                  )}
                  {profile.lateNightRitual && (
                    <div>
                      <span className="text-xs text-muted-foreground">Late-night ritual</span>
                      <p className="text-sm font-medium">{profile.lateNightRitual}</p>
                    </div>
                  )}
                  {profile.perfectSaturdayAtIIMA && (
                    <div>
                      <span className="text-xs text-muted-foreground">Perfect Saturday at IIMA</span>
                      <p className="text-sm font-medium">{profile.perfectSaturdayAtIIMA}</p>
                    </div>
                  )}
                  {profile.idealPromOutfit && (
                    <div>
                      <span className="text-xs text-muted-foreground">Ideal prom outfit</span>
                      <p className="text-sm font-medium">{profile.idealPromOutfit}</p>
                    </div>
                  )}
                  {profile.bollywoodOrEnglishAtProm && (
                    <div>
                      <span className="text-xs text-muted-foreground">Bollywood or English at prom?</span>
                      <p className="text-sm font-medium">{profile.bollywoodOrEnglishAtProm}</p>
                    </div>
                  )}
                  {profile.goToBollywoodSong && (
                    <div>
                      <span className="text-xs text-muted-foreground">Go-to Bollywood song</span>
                      <p className="text-sm font-medium">{profile.goToBollywoodSong}</p>
                    </div>
                  )}
                  {profile.morningOrNightPerson && (
                    <div>
                      <span className="text-xs text-muted-foreground">Morning or night person?</span>
                      <p className="text-sm font-medium">{profile.morningOrNightPerson}</p>
                    </div>
                  )}
                  {profile.secretTalent && (
                    <div>
                      <span className="text-xs text-muted-foreground">Secret talent</span>
                      <p className="text-sm font-medium">{profile.secretTalent}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Add Fun Answers CTA - when none added yet */}
            {!(
              profile.morningOrNightPerson || profile.idealWeekend || profile.goToKaraokeSong ||
              profile.superpowerChoice || profile.favouriteMovieGenre || profile.secretTalent ||
              profile.favouriteChaiSpot || profile.idealPromOutfit || profile.messOrOutside ||
              profile.bestDateSpotOnCampus || profile.bollywoodOrEnglishAtProm || profile.lateNightRitual ||
              profile.perfectSaturdayAtIIMA || profile.goToBollywoodSong
            ) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-2 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Fun Answers
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Add optional fun answers to help others get to know you better.
                </p>
                <Button variant="outline" onClick={openFunEdit}>
                  Add fun answers
                </Button>
              </motion.div>
            )}

            {/* This or That Polls */}
            {(profile.pollTniteOrStayIn || profile.poll145Surprises || profile.pollTeaPostOrNestle ||
              profile.pollMaggiOrChai || profile.pollDormOrLibrary || profile.pollSectionOrBatch ||
              profile.pollLKPOrHeritage || profile.pollMorningOrAfternoon || profile.pollCROrLKP) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Vote className="w-5 h-5 text-primary" />
                    This or That
                  </span>
                  <Button variant="ghost" size="sm" onClick={openPollsEdit}>
                    Edit
                  </Button>
                </h3>
                <div className="space-y-2">
                  {POLLS.map(({ key, label, optionA, optionB }) => {
                    const val = profile[key]?.toString();
                    if (!val || (val !== optionA && val !== optionB)) return null;
                    return (
                      <div key={key} className="flex justify-between items-center py-2 border-b border-border/50 last:border-0">
                        <span className="text-sm text-muted-foreground">{label}</span>
                        <span className="text-sm font-medium">{val}</span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Add Polls CTA - when none added yet */}
            {!(profile.pollTniteOrStayIn || profile.poll145Surprises || profile.pollTeaPostOrNestle ||
              profile.pollMaggiOrChai || profile.pollDormOrLibrary || profile.pollSectionOrBatch ||
              profile.pollLKPOrHeritage || profile.pollMorningOrAfternoon || profile.pollCROrLKP) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-2 flex items-center gap-2">
                  <Vote className="w-5 h-5 text-primary" />
                  This or That
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pick your side on IIMA-specific polls – Tnite vs Stay in, 1:45 surprises, Tea Post vs Nestlé, and more!
                </p>
                <Button variant="outline" onClick={openPollsEdit}>
                  Add polls
                </Button>
              </motion.div>
            )}

            {/* Lifestyle Preferences */}
            {(profile.alcoholPreference ||
              profile.smokingPreference ||
              profile.foodPreference ||
              profile.favouritePlace ||
              profile.teaOrCoffee ||
              profile.mountainOrBeach) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="glass rounded-2xl p-6"
              >
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Preferences
                </h3>
                <div className="space-y-3">
                  {profile.alcoholPreference && (
                    <div className="flex items-center gap-3">
                      <Wine className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Alcohol:</span>
                      <span className="text-sm font-medium">{profile.alcoholPreference}</span>
                    </div>
                  )}
                  {profile.smokingPreference && (
                    <div className="flex items-center gap-3">
                      <Cigarette className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Smoking:</span>
                      <span className="text-sm font-medium">{profile.smokingPreference}</span>
                    </div>
                  )}
                  {profile.foodPreference && (
                    <div className="flex items-center gap-3">
                      <Utensils className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Food:</span>
                      <span className="text-sm font-medium">{profile.foodPreference}</span>
                    </div>
                  )}
                  {profile.favouritePlace && (
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Favourite Place:</span>
                      <span className="text-sm font-medium">{profile.favouritePlace}</span>
                    </div>
                  )}
                  {profile.teaOrCoffee && (
                    <div className="flex items-center gap-3">
                      <Coffee className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Tea or Coffee:</span>
                      <span className="text-sm font-medium">{profile.teaOrCoffee}</span>
                    </div>
                  )}
                  {profile.mountainOrBeach && (
                    <div className="flex items-center gap-3">
                      <Mountain className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Mountain or Beach:</span>
                      <span className="text-sm font-medium">{profile.mountainOrBeach}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
