import { useState, useEffect } from "react";
import { motion } from "framer-motion";
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
import { Sparkles } from "lucide-react";

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
      <DialogContent className="max-w-[420px] max-h-[85dvh] overflow-y-auto glass-strong border-primary/30 shadow-glow">
        <DialogHeader className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle className="font-display text-2xl font-bold text-foreground">
              Filters
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Customize your discovery preferences
          </p>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Age range */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-3"
          >
            <Label className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">Age Range</span>
            </Label>
            <div className="flex items-center gap-4 px-2">
              <span className="text-lg font-semibold text-primary w-10 text-center">
                {local.ageMin}
              </span>
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
              <span className="text-lg font-semibold text-primary w-10 text-center">
                {local.ageMax}
              </span>
            </div>
          </motion.div>

          {/* Gender(s) interested in */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-3"
          >
            <Label className="text-base font-semibold text-foreground flex items-center gap-2">
              <span className="text-primary">Interested In</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {GENDER_OPTIONS.map((g) => (
                <motion.div
                  key={g}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="button"
                    variant={local.gendersInterestedIn.includes(g) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleGender(g)}
                    className={
                      local.gendersInterestedIn.includes(g)
                        ? "bg-primary/25 text-primary border-primary/40 hover:bg-primary/30 shadow-md shadow-primary/20 font-semibold"
                        : "bg-background/40 border-primary/20 hover:bg-background/60 hover:border-primary/30 text-foreground/80"
                    }
                  >
                    {g}
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Non-negotiables */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <div>
              <Label className="text-base font-semibold text-foreground flex items-center gap-2">
                <span className="text-primary">Non-Negotiables</span>
              </Label>
              <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                Only see profiles that match these preferences
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {NON_NEGOTIABLE_OPTIONS.map((n) => (
                <motion.div
                  key={n}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button
                    type="button"
                    variant={local.nonNegotiables.includes(n) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleNonNegotiable(n)}
                    className={
                      local.nonNegotiables.includes(n)
                        ? "bg-primary/25 text-primary border-primary/40 hover:bg-primary/30 shadow-md shadow-primary/20 font-semibold"
                        : "bg-background/40 border-primary/20 hover:bg-background/60 hover:border-primary/30 text-foreground/80"
                    }
                  >
                    {n}
                  </Button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        <DialogFooter className="gap-2 pt-4 border-t border-primary/20">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="hover:bg-background/60"
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            onClick={handleSave}
            className="shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30"
          >
            Save Filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
