import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { signOut } from "aws-amplify/auth";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile, clearTestUser } from "@/utils/auth";
import { usePromDate } from "@/hooks/usePromDate";
import { ENABLE_BACKEND_PROFILE_FETCH, GOOGLE_LOGIN_CHECK } from "@/config";
import { getUrl, uploadData } from "aws-amplify/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, User, Mail, Heart, Tag, Coffee, Mountain, Utensils, Wine, Cigarette, MapPin, Sparkles, Loader2, Vote, LogOut, Camera } from "lucide-react";
import ShareWhatsAppButton from "@/components/ShareWhatsAppButton";
import SparkleBackground from "@/components/SparkleBackground";

const client = generateClient<Schema>();

type UserProfileData = {
  id: string;
  email: string;
  name?: string | null;
  age?: number | null;
  height?: string | null;
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
  profilePicKey?: string | null;
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

// Preference options (matches onboarding)
const alcoholOptions = ["Never", "Sometimes", "Regularly"];
const smokingOptions = ["Never", "Sometimes", "Regularly"];
const foodOptions = ["Veg", "Non-Veg", "Eggetarian", "No preference"];
const favouritePlaceOptions = ["Tea Post", "Library", "LKP", "CR", "Sports Complex", "Nestlé", "Heritage Walk", "Other"];
const teaOrCoffeeOptions = ["Tea", "Coffee", "Both"];
const mountainOrBeachOptions = ["Mountain", "Beach", "Both"];

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
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [authProfile, setAuthProfile] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFunEditSheet, setShowFunEditSheet] = useState(false);
  const [showPollsEditSheet, setShowPollsEditSheet] = useState(false);
  const [funEditValues, setFunEditValues] = useState<Record<string, string>>({});
  const [pollEditValues, setPollEditValues] = useState<Record<string, string>>({});
  const [savingFun, setSavingFun] = useState(false);
  const [savingPolls, setSavingPolls] = useState(false);
  const [showPreferencesEditSheet, setShowPreferencesEditSheet] = useState(false);
  const [preferencesEditValues, setPreferencesEditValues] = useState<Record<string, string>>({});
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [showBioEditSheet, setShowBioEditSheet] = useState(false);
  const [bioEditValue, setBioEditValue] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authMode = GOOGLE_LOGIN_CHECK ? undefined : ("apiKey" as const);
  const { promDate } = usePromDate({ currentUserId: profile?.id ?? "" });

  useEffect(() => {
    if (profile?.id && promDate) {
      navigate("/prom-date", { replace: true });
    }
  }, [profile?.id, promDate, navigate]);

  // Scroll to top when navigating to Profile
  useEffect(() => {
    const main = document.getElementById("app-main");
    if (main) main.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (GOOGLE_LOGIN_CHECK) {
        await signOut();
      } else {
        clearTestUser();
      }
      navigate("/");
    } catch (err) {
      console.error("Error signing out:", err);
      if (!GOOGLE_LOGIN_CHECK) clearTestUser();
      navigate("/");
    } finally {
      setIsLoggingOut(false);
    }
  };

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

  const PREF_KEYS = ["alcoholPreference", "smokingPreference", "foodPreference", "favouritePlace", "teaOrCoffee", "mountainOrBeach"] as const;
  // Height is read-only – never include in any profile update (set at onboarding only)
  const openPreferencesEdit = () => {
    const vals: Record<string, string> = {};
    PREF_KEYS.forEach((key) => {
      vals[key] = profile?.[key]?.toString() || "";
    });
    setPreferencesEditValues(vals);
    setShowPreferencesEditSheet(true);
  };

  const openBioEdit = () => {
    setBioEditValue(profile?.bio || "");
    setShowBioEditSheet(true);
  };

  const saveBio = async () => {
    if (!profile?.id) return;
    setSavingBio(true);
    try {
      // @ts-ignore - authMode
      const { errors } = await client.models.UserProfile.update(
        { id: profile.id, email: profile.email, bio: bioEditValue.trim() || undefined },
        authMode ? { authMode } : undefined
      );
      if (errors) throw new Error(errors[0]?.message);
      setProfile((prev) => prev ? { ...prev, bio: bioEditValue.trim() || undefined } : null);
      setShowBioEditSheet(false);
    } catch (err) {
      console.error("Failed to save bio:", err);
    } finally {
      setSavingBio(false);
    }
  };

  const handleProfilePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.id) return;
    if (!file.type.startsWith("image/")) {
      setPhotoUploadError("Please select an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError("Image must be under 5MB");
      return;
    }
    setPhotoUploadError(null);
    setUploadingPhoto(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `profile-${timestamp}.${ext}`;
      const pathFn = ({ identityId }: { identityId: string }) =>
        `profile-pics/${identityId}/${fileName}`;
      const result = await uploadData({
        path: pathFn,
        data: file,
        options: { contentType: file.type, bucket: "userPhotos" },
      }).result;
      const s3Path = (result as { path?: string }).path ?? `profile-pics/${fileName}`;
      // @ts-ignore - authMode
      const { errors } = await client.models.UserProfile.update(
        { id: profile.id, email: profile.email, profilePicKey: s3Path },
        authMode ? { authMode } : undefined
      );
      if (errors) throw new Error(errors[0]?.message);
      setProfile((prev) => prev ? { ...prev, profilePicKey: s3Path } : null);
      const { url } = await getUrl({ path: s3Path, options: { bucket: "userPhotos" } });
      setProfilePicUrl(url.toString());
    } catch (err) {
      console.error("Failed to upload photo:", err);
      setPhotoUploadError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const savePreferences = async () => {
    if (!profile?.id) return;
    setSavingPreferences(true);
    try {
      const prefData: Record<string, string | undefined> = {};
      PREF_KEYS.forEach((key) => {
        prefData[key] = preferencesEditValues[key] || undefined;
      });
      // @ts-ignore - authMode
      const { errors } = await client.models.UserProfile.update(
        { id: profile.id, email: profile.email, ...prefData },
        authMode ? { authMode } : undefined
      );
      if (errors) throw new Error(errors[0]?.message);
      setProfile((prev) => prev ? { ...prev, ...preferencesEditValues } : null);
      setShowPreferencesEditSheet(false);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setSavingPreferences(false);
    }
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
          const backendProfile = profiles[0] as UserProfileData;
          setProfile(backendProfile);
          
          // Fetch profile picture from S3 if available
          if (backendProfile.profilePicKey) {
            try {
              const { url } = await getUrl({
                path: backendProfile.profilePicKey,
                options: { bucket: "userPhotos" },
              });
              setProfilePicUrl(url.toString());
            } catch (err) {
              console.warn("[Profile] Failed to get profile pic URL:", err);
            }
          }
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
        {/* Header - aligned with Onboarding/Discover (glass, primary accents) */}
        <header className="shrink-0 border-b border-primary/20 bg-transparent">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/discover/profile")}
                className="gap-1.5 border-primary/30 text-foreground/90 hover:bg-primary/10 hover:text-foreground hover:border-primary/50"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <h1 className="font-display text-xl font-bold text-foreground">My Profile</h1>
              <div className="flex gap-1 shrink-0">
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
        </header>

        {/* Scrollable content - tile/card view like Discover */}
        <div className="flex-1 overflow-y-auto scroll-touch">
          <div className="p-4 space-y-6 pb-8 max-w-[500px] mx-auto">
            {/* Profile tile - Discover-style: hero photo + overlay text, then content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden bg-background border border-border/50 shadow-float flex flex-col"
            >
              {/* Hero photo area (like SwipeCard) */}
              <div className="relative aspect-[4/5] w-full bg-muted shrink-0 min-h-[280px] group">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoSelect}
                  className="hidden"
                />
                {profilePicUrl || authProfile?.picture ? (
                  <img
                    src={profilePicUrl || authProfile?.picture || ""}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Avatar className="h-32 w-32 border-4 border-primary/20">
                      <AvatarImage src={undefined} alt="" />
                      <AvatarFallback className="bg-primary/20 text-primary text-5xl font-display">
                        {profile.name?.charAt(0)?.toUpperCase() || profile.email?.charAt(0)?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute bottom-14 right-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 hover:bg-black/70 text-white text-sm font-medium disabled:cursor-wait"
                >
                  {uploadingPhoto ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {uploadingPhoto ? "Uploading..." : "Change photo"}
                </button>
                {photoUploadError && (
                  <p className="absolute bottom-2 left-2 right-2 text-xs text-destructive bg-black/60 px-2 py-1 rounded">
                    {photoUploadError}
                  </p>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h2 className="font-display text-2xl font-bold drop-shadow-md">
                    {profile.name || "Anonymous"}
                    {profile.age ? `, ${profile.age}` : ""}
                    {profile.height ? ` • ${profile.height}` : ""}
                  </h2>
                  {(profile.gender || profile.sexualOrientation) && (
                    <p className="text-sm text-white/90">
                      {profile.gender && profile.sexualOrientation
                        ? `${profile.gender} • ${profile.sexualOrientation}`
                        : (profile.gender || profile.sexualOrientation)}
                    </p>
                  )}
                </div>
              </div>

              {/* Content below hero - chips + email */}
              <div className="px-4 pb-4 pt-3 space-y-3">
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
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground pt-2 border-t border-border/50">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{profile.email}</span>
                </div>
              </div>
            </motion.div>

            {/* Bio tile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
            >
              <h3 className="font-display font-semibold text-lg mb-3 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  About Me
                </span>
                <Button variant="ghost" size="sm" onClick={openBioEdit}>
                  {profile.bio ? "Edit" : "Add"}
                </Button>
              </h3>
              {profile.bio ? (
                <p className="text-muted-foreground leading-relaxed">{profile.bio}</p>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mb-4">
                    Tell others a bit about yourself. What makes you you?
                  </p>
                  <Button variant="outline" onClick={openBioEdit}>
                    Add bio
                  </Button>
                </>
              )}
            </motion.div>

            {/* Bio Edit Sheet */}
            <Sheet open={showBioEditSheet} onOpenChange={setShowBioEditSheet}>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>About Me</SheetTitle>
                </SheetHeader>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Write a short bio to help others get to know you.
                </p>
                <Textarea
                  value={bioEditValue}
                  onChange={(e) => setBioEditValue(e.target.value)}
                  placeholder="Tell others about yourself..."
                  className="min-h-[140px] resize-none"
                />
                <div className="flex gap-2 mt-8">
                  <Button variant="outline" onClick={() => setShowBioEditSheet(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={saveBio} disabled={savingBio} className="flex-1">
                    {savingBio ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Tags/Interests tile */}
            {profile.tags && profile.tags.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
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
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
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
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
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
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
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
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
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
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
              >
                <h3 className="font-display font-semibold text-lg mb-4 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Heart className="w-5 h-5 text-primary" />
                    Preferences
                  </span>
                  <Button variant="ghost" size="sm" onClick={openPreferencesEdit}>
                    Edit
                  </Button>
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

            {/* Add Preferences CTA - when none added yet */}
            {!(profile.alcoholPreference ||
              profile.smokingPreference ||
              profile.foodPreference ||
              profile.favouritePlace ||
              profile.teaOrCoffee ||
              profile.mountainOrBeach) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
              >
                <h3 className="font-display font-semibold text-lg mb-2 flex items-center gap-2">
                  <Heart className="w-5 h-5 text-primary" />
                  Preferences
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Alcohol, smoking, food, tea/coffee – help matches know your vibe.
                </p>
                <Button variant="outline" onClick={openPreferencesEdit}>
                  Add preferences
                </Button>
              </motion.div>
            )}

            {/* Preferences Edit Sheet */}
            <Sheet open={showPreferencesEditSheet} onOpenChange={setShowPreferencesEditSheet}>
              <SheetContent side="right" className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Preferences</SheetTitle>
                </SheetHeader>
                <p className="text-sm text-muted-foreground mt-2 mb-6">
                  Edit your lifestyle preferences. These influence discovery matching.
                </p>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm">Alcohol</Label>
                    <Select
                      value={preferencesEditValues.alcoholPreference || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, alcoholPreference: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {alcoholOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Smoking</Label>
                    <Select
                      value={preferencesEditValues.smokingPreference || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, smokingPreference: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {smokingOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Food</Label>
                    <Select
                      value={preferencesEditValues.foodPreference || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, foodPreference: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {foodOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Tea or Coffee</Label>
                    <Select
                      value={preferencesEditValues.teaOrCoffee || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, teaOrCoffee: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {teaOrCoffeeOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Mountain or Beach</Label>
                    <Select
                      value={preferencesEditValues.mountainOrBeach || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, mountainOrBeach: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {mountainOrBeachOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm">Favourite place on campus</Label>
                    <Select
                      value={preferencesEditValues.favouritePlace || ""}
                      onValueChange={(v) => setPreferencesEditValues((prev) => ({ ...prev, favouritePlace: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {favouritePlaceOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2 mt-8">
                  <Button variant="outline" onClick={() => setShowPreferencesEditSheet(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={savePreferences} disabled={savingPreferences} className="flex-1">
                    {savingPreferences ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Share via WhatsApp */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="rounded-2xl p-6 border border-border/50 bg-background/60 backdrop-blur-sm shadow-float"
            >
              <h3 className="font-display font-semibold text-lg mb-2 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Invite friends
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Share Starlit by the Brick with your batchmates – the more, the merrier!
              </p>
              <ShareWhatsAppButton
                variant="outline"
                size="default"
                className="w-full gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
                showLabel={true}
              />
            </motion.div>

            {/* Log out at end of profile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="pt-2 pb-6"
            >
              <Button
                variant="outline"
                className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Log out
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
