import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";

interface ProfileData {
  id: string;
  tags: string[];
  promptAnswer: string;
  personality: { extrovert: number; openness: number };
  campusSpots: string[];
  compatScore: number;
}

interface AnonymousCardProps {
  profile: ProfileData;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}

const AnonymousCard = ({ profile, index, isSelected, onSelect }: AnonymousCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`glass rounded-2xl p-5 cursor-pointer transition-all relative overflow-hidden ${
        isSelected ? "ring-2 ring-primary shadow-glow" : "hover:bg-card/70"
      }`}
    >
      {/* Selection indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-primary flex items-center justify-center"
        >
          <Check className="w-5 h-5 text-primary-foreground" />
        </motion.div>
      )}

      {/* Compatibility score */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-sm font-semibold text-primary">
            {Math.round(profile.compatScore * 100)}% Match
          </span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mb-4">
        {profile.tags.map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Prompt answer */}
      <p className="text-foreground font-medium mb-4 italic">
        "{profile.promptAnswer}"
      </p>

      {/* Campus spots */}
      <div className="text-sm text-muted-foreground mb-4">
        <span className="text-foreground">Hangs out at:</span>{" "}
        {profile.campusSpots.slice(0, 2).join(", ")}
      </div>

      {/* Personality bars */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20">Social</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile.personality.extrovert * 100}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="h-full bg-secondary rounded-full"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground w-20">Openness</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${profile.personality.openness * 100}%` }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="h-full bg-primary rounded-full"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AnonymousCard;
