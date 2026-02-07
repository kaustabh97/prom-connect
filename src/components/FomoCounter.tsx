import { motion } from "framer-motion";

interface FomoCounterProps {
  count: number;
  hasMore: boolean;
  /** Optional animation props for motion.div wrapper */
  animate?: boolean;
  delay?: number;
}

export default function FomoCounter({ count, hasMore, animate = true, delay = 0 }: FomoCounterProps) {
  const content = (
    <div className="mb-6 px-5 py-4 rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 shadow-[0_0_20px_rgba(251,191,36,0.08)]">
      <p className="text-sm text-muted-foreground text-center mb-1">
        <span className="text-3xl font-bold tabular-nums text-gradient-gold">
          {hasMore ? `${count}+` : count}
        </span>{" "}
        people have signed up for prom.
      </p>
      <p className="text-sm font-medium text-primary/90 text-center">
        Don&apos;t be the one left wondering what if! ✨
      </p>
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
