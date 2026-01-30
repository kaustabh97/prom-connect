import { motion } from "framer-motion";
import { Sparkles, Heart, Shield, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import SparkleBackground from "@/components/SparkleBackground";
import FeatureCard from "@/components/FeatureCard";
import CountdownTimer from "@/components/CountdownTimer";

const HERO_FADE = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8 } };
const FADE_IN_VIEW = { initial: { opacity: 0, y: 20 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0.6 } };

const features = [
  { icon: Shield, title: "Privacy First", description: "Your identity stays hidden until you both choose to reveal. No peeking allowed." },
  { icon: Heart, title: "Mutual Reveals", description: "Only when both of you say 'yes' do the masks come off. It's magic, not creepy." },
  { icon: Clock, title: "Time-Bound", description: "Built for Prom 2026. All data auto-deletes after the event. No digital footprints." },
  { icon: Users, title: "Campus Verified", description: "Only IIMA students can join. Sign in with your institute email." },
];

const privacyItems = [
  { title: "Anonymous by Default", desc: "Your identity is hidden until mutual reveal" },
  { title: "Zero Knowledge", desc: "Even we can't see who matched with whom" },
  { title: "Auto-Delete", desc: "All data purged 7 days after prom" },
];

const Landing = () => {
  const navigate = useNavigate();

  const scrollToHowItWorks = () => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden">
      <SparkleBackground />
      
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-20">
        <motion.div
          className="absolute top-20 left-10 w-32 h-32 rounded-full bg-primary/10 blur-3xl"
          animate={{ y: [0, 20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-40 right-10 w-40 h-40 rounded-full bg-secondary/10 blur-3xl"
          animate={{ y: [0, -30, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 10, repeat: Infinity }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto z-10"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">IIM Ahmedabad Prom 2026</span>
          </motion.div>

          <motion.div
            {...HERO_FADE}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="relative flex flex-col items-center justify-center gap-0 mb-6 text-center w-full min-h-[14rem] sm:min-h-[16rem] md:min-h-[18rem]"
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 w-80 h-80 sm:w-[22rem] sm:h-[22rem] md:w-96 md:h-96 lg:w-[28rem] lg:h-[28rem] overflow-hidden">
              <img src="/dancing-couple-starry.png" alt="" role="presentation" className="w-full h-full object-contain" />
            </div>
            <h1 className="relative z-10 font-display text-[4rem] sm:text-[5rem] md:text-[6rem] lg:text-[7rem] xl:text-[8rem] font-bold px-4 pr-8 sm:pr-10 md:pr-12 w-full max-w-6xl mx-auto text-center leading-none">
              <span className="font-pen text-gradient-gold font-semibold inline-block">
                When the lights
                <br />
                stay on
              </span>
            </h1>
          </motion.div>

          <motion.p {...HERO_FADE} transition={{ delay: 0.5, duration: 0.8 }} className="text-xl md:text-2xl text-muted-foreground mb-4 font-light">
            Keep it anonymous. Keep it real.
          </motion.p>

          <motion.p {...HERO_FADE} transition={{ delay: 0.6, duration: 0.8 }} className="text-lg text-muted-foreground/80 mb-12 max-w-2xl mx-auto">
            Find your prom date through genuine connections, not just profiles. Your identity stays hidden until you both choose to reveal.
          </motion.p>

          <motion.div {...HERO_FADE} transition={{ delay: 0.7, duration: 0.8 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
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
              Sign in with IIMA
            </Button>
            <Button variant="gold-outline" size="xl" onClick={scrollToHowItWorks}>
              How it works
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-16"
          >
            <CountdownTimer targetDate="2026-02-14T19:00:00" />
          </motion.div>
        </motion.div>
      </section>

      <section id="how-it-works" className="relative py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div {...FADE_IN_VIEW} className="text-center mb-16">
            <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
              How the <span className="text-gradient-gold">Magic</span> Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A thoughtful approach to finding your perfect prom date
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <FeatureCard key={feature.title} {...feature} index={index} />
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass rounded-3xl p-8 md:p-12 text-center relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5" />
            <div className="relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              <h3 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Our Privacy <span className="text-gradient-gold">Promise</span>
              </h3>
              <p className="text-muted-foreground text-lg mb-8 max-w-2xl mx-auto">
                Only you and your match see revealed profiles — organisers and other users cannot access these details. Your privacy is not a feature, it's a foundation.
              </p>
              <div className="grid sm:grid-cols-3 gap-6 text-left">
                {privacyItems.map((item) => (
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

      <section className="relative py-24 px-4 text-center">
        <motion.div {...FADE_IN_VIEW}>
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Ready to find your <span className="text-gradient-rose">prom date</span>?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">
            Join fellow IIMA students in the most exciting matchmaking event of the year.
          </p>
          <Button variant="gold" size="xl" onClick={() => navigate("/auth")}>
            Get Started
            <Sparkles className="w-5 h-5 ml-2" />
          </Button>
        </motion.div>
      </section>

      <footer className="py-8 px-4 border-t border-border/50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© 2026 Prom IIMA. Built with 💛 for the campus.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
