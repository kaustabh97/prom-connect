import { useRef } from "react";
import { MessageCircle, Share2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ReferralShareCard, PartnerInviteShareCard } from "./ShareableCard";
import { useShareImage } from "@/hooks/useShareImage";
import { shareViaWhatsApp, sharePartnerInviteViaWhatsApp } from "@/utils/share";

type ShareSheetVariant = "referral" | "partnerInvite";

interface ShareSheetBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareSheetReferralProps extends ShareSheetBaseProps {
  variant: "referral";
}

interface ShareSheetPartnerInviteProps extends ShareSheetBaseProps {
  variant: "partnerInvite";
  fromName: string;
  fromEmail: string;
  fromPhotoUrl?: string | null;
}

export type ShareSheetProps = ShareSheetReferralProps | ShareSheetPartnerInviteProps;

export default function ShareSheet(props: ShareSheetProps) {
  const { open, onOpenChange } = props;
  const cardRef = useRef<HTMLDivElement>(null);
  const { captureAndShare, isSharing } = useShareImage();

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    const imageUrls =
      props.variant === "partnerInvite" && props.fromPhotoUrl
        ? [props.fromPhotoUrl]
        : [];
    await captureAndShare(cardRef.current, {
      filename:
        props.variant === "referral"
          ? "starlitbythebrick-referral.png"
          : "starlitbythebrick-invite.png",
      shareTitle: "Starlit by the Brick",
      shareText:
        props.variant === "referral"
          ? "Starlit by the Brick – IIMA's anonymous matchmaking for Prom 2026!"
          : `${props.fromName} wants to go to Prom with you!`,
      imageUrls,
    });
    onOpenChange(false);
  };

  const handleShareWhatsApp = () => {
    if (props.variant === "referral") {
      shareViaWhatsApp();
    } else {
      sharePartnerInviteViaWhatsApp(props.fromName, props.fromEmail);
    }
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex flex-col gap-6 border-t border-primary/20 bg-[#0f1729]"
      >
        <SheetHeader>
          <SheetTitle className="text-foreground">Share</SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Share as an image or send via WhatsApp
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col items-center gap-6">
          <div ref={cardRef} className="flex justify-center">
            {props.variant === "referral" ? (
              <ReferralShareCard />
            ) : (
              <PartnerInviteShareCard
                fromName={props.fromName}
                fromPhotoUrl={props.fromPhotoUrl}
              />
            )}
          </div>
          <div className="flex w-full max-w-sm flex-col gap-3">
            <Button
              variant="default"
              size="lg"
              className="w-full gap-2"
              onClick={handleShareImage}
              disabled={isSharing}
            >
              {isSharing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Creating image...
                </>
              ) : (
                <>
                  <Share2 className="h-5 w-5" />
                  Share as image
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
              onClick={handleShareWhatsApp}
              disabled={isSharing}
            >
              <MessageCircle className="h-5 w-5" />
              Share via WhatsApp
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
