import { motion } from "framer-motion";

interface DiscoveryProgressProps {
  current: number; // 1-indexed for display
  total: number;
}

export function DiscoveryProgress({ current, total }: DiscoveryProgressProps) {
  const progressPercent = (current / total) * 100;

  return (
    <div className="w-full">
      {/* Progress bar with text */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {current}/{total}
        </span>
      </div>
    </div>
  );
}
