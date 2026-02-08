import { forwardRef } from "react";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { Coffee, Mountain, Utensils, Wine, Cigarette, MapPin, Heart, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SwipeCardProps {
  profile: DiscoveryProfileFull;
  isTop: boolean;
  onSwipe?: (action: "like" | "pass") => void;
  onNext?: () => void;
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
  function SwipeCard({ profile, isTop, onSwipe, onNext }, ref) {
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
                    {profile.cohort}
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

              {/* Like / Next / Pass – integrated at end of profile */}
              {isTop && (onSwipe || onNext) && (
                <div className="flex items-center justify-center gap-4 pt-6 pb-2 px-4 border-t border-border/50 mt-4">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full border-2 border-red-500/50 hover:border-red-500 hover:bg-red-500/10"
                    onClick={() => onSwipe?.("pass")}
                    title="Pass – won't see again"
                  >
                    <X className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-10 w-10 sm:h-12 sm:w-12 rounded-full border-2 border-border/50 hover:border-primary/50 hover:bg-primary/10"
                    onClick={onNext}
                    disabled={!onNext}
                    title="Next – skip for now, may see again"
                  >
                    <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="default"
                    size="icon"
                    className="h-12 w-12 sm:h-14 sm:w-14 rounded-full bg-primary hover:bg-primary/90"
                    onClick={() => onSwipe?.("like")}
                    title="Like"
                  >
                    <Heart className="w-6 h-6 sm:w-7 sm:h-7 fill-primary-foreground text-primary-foreground" />
                  </Button>
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
