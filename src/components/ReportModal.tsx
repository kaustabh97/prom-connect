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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { Flag, Loader2 } from "lucide-react";

const client = generateClient<Schema>();
const REPORT_EMAIL = "p24kaustabh@iima.ac.in";

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName?: string;
  personId?: string;
  context?: string;
  reporterEmail?: string;
  reporterName?: string;
}

export default function ReportModal({
  open,
  onOpenChange,
  personName,
  personId,
  context = "Prom Connect",
  reporterEmail,
  reporterName,
}: ReportModalProps) {
  const [reportText, setReportText] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();
  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  const handleSubmit = async () => {
    const text = reportText.trim();
    if (!text) {
      toast({ title: "Please describe the issue", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const sendReportEmail = client.queries?.sendReportEmail;
      if (typeof sendReportEmail === "function") {
        const result = await sendReportEmail(
          {
            personName: personName ?? undefined,
            personId: personId ?? undefined,
            context,
            reportText: text,
            reporterEmail: reporterEmail ?? undefined,
            reporterName: reporterName ?? undefined,
          },
          opts
        );
        if (result.data?.success !== false) {
          toast({ title: "Report sent", description: "Thank you for helping keep Prom Connect safe." });
          setReportText("");
          onOpenChange(false);
        } else {
          toast({ title: "Could not send report", variant: "destructive" });
        }
      } else {
        // Fallback: open mailto when backend sendReportEmail not deployed
        const subject = encodeURIComponent("Prom Connect – Report");
        const bodyParts: string[] = [];
        if (personName || personId) {
          bodyParts.push(`Reporting: ${personName || "Unknown"}${personId ? ` (ID: ${personId})` : ""}`);
        }
        bodyParts.push(`Context: ${context}`);
        if (reporterEmail || reporterName) {
          bodyParts.push(`Reporter: ${reporterName || ""} ${reporterEmail ? `<${reporterEmail}>` : ""}`.trim());
        }
        bodyParts.push("");
        bodyParts.push("Report details:");
        bodyParts.push("---");
        bodyParts.push(text);
        bodyParts.push("---");
        const body = encodeURIComponent(bodyParts.join("\n"));
        window.location.href = `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
        toast({ title: "Report opened", description: "Your email client will open with the report pre-filled." });
        setReportText("");
        onOpenChange(false);
      }
    } catch (err) {
      console.error("[ReportModal] Send failed:", err);
      toast({
        title: "Could not send report",
        description: err instanceof Error ? err.message : "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    if (!sending) {
      setReportText("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" />
            Report
          </DialogTitle>
          <DialogDescription>
            {personName || personId ? (
              <>
                Reporting{" "}
                <span className="font-medium text-foreground">
                  {personName || "this person"}
                </span>
                {personId ? ` (ID: ${personId})` : ""}
              </>
            ) : (
              "Describe the issue you wish to report."
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="report-text" className="text-sm font-medium">
              What would you like to report?
            </label>
            <Textarea
              id="report-text"
              placeholder="Please provide details..."
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              rows={4}
              className="resize-none"
              disabled={sending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={sending || !reportText.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Sending...
              </>
            ) : (
              "Send report"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
