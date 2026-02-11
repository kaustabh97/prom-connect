import { forwardRef } from "react";
import { getCohortDisplayLabel, type DiscoveryProfileFull } from "@/lib/dating";
import { Coffee, Mountain, Utensils, Wine, Cigarette, MapPin, Heart, ChevronRight, Flag, Flower2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SwipeCardProps {
  profile: DiscoveryProfileFull;
  isTop: boolean;
  /** Next = cycle to next profile (endless loop, no reject). */
  onNext?: () => void;
  onSwipe?: (action: "like" | "pass") => void;
  /** When true, Like button is visually disabled but still clickable (shows toast in parent). */
  likeDisabled?: boolean;
  /** Report: top-right on photo, slightly inward */
  onReportClick?: () => void;
  /** Rose: bottom-right of card, slightly inward */
  onRoseClick?: () => void;
  showRoseButton?: boolean;
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

const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, isTop, onNext, onSwipe, likeDisabled, onReportClick, onRoseClick, showRoseButton }, ref) {
    const mainPhoto = profile.photoUrls?.[0];

    const aboutChips: { key: string; icon?: React.ElementType; label: string }[] = [];
    if (profile.alcoholPreference) aboutChips.push({ key: "alcohol", icon: Wine, label: profile.alcoholPreference });
    if (profile.smokingPreference) aboutChips.push({ key: "smoking", icon: Cigarette, label: profile.smokingPreference });
    if (profile.foodPreference) aboutChips.push({ key: "food", icon: Utensils, label: profile.foodPreference });
    if (profile.teaOrCoffee) aboutChips.push({ key: "teaOrCoffee", icon: Coffee, label: profile.teaOrCoffee });
    if (profile.mountainOrBeach) aboutChips.push({ key: "mountainOrBeach", icon: Mountain, label: profile.mountainOrBeach });
    if (profile.favouritePlace) aboutChips.push({ key: "favouritePlace", icon: MapPin, label: profile.favouritePlace });

    return (
      <div ref={ref} className="relative w-full h-full flex flex-col min-h-[600px]">
        {showRoseButton && onRoseClick && (
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-4 right-4 z-10 h-10 w-10 rounded-full border-2 border-rose-400/60 bg-rose-50/90 shadow-lg backdrop-blur-sm hover:border-rose-500 hover:bg-rose-100/90"
            onClick={onRoseClick}
            title="Send a rose"
            aria-label="Send a rose"
          >
            <Flower2 className="h-5 w-5 text-rose-600" />
          </Button>
        )}
        <div className="relative w-full h-full rounded-2xl overflow-hidden bg-background border border-border shadow-float flex flex-col">
          {/* Single flow: photo + content – parent (Discover card area) scrolls */}
          <div className="flex-1 min-h-0 flex flex-col min-w-0">
            {/* Hero photo - flows with content */}
            <div className="relative aspect-[4/5] w-full bg-muted shrink-0 min-h-[400px]">
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
              {onReportClick && (
                <Button
                  variant="outline"
                  size="icon"
                  className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full border-2 border-muted-foreground/40 bg-background/90 shadow-lg backdrop-blur-sm hover:border-destructive/50 hover:bg-destructive/10"
                  onClick={onReportClick}
                  title="Report"
                  aria-label="Report"
                >
                  <Flag className="h-5 w-5 text-muted-foreground" />
                </Button>
              )}
              <div className="absolute bottom-4 left-4 right-4 text-white">
                <h2 className="font-display text-2xl font-bold">
                  {profile.name}, {profile.age}
                </h2>
                <p className="text-sm text-white/90">{profile.gender}</p>
              </div>
            </div>

            {/* Content sections - same scroll */}
            <div className="px-4 pb-4 pt-3 space-y-4">
              {/* Basic info: Gender, Sexual Orientation, Cohort, Hometown, Intention */}
              <div className="flex flex-wrap gap-2">
                {profile.gender && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.gender}
                  </span>
                )}
                {profile.sexualOrientation && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.sexualOrientation}
                  </span>
                )}
                {profile.cohort && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {getCohortDisplayLabel(profile.cohort)}
                  </span>
                )}
                {profile.hometown && (
                  <span className="px-3 py-1.5 rounded-full bg-muted/80 text-foreground text-sm border border-border/50">
                    {profile.hometown}
                  </span>
                )}
                {profile.intention && (
                  <span className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-sm font-medium border border-primary/20">
                    {profile.intention}
                  </span>
                )}
              </div>

              {profile.bio && (
                <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">My bio</h3>
                  <p className="text-sm text-foreground/90 leading-relaxed">{profile.bio}</p>
                </section>
              )}

              {aboutChips.length > 0 && (
                <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">About me</h3>
                  <div className="flex flex-wrap gap-2">
                    {aboutChips.map((item) => (
                      <AttributeChip key={item.key} icon={item.icon} label={item.label} />
                    ))}
                  </div>
                </section>
              )}

              {profile.email && (
                <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">IIMA email</h3>
                  <p className="text-xs text-muted-foreground break-all">
                    {profile.email}
                  </p>
                </section>
              )}

              {profile.tags?.length > 0 && (
                <section className="rounded-2xl bg-card/60 border border-border/50 p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3">My interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.tags.map((tag, i) => (
                      <span
                        key={`tag-${i}-${tag}`}
                        className="px-3 py-2 rounded-full bg-muted/80 text-foreground text-sm border border-border/50"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Next (cycle) / Like – integrated at end of profile */}
              {isTop && (onNext || onSwipe) && (
                <div className="flex items-center justify-center gap-6 pt-6 pb-2 px-4 border-t border-border/50 mt-4">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-muted-foreground/30 bg-muted/30 hover:border-muted-foreground/60 hover:bg-muted/50 transition-all duration-200 hover:scale-105 active:scale-95 shadow-lg shadow-black/20"
                        onClick={() => (onNext ? onNext() : onSwipe?.("pass"))}
                      >
                        <ChevronRight className="w-7 h-7 sm:w-8 sm:h-8 text-muted-foreground" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-medium">
                      Next – see next profile
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="default"
                        size="icon"
                        className={
                          likeDisabled
                            ? "h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
                            : "h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-[0_0_24px_hsl(43_74%_66%_/_0.4)] hover:shadow-[0_0_32px_hsl(43_74%_66%_/_0.5)] transition-all duration-200 hover:scale-105 active:scale-95"
                        }
                        onClick={() => onSwipe("like")}
                      >
                        <Heart
                          className={`w-7 h-7 sm:w-8 sm:h-8 ${likeDisabled ? "text-muted-foreground" : "fill-primary-foreground text-primary-foreground"}`}
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="font-medium">
                      {likeDisabled
                        ? "You've used today's likes – come back tomorrow"
                        : "Like – interested in this profile"}
                    </TooltipContent>
                  </Tooltip>
                </div>
              )}

              <div className="h-4" />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

export default SwipeCard;
