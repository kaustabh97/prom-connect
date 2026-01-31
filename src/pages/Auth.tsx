import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SparkleBackground from "@/components/SparkleBackground";
import { Heart, Lock } from "lucide-react";
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
      
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      const profile = await getUserProfile();
      setUserInfo(profile);
      setIsLoading(false);

      if (profile) {
        navigate("/onboarding");
      }
      
      if (profile && (code || state)) {
        navigate("/onboarding");
      }
    };
    checkUser();
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      console.log("Initiating Google sign-in from:", window.location.href);
      await signInWithRedirect({ provider: "Google" });
    } catch (error) {
      console.error("Error during Google sign-in:", error);
      // Show user-friendly error
      alert("Sign-in failed. Please make sure you're using the correct URL. If on mobile, your IP address may need to be added to the allowed callback URLs.");
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col items-center justify-center p-4">
      <SparkleBackground />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md relative z-10"
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
                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto mb-5 border border-primary/20"
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

            {/* Sign in button */}
            <div className="space-y-4">
              <Button
                variant="gold"
                size="lg"
                className="w-full h-12"
                onClick={handleGoogleSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Signing in...
                  </>
                ) : (
                  <>
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
                    Sign in with Google
                  </>
                )}
              </Button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-muted-foreground">
                    Exclusive to IIMA Community
                  </span>
                </div>
              </div>
            </div>

            {/* Security note */}
            <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Lock className="w-4 h-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Your identity stays anonymous until you choose to reveal
                </p>
              </div>
            </div>

            {/* Privacy note */}
            <p className="text-center text-xs text-muted-foreground mt-6">
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
