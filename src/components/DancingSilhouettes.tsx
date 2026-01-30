import { motion } from "framer-motion";

/**
 * Dancing couple silhouette — clean, orderly pose matching reference:
 * Man's left arm raised clasping woman's right hand above their heads,
 * woman's leg lifted, dress flowing. Slow, gentle animation.
 */
const DancingSilhouettes = () => {
  return (
    <motion.div
      className="absolute inset-0 flex items-end justify-center pointer-events-none overflow-hidden"
      aria-hidden
    >
      <motion.div
        className="relative w-[min(380px,80vw)] h-[50vh] min-h-[260px] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        style={{
          filter: "drop-shadow(0 0 16px rgba(255,255,255,0.35)) drop-shadow(0 0 32px rgba(255,255,255,0.15))",
        }}
      >
        {/* Slow, orderly sway — like the reference image */}
        <motion.svg
          viewBox="0 0 220 300"
          className="w-full h-full object-contain object-bottom"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          animate={{
            x: [-4, 4, -4],
            rotate: [-1.2, 1.2, -1.2],
          }}
          transition={{
            duration: 9,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <defs>
            <linearGradient
              id="silhouette-shine"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="rgba(255,255,255,0.92)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0.82)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.72)" />
            </linearGradient>
            <filter id="silhouette-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Guy (left): arms up — left arm raised clasping her hand above heads; right arm at her waist */}
          <g filter="url(#silhouette-glow)" fill="url(#silhouette-shine)">
            {/* Legs — one forward, one back */}
            <path d="M 70 195 L 66 300 L 78 300 L 74 195 Z" />
            <path d="M 86 202 L 82 300 L 94 300 L 90 202 Z" />
            {/* Torso */}
            <path d="M 60 95 L 56 198 L 100 198 L 96 95 Q 78 92 60 95 Z" />
            {/* Head */}
            <ellipse cx="80" cy="68" rx="18" ry="22" />
            {/* Raised arm — clasping her hand above heads */}
            <path d="M 96 98 L 98 55 L 118 50 L 125 75 L 108 95 Z" />
            {/* Arm at her waist */}
            <path d="M 58 108 Q 35 118 32 158 Q 30 168 52 152 L 62 118 Z" />
          </g>

          {/* Girl (right): right hand raised in his, right leg lifted, dress flowing outward */}
          <g filter="url(#silhouette-glow)" fill="url(#silhouette-shine)">
            {/* Flowing dress/skirt — outward flow */}
            <path
              d="M 102 172 Q 55 300 90 300 L 172 300 Q 210 300 202 248 Q 194 200 168 172 L 118 155 Z"
            />
            {/* Lifted leg (right leg bent, visible against dress) */}
            <path d="M 158 195 L 162 260 Q 170 275 178 265 L 172 200 Z" />
            {/* Bodice */}
            <path d="M 108 92 L 112 158 L 165 168 L 172 92 Q 140 88 108 92 Z" />
            {/* Head — slightly tilted back */}
            <ellipse cx="142" cy="74" rx="16" ry="20" transform="rotate(-5 142 74)" />
            {/* Raised arm — hand clasped with his above heads */}
            <path d="M 108 95 L 118 75 L 125 50 L 118 48 L 108 70 Z" />
            {/* Arm toward him / dress arm */}
            <path d="M 168 108 Q 198 118 202 162 Q 204 178 182 168 L 168 138 Z" />
          </g>
        </motion.svg>
      </motion.div>
    </motion.div>
  );
};

export default DancingSilhouettes;
