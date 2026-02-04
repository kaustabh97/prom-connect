import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import SparkleBackground from "@/components/SparkleBackground";
import { usePromDate } from "@/hooks/usePromDate";
import { getUserProfile } from "@/utils/auth";
import { getUrl } from "aws-amplify/storage";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { Heart, Loader2 } from "lucide-react";

const client = generateClient<Schema>();

export default function PromDate() {
  const navigate = useNavigate();
  const [currentUserId, setCurrentUserId] = React.useState("");
  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  useEffect(() => {
    const load = async () => {
      const p = await getUserProfile();
      if (!p?.email) {
        navigate("/auth");
        return;
      }
      const { data } = await client.models.UserProfile.list(
        { filter: { email: { eq: p.email } } },
        opts
      );
      const id = data?.[0]?.id;
      if (id) setCurrentUserId(id);
    };
    load();
  }, [navigate]);

  const { promDate, isLoading, error } = usePromDate({ currentUserId });
  const [myProfile, setMyProfile] = React.useState<Schema["UserProfile"]["type"] | null>(null);
  const [myPicUrl, setMyPicUrl] = React.useState<string | null>(null);
  const [theirPicUrl, setTheirPicUrl] = React.useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId || !promDate) return;
    const fetch = async () => {
      try {
        const { data: me } = await client.models.UserProfile.get({ id: currentUserId }, opts);
        setMyProfile(me ?? null);
        if (me?.profilePicKey) {
          const { url } = await getUrl({ path: me.profilePicKey, options: { bucket: "userPhotos" } });
          setMyPicUrl(url.toString());
        }
        const otherKey = promDate.otherUserProfile?.profilePicKey;
        if (otherKey) {
          const { url } = await getUrl({ path: otherKey, options: { bucket: "userPhotos" } });
          setTheirPicUrl(url.toString());
        }
      } catch (_) {}
    };
    fetch();
  }, [currentUserId, promDate]);

  if (!currentUserId || isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !promDate) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <p className="text-muted-foreground">No prom date yet.</p>
      </div>
    );
  }

  const myName = myProfile?.name || "You";
  const theirName =
    promDate.otherUserProfile?.name ||
    promDate.otherUserEmail?.split("@")[0] ||
    "Your date";

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4"
          >
            <Heart className="w-10 h-10 text-primary" />
          </motion.div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            You have a date
          </h1>
          <p className="text-muted-foreground text-lg">
            You&apos;re going to Prom together – the rest is up to you two.
          </p>
        </motion.div>

        {/* Two cards in V-shape */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="relative w-full max-w-md flex items-end justify-center gap-4 py-8"
        >
          {/* Left card (me) */}
          <motion.div
            initial={{ rotate: -8, y: 20 }}
            animate={{ rotate: -6, y: 0 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-2xl p-6 border border-primary/30 w-40 shrink-0 text-center shadow-lg"
          >
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-primary/20 mb-3 ring-2 ring-primary/40">
              {myPicUrl ? (
                <img src={myPicUrl} alt={myName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Heart className="w-10 h-10 text-primary/60" />
                </div>
              )}
            </div>
            <p className="font-semibold text-foreground truncate">{myName}</p>
            <p className="text-xs text-muted-foreground">You</p>
          </motion.div>

          {/* Right card (them) */}
          <motion.div
            initial={{ rotate: 8, y: 20 }}
            animate={{ rotate: 6, y: 0 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-2xl p-6 border border-primary/30 w-40 shrink-0 text-center shadow-lg"
          >
            <div className="w-24 h-24 mx-auto rounded-full overflow-hidden bg-primary/20 mb-3 ring-2 ring-primary/40">
              {theirPicUrl ? (
                <img src={theirPicUrl} alt={theirName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Heart className="w-10 h-10 text-primary/60" />
                </div>
              )}
            </div>
            <p className="font-semibold text-foreground truncate">{theirName}</p>
            <p className="text-xs text-muted-foreground">Your date</p>
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-sm text-muted-foreground text-center mt-4 max-w-sm"
        >
          See you at Prom. Have fun.
        </motion.p>
      </div>
    </div>
  );
}
