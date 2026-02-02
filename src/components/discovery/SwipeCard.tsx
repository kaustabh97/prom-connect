import { useCallback, useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { Heart, X, Coffee, Mountain, Utensils, Wine, Cigarette, MapPin } from "lucide-react";

const SWIPE_THRESHOLD = 80;
const EXIT_VELOCITY = 500;
const EXIT_OFFSET = 400;
const EXIT_DURATION_MS = 320;

export interface SwipeCardHandle {
  triggerSwipe: (action: "like" | "pass") => void;
}

interface SwipeCardProps {
  profile: DiscoveryProfileFull;
  onSwipe: (action: "like" | "pass") => void;
  isTop: boolean;
}

/** Chip for About me / attributes - Bumble-style rounded pill */
function AttributeChip({
  icon: Icon,
  label,
}: {
  icon?: React.ElementType;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
      {label}
    </span>
  );
}

const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  function SwipeCard({ profile, onSwipe, isTop }, ref) {
    const x = useMotionValue(0);
    const [exiting, setExiting] = useState<"like" | "pass" | null>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
      mountedRef.current = true;
      return () => {
        mountedRef.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }, []);

    const runExit = useCallback(
      (action: "like" | "pass") => {
        if (exiting) return;
        setExiting(action);
        const dir = action === "like" ? 1 : -1;
        x.set(dir * EXIT_OFFSET);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          timeoutRef.current = null;
          if (mountedRef.current) onSwipe(action);
        }, EXIT_DURATION_MS);
      },
      [onSwipe, exiting, x]
    );

    useImperativeHandle(ref, () => ({
      triggerSwipe(action: "like" | "pass") {
        runExit(action);
      },
    }));

    const handleDragEnd = useCallback(
      (_: unknown, info: PanInfo) => {
        if (exiting) return;
        const offset = info.offset.x;
        const velocity = info.velocity.x;
        if (
          Math.abs(offset) > SWIPE_THRESHOLD ||
          Math.abs(velocity) > EXIT_VELOCITY
        ) {
          const dir = offset > 0 || velocity > 0 ? 1 : -1;
          const action = dir > 0 ? "like" : "pass";
          runExit(action);
        }
      },
      [exiting, runExit]
    );

    const rotate = useTransform(x, [-200, 200], [-12, 12]);
    const likeOpacity = useTransform(x, [0, SWIPE_THRESHOLD], [0, 1]);
    const passOpacity = useTransform(x, [-SWIPE_THRESHOLD, 0], [1, 0]);

    const mainPhoto = profile.photoUrls?.[0];
    const isExiting = exiting !== null;

    const aboutChips: { icon?: React.ElementType; label: string }[] = [];
    if (profile.gender) aboutChips.push({ label: profile.gender });
    if (profile.sexualOrientation) aboutChips.push({ label: profile.sexualOrientation });
    if (profile.alcoholPreference) aboutChips.push({ icon: Wine, label: profile.alcoholPreference });
    if (profile.smokingPreference) aboutChips.push({ icon: Cigarette, label: profile.smokingPreference });
    if (profile.foodPreference) aboutChips.push({ icon: Utensils, label: profile.foodPreference });
    if (profile.teaOrCoffee) aboutChips.push({ icon: Coffee, label: profile.teaOrCoffee });
    if (profile.mountainOrBeach) aboutChips.push({ icon: Mountain, label: profile.mountainOrBeach });
    if (profile.favouritePlace) aboutChips.push({ icon: MapPin, label: profile.favouritePlace });

    return (
      <motion.div
        drag={isTop && !isExiting ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        dragDirectionLock
        onDragEnd={handleDragEnd}
        style={{ x, rotate }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full cursor-grab active:cursor-grabbing touch-pan-y"
      >
        <motion.div
          className="relative w-full rounded-2xl overflow-hidden bg-background border border-border shadow-float min-h-0"
          style={{ pointerEvents: isTop ? "auto" : "none" }}
        >
          {/* Swipe hints (only when dragging) - fixed on card */}
          {isTop && (
            <>
              <motion.div
                style={{ opacity: likeOpacity }}
                className="absolute top-24 left-4 pointer-events-none z-10"
              >
                <span className="rounded-xl border-4 border-green-500 px-3 py-1.5 text-green-500 font-bold text-lg rotate-[-12deg] flex items-center gap-1.5">
                  <Heart className="w-6 h-6 fill-green-500" /> LIKE
                </span>
              </motion.div>
              <motion.div
                style={{ opacity: passOpacity }}
                className="absolute top-24 right-4 pointer-events-none z-10"
              >
                <span className="rounded-xl border-4 border-red-500 px-3 py-1.5 text-red-500 font-bold text-lg rotate-[12deg] flex items-center gap-1.5">
                  <X className="w-6 h-6" /> PASS
                </span>
              </motion.div>
            </>
          )}

          {/* Single flow: photo + content (page scrolls, no inner scroll) */}
          <div className="min-h-0 flex flex-col">
            {/* Hero photo - flows with content */}
            <div className="relative aspect-[4/5] w-full bg-muted shrink-0">
              {mainPhoto ? (
                <img
                  src={mainPhoto}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground min-h-[280px]">
                  <span className="text-6xl font-display text-primary/40">
                    {profile.name.charAt(0)}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="font-display text-2xl font-bold">
                  {profile.name}, {profile.age}
                </h2>
                <p className="text-sm text-white/90">{profile.gender}</p>
              </div>
            </div>

            {/* Content sections - same scroll */}
            <div className="px-4 pb-4 pt-3 space-y-4">
            {/* Quick identifiers row */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                {profile.gender}
              </span>
              {profile.sexualOrientation && (
                <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                  {profile.sexualOrientation}
                </span>
              )}
            </div>

            {/* My bio */}
            {profile.bio && (
              <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                <h3 className="text-sm font-bold text-foreground mb-2">My bio</h3>
                <p className="text-sm text-foreground/90 leading-relaxed">{profile.bio}</p>
              </section>
            )}

            {/* About me - chip grid like Bumble */}
            {aboutChips.length > 0 && (
              <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                <h3 className="text-sm font-bold text-foreground mb-3">About me</h3>
                <div className="flex flex-wrap gap-2">
                  {aboutChips.map((item) => (
                    <AttributeChip key={item.label} icon={item.icon} label={item.label} />
                  ))}
                </div>
              </section>
            )}

            {/* I'm looking for / Non-negotiables */}
            {profile.nonNegotiables?.length > 0 && (
              <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                <h3 className="text-sm font-bold text-foreground mb-3">I'm looking for</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.nonNegotiables.map((n) => (
                    <span
                      key={n}
                      className="px-3 py-2 rounded-full bg-primary/15 text-primary text-sm font-medium border border-primary/20"
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* My interests - Bumble-style tags */}
            {profile.tags?.length > 0 && (
              <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                <h3 className="text-sm font-bold text-foreground mb-3">My interests</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-2 rounded-full bg-muted/80 text-foreground text-sm border border-border/50"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </section>
            )}

              <div className="h-4" />
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }
);

export default SwipeCard;
