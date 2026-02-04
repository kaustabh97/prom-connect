import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, X, Loader2 } from "lucide-react";
import { sharePartnerInviteViaWhatsApp } from "@/utils/share";
import { getUserProfile } from "@/utils/auth";

export interface PendingPartnerRequest {
  id: string;
  toEmail: string;
  partnerDisplayName: string;
}

interface PendingPartnerRequestViewProps {
  partnerDisplayName: string;
  onWithdraw: () => Promise<void>;
  onShare?: () => void;
  isWithdrawing: boolean;
}

/**
 * Shown when user has sent a partner invite (Already a couple flow) and is waiting for acceptance.
 * No access to Discover or Chat – only withdraw or share.
 */
export default function PendingPartnerRequestView({
  partnerDisplayName,
  onWithdraw,
  onShare,
  isWithdrawing,
}: PendingPartnerRequestViewProps) {
  const handleShare = async () => {
    const p = await getUserProfile();
    sharePartnerInviteViaWhatsApp(p?.name || "Someone", p?.email || "");
    onShare?.();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 py-12 px-6">
      <div className="flex flex-col flex-1 items-center justify-center text-center max-w-sm mx-auto">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
          <Heart className="w-10 h-10 text-primary" />
        </div>
        <h2 className="font-display text-2xl font-bold mb-3">
          Your prom invite is in the air! ✨
        </h2>
        <p className="text-muted-foreground text-lg mb-2">
          You&apos;re waiting on{" "}
          <span className="text-primary font-semibold">{partnerDisplayName}</span>
          — fingers crossed they say yes!
        </p>
        <p className="text-sm text-muted-foreground mb-8">
          No swiping or chatting until they accept. Use the buttons below to nudge them or change your mind.
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-auto pt-6">
        <Button
          variant="default"
          size="lg"
          className="w-full h-14 text-base gap-2"
          onClick={handleShare}
          disabled={isWithdrawing}
        >
          <MessageCircle className="w-5 h-5" />
          Share invite via WhatsApp
        </Button>
        <Button
          variant="outline"
          size="lg"
          className="w-full h-14 text-base gap-2"
          onClick={onWithdraw}
          disabled={isWithdrawing}
        >
          {isWithdrawing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Withdrawing...
            </>
          ) : (
            <>
              <X className="w-5 h-5" />
              Withdraw request – I&apos;ll discover instead
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
