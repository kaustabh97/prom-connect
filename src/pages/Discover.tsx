import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import AnonymousCard from "@/components/AnonymousCard";
import { Heart, X, MessageCircle, Sparkles, ArrowRight, RefreshCw } from "lucide-react";

// Mock data for demo
const mockProfiles = [
  {
    id: "1",
    tags: ["Music", "Coffee", "Debate"],
    promptAnswer: "Library vibes > Coffee shop chaos",
    personality: { extrovert: 0.3, openness: 0.7 },
    campusSpots: ["Library", "LKP", "Vikram Sarabhai Library"],
    compatScore: 0.87,
  },
  {
    id: "2",
    tags: ["Running", "Tech", "Food"],
    promptAnswer: "Early morning runs hit different",
    personality: { extrovert: 0.8, openness: 0.6 },
    campusSpots: ["Sports Complex", "CR", "KLMDC"],
    compatScore: 0.82,
  },
  {
    id: "3",
    tags: ["Dance", "Movies", "Travel"],
    promptAnswer: "Bollywood over Hollywood any day",
    personality: { extrovert: 0.9, openness: 0.8 },
    campusSpots: ["LKP", "Rambhai", "Heritage Campus"],
    compatScore: 0.78,
  },
  {
    id: "4",
    tags: ["Reading", "Art", "Cooking"],
    promptAnswer: "Maggi at 2am is self-care",
    personality: { extrovert: 0.2, openness: 0.9 },
    campusSpots: ["Library", "Dorm Room", "New Campus Garden"],
    compatScore: 0.91,
  },
  {
    id: "5",
    tags: ["Gaming", "Finance", "Sports"],
    promptAnswer: "FIFA tournaments are serious business",
    personality: { extrovert: 0.5, openness: 0.5 },
    campusSpots: ["CR", "Sports Complex", "LKP"],
    compatScore: 0.75,
  },
];

const Discover = () => {
  const navigate = useNavigate();
  const [currentRound, setCurrentRound] = useState(1);
  const [roundProfiles, setRoundProfiles] = useState(mockProfiles.slice(0, 4));
  const [shortlist, setShortlist] = useState<string[]>([]);
  const [selectedInRound, setSelectedInRound] = useState<string | null>(null);
  const [showRoundComplete, setShowRoundComplete] = useState(false);

  const handleSelect = (id: string) => {
    setSelectedInRound(id);
  };

  const confirmSelection = () => {
    if (selectedInRound) {
      setShortlist(prev => [...prev, selectedInRound]);
      setShowRoundComplete(true);
      
      setTimeout(() => {
        setShowRoundComplete(false);
        setSelectedInRound(null);
        
        if (shortlist.length + 1 >= 5) {
          // Navigate to matches when shortlist is complete
          navigate("/matches");
        } else {
          // Load next round
          setCurrentRound(prev => prev + 1);
          // In real app, fetch new profiles; for demo, shuffle
          setRoundProfiles(mockProfiles.sort(() => Math.random() - 0.5).slice(0, 4));
        }
      }, 1500);
    }
  };

  const skipRound = () => {
    setSelectedInRound(null);
    setCurrentRound(prev => prev + 1);
    setRoundProfiles(mockProfiles.sort(() => Math.random() - 0.5).slice(0, 4));
  };

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
      <SparkleBackground />

      {/* Header */}
      <header className="relative z-20 p-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold">Discover</h1>
          <p className="text-sm text-muted-foreground">Round {currentRound} of 5</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{shortlist.length}/5</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/matches")}>
            <MessageCircle className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="relative z-10 px-4 mb-6">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${(shortlist.length / 5) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex justify-between mt-2">
          {[1, 2, 3, 4, 5].map((step) => (
            <div
              key={step}
              className={`w-2 h-2 rounded-full ${
                step <= shortlist.length ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="relative z-10 px-4 mb-6 text-center">
        <p className="text-muted-foreground">
          Pick <span className="text-primary font-semibold">one person</span> from this round to add to your shortlist
        </p>
      </div>

      {/* Cards Grid */}
      <main className="relative z-10 px-4 pb-32">
        <AnimatePresence mode="wait">
          {showRoundComplete ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4"
              >
                <Heart className="w-10 h-10 text-primary" />
              </motion.div>
              <h3 className="font-display text-2xl font-bold mb-2">Added to Shortlist!</h3>
              <p className="text-muted-foreground">Loading next round...</p>
            </motion.div>
          ) : (
            <motion.div
              key="cards"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {roundProfiles.map((profile, index) => (
                <AnonymousCard
                  key={profile.id}
                  profile={profile}
                  index={index}
                  isSelected={selectedInRound === profile.id}
                  onSelect={() => handleSelect(profile.id)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Action Bar */}
      {!showRoundComplete && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-0 left-0 right-0 p-4 glass-strong z-20"
        >
          <div className="max-w-lg mx-auto flex gap-3">
            <Button
              variant="glass"
              className="flex-1"
              onClick={skipRound}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Skip Round
            </Button>
            <Button
              variant="gold"
              className="flex-1"
              disabled={!selectedInRound}
              onClick={confirmSelection}
            >
              Add to Shortlist
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default Discover;
