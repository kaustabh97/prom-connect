import { Sparkles, User } from "lucide-react";
import { APP_URL } from "@/config";

/** Referral card – IIMA matchmaking for Prom 2026 */
export function ReferralShareCard() {
  return (
    <div
      className="w-[360px] rounded-2xl border border-primary/30 bg-[#0f1729] p-8 shadow-xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(15,23,41,1) 0%, rgba(15,23,41,0.98) 100%)",
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold text-foreground">
          Starlit by the Brick
        </h2>
        <p className="mt-2 text-base text-muted-foreground">
          IIMA&apos;s anonymous matchmaking for Prom 2026
        </p>
        <p className="mt-4 text-sm text-primary font-medium">
          Find your date. Campus-only, privacy-first.
        </p>
        <p className="mt-6 text-xs text-muted-foreground/80 break-all">
          {APP_URL}
        </p>
        <p className="mt-4 font-playfair text-lg text-primary">
          Save the date – 15th Feb, 8 PM
        </p>
      </div>
    </div>
  );
}

interface PartnerInviteShareCardProps {
  fromName: string;
  fromPhotoUrl?: string | null;
}

/** Partner invite card – X wants to go to Prom with you (no link – kept in WhatsApp text) */
export function PartnerInviteShareCard({
  fromName,
  fromPhotoUrl,
}: PartnerInviteShareCardProps) {
  return (
    <div
      className="w-[360px] rounded-2xl border border-primary/30 bg-[#0f1729] p-8 shadow-xl"
      style={{
        background:
          "linear-gradient(180deg, rgba(15,23,41,1) 0%, rgba(15,23,41,0.98) 100%)",
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/20 ring-2 ring-primary/40">
          {fromPhotoUrl ? (
            <img
              src={fromPhotoUrl}
              alt={fromName}
              className="h-full w-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <User className="h-10 w-10 text-primary/60" />
          )}
        </div>
        <p className="text-muted-foreground">wants to go to Prom with you</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-primary">
          {fromName}
        </h2>
        <p className="mt-4 text-sm text-muted-foreground">
          Join Starlit by the Brick and accept their invite – your dance floor awaits! 💃🕺
        </p>
        <p className="mt-6 font-playfair text-xl text-primary">
          Save the date – 15th Feb, 8 PM ✨
        </p>
        <p className="mt-3 text-sm text-muted-foreground/80">
          See you on the dance floor.
        </p>
      </div>
    </div>
  );
}
