import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { getUserProfile } from "@/utils/auth";
import { ENABLE_BACKEND_PROFILE_FETCH } from "@/config";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, User, Mail, Heart, Tag, Coffee, Mountain, Utensils, Wine, Cigarette, MapPin } from "lucide-react";
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
  onboardingCompleted?: boolean | null;
};

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [authProfile, setAuthProfile] = useState<{ email?: string; name?: string; picture?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
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
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center p-4">
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
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center p-4">
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
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 border-b border-border/50 bg-background/95 backdrop-blur-lg">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/discover/profile")}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
            <h1 className="font-display text-xl font-bold flex-1">My Profile</h1>
            <div className="w-16" /> {/* Spacer for centering */}
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
