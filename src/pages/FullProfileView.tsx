import { useParams, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { useScrollWheel } from "@/hooks/useScrollWheel";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Heart, X, ArrowLeft } from "lucide-react";
import {
  MOCK_DISCOVERY_PROFILES_FULL,
  type DiscoveryProfileFull,
} from "@/lib/dating";
import { useMatch } from "@/hooks/useMatch";

export default function FullProfileView() {
  const { profileId } = useParams<{ profileId: string }>();
  const navigate = useNavigate();
  const { recordSwipe } = useMatch();
  const scrollRef = useScrollWheel();

  const profile = useMemo(() => {
    return MOCK_DISCOVERY_PROFILES_FULL.find((p) => p.id === profileId) ?? null;
  }, [profileId]);

  const handleLike = () => {
    if (profile) {
      recordSwipe(profile.id, "like");
      navigate("/discover/profile");
    }
  };

  const handlePass = () => {
    if (profile) {
      recordSwipe(profile.id, "pass");
      navigate("/discover/profile");
    }
  };

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-4">
        <p className="text-muted-foreground">Profile not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/discover/profile")}>
          Back to Discover
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 bg-background min-h-0">
      {/* Single full-page scroll: header + photo + content */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain scroll-touch outline-none pb-4"
        tabIndex={0}
      >
        <header className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-border/50 bg-background/95 backdrop-blur shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/discover/profile")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-display font-semibold">Profile</span>
          <div className="w-10" />
        </header>

        {/* Photo - scrolls with content */}
        <div className="aspect-[4/5] bg-muted flex items-center justify-center shrink-0">
          {profile.photoUrls?.[0] ? (
            <img
              src={profile.photoUrls[0]}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl font-display text-primary/40">
              {profile.name.charAt(0)}
            </span>
          )}
        </div>

        <div className="p-4 space-y-6 max-w-[500px] mx-auto">
          {/* Name, age, gender */}
          <section>
            <h1 className="font-display text-2xl font-bold">
              {profile.name}, {profile.age}
            </h1>
            <p className="text-muted-foreground">{profile.gender}</p>
          </section>

          {/* About */}
          {profile.bio && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                About
              </h2>
              <p className="text-foreground">{profile.bio}</p>
            </section>
          )}

          {/* Interests */}
          {profile.tags?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Interests
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Campus / lifestyle */}
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Campus & lifestyle
            </h2>
            <ul className="space-y-1 text-sm">
              {profile.favouritePlace && (
                <li>Favourite place: {profile.favouritePlace}</li>
              )}
              {profile.teaOrCoffee && (
                <li>Tea or Coffee: {profile.teaOrCoffee}</li>
              )}
              {profile.mountainOrBeach && (
                <li>Mountain or Beach: {profile.mountainOrBeach}</li>
              )}
              {profile.foodPreference && (
                <li>Food: {profile.foodPreference}</li>
              )}
            </ul>
          </section>

          {/* Non-negotiables */}
          {profile.nonNegotiables?.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Non-negotiables
              </h2>
              <div className="flex flex-wrap gap-2">
                {profile.nonNegotiables.map((n) => (
                  <span
                    key={n}
                    className="px-3 py-1.5 rounded-full bg-muted text-foreground text-sm"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Spacer for bottom buttons */}
          <div className="h-24" />
        </div>
      </div>

      {/* Fixed Like / Pass at bottom - outside scroll */}
      <div className="fixed bottom-16 left-0 right-0 max-w-[500px] mx-auto px-4 py-3 border-t border-border/50 bg-background/95 backdrop-blur flex items-center justify-center gap-6 safe-area-pb">
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          onClick={handlePass}
        >
          <X className="w-6 h-6" />
        </Button>
        <Button
          variant="default"
          size="icon"
          className="h-12 w-12 rounded-full bg-primary"
          onClick={handleLike}
        >
          <Heart className="w-6 h-6 fill-primary-foreground text-primary-foreground" />
        </Button>
      </div>
    </div>
  );
}
