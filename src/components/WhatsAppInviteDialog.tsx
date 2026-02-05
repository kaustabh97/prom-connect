import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sharePartnerInviteViaWhatsApp } from "@/utils/share";

interface WhatsAppInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fromName: string;
  fromEmail: string;
  /** Label for the skip/cancel button. Default: "Skip for Now" */
  skipLabel?: string;
  /** Called when skip is clicked (in addition to closing). E.g. navigate. */
  onSkip?: () => void;
  /** Called after opening WhatsApp (e.g. navigate). */
  onOpenWhatsApp?: () => void;
}

/**
 * Dialog to share partner invite via WhatsApp with optional personal message.
 * Same flow as Onboarding - no "Share as image", only WhatsApp with personal message.
 */
export default function WhatsAppInviteDialog({
  open,
  onOpenChange,
  fromName,
  fromEmail,
  skipLabel = "Skip for Now",
  onSkip,
  onOpenWhatsApp,
}: WhatsAppInviteDialogProps) {
  const [personalMessage, setPersonalMessage] = useState("");

  const handleOpenChange = (next: boolean) => {
    if (!next) setPersonalMessage("");
    onOpenChange(next);
  };

  const handleSkip = () => {
    onSkip?.();
    handleOpenChange(false);
  };

  const handleOpenWhatsApp = () => {
    sharePartnerInviteViaWhatsApp(fromName, fromEmail, personalMessage || undefined);
    setPersonalMessage("");
    onOpenChange(false);
    onOpenWhatsApp?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] rounded-2xl glass-strong border-primary/30 shadow-glow p-0 gap-0 flex flex-col overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none rounded-2xl" />

        <DialogHeader className="relative px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-center mb-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/20 border-2 border-primary/50">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-display font-bold text-center text-foreground">
            Invite Your IIMA Cutie
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground pt-2 space-y-3 overflow-y-auto max-h-[40vh]">
            <p>
              Invite your partner to join Starlit by the Brick and accept your invitation via WhatsApp. Add a personal message to make it extra special.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-2 flex-1 min-h-0 overflow-y-auto">
          <Label htmlFor="invite-personal-message" className="text-sm font-medium text-foreground">
            Add a personal message <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="invite-personal-message"
            placeholder="e.g. You're going to love this 💫"
            value={personalMessage}
            onChange={(e) => setPersonalMessage(e.target.value)}
            className="mt-2 min-h-[80px] resize-none"
            maxLength={300}
          />
          <p className="text-xs text-muted-foreground mt-1">{personalMessage.length}/300</p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 px-6 pb-6 pt-4 relative flex-shrink-0 border-t border-border/50">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="w-full sm:w-auto"
          >
            {skipLabel}
          </Button>
          <Button
            variant="gold"
            onClick={handleOpenWhatsApp}
            className="w-full sm:w-auto"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Open WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
