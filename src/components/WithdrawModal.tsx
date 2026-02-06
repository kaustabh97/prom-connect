import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { logError } from "@/utils/logger";

const sexualities = ["Straight", "Gay", "Bisexual", "Queer"];
const intentions = [
  "Date for Prom",
  "In a relationship, looking for a prom date",
  "Long Term",
  "Not Sure",
];

export interface WithdrawFormData {
  sexualOrientation: string;
  intention: string;
  hometown: string;
}

interface WithdrawModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (data: WithdrawFormData) => Promise<void>;
}

/**
 * Modal shown when user withdraws a partner request. Collects compulsory
 * profile fields (sexual orientation, intention, hometown) so the profile
 * matches anyone in the normal discover flow.
 */
export default function WithdrawModal({
  open,
  onOpenChange,
  onConfirm,
}: WithdrawModalProps) {
  const [sexualOrientation, setSexualOrientation] = useState("");
  const [intention, setIntention] = useState("");
  const [hometown, setHometown] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit =
    sexualOrientation.trim() !== "" &&
    intention.trim() !== "" &&
    hometown.trim() !== "";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onConfirm({
        sexualOrientation: sexualOrientation.trim(),
        intention: intention.trim(),
        hometown: hometown.trim(),
      });
      onOpenChange(false);
    } catch (e) {
      logError(e, { component: "WithdrawModal", operation: "handleSubmit" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Almost there!</DialogTitle>
          <DialogDescription>
            To join the discover flow, we need a few quick details. Same info as
            everyone else.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label htmlFor="withdraw-sexuality">Sexual orientation</Label>
            <Select
              value={sexualOrientation}
              onValueChange={setSexualOrientation}
            >
              <SelectTrigger id="withdraw-sexuality" className="mt-2">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {sexualities.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="withdraw-intention">What&apos;s the endgame?</Label>
            <Select value={intention} onValueChange={setIntention}>
              <SelectTrigger id="withdraw-intention" className="mt-2">
                <SelectValue placeholder="Just prom? Or more?" />
              </SelectTrigger>
              <SelectContent>
                {intentions.map((i) => (
                  <SelectItem key={i} value={i}>
                    {i}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="withdraw-hometown">Hometown</Label>
            <Input
              id="withdraw-hometown"
              placeholder="Enter your hometown"
              value={hometown}
              onChange={(e) => setHometown(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              "Withdraw & discover"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
