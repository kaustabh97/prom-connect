import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReportFloatingButtonProps {
  /** Called when the Report button is clicked - typically opens the Report modal */
  onClick: () => void;
  /** Position: "bottom" (default) fixed bottom-right, "top-right" fixed top-right, "inline" for parent-positioned (chat) */
  position?: "bottom" | "top-right" | "inline";
}

/**
 * Floating button to report a person. Calls onClick (opens Report modal).
 */
export default function ReportFloatingButton({ onClick, position = "bottom" }: ReportFloatingButtonProps) {
  const positionClass = position === "inline"
    ? ""
    : position === "top-right"
      ? "fixed top-20 right-6 z-40"
      : "fixed bottom-20 right-6 z-40";

  return (
    <Button
      variant="outline"
      size="icon"
      className={`${positionClass} h-12 w-12 rounded-full border-2 border-muted-foreground/40 bg-background/90 shadow-lg backdrop-blur-sm hover:border-destructive/50 hover:bg-destructive/10`}
      onClick={onClick}
      title="Report"
      aria-label="Report"
    >
      <Flag className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}
