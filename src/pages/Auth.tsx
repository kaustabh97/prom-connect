import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SparkleBackground from "@/components/SparkleBackground";
import { Heart, Shield, Sparkles } from "lucide-react";
import { signInWithRedirect } from "aws-amplify/auth";
import { useEffect, useState } from "react";
import { getUserProfile, type UserProfile } from "@/utils/auth";

const Auth = () => {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Check if user is already signed in
  useEffect(() => {
    const checkUser = async () => {
      setIsLoading(true);
      
      // Check if we're returning from OAuth redirect
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      const profile = await getUserProfile();
      setUserInfo(profile);
      setIsLoading(false);

      // If user is signed in, redirect to onboarding
      if (profile) {
        console.log("User already signed in, redirecting to onboarding...");
        navigate("/onboarding");
      }
      
      // If user just signed in (coming back from OAuth), redirect to onboarding
      if (profile && (code || state)) {
        navigate("/onboarding");
      }
    };
    checkUser();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signInWithRedirect({ provider: "Google" });
    } catch (error) {
      console.error("Error during Google sign-in", error);
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-midnight flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
      <SparkleBackground />

      {/* Decorative blurs */}
      <div className="absolute top-1/4 -left-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-1/4 -right-20 w-64 h-64 bg-secondary/20 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-sm relative z-10"
      >
        {/* Main Card */}
        <div className="glass rounded-3xl p-8 relative overflow-hidden border border-white/10">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

          <div className="relative z-10">
            {/* Logo Section */}
            <div className="text-center mb-8">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative w-20 h-20 mx-auto mb-5"
              >
                {/* Outer ring */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/30 to-secondary/30 animate-pulse" />
                {/* Inner icon container */}
                <div className="absolute inset-1 rounded-xl bg-card/80 backdrop-blur-sm flex items-center justify-center">
                  <Heart className="w-9 h-9 text-primary" fill="currentColor" fillOpacity={0.2} />
                </div>
                {/* Sparkle decoration */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="absolute -top-1 -right-1"
                >
                  <Sparkles className="w-5 h-5 text-primary" />
                </motion.div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h1 className="font-display text-3xl font-bold mb-2 tracking-tight">
                  <span className="text-gradient-gold">Prom 2026</span>
                </h1>
                <p className="text-muted-foreground text-sm">
                  Find your perfect match for the big night
                </p>
              </motion.div>
            </div>

            {/* Sign In Section */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-5"
            >
              {/* Google Sign In Button */}
              <Button
                variant="outline"
                size="lg"
                className="w-full h-12 bg-white hover:bg-gray-50 text-gray-800 border-0 font-medium shadow-lg shadow-black/10"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mr-3" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    {/* Colored Google Logo */}
                    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </Button>

              {/* Community Badge */}
              <div className="flex items-center justify-center gap-2 py-2">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
                <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
                  Exclusive to IIMA Community
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
              </div>
            </motion.div>

            {/* Security Badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 p-3.5 rounded-xl bg-primary/5 border border-primary/10"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Shield className="w-4.5 h-4.5 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your identity stays <span className="text-foreground font-medium">completely anonymous</span> until you choose to reveal it
                </p>
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center text-[10px] text-muted-foreground/70 mt-6 leading-relaxed"
            >
              By signing in, you agree to our{" "}
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Privacy Policy
              </a>
              {" "}and{" "}
              <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                Terms of Service
              </a>
            </motion.p>
          </div>
        </div>

        {/* Bottom branding */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-center text-[10px] text-muted-foreground/50 mt-4"
        >
          Made with love for IIMA
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Auth;
