import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SparkleBackground from "@/components/SparkleBackground";
import { Heart, Users } from "lucide-react";
import { signInWithRedirect } from "aws-amplify/auth";

const Auth = () => {
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    console.log("Signing in with Google")
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (error) {
      console.error("Error during Google sign-in", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
      <SparkleBackground />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-3xl p-8 md:p-10 relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />

          <div className="relative z-10">
            {/* Logo/Title */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring" }}
                className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4"
              >
                <Heart className="w-8 h-8 text-primary" />
              </motion.div>
              <h1 className="font-display text-3xl font-bold mb-2">
                Welcome to <span className="text-gradient-gold">Prom 2026</span>
              </h1>
              <p className="text-muted-foreground">
                Sign in with your IIMA account to continue
              </p>
            </div>

            {/* Sign in options */}
            <div className="space-y-4">
              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={handleGoogleSignIn}
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">
                    For IIMA students only
                  </span>
                </div>
              </div>
            </div>

            {/* Registration options */}
            <div className="mt-8 space-y-4">
              <p className="text-center text-sm text-muted-foreground mb-4">
                How would you like to join?
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/onboarding?type=individual")}
                  className="glass rounded-xl p-4 text-center hover:bg-card/70 transition-colors group"
                >
                  <Heart className="w-6 h-6 text-primary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-foreground text-sm">Finding a Date</span>
                  <p className="text-xs text-muted-foreground mt-1">Join matchmaking</p>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => navigate("/onboarding?type=couple")}
                  className="glass rounded-xl p-4 text-center hover:bg-card/70 transition-colors group"
                >
                  <Users className="w-6 h-6 text-secondary mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-foreground text-sm">Already a Couple</span>
                  <p className="text-xs text-muted-foreground mt-1">Just register</p>
                </motion.button>
              </div>
            </div>

            {/* Privacy note */}
            <p className="text-center text-xs text-muted-foreground mt-8">
              By signing in, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">Privacy Policy</a>
              {" "}and{" "}
              <a href="#" className="text-primary hover:underline">Terms of Service</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
