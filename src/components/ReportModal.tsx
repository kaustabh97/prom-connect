import { useState, useEffect } from "react";
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
import { getUserProfileFromCognito } from "@/utils/auth";
import { logError, logInfo } from "@/utils/logger";
import { Flag, Loader2 } from "lucide-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
const REPORT_EMAIL = "mosaic@iima.ac.in";
const client = generateClient<Schema>();

/** Fallback: open Gmail with report pre-filled */
function openGmailReportFallback(
  text: string,
  context: string,
  personName?: string,
  personId?: string,
  personEmail?: string,
  reporterEmail?: string,
  reporterName?: string
) {
  const subject = encodeURIComponent("Starlit by the Brick – Report");
  const bodyParts: string[] = [];
  if (personEmail || personName) {
    const identifier = personEmail || personName || "Unknown";
    bodyParts.push(`Reporting: ${identifier}`);
  }
  bodyParts.push(`Context: ${context}`);
  if (reporterEmail || reporterName) {
    bodyParts.push(`Reporter: ${reporterName || ""} ${reporterEmail ? `<${reporterEmail}>` : ""}`.trim());
  }
  bodyParts.push("", "Report details:", "---", text, "---");
  const body = encodeURIComponent(bodyParts.join("\n"));
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(REPORT_EMAIL)}&su=${subject}&body=${body}`;
  window.open(gmailUrl, "_blank", "noopener,noreferrer");
}

/** Send report via FormSubmit (no sign-up; recipient confirms email once) */
async function sendReportViaFormSubmit(
  text: string,
  context: string,
  personName?: string,
  personId?: string,
  personEmail?: string,
  reporterEmail?: string,
  reporterName?: string
): Promise<{ ok: boolean }> {
  const res = await fetch(`https://formsubmit.co/ajax/${REPORT_EMAIL}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      _subject: "Starlit by the Brick – Report",
      _template: "table",
      _captcha: "false",
      "Report details": text,
      "Reported person": personEmail || personName || "Unknown",
      Context: context,
      "Reporter email": reporterEmail || "",
      "Reporter name": reporterName || "",
    }),
  });
  const data = await res.json();
  return { ok: res.ok && (data as { success?: boolean }).success !== false };
}

interface ReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personName?: string;
  personId?: string;
  personEmail?: string;
  context?: string;
  reporterEmail?: string;
  reporterName?: string;
  /** Current user's profile id; when set, a Report record is created so reported profile is excluded from discovery */
  reporterUserId?: string;
  /** Called after report is submitted and Report record created (e.g. refresh Discover feed) */
  onReportCreated?: () => void;
}

export default function ReportModal({
  open,
  onOpenChange,
  personName,
  personId,
  personEmail,
  context = "Starlit by the Brick",
  reporterEmail,
  reporterName,
  reporterUserId,
  onReportCreated,
}: ReportModalProps) {
  const [reportText, setReportText] = useState("");
  const [sending, setSending] = useState(false);
  const [reporterInfo, setReporterInfo] = useState<{ email?: string; name?: string }>({});
  const { toast } = useToast();

  // Fetch current user (reporter) when modal opens
  useEffect(() => {
    if (open) {
      logInfo("Report modal opened", { component: "ReportModal", operation: "open", extra: { personName, personId } });
      getUserProfileFromCognito().then((p) => {
        setReporterInfo({ email: p?.email, name: p?.name });
      });
    }
  }, [open]);

  const handleSubmit = async () => {
    const text = reportText.trim();
    if (!text) {
      toast({ title: "Please describe the issue", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const reporterEmailToUse = reporterEmail ?? reporterInfo.email;
      const reporterNameToUse = reporterName ?? reporterInfo.name;
      const result = await sendReportViaFormSubmit(
        text,
        context,
        personName ?? undefined,
        personId,
        personEmail ?? undefined,
        reporterEmailToUse,
        reporterNameToUse
      );
      if (result.ok) {
        logInfo("Report submitted successfully", { component: "ReportModal", operation: "submit", extra: { personName, personId } });
        if (reporterUserId && personId) {
          try {
            await client.models.Report.create(
              {
                reporterUserId,
                reportedProfileId: personId,
                createdAt: new Date().toISOString(),
              },
              { authMode: "apiKey" }
            );
            onReportCreated?.();
          } catch (err) {
            logError(err, { component: "ReportModal", operation: "createReport", extra: { reporterUserId, personId } });
          }
        }
        toast({ title: "Report sent", description: "Thank you for helping keep Starlit by the Brick safe." });
        setReportText("");
        onOpenChange(false);
      } else {
        openGmailReportFallback(text, context, personName ?? undefined, personId, personEmail ?? undefined, reporterEmailToUse, reporterNameToUse);
        toast({ title: "Opened email app", description: "Please send the report manually." });
        setReportText("");
        onOpenChange(false);
      }
    } catch (err) {
      logError(err, { component: "ReportModal", operation: "sendReportViaFormSubmit" });
      const reporterEmailToUse = reporterEmail ?? reporterInfo.email;
      const reporterNameToUse = reporterName ?? reporterInfo.name;
      openGmailReportFallback(text, context, personName ?? undefined, personId, personEmail ?? undefined, reporterEmailToUse, reporterNameToUse);
      toast({ title: "Opened email app", description: "Please send the report manually." });
      setReportText("");
      onOpenChange(false);
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
            {personName ? (
              <>
                Reporting{" "}
                <span className="font-medium text-foreground">
                  {personName}
                </span>
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
