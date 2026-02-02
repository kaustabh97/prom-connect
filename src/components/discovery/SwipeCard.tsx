import { forwardRef } from "react";
import type { DiscoveryProfileFull } from "@/lib/dating";
import { Coffee, Mountain, Utensils, Wine, Cigarette, MapPin } from "lucide-react";

interface SwipeCardProps {
  profile: DiscoveryProfileFull;
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

const SwipeCard = forwardRef<HTMLDivElement, SwipeCardProps>(
  function SwipeCard({ profile, isTop }, ref) {
    const mainPhoto = profile.photoUrls?.[0];

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
      <div ref={ref} className="relative w-full">
        <div className="relative w-full rounded-2xl overflow-hidden bg-background border border-border shadow-float min-h-0">
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
        </div>
      </div>
    );
  }
);

export default SwipeCard;
