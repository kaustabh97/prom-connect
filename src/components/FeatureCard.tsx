import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

const FeatureCard = ({ icon: Icon, title, description, index }: FeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -5, scale: 1.02 }}
      className="glass rounded-2xl p-6 group cursor-pointer"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/30 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-display text-xl font-semibold mb-2 text-foreground">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};

export default FeatureCard;
