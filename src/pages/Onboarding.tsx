import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SparkleBackground from "@/components/SparkleBackground";
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles,
  User,
  Heart,
  MessageCircle,
  Camera
} from "lucide-react";

type OnboardingStep = "type" | "basics" | "interests" | "prompts" | "preferences" | "photos" | "complete";

interface ProfileData {
  type: "individual" | "couple";
  name: string;
  partnerName?: string;
  gender: string;
  sexuality: string[];
  bio: string;
  tags: string[];
  prompts: { question: string; answer: string }[];
  preferences: {
    extrovert: number;
    hangoutTime: string;
    lifestyle: string[];
  };
}

const availableTags = [
  "Running", "Music", "Debate", "Coffee", "Reading", "Movies",
  "Gaming", "Dance", "Food", "Travel", "Photography", "Art",
  "Sports", "Cooking", "Tech", "Finance", "Consulting", "Startups"
];

const prompts = [
  "Best place in IIMA is...",
  "One thing I love is...",
  "My ideal weekend looks like...",
  "A song that defines me...",
  "Two truths and a lie about me...",
];

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialType = searchParams.get("type") as "individual" | "couple" | null;
  
  const [step, setStep] = useState<OnboardingStep>(initialType ? "basics" : "type");
  const [profile, setProfile] = useState<ProfileData>({
    type: initialType || "individual",
    name: "",
    gender: "",
    sexuality: [],
    bio: "",
    tags: [],
    prompts: [{ question: prompts[0], answer: "" }, { question: prompts[1], answer: "" }],
    preferences: {
      extrovert: 50,
      hangoutTime: "",
      lifestyle: [],
    },
  });

  const steps: OnboardingStep[] = profile.type === "couple" 
    ? ["type", "basics", "complete"]
    : ["type", "basics", "interests", "prompts", "preferences", "complete"];

  const currentStepIndex = steps.indexOf(step);
  const progress = ((currentStepIndex) / (steps.length - 1)) * 100;

  const nextStep = () => {
    const nextIndex = currentStepIndex + 1;
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

  const toggleSexuality = (option: string) => {
    setProfile(prev => ({
      ...prev,
      sexuality: prev.sexuality.includes(option)
        ? prev.sexuality.filter(s => s !== option)
        : [...prev.sexuality, option]
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
              <p className="text-muted-foreground">This info stays private until you reveal</p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Your Name</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
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

              <div>
                <Label>Gender Identity</Label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {["Woman", "Man", "Non-binary"].map((g) => (
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

              {profile.type === "individual" && (
                <div>
                  <Label>Interested in</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {["Women", "Men", "Everyone"].map((s) => (
                      <button
                        key={s}
                        onClick={() => toggleSexuality(s)}
                        className={`p-3 rounded-xl text-sm font-medium transition-all ${
                          profile.sexuality.includes(s)
                            ? "bg-secondary text-secondary-foreground"
                            : "glass hover:bg-card/70"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            <Button variant="gold" className="w-full" onClick={nextStep} disabled={!profile.name || !profile.gender}>
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
              <p className="text-muted-foreground">Pick up to 6 interests (shown anonymously)</p>
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
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <MessageCircle className="w-10 h-10 text-primary mx-auto mb-3" />
              <h2 className="font-display text-2xl font-bold mb-2">Share a bit more</h2>
              <p className="text-muted-foreground">These answers appear on your anonymous card</p>
            </div>

            <div className="space-y-4">
              {profile.prompts.map((prompt, idx) => (
                <div key={idx}>
                  <Label>{prompt.question}</Label>
                  <Input
                    placeholder="Your answer..."
                    value={prompt.answer}
                    onChange={(e) => {
                      const newPrompts = [...profile.prompts];
                      newPrompts[idx].answer = e.target.value;
                      setProfile(prev => ({ ...prev, prompts: newPrompts }));
                    }}
                    className="mt-1.5"
                  />
                </div>
              ))}
            </div>

            <Button 
              variant="gold" 
              className="w-full" 
              onClick={nextStep}
              disabled={!profile.prompts.every(p => p.answer.length > 0)}
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        );

      case "preferences":
        return (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-8">
              <h2 className="font-display text-2xl font-bold mb-2">A few preferences</h2>
              <p className="text-muted-foreground">Helps us find compatible matches</p>
            </div>

            <div className="space-y-6">
              <div>
                <Label className="mb-3 block">How social are you?</Label>
                <div className="flex justify-between text-sm text-muted-foreground mb-2">
                  <span>Introvert</span>
                  <span>Extrovert</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={profile.preferences.extrovert}
                  onChange={(e) => setProfile(prev => ({
                    ...prev,
                    preferences: { ...prev.preferences, extrovert: parseInt(e.target.value) }
                  }))}
                  className="w-full accent-primary"
                />
              </div>

              <div>
                <Label>Preferred hangout time</Label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {["Morning person", "Night owl", "Whenever", "Weekends only"].map((time) => (
                    <button
                      key={time}
                      onClick={() => setProfile(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, hangoutTime: time }
                      }))}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        profile.preferences.hangoutTime === time
                          ? "bg-primary text-primary-foreground"
                          : "glass hover:bg-card/70"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button variant="gold" className="w-full" onClick={nextStep}>
              Finish Setup
              <Check className="w-4 h-4 ml-2" />
            </Button>
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

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
      <SparkleBackground />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <header className="p-4 flex items-center justify-between">
          {currentStepIndex > 0 && step !== "complete" ? (
            <Button variant="ghost" size="sm" onClick={prevStep}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}
          
          {step !== "complete" && (
            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
          )}
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
