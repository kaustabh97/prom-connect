import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Heart, User } from "lucide-react";
import SparkleBackground from "@/components/SparkleBackground";

export default function MatchmakingComingSoon() {
  const navigate = useNavigate();

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col w-full">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-10 max-w-[500px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
            <Heart className="w-12 h-12 text-primary" />
          </div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-3">
            Matchmaking will start soon! ✨
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            We&apos;re putting the finishing touches on discovery and chatting. 
            In the meantime, you can view and edit your profile.
          </p>
          <Button
            variant="gold"
            size="lg"
            className="w-full max-w-xs gap-2"
            onClick={() => navigate("/profile")}
          >
            <User className="w-5 h-5" />
            View my profile
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
