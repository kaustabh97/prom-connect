import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import SparkleBackground from "@/components/SparkleBackground";
import { Heart, Sparkles, ArrowLeft, PartyPopper, X } from "lucide-react";

interface PromAskProps {
  matchId: string;
  matchCompatScore: number;
  onClose: () => void;
}

const PromAsk = ({ matchId, matchCompatScore, onClose }: PromAskProps) => {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    // In real app, send prom ask request
    setSent(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass rounded-3xl p-8 max-w-md w-full relative overflow-hidden"
      >
        {/* Decorative gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
        
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="sent"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative z-10 text-center py-8"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6"
              >
                <PartyPopper className="w-10 h-10 text-primary" />
              </motion.div>
              
              <h3 className="font-display text-2xl font-bold mb-2">
                Prom Ask Sent! 🎉
              </h3>
              <p className="text-muted-foreground mb-6">
                They'll receive your invitation. We'll notify you when they respond!
              </p>
              
              <Button variant="gold" onClick={onClose}>
                Got it!
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative z-10"
            >
              <div className="text-center mb-6">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring" }}
                  className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center mx-auto mb-4"
                >
                  <Heart className="w-8 h-8 text-secondary" />
                </motion.div>
                
                <h3 className="font-display text-2xl font-bold mb-2">
                  Ask to Prom? 💃
                </h3>
                <p className="text-muted-foreground">
                  Send a special invitation to your{" "}
                  <span className="text-primary font-semibold">
                    {Math.round(matchCompatScore * 100)}% match
                  </span>
                </p>
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium text-foreground mb-2 block">
                  Add a personal message (optional)
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Would you like to go to prom with me? ✨"
                  className="resize-none"
                  rows={3}
                />
              </div>

              <div className="glass rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground">
                  <Sparkles className="w-4 h-4 inline mr-1 text-primary" />
                  If they accept, you'll both be paired for prom and can coordinate details!
                </p>
              </div>

              <div className="flex gap-3">
                <Button variant="glass" className="flex-1" onClick={onClose}>
                  Maybe Later
                </Button>
                <Button variant="gold" className="flex-1" onClick={handleSend}>
                  <Heart className="w-4 h-4 mr-2" />
                  Send Prom Ask
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default PromAsk;
