import { useMemo } from "react";

// Seeded RNG so sparkle positions are stable across renders
const seeded = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const SPARKLE_COUNT = 180;

const SparkleBackground = () => {
  const sparkles = useMemo(() => {
    const rnd = seeded(42);
    return Array.from({ length: SPARKLE_COUNT }, (_, i) => {
      const size = rnd() * 3.2 + 1;
      const isBright = rnd() > 0.55;
      return {
        id: i,
        left: `${rnd() * 100}%`,
        top: `${rnd() * 100}%`,
        size,
        delay: rnd() * 8,
        duration: rnd() * 2 + 1.5,
        isBright,
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-hero-pattern opacity-30" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />

      {/* Sparkles: CSS animation only (no Framer) for better perf */}
      {sparkles.map((sparkle) => (
        <div
          key={sparkle.id}
          className={`absolute rounded-full animate-sparkle-bg ${
            sparkle.isBright ? "bg-white" : "bg-primary/60"
          }`}
          style={{
            left: sparkle.left,
            top: sparkle.top,
            width: sparkle.size,
            height: sparkle.size,
            boxShadow: sparkle.isBright
              ? "0 0 10px rgba(255,255,255,0.9), 0 0 20px rgba(255,255,255,0.4)"
              : "0 0 6px rgba(110,156,255,0.6), 0 0 12px rgba(180,140,255,0.25)",
            animationDuration: `${sparkle.duration}s`,
            animationDelay: `${sparkle.delay}s`,
          }}
        />
      ))}
    </div>
  );
};

export default SparkleBackground;
