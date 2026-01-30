import { motion } from "framer-motion";
import { useMemo } from "react";

// Seeded pseudo-random for reproducible shower particles
const seeded = (seed: number) => () => {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
};

const SparkleBackground = () => {
  const sparkles = useMemo(() => {
    return Array.from({ length: 1400 }, (_, i) => {
      const size = Math.random() * 3.2 + 1;
      const isBright = Math.random() > 0.55;
      return {
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size,
        delay: Math.random() * 12,
        duration: Math.random() * 2.2 + 1.4,
        isBright,
      };
    });
  }, []);

  const showerParticles = useMemo(() => {
    const rnd = seeded(12345);
    return Array.from({ length: 55 }, (_, i) => {
      const left = rnd() * 92; // 0–92% along tail
      const size = 1.5 + (1 - left / 100) * 3.5 + rnd() * 1.5; // bigger near star
      const opacity = 0.4 + (1 - left / 100) * 0.55 + rnd() * 0.2; // brighter near star
      const offsetY = (rnd() - 0.5) * 24; // vertical spread (shower)
      const offsetX = (rnd() - 0.5) * 8;
      return {
        id: `shower-${i}`,
        left,
        size: Math.min(5, Math.max(1.5, size)),
        opacity: Math.min(1, opacity),
        offsetX,
        offsetY,
      };
    });
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Gradient overlays + purple tinge */}
      <div className="absolute inset-0 bg-hero-pattern opacity-25" />
      <div className="absolute top-1/2 left-1/2 w-[140%] h-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/8 blur-[80px]" />
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-secondary/5 rounded-full blur-3xl" />
      
      {/* Sparkles */}
      {sparkles.map((sparkle) => (
        <motion.div
          key={sparkle.id}
          className={`absolute rounded-full ${
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
          }}
          animate={{
            opacity: [0.2, 1, 0.3],
            scale: [0.6, 1.2, 0.7],
          }}
          transition={{
            duration: sparkle.duration,
            delay: sparkle.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Pink shooting star: tail (sparkly) above, star below, lightly connected, 35s */}
      <motion.div
        className="absolute z-10 flex flex-col items-end pointer-events-none"
        style={{
          right: "8%",
          top: "0%",
          transformOrigin: "100% 0%",
          transform: "rotate(270deg)",
          width: "min(58vw, 360px)",
        }}
        animate={{
          right: "8%",
          top: ["-8%", "108%"],
          opacity: [1, 1, 1, 1, 0],
        }}
        transition={{
          duration: 700,
          repeat: Infinity,
          repeatDelay: 6,
          ease: "linear",
        }}
      >
        {/* Tail: shower of stars (firework-style) — no line, only particles */}
        <div className="relative flex-1 min-h-[32px] w-full overflow-visible">
          {showerParticles.map((p) => (
            <div
              key={p.id}
              className="absolute rounded-full bg-white"
              style={{
                left: `${p.left}%`,
                top: "50%",
                width: p.size,
                height: p.size,
                opacity: p.opacity,
                transform: `translate(${p.offsetX}px, calc(-50% + ${p.offsetY}px))`,
                boxShadow: "0 0 6px rgba(255,255,255,0.95), 0 0 12px rgba(244,114,182,0.85), 0 0 18px rgba(251,207,232,0.5)",
              }}
            />
          ))}
        </div>
        {/* Star below the tail — overlap so tail and star connect lightly */}
        <div
          className="relative flex-shrink-0 w-12 h-12 -mt-2"
          style={{
            filter: "drop-shadow(0 0 16px rgba(244,114,182,0.9)) drop-shadow(0 0 32px rgba(236,72,153,0.6)) drop-shadow(0 0 48px rgba(244,114,182,0.4))",
          }}
        >
          <svg viewBox="0 0 32 32" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="star-core" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
                <stop offset="35%" stopColor="rgba(251,207,232,0.95)" />
                <stop offset="65%" stopColor="rgba(244,114,182,0.85)" />
                <stop offset="100%" stopColor="rgba(236,72,153,0.4)" />
              </radialGradient>
            </defs>
            {/* 8 rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((rot) => (
              <line
                key={rot}
                x1="16"
                y1="16"
                x2="16"
                y2="4"
                stroke="url(#star-core)"
                strokeWidth="1.5"
                strokeLinecap="round"
                transform={`rotate(${rot} 16 16)`}
              />
            ))}
            {/* Bright center */}
            <circle cx="16" cy="16" r="4" fill="url(#star-core)" />
          </svg>
        </div>
      </motion.div>

    </div>
  );
};

export default SparkleBackground;
