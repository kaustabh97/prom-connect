import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SparkleBackground from "@/components/SparkleBackground";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { fetchAuthSession } from "aws-amplify/auth";
import { getUserProfile } from "@/utils/auth";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles,
  User,
  Heart,
  MessageCircle,
  X,
  Lock,
  Shield,
  AlertTriangle
} from "lucide-react";

import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

type OnboardingStep = "type" | "basics" | "interests" | "prompts" | "complete";

interface LifestyleAnswers {
  alcohol: string;
  smoking: string;
  food: string;
  favouritePlace: string;
  teaOrCoffee: string;
  mountainOrBeach: string;
}

interface ProfileData {
  type: "individual" | "couple";
  name: string;
  partnerName?: string;
  age: number;
  gender: string;
  sexualOrientation: string;
  bio: string;
  tags: string[];
  lifestyle: LifestyleAnswers;
}

const availableTags = [
  "Running", "Music", "Debate", "Coffee", "Reading", "Movies",
  "Gaming", "Dance", "Food", "Travel", "Photography", "Art",
  "Sports", "Cooking", "Tech", "Finance", "Consulting", "Startups"
];

const lifestyleQuestions: { key: keyof LifestyleAnswers; question: string; options: string[] }[] = [
  { key: "alcohol", question: "Alcohol?", options: ["Sometimes", "Regularly", "Never"] },
  { key: "smoking", question: "Smoking?", options: ["Sometimes", "Regularly", "Never"] },
  { key: "food", question: "Food preference?", options: ["Veg", "Non-Veg", "Eggetarian"] },
  { key: "favouritePlace", question: "Favourite place in IIMA?", options: ["Library", "Tea Post", "LKP", "CR", "Sports Complex"] },
  { key: "teaOrCoffee", question: "Tea or Coffee?", options: ["Tea", "Coffee", "Both"] },
  { key: "mountainOrBeach", question: "Mountain or Beach?", options: ["Mountain", "Beach", "Both"] },
];

