import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { DiscoveryFilters } from "@/lib/dating";
import { GENDER_OPTIONS, NON_NEGOTIABLE_OPTIONS } from "@/lib/dating";

interface FiltersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: DiscoveryFilters;
  onSave: (f: DiscoveryFilters) => void;
}

export default function FiltersModal({
  open,
  onOpenChange,
  filters,
  onSave,
}: FiltersModalProps) {
  const [local, setLocal] = useState<DiscoveryFilters>(filters);

  useEffect(() => {
    if (open) setLocal({ ...filters });
  }, [open, filters]);

  const toggleGender = (g: string) => {
    setLocal((prev) => ({
      ...prev,
      gendersInterestedIn: prev.gendersInterestedIn.includes(g)
        ? prev.gendersInterestedIn.filter((x) => x !== g)
        : [...prev.gendersInterestedIn, g],
    }));
  };

  const toggleNonNegotiable = (n: string) => {
    setLocal((prev) => ({
      ...prev,
      nonNegotiables: prev.nonNegotiables.includes(n)
        ? prev.nonNegotiables.filter((x) => x !== n)
        : [...prev.nonNegotiables, n],
    }));
  };

  const handleSave = () => {
    onSave(local);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] max-h-[85dvh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Filters</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Age range */}
          <div>
            <Label className="text-sm font-medium">Age range</Label>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-sm text-muted-foreground w-8">{local.ageMin}</span>
              <Slider
                value={[local.ageMin, local.ageMax]}
                min={18}
                max={50}
                step={1}
                onValueChange={([a, b]) =>
                  setLocal((prev) => ({ ...prev, ageMin: a, ageMax: b }))
                }
                className="flex-1"
              />
              <span className="text-sm text-muted-foreground w-8">{local.ageMax}</span>
            </div>
          </div>

          {/* Gender(s) interested in */}
          <div>
            <Label className="text-sm font-medium">Interested in</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {GENDER_OPTIONS.map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={local.gendersInterestedIn.includes(g) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleGender(g)}
                  className={
                    local.gendersInterestedIn.includes(g) ? "bg-primary/20 text-primary" : ""
                  }
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          {/* Non-negotiables */}
          <div>
            <Label className="text-sm font-medium">Non-negotiables</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Only see profiles that match these
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {NON_NEGOTIABLE_OPTIONS.map((n) => (
                <Button
                  key={n}
                  type="button"
                  variant={local.nonNegotiables.includes(n) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleNonNegotiable(n)}
                  className={
                    local.nonNegotiables.includes(n) ? "bg-primary/20 text-primary" : ""
                  }
                >
                  {n}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSave}>
            Save filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
