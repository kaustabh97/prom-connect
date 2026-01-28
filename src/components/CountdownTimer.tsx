import { motion } from "framer-motion";
import { useEffect, useState } from "react";

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownTimerProps {
  targetDate: string;
}

const CountdownTimer = ({ targetDate }: CountdownTimerProps) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const timeUnits = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground mb-4 uppercase tracking-widest">
        Prom Night Countdown
      </p>
      <div className="flex justify-center gap-3 md:gap-6">
        {timeUnits.map((unit, index) => (
          <motion.div
            key={unit.label}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.1, type: "spring" }}
            className="glass rounded-2xl p-4 md:p-6 min-w-[70px] md:min-w-[90px]"
          >
            <motion.span
              key={unit.value}
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="block font-display text-2xl md:text-4xl font-bold text-gradient-gold"
            >
              {unit.value.toString().padStart(2, "0")}
            </motion.span>
            <span className="text-xs text-muted-foreground uppercase tracking-wider">
              {unit.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CountdownTimer;
