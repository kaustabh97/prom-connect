import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shareViaWhatsApp } from "@/utils/share";

interface ShareWhatsAppButtonProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  showLabel?: boolean;
  /** Custom label text (e.g. "Refer friends"). Default: "Share" */
  label?: string;
}

/**
 * Button that opens WhatsApp with a referral message pre-filled.
 * User can select contacts to share with.
 */
export default function ShareWhatsAppButton({
  variant = "outline",
  size = "sm",
  className = "",
  showLabel = true,
  label = "Share",
}: ShareWhatsAppButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={shareViaWhatsApp}
      title="Share via WhatsApp"
      aria-label={label}
    >
      <Share2 className="w-4 h-4 shrink-0" />
      {showLabel && size !== "icon" && <span className="ml-2">{label}</span>}
    </Button>
  );
}
