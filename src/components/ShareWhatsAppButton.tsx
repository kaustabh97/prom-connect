import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ShareSheet from "@/components/ShareSheet";

interface ShareWhatsAppButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
  /** Custom label text (e.g. "Refer friends"). Default: "Share" */
  label?: string;
}

/**
 * Button that opens a share sheet with referral image + WhatsApp options.
 * User can share as image (like Prom Date) or send via WhatsApp.
 */
export default function ShareWhatsAppButton({
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
  label = "Share",
}: ShareWhatsAppButtonProps) {
  const [showShareSheet, setShowShareSheet] = useState(false);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        className={className}
        onClick={() => setShowShareSheet(true)}
        title="Share"
        aria-label={label}
      >
        <Share2 className="w-4 h-4 shrink-0" />
        {showLabel && size !== "icon" && <span className="ml-2">{label}</span>}
      </Button>
      <ShareSheet
        variant="referral"
        open={showShareSheet}
        onOpenChange={setShowShareSheet}
      />
    </>
  );
}
