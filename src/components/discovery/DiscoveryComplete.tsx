import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";

interface DiscoveryCompleteProps {
  profilesReviewed: number;
  onContinue: () => void;
}

export function DiscoveryComplete({
  profilesReviewed,
  onContinue,
}: DiscoveryCompleteProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full text-center py-8 px-4"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
        className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
      >
        <Sparkles className="w-8 h-8 text-primary" />
      </motion.div>

      {/* Heading */}
      <motion.h2
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="font-display text-2xl font-bold text-foreground mb-3"
      >
        Discovery Complete
      </motion.h2>

      {/* Message */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-muted-foreground mb-2 max-w-sm mx-auto leading-relaxed"
      >
        Thanks — this helps us understand what you're drawn towards.
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-muted-foreground mb-8 max-w-sm mx-auto leading-relaxed"
      >
        Your matches will now be much better.
      </motion.p>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="glass rounded-xl p-4 mb-8 max-w-xs mx-auto"
      >
        <p className="text-sm text-muted-foreground">
          You reviewed{" "}
          <span className="text-primary font-semibold">
            {profilesReviewed} profiles
          </span>
        </p>
        <p className="text-xs text-muted-foreground/80 mt-1">
          Your preferences are now being processed
        </p>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <Button variant="gold" size="lg" onClick={onContinue}>
          Continue
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
