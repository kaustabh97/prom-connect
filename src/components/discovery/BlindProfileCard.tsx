import { motion } from "framer-motion";
import type { DiscoveryProfile, TraitQuestion } from "@/lib/discovery";
import { DISCOVERY_CONFIG } from "@/lib/discovery";

interface BlindProfileCardProps {
  profile: DiscoveryProfile;
  selectedTraitIds: string[];
  onTraitToggle: (traitId: string) => void;
}

interface QuestionCardProps {
  trait: TraitQuestion;
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
}

function QuestionCard({
  trait,
  isSelected,
  isDisabled,
  onToggle,
}: QuestionCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      whileTap={!isDisabled ? { scale: 0.97 } : undefined}
      className={`
        relative w-full rounded-xl px-3.5 py-3
        flex flex-col gap-1 text-left
        transition-all duration-200 border
        focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50
        ${
          isSelected
            ? "bg-primary/20 border-primary"
            : isDisabled
            ? "bg-muted/10 border-transparent opacity-40 cursor-not-allowed"
            : "bg-card/50 border-white/10 active:bg-card/60"
        }
      `}
    >
      {/* Question */}
      <p
        className={`text-xs leading-tight ${
          isSelected ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {trait.question}
      </p>

      {/* Answer (1-2 words) */}
      <p
        className={`text-base font-semibold leading-snug ${
          isSelected ? "text-foreground" : "text-foreground/90"
        }`}
      >
        {trait.answer}
      </p>

      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
        >
          <span className="text-xs text-primary-foreground font-bold">✓</span>
        </motion.div>
      )}
    </motion.button>
  );
}

export function BlindProfileCard({
  profile,
  selectedTraitIds,
  onTraitToggle,
}: BlindProfileCardProps) {
  const isAtMax =
    selectedTraitIds.length >= DISCOVERY_CONFIG.REQUIRED_SELECTIONS;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="w-full"
    >
      {/* Header: Age & Program */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="text-lg font-semibold text-foreground">
          {profile.age} years old
        </span>
        {profile.program && (
          <span className="text-sm text-muted-foreground">
            · {profile.program}
          </span>
        )}
      </div>

      {/* 4×2 Grid of Questions */}
      <div className="grid grid-cols-2 gap-2.5">
        {profile.traitQuestions.map((trait) => {
          const isSelected = selectedTraitIds.includes(trait.traitId);
          const isDisabled = !isSelected && isAtMax;

          return (
            <QuestionCard
              key={trait.traitId}
              trait={trait}
              isSelected={isSelected}
              isDisabled={isDisabled}
              onToggle={() => onTraitToggle(trait.traitId)}
            />
          );
        })}
      </div>

      {/* Selection count */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <div className="flex gap-1.5">
          {[...Array(DISCOVERY_CONFIG.REQUIRED_SELECTIONS)].map((_, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i < selectedTraitIds.length ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">
          {selectedTraitIds.length}/{DISCOVERY_CONFIG.REQUIRED_SELECTIONS} selected
        </span>
      </div>
    </motion.div>
  );
}