const client = generateClient<Schema>();

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") as "individual" | "couple" | null;
  
  // Auth state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      try {
        const profile = await getUserProfile();
        
        if (profile && profile.email) {
          setIsAuthenticated(true);
          setUserEmail(profile.email);
          console.log("User authenticated:", profile.email);
        } else {
          setIsAuthenticated(false);
          setShowAuthModal(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
        setShowAuthModal(true);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const [step, setStep] = useState<OnboardingStep>("type");
  const [profile, setProfile] = useState<ProfileData>({
    type: "individual",
    name: "",
    age: 25,
    gender: "",
    sexualOrientation: "",
    bio: "",
    tags: [],
    lifestyle: {
      alcohol: "",
      smoking: "",
      food: "",
      favouritePlace: "",
      teaOrCoffee: "",
      mountainOrBeach: "",
    },
  });

  const steps: OnboardingStep[] = profile.type === "couple" 
    ? ["type", "basics", "complete"]
    : ["type", "basics", "interests", "prompts", "complete"];

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const [isSaving, setIsSaving] = useState(false);

  const nextStep = async () => {
    const nextIndex = currentStepIndex + 1;
    
    // When moving into the final "complete" step for individuals,
    // persist the full profile to the Amplify backend.
    if (nextIndex === 4 && profile.type === "individual") {
      setIsSaving(true);
      try {
        // Use the email from authenticated user
        const email = userEmail || "unknown@iima.ac.in";

        console.log("Creating profile in the backend for:", email);

        await client.models.UserProfile.create({
          // Basic info
          email,
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          bio: profile.bio,
          sexualOrientation: profile.sexualOrientation,
          
          // Interests/tags
          tags: profile.tags,
          
          // Lifestyle preferences
          alcoholPreference: profile.lifestyle.alcohol,
          smokingPreference: profile.lifestyle.smoking,
          foodPreference: profile.lifestyle.food,
          favouritePlace: profile.lifestyle.favouritePlace,
          teaOrCoffee: profile.lifestyle.teaOrCoffee,
          mountainOrBeach: profile.lifestyle.mountainOrBeach,
          
          // Mark onboarding as complete
          onboardingCompleted: true,
        });
        
        console.log("Profile saved successfully!");
      } catch (error) {
        console.error("Failed to save user profile", error);
      } finally {
        setIsSaving(false);
      }
    }

    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    }
  };

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const toggleTag = (tag: string) => {
    setProfile(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 6 ? [...prev.tags, tag] : prev.tags
    }));
  };


  const renderStep = () => {
    switch (step) {
      case "type":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold mb-2">How are you joining Prom?</h2>
              <p className="text-muted-foreground">This determines your experience</p>
            </div>

            <div className="grid gap-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProfile(prev => ({ ...prev, type: "individual" }));
                  nextStep();
                }}
                className={`glass rounded-2xl p-6 text-left ${profile.type === "individual" ? "ring-2 ring-primary" : ""}`}
              >
                <Heart className="w-8 h-8 text-primary mb-3" />
                <h3 className="font-semibold text-lg mb-1">I'm Looking for a Date</h3>
                <p className="text-sm text-muted-foreground">
                  Create an anonymous profile and get matched with compatible people
                </p>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setProfile(prev => ({ ...prev, type: "couple" }));
                  nextStep();
                }}
                className={`glass rounded-2xl p-6 text-left ${profile.type === "couple" ? "ring-2 ring-secondary" : ""}`}
              >
                <User className="w-8 h-8 text-secondary mb-3" />
                <h3 className="font-semibold text-lg mb-1">We're Already a Couple</h3>
                <p className="text-sm text-muted-foreground">
                  Quick registration for couples attending prom together
                </p>
              </motion.button>
            </div>
          </motion.div>
        );

      case "basics":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold mb-2">Tell us about yourself</h2>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                This info stays private until you reveal
              </p>
            </div>

            <div className="space-y-4">
              {/* 1. Name */}
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your name"
                  value={profile.name}
                  onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1.5"
                />
              </div>

              {profile.type === "couple" && (
                <div>
                  <Label htmlFor="partnerName">Partner's Name (optional)</Label>
                  <Input
                    id="partnerName"
                    placeholder="Enter your partner's name"
                    value={profile.partnerName || ""}
                    onChange={(e) => setProfile(prev => ({ ...prev, partnerName: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
              )}

              {/* 2. Age */}
              <div>
                <Label>Age: <span className="text-primary font-semibold">{profile.age}</span></Label>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground">21</span>
                  <input
                    type="range"
                    min={21}
                    max={45}
                    value={profile.age}
                    onChange={(e) => setProfile(prev => ({ ...prev, age: parseInt(e.target.value) }))}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs text-muted-foreground">45</span>
                </div>
              </div>

              {/* 3. Gender */}
              <div>
                <Label>Gender</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {["Woman", "Man", "Non-Binary"].map((g) => (
                    <button
                      key={g}
                      onClick={() => setProfile(prev => ({ ...prev, gender: g }))}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        profile.gender === g
                          ? "bg-primary text-primary-foreground"
                          : "glass hover:bg-card/70"
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Sexual Orientation (only for individuals) */}
              {profile.type === "individual" && (
                <div>
                  <Label>Sexual Orientation</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1.5">
                    {["Straight", "Gay", "Bisexual", "Other"].map((orientation) => (
                      <button
                        key={orientation}
                        onClick={() => setProfile(prev => ({ ...prev, sexualOrientation: orientation }))}
                        className={`p-3 rounded-xl text-sm font-medium transition-all ${
                          profile.sexualOrientation === orientation
                            ? "bg-secondary text-secondary-foreground"
                            : "glass hover:bg-card/70"
                        }`}
                      >
                        {orientation}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Short Bio */}
              <div>
                <Label htmlFor="bio">Short Bio</Label>
                <Textarea
                  id="bio"
                  placeholder="A brief intro about yourself..."
                  value={profile.bio}
                  onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
                  className="mt-1.5 resize-none"
                  rows={3}
                />
              </div>
            </div>

            <Button 
              variant="gold" 
              className="w-full" 
              onClick={nextStep} 
              disabled={!profile.name || !profile.gender || (profile.type === "individual" && !profile.sexualOrientation)}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        );

      case "interests":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold mb-2">What are you into?</h2>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                Shown anonymously on your profile
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                    profile.tags.includes(tag)
                      ? "bg-primary text-primary-foreground"
                      : "glass hover:bg-card/70"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Selected: {profile.tags.length}/6
            </p>

            <Button variant="gold" className="w-full" onClick={nextStep} disabled={profile.tags.length < 3}>
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        );

      case "prompts":
        const allLifestyleAnswered = lifestyleQuestions.every(
          (q) => profile.lifestyle[q.key] !== ""
        );
        
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-display text-2xl font-bold mb-2">Share a bit more</h2>
              <p className="text-muted-foreground flex items-center justify-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                Your preferences are securely stored
              </p>
            </div>

            <div className="space-y-4">
              {lifestyleQuestions.map((q) => (
                <div key={q.key}>
                  <Label className="text-sm">{q.question}</Label>
                  <div className={`grid gap-2 mt-1.5 ${q.options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {q.options.map((option) => (
                      <button
                        key={option}
                        onClick={() =>
                          setProfile((prev) => ({
                            ...prev,
                            lifestyle: { ...prev.lifestyle, [q.key]: option },
                          }))
                        }
                        className={`p-2.5 rounded-xl text-sm font-medium transition-all ${
                          profile.lifestyle[q.key] === option
                            ? "bg-primary text-primary-foreground"
                            : "glass hover:bg-card/70"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <Button 
              variant="gold" 
              className="w-full" 
              onClick={nextStep}
              disabled={!allLifestyleAnswered || isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  Finish Setup
                  <Check className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            
            <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Your data is encrypted and secure
            </p>
          </motion.div>
        );

      case "complete":
        return (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
              className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
            >
              <Sparkles className="w-10 h-10 text-primary" />
            </motion.div>
            
            <h2 className="font-display text-3xl font-bold mb-3">You're all set!</h2>
            <p className="text-muted-foreground mb-8">
              {profile.type === "couple" 
                ? "Your registration is complete. See you at prom!"
                : "Your anonymous profile is ready. Time to discover your matches!"}
            </p>

            <Button 
              variant="gold" 
              size="lg" 
              onClick={() => navigate(profile.type === "couple" ? "/" : "/discover")}
            >
              {profile.type === "couple" ? "Done" : "Start Discovering"}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        );
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show auth required modal
  if (showAuthModal || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
        <SparkleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-sm"
        >
          <div className="glass rounded-2xl p-6 text-center border border-destructive/20">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You need to sign in with your IIMA account to continue with onboarding.
            </p>
            <Button 
              variant="gold" 
              className="w-full"
              onClick={() => navigate("/auth")}
            >
              Go to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
      <SparkleBackground />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          <div className="flex-1">
            {currentStepIndex > 0 && step !== "complete" ? (
              <Button variant="ghost" size="sm" onClick={prevStep}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
            ) : (
              <div />
            )}
          </div>

          <div className="flex-1 flex justify-center">
            {step !== "complete" && (
              <span className="text-sm text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
            )}
          </div>

          <div className="flex-1 flex justify-end">
            {step !== "complete" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
              >
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            )}
          </div>
        </header>

        {/* Progress bar */}
        {step !== "complete" && (
          <div className="px-4">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="glass rounded-3xl p-6 md:p-8">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Onboarding;
