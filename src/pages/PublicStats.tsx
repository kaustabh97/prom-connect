import { lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Users, Heart, MessageCircle, CheckCircle2, ArrowLeft, HelpCircle, Loader2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { usePublicStats } from "@/hooks/usePublicStats";
import { ChartContainer } from "@/components/ui/chart";
import { PieChart, Pie, Cell } from "recharts";
import { logInfo } from "@/utils/logger";

const SparkleBackground = lazy(() => import("@/components/SparkleBackground"));

const MATCHES_TOOLTIP =
  "Total number of mutual matches between users. One person can have multiple matches (e.g. with different people).";

const chartConfig = {
  Men: { label: "Men", color: "hsl(45 93% 47%)" },
  Women: { label: "Women", color: "hsl(346 77% 50%)" },
  Other: { label: "Other", color: "hsl(215 16% 47%)" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  tooltip,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tooltip?: string;
}) {
  const content = (
    <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-6 text-center shadow-[0_0_20px_rgba(251,191,36,0.06)]">
      <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <p className="text-2xl font-bold tabular-nums text-gradient-gold">{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="More info">
                  <HelpCircle className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </p>
    </div>
  );
  return content;
}

export default function PublicStats() {
  const navigate = useNavigate();
  const { stats, loading, error } = usePublicStats("PublicStats");

  const handleBack = () => {
    logInfo("PublicStats: Back to home", { component: "PublicStats", operation: "backClick" });
    navigate("/");
  };

  const pieData = stats?.usersByGender
    ? Object.entries(stats.usersByGender)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="min-h-screen bg-gradient-midnight relative overflow-hidden w-full">
      <Suspense fallback={null}>
        <SparkleBackground />
      </Suspense>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mb-10 text-center"
        >
          <div className="mb-2 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20">
              <BarChart3 className="h-7 w-7 text-primary" />
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Prom <span className="text-gradient-gold">stats</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Live numbers from the platform. No sign-in required.
          </p>
        </motion.div>

        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Loading statistics…</p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-destructive/50 bg-destructive/10 p-6 text-center"
          >
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </motion.div>
        )}

        {!loading && !error && stats && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="grid grid-cols-1 gap-4 sm:grid-cols-2"
            >
              <StatCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString()} />
              <StatCard
                icon={Heart}
                label="Total Matches"
                value={stats.totalMatches.toLocaleString()}
                tooltip={MATCHES_TOOLTIP}
              />
              <StatCard
                icon={MessageCircle}
                label="Total Conversations"
                value={stats.totalConversations.toLocaleString()}
              />
              <StatCard
                icon={CheckCircle2}
                label="Prom Dates Finalised"
                value={stats.promDatesFinalised.toLocaleString()}
              />
            </motion.div>

            {pieData.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.3 }}
                className="mt-10"
              >
                <h2 className="mb-4 text-center font-display text-xl font-semibold text-foreground">
                  Gender distribution
                </h2>
                <div className="rounded-2xl border-2 border-primary/20 bg-card/40 p-6 backdrop-blur">
                  <ChartContainer config={chartConfig} className="mx-auto h-[280px] w-full max-w-[280px]">
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={
                              entry.name === "Men"
                                ? "hsl(45 93% 47%)"
                                : entry.name === "Women"
                                  ? "hsl(346 77% 50%)"
                                  : "hsl(215 16% 47%)"
                            }
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-12 text-center"
            >
              <Button variant="gold-outline" onClick={handleBack}>
                Back to home
              </Button>
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
}
