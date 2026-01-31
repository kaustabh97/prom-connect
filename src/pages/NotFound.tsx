import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import { Heart, Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
      <SparkleBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center relative z-10"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="w-20 h-20 rounded-full glass flex items-center justify-center mx-auto mb-6"
        >
          <Heart className="w-10 h-10 text-primary" />
        </motion.div>
        
        <h1 className="font-display text-6xl font-bold mb-4 text-gradient-gold">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Oops! This page didn't find its match.
        </p>
        
        <Button variant="gold" size="lg" onClick={() => navigate("/")}>
          <Home className="w-5 h-5 mr-2" />
          Back to Home
        </Button>
      </motion.div>
    </div>
  );
};

export default NotFound;
