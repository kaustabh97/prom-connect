import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Sparkles, Heart, Users, Filter, CheckCircle2, MessageSquare, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import FeatureCard from "@/components/FeatureCard";
import CountdownTimer from "@/components/CountdownTimer";
import { BETA_MODE } from "@/config";

const SparkleBackground = lazy(() => import("@/components/SparkleBackground"));

const HERO_FADE = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8 } };

const Landing = () => {
  const navigate = useNavigate();

  const features = [
    {
      icon: Users,
      title: "Campus Only",
      description: "Exclusively for IIMA. Sign in with your @iima.ac.in email and you're in. Real people from your campus, no strangers.",
    },
    {
      icon: Filter,
      title: "Set Your Preferences",
      description: "Pick your filters and non-negotiables. Only see people who match what you're looking for.",
    },
    {
      icon: Heart,
      title: "Swipe and Match",
      description: "Browse profiles and swipe right if you're interested. When it's mutual, you match and can start chatting.",
    },
    {
      icon: MessageSquare,
      title: "Chat Before Prom",
      description: "Get to know your matches. When it feels right, ask them to prom. No pressure, take your time.",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden w-full">
      {BETA_MODE && (
        <div
          className="relative z-20 flex items-center justify-center gap-3 py-4 px-5 bg-primary/15 border-b border-primary/30 text-primary text-lg font-medium"
          role="status"
          aria-label="Website is in beta testing"
        >
          <FlaskConical className="w-6 h-6 shrink-0" />
          <span>We're still testing. Thanks for being early and helping us improve.</span>
        </div>
      )}
      <Suspense fallback={null}>
        <SparkleBackground />
      </Suspense>
      
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10 w-full max-w-[600px] mx-auto">
        <div
          className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl animate-float"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute bottom-40 right-10 w-40 h-40 rounded-full bg-secondary/10 blur-3xl animate-float"
          style={{ animationDuration: "10s", animationDirection: "reverse" }}
        />

        {/* Main content */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto z-10"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-12"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">IIMA Prom 2026</span>
          </motion.div>

          {/* Headline – single h1, no nesting */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative flex flex-col items-center justify-center gap-0 mb-6 text-center w-full min-h-[14rem] sm:min-h-[16rem] md:min-h-[18rem]"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-80 h-80 sm:w-[22rem] sm:h-[22rem] md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] overflow-hidden">
              <img
                src="/dancing-couple-starry.png"
                alt=""
                role="presentation"
                className="w-full h-full object-contain"
                decoding="async"
                fetchPriority="high"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (target.src && !target.src.endsWith("/placeholder.svg")) {
                    target.src = "/placeholder.svg";
                  }
                }}
              />
            </div>
            <h1 className="relative z-10 font-display text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[7rem] xl:text-[8rem] font-bold px-4 pr-8 sm:pr-10 md:pr-12 w-full max-w-6xl mx-auto text-center leading-none">
              <span className="font-regal text-gradient-gold font-normal inline-block text-[1.08em] leading-tight">
                When the lights
                <br />
                stay on
              </span>
            </h1>
          </motion.div>

          <motion.p {...HERO_FADE} transition={{ delay: 0.5, duration: 0.8 }} className="text-xl md:text-2xl text-muted-foreground mt-14 mb-2 font-light">
            Prom 2026 just got easier.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto"
          >
            Find your date from campus. Set your preferences, swipe through real profiles, and chat when you both match. No strangers, just IIMA.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <Button
              variant="gold"
              size="xl"
              onClick={() => navigate("/auth")}
              className="group"
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
              Sign in with IIMA email
            </Button>
            <Button
              variant="gold-outline"
              size="xl"
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
            >
              How it works
            </Button>
          </motion.div>

          {/* Countdown */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16"
          >
            <CountdownTimer targetDate="2026-02-15T20:00:00" />
          </motion.div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section id="how-it-works" className="relative py-10 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              How it <span className="text-gradient-gold">works</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Four simple steps to find your prom date.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Why This Works for IMA Section */}
      <section className="relative py-10 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
          >
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              
              <h3 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Why this works for <span className="text-gradient-gold">IIMA</span>
              </h3>
              
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                You share the same campus and the same moment. Prom is the next big night. We built this so finding a date is easy and fun.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 text-left">
                {[
                  { title: "Real People", desc: "Every profile is someone from campus. No strangers, just people you might know." },
                  { title: "IIMA Verified", desc: "Sign in with your IIMA email. Everyone here is from campus." },
                  { title: "You're in Control", desc: "Set your filters and preferences. Only see people who match what you want." },
                ].map((item) => (
                  <div key={item.title} className="p-4 rounded-xl bg-card/50">
                    <h4 className="font-semibold text-foreground mb-1">{item.title}</h4>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative py-20 px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Ready to find your <span className="text-gradient-rose">prom date</span>?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Your peers are already here. Set up your profile, swipe, chat when it matches, and maybe you'll walk in together on the big night.
          </p>
          <Button variant="gold" size="xl" onClick={() => navigate("/auth")}>
            Get Started
            <Sparkles className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-5 px-4 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
            <p>© 2026 Prom IIMA. Built with 💛 for the campus.</p>
          </div>
          <div className="text-center text-xs text-muted-foreground/60 pt-2">
            Created by{" "}
            <span className="text-muted-foreground/70">Dipak Agrawal</span>
            {" & "}
            <span className="text-muted-foreground/70">Kaustabh Chatterjee</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
