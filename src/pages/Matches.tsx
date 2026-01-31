import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import NavBar from "@/components/NavBar";
import PromAsk from "@/components/PromAsk";
import { 
  Heart, 
  MessageCircle, 
  Sparkles, 
  Eye, 
  X,
  Send,
  MoreVertical,
  Flag,
  Trash2,
  PartyPopper
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Mock matches data
const mockMatches = [
  {
    id: "1",
    tags: ["Music", "Coffee", "Debate"],
    promptAnswer: "Library vibes > Coffee shop chaos",
    compatScore: 0.87,
    chatStarted: true,
    lastMessage: "So what's your go-to study spot?",
    unread: 2,
    revealed: false,
  },
  {
    id: "2",
    tags: ["Running", "Tech", "Food"],
    promptAnswer: "Early morning runs hit different",
    compatScore: 0.82,
    chatStarted: true,
    lastMessage: "We should grab coffee sometime!",
    unread: 0,
    revealed: false,
  },
  {
    id: "3",
    tags: ["Dance", "Movies", "Travel"],
    promptAnswer: "Bollywood over Hollywood any day",
    compatScore: 0.78,
    chatStarted: false,
    lastMessage: null,
    unread: 0,
    revealed: false,
  },
];

const Matches = () => {
  const navigate = useNavigate();
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [showRevealModal, setShowRevealModal] = useState(false);
  const [showPromAsk, setShowPromAsk] = useState(false);
  const [revealingMatch, setRevealingMatch] = useState<string | null>(null);

  const activeMatch = mockMatches.find(m => m.id === activeChat);

  const handleReveal = (matchId: string) => {
    setRevealingMatch(matchId);
    setShowRevealModal(true);
  };

  const confirmReveal = () => {
    // In real app, send reveal request
    setShowRevealModal(false);
    setRevealingMatch(null);
    // Show success animation
  };

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />
      <NavBar />

      <div className="flex-1 flex relative z-10">

      {/* Sidebar - Match List */}
      <aside className={`w-full md:w-80 lg:w-96 border-r border-border/50 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <header className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-2xl font-bold">Matches</h1>
            <Button variant="ghost" size="icon" onClick={() => navigate("/discover")}>
              <Sparkles className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="glass" size="sm" className="flex-1">
              All ({mockMatches.length})
            </Button>
            <Button variant="ghost" size="sm" className="flex-1">
              Revealed (0)
            </Button>
          </div>
        </header>

        {/* Match List */}
        <div className="flex-1 overflow-y-auto p-2">
          {mockMatches.map((match) => (
            <motion.button
              key={match.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveChat(match.id)}
              className={`w-full p-3 rounded-xl mb-2 text-left transition-colors ${
                activeChat === match.id 
                  ? "bg-primary/20 border border-primary/30" 
                  : "glass hover:bg-card/70"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Avatar placeholder */}
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Heart className="w-5 h-5 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">
                      {Math.round(match.compatScore * 100)}% Match
                    </span>
                    {match.unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {match.unread}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-wrap gap-1 mb-1">
                    {match.tags.slice(0, 2).map(tag => (
                      <span key={tag} className="text-xs text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {match.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate">
                      {match.lastMessage}
                    </p>
                  )}
                  
                  {!match.chatStarted && (
                    <p className="text-sm text-primary">Start a conversation →</p>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </aside>

      {/* Chat Area */}
      <main className={`flex-1 flex flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        {activeChat && activeMatch ? (
          <ChatView 
            match={activeMatch} 
            onBack={() => setActiveChat(null)}
            onReveal={() => handleReveal(activeMatch.id)}
            onPromAsk={() => setShowPromAsk(true)}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Select a match</h3>
              <p className="text-muted-foreground">
                Choose someone from your matches to start chatting
              </p>
            </div>
          </div>
        )}
      </main>
      </div>

      {/* Reveal Modal */}
      <AnimatePresence>
        {showRevealModal && (
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
              className="glass rounded-3xl p-8 max-w-md w-full text-center"
            >
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="font-display text-2xl font-bold mb-2">Ready to Reveal?</h3>
              <p className="text-muted-foreground mb-6">
                When you both reveal, you'll see each other's photos, names, and contact details. 
                This cannot be undone.
              </p>

              <div className="glass rounded-xl p-4 mb-6 text-left">
                <p className="text-sm text-foreground font-medium mb-1">🔒 Privacy Promise</p>
                <p className="text-xs text-muted-foreground">
                  Only you and your match will see revealed details. Organisers and other users cannot access this information.
                </p>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="glass" 
                  className="flex-1"
                  onClick={() => setShowRevealModal(false)}
                >
                  Not Yet
                </Button>
                <Button 
                  variant="gold" 
                  className="flex-1"
                  onClick={confirmReveal}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Reveal Identity
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prom Ask Modal */}
      <AnimatePresence>
        {showPromAsk && activeMatch && (
          <PromAsk
            matchId={activeMatch.id}
            matchCompatScore={activeMatch.compatScore}
            onClose={() => setShowPromAsk(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Chat View Component
interface ChatViewProps {
  match: typeof mockMatches[0];
  onBack: () => void;
  onReveal: () => void;
  onPromAsk: () => void;
}

const ChatView = ({ match, onBack, onReveal, onPromAsk }: ChatViewProps) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { id: 1, from: "them", text: "Hey! I noticed we both love coffee ☕", time: "2:30 PM" },
    { id: 2, from: "me", text: "Yes! Library cafe is my second home 😄", time: "2:32 PM" },
    { id: 3, from: "them", text: "So what's your go-to study spot?", time: "2:35 PM" },
  ]);

  const icebreakers = [
    "What's your favorite IIMA hangout?",
    "Drop a song that defines you 🎵",
    "Would you rather... early morning or late night?",
    "What brought you to IIMA?",
  ];

  const sendMessage = () => {
    if (message.trim()) {
      setMessages(prev => [...prev, {
        id: prev.length + 1,
        from: "me",
        text: message,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
      setMessage("");
    }
  };

  return (
    <>
      {/* Chat Header */}
      <header className="p-4 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
            <X className="w-5 h-5" />
          </Button>
          
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary" />
          </div>
          
          <div>
            <p className="font-semibold">{Math.round(match.compatScore * 100)}% Match</p>
            <p className="text-xs text-muted-foreground">{match.tags.join(" • ")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="rose" size="sm" onClick={onPromAsk}>
            <PartyPopper className="w-4 h-4 mr-1" />
            Ask to Prom
          </Button>
          <Button variant="gold" size="sm" onClick={onReveal}>
            <Eye className="w-4 h-4 mr-1" />
            Reveal
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Flag className="w-4 h-4 mr-2" />
                Report
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Unmatch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.from === "me" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.from === "me"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "glass rounded-bl-md"
              }`}
            >
              <p>{msg.text}</p>
              <p className={`text-xs mt-1 ${
                msg.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground"
              }`}>
                {msg.time}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Icebreakers */}
      <div className="px-4 py-2 border-t border-border/50">
        <p className="text-xs text-muted-foreground mb-2">💡 Icebreakers</p>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {icebreakers.map((icebreaker, i) => (
            <button
              key={i}
              onClick={() => setMessage(icebreaker)}
              className="shrink-0 px-3 py-1.5 rounded-full glass text-sm hover:bg-card/70 transition-colors"
            >
              {icebreaker}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type a message..."
            className="flex-1 bg-muted rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <Button variant="gold" size="icon" onClick={sendMessage} disabled={!message.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </>
  );
};

export default Matches;
