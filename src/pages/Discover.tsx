import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import {
  BlindProfileCard,
  DiscoveryProgress,
  DiscoveryComplete,
} from "@/components/discovery";
import {
  type DiscoveryProfile,
  type TraitSelection,
  DISCOVERY_CONFIG,
  MOCK_DISCOVERY_PROFILES,
} from "@/lib/discovery";
import { ArrowRight } from "lucide-react";

// ============================================================================
// MOCK API FUNCTIONS (replace with real API calls)
// ============================================================================

async function fetchDiscoveryProfiles(): Promise<DiscoveryProfile[]> {
  // Simulate API latency
  await new Promise((r) => setTimeout(r, 300));
  // Shuffle and return profiles
  return [...MOCK_DISCOVERY_PROFILES]
    .sort(() => Math.random() - 0.5)
    .slice(0, DISCOVERY_CONFIG.PROFILES_COUNT);
}

async function submitTraitSelection(selection: TraitSelection): Promise<void> {
  // Simulate API call
  await new Promise((r) => setTimeout(r, 100));
  console.log("Submitted selection:", selection);
}

async function completeDiscovery(userId: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 100));
  console.log("Discovery completed for user:", userId);
}

// ============================================================================
// DISCOVER PAGE COMPONENT
// ============================================================================

type DiscoveryState = "loading" | "active" | "complete";

const Discover = () => {
  const navigate = useNavigate();

  // Core state
  const [state, setState] = useState<DiscoveryState>("loading");
  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedTraitIds, setSelectedTraitIds] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<TraitSelection[]>([]);

  // Mock user ID (replace with real auth)
  const viewerUserId = "current-user-id";

  // Fetch profiles on mount
  useEffect(() => {
    const load = async () => {
      try {
        const fetched = await fetchDiscoveryProfiles();
        setProfiles(fetched);
        setState("active");
      } catch (err) {
        console.error("Failed to fetch profiles:", err);
      }
    };
    load();
  }, []);

  // Current profile
  const currentProfile = profiles[currentIndex];
  const isLastProfile = currentIndex === profiles.length - 1;

  // Validation: exactly 2 traits required
  const canSubmit =
    selectedTraitIds.length === DISCOVERY_CONFIG.REQUIRED_SELECTIONS;

  // Toggle trait selection
  const handleTraitToggle = useCallback(
    (traitId: string) => {
      setSelectedTraitIds((prev) => {
        if (prev.includes(traitId)) {
          // Remove if already selected
          return prev.filter((id) => id !== traitId);
        } else if (prev.length < DISCOVERY_CONFIG.REQUIRED_SELECTIONS) {
          // Add if under limit
          return [...prev, traitId];
        }
        // At max, ignore
        return prev;
      });
    },
    []
  );

  // Submit current selection and move to next
  const handleNext = useCallback(async () => {
    if (!canSubmit || !currentProfile) return;

    const selection: TraitSelection = {
      viewerUserId,
      profileUserId: currentProfile.id,
      selectedTraitIds: [...selectedTraitIds],
      allTraitIds: currentProfile.traitQuestions.map((t) => t.traitId),
      createdAt: new Date().toISOString(),
    };

    // Submit to backend
    await submitTraitSelection(selection);

    // Store locally
    setSubmissions((prev) => [...prev, selection]);

    // Reset selection
    setSelectedTraitIds([]);

    if (isLastProfile) {
      // Complete discovery
      await completeDiscovery(viewerUserId);
      setState("complete");
    } else {
      // Move to next profile
      setCurrentIndex((i) => i + 1);
    }
  }, [canSubmit, currentProfile, selectedTraitIds, isLastProfile, viewerUserId]);

  // Handle completion continue
  const handleContinue = () => {
    navigate("/matches");
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
      <SparkleBackground />

      <div className="relative z-10 min-h-screen flex flex-col max-w-[400px] mx-auto px-4 pt-5 pb-6">
        {/* Header */}
        <header className="mb-4">
          <h1 className="font-display text-xl font-bold text-foreground">
            Discover
          </h1>
          <p className="text-sm text-muted-foreground">
            Tap 2 things that stand out to you
          </p>
        </header>

        {/* Loading state */}
        {state === "loading" && (
          <div className="flex-1 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Finding profiles for you...
              </p>
            </motion.div>
          </div>
        )}

        {/* Active discovery state */}
        {state === "active" && currentProfile && (
          <>
            {/* Progress */}
            <div className="mb-4">
              <DiscoveryProgress
                current={currentIndex + 1}
                total={profiles.length}
              />
            </div>

            {/* Profile Card with integrated selection */}
            <AnimatePresence mode="wait">
              <BlindProfileCard
                key={currentProfile.id}
                profile={currentProfile}
                selectedTraitIds={selectedTraitIds}
                onTraitToggle={handleTraitToggle}
              />
            </AnimatePresence>

            {/* Action button */}
            <div className="mt-6">
              <Button
                variant="gold"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={handleNext}
              >
                {isLastProfile ? "Finish" : "Next"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              {!canSubmit && (
                <p className="text-xs text-muted-foreground text-center mt-2">
                  Select {DISCOVERY_CONFIG.REQUIRED_SELECTIONS} to continue
                </p>
              )}
            </div>
          </>
        )}

        {/* Complete state */}
        {state === "complete" && (
          <div className="flex-1 flex items-center justify-center">
            <DiscoveryComplete
              profilesReviewed={submissions.length}
              onContinue={handleContinue}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
