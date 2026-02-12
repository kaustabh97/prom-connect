import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { logInfo } from "@/utils/logger";

interface FomoCounterProps {
  count: number;
  hasMore: boolean;
  /** Optional animation props for motion.div wrapper */
  animate?: boolean;
  delay?: number;
  /** Where this counter is being shown (for analytics) */
  source?: string;
}

export default function FomoCounter({ count, hasMore, animate = true, delay = 0, source = "unknown" }: FomoCounterProps) {
  const navigate = useNavigate();

  const content = (
    <div className="mb-6 px-5 py-4 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 shadow-[0_0_20px_rgba(251,191,36,0.08)] flex items-center justify-between gap-3 flex-wrap">
      <div className="text-left text-sm text-muted-foreground">
        <span className="text-3xl font-bold tabular-nums text-gradient-gold mr-1">
          {hasMore ? `${count}+` : count}
        </span>
        going to prom so far.
      </div>

      <Button
        variant="gold-outline"
        size="sm"
        onClick={() => {
          logInfo("FomoCounter: View more statistics clicked", {
            component: "FomoCounter",
            operation: "viewMoreStatsClick",
            source,
          });
          navigate("/stats");
        }}
        className="whitespace-nowrap ml-auto shrink-0"
      >
        View stats
      </Button>
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay, duration: 0.8 }}
      >
        {content}
      </motion.div>
    );
  }
  return content;
}
