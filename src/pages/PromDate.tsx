import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import SparkleBackground from "@/components/SparkleBackground";
import { usePromDate } from "@/hooks/usePromDate";
import { getUserProfileFromCognito, clearTestUser } from "@/utils/auth";
import { deleteUserProfile } from "@/utils/deleteProfile";
import { unmatchUsers, resetProfileForDiscovery } from "@/utils/unmatch";
import { logError, logInfo } from "@/utils/logger";
import { getUrl } from "aws-amplify/storage";
import { getIdFromEmail } from "@/utils/userId";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { Loader2, LogOut, MessageCircle, Sparkles, User, Trash2 } from "lucide-react";
import CountdownTimer from "@/components/CountdownTimer";
import { signOut } from "aws-amplify/auth";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import WithdrawModal, { type WithdrawFormData } from "@/components/WithdrawModal";

const client = generateClient<Schema>();

export default function PromDate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const partnerNameFromUrl = searchParams.get("partnerName");
  const isOutsidePartner = searchParams.get("outside") === "1";
  const [currentUserId, setCurrentUserId] = useState("");
  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  // Prevent browser back from leaving Prom Date – this is the final screen
  useEffect(() => {
    const handlePopState = () => {
      window.history.pushState(null, "", window.location.href);
    };
    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    logInfo("PromDate page loaded", { component: "PromDate", operation: "mount", extra: { partnerNameFromUrl, isOutsidePartner } });
    const load = async () => {
      const p = await getUserProfileFromCognito();
      if (!p?.email) {
        logInfo("No auth, redirecting to auth", { component: "PromDate", operation: "load" });
        navigate("/auth");
        return;
      }
      const profileId = getIdFromEmail(p.email.trim());
      const { data: me } = await client.models.UserProfile.get({ id: profileId }, opts);
      if (me?.id) {
        setCurrentUserId(me.id);
        logInfo("PromDate: current user loaded", { component: "PromDate", operation: "load", extra: { currentUserId: me.id } });
      }
    };
    load();
  }, [navigate]);

  const { promDate, isLoading, error } = usePromDate({ currentUserId });
  const [myProfile, setMyProfile] = useState<Schema["UserProfile"]["type"] | null>(null);
  const [myPicUrl, setMyPicUrl] = useState<string | null>(null);
  const [theirPicUrl, setTheirPicUrl] = useState<string | null>(null);

  // Outside partner: load only my profile
  useEffect(() => {
    if (!currentUserId) return;
    if (isOutsidePartner && partnerNameFromUrl) {
      const fetch = async () => {
        try {
          const { data: me } = await client.models.UserProfile.get({ id: currentUserId }, opts);
          setMyProfile(me ?? null);
          if (me?.profilePicKey) {
            const { url } = await getUrl({ path: me.profilePicKey, options: { bucket: "userPhotos" } });
            setMyPicUrl(url.toString());
          }
        } catch (err) {
          logError(err, { component: "PromDate", operation: "fetchOutsideProfile", extra: { currentUserId } });
        }
      };
      fetch();
    }
  }, [currentUserId, isOutsidePartner, partnerNameFromUrl]);

  // IIMA both: load my profile + their profile
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
      } catch (err) {
        logError(err, { component: "PromDate", operation: "fetchBothProfiles", extra: { currentUserId } });
      }
    };
    fetch();
  }, [currentUserId, promDate]);

  const showOutsideView = isOutsidePartner && partnerNameFromUrl;
  const showBothView = promDate && !showOutsideView;

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showChangeFlowDialog, setShowChangeFlowDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isChangingFlow, setIsChangingFlow] = useState(false);
  const [changeFlowError, setChangeFlowError] = useState<string | null>(null);

  /** Change flow: unmatch / reset without asking withdraw details; user chooses flow on next screen.
   * Users can change flows as many times as they want - no restrictions.
   */
  const handleChangeFlowClick = async () => {
    setIsChangingFlow(true);
    setChangeFlowError(null);
    try {
      if (showOutsideView) {
        // Outside partner flow: just reset profile fields, no match to delete
        await resetProfileForDiscovery(currentUserId);
        logInfo("Reset profile for discovery (outside partner)", { 
          component: "PromDate", 
          operation: "changeFlow",
          extra: { currentUserId } 
        });
        navigate("/onboarding?flow=choice", { replace: true });
        return;
      }
      // IIMA match: unmatch and reset both profiles
      if (!promDate?.match?.id || !currentUserId || !promDate.otherUserId) {
        // If no match but user is on prom-date page, just reset their profile
        logInfo("No match found, resetting profile for discovery", { 
          component: "PromDate", 
          operation: "changeFlow",
          extra: { currentUserId } 
        });
        await resetProfileForDiscovery(currentUserId);
        navigate("/onboarding?flow=choice", { replace: true });
        return;
      }
      const result = await unmatchUsers({
        matchId: promDate.match.id,
        currentUserId,
        otherUserId: promDate.otherUserId,
        isPromDate: !!promDate.match.isPromDate,
        currentUserFormData: undefined,
      });
      if (result.success) {
        logInfo("Unmatched and reset profile for discovery", { 
          component: "PromDate", 
          operation: "changeFlow",
          extra: { matchId: promDate.match.id, currentUserId } 
        });
        navigate("/onboarding?flow=choice", { replace: true });
      } else {
        setChangeFlowError(result.error ?? "Failed to change flow");
      }
    } catch (err) {
      logError(err, { component: "PromDate", operation: "changeFlow" });
      setChangeFlowError(err instanceof Error ? err.message : "Failed to change flow");
    } finally {
      setIsChangingFlow(false);
    }
  };

  const handleDeleteAccount = async () => {
    const p = await getUserProfileFromCognito();
    if (!p?.email) return;
    const profileId = getIdFromEmail(p.email.trim());
    const { data: myProfile } = await client.models.UserProfile.get({ id: profileId }, opts);
    if (!myProfile?.id || !myProfile.email) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteUserProfile(myProfile.id, myProfile.email);
      if (result.success) {
        if (!GOOGLE_LOGIN_CHECK) clearTestUser();
        if (GOOGLE_LOGIN_CHECK) await signOut();
        navigate("/", { replace: true });
      } else {
        setDeleteError(result.error ?? "Failed to delete account");
      }
    } catch (err) {
      logError(err, { component: "PromDate", operation: "deleteAccount" });
      setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    logInfo("PromDate: logout clicked", { component: "PromDate", operation: "logout" });
    try {
      if (GOOGLE_LOGIN_CHECK) {
        await signOut();
      } else {
        clearTestUser();
      }
      navigate("/");
    } catch (err) {
      logError(err, { component: "PromDate", operation: "logout" });
      if (!GOOGLE_LOGIN_CHECK) clearTestUser();
      navigate("/");
    }
  };

  if (!currentUserId || (isLoading && !showOutsideView)) {
    return (
      <div className="h-dvh max-h-dvh overflow-hidden bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!showOutsideView && (error || !promDate)) {
    return (
      <div className="h-dvh max-h-dvh overflow-hidden bg-gradient-midnight flex items-center justify-center">
        <SparkleBackground />
        <p className="text-muted-foreground">Your prom date is still out there – keep swiping!</p>
      </div>
    );
  }

  const myName = myProfile?.name || "You";
  const theirName = showBothView
    ? (promDate!.otherUserProfile?.name || promDate!.otherUserEmail?.split("@")[0] || "Your date")
    : (partnerNameFromUrl || "your partner");

  return (
    <div className="min-h-dvh bg-gradient-midnight relative flex flex-col">
      <SparkleBackground />
      {/* Top bar: Log out */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="gap-1.5 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </Button>
      </div>
      <div
        className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 pt-24 md:pt-32 pb-8 min-h-dvh"
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="flex items-center justify-center gap-2 mx-auto mb-4"
          >
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            It&apos;s official – you&apos;re going to Prom together
          </h1>
          <p className="text-muted-foreground text-lg">
            Time to plan the dance moves, coordinate outfits, and make it a night to remember.
          </p>
        </motion.div>

        {/* Outside partner: single card + two small buttons (change flow, delete) */}
        {showOutsideView && (
          <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="glass rounded-2xl p-6 border border-primary/30 text-center shadow-lg"
          >
            <div className="w-32 h-32 mx-auto rounded-full overflow-hidden bg-primary/20 mb-3 ring-2 ring-primary/40 shadow-inner">
              {myPicUrl ? (
                <img src={myPicUrl} alt={myName} className="w-full h-full object-cover" crossOrigin="anonymous" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-14 h-14 text-primary/60" />
                </div>
              )}
            </div>
            <p className="font-playfair text-lg font-medium text-foreground">{myName}</p>
            <p className="text-sm text-muted-foreground mt-2">+</p>
            <p className="font-playfair text-lg font-medium text-foreground mt-1">{theirName}</p>
          </motion.div>
          <motion.div
            data-share-hide
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-6 w-full max-w-xs mx-auto flex flex-col items-center gap-3"
          >
            <div className="w-full flex gap-2">
              <Button
                variant="outline"
                size="default"
                className="flex-1 w-0 gap-2 border-slate-400/80 bg-slate-500/10 hover:bg-slate-500/20 text-foreground text-sm"
                disabled={isChangingFlow}
                onClick={() => { setChangeFlowError(null); setShowChangeFlowDialog(true); }}
              >
                <User className="w-4 h-4 shrink-0" />
                Looking for dates
              </Button>
              <Button
                variant="outline"
                size="default"
                className="flex-1 w-0 gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 text-sm"
                disabled={isDeleting}
                onClick={() => { setDeleteError(null); setShowDeleteDialog(true); }}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                Delete account
              </Button>
            </div>
          </motion.div>
          </>
        )}

        {/* Both IIMA: two cards with photos in V-shape */}
        {showBothView && (
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
              className="glass rounded-2xl p-5 border border-primary/30 w-36 shrink-0 text-center shadow-lg"
            >
              <div className="w-28 h-28 mx-auto rounded-full overflow-hidden bg-primary/20 mb-3 ring-2 ring-primary/40 shadow-inner">
                {myPicUrl ? (
                  <img src={myPicUrl} alt={myName} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-primary/60" />
                  </div>
                )}
              </div>
              <p className="font-playfair font-medium text-foreground truncate">{myName}</p>
              <p className="text-xs text-muted-foreground">You</p>
            </motion.div>

            <p className="text-2xl text-primary/60 pb-6 font-light">+</p>

            {/* Right card (them) */}
            <motion.div
              initial={{ rotate: 8, y: 20 }}
              animate={{ rotate: 6, y: 0 }}
              transition={{ delay: 0.6 }}
              className="glass rounded-2xl p-5 border border-primary/30 w-36 shrink-0 text-center shadow-lg"
            >
              <div className="w-28 h-28 mx-auto rounded-full overflow-hidden bg-primary/20 mb-3 ring-2 ring-primary/40 shadow-inner">
                {theirPicUrl ? (
                  <img src={theirPicUrl} alt={theirName} className="w-full h-full object-cover" crossOrigin="anonymous" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-12 h-12 text-primary/60" />
                  </div>
                )}
              </div>
              <p className="font-playfair font-medium text-foreground truncate">{theirName}</p>
              <p className="text-xs text-muted-foreground">Your date</p>
            </motion.div>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="font-playfair text-xl md:text-2xl font-medium text-primary text-center mt-4 tracking-wide"
        >
          Save the date – 15th Feb, 8 PM
        </motion.p>

        <motion.div
          data-share-hide
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-8 w-full max-w-md"
        >
          <CountdownTimer targetDate="2026-02-15T20:00:00" />
        </motion.div>

        {/* Chat button + two small buttons (change flow, delete) - always for IIMA couples (hidden in share image) */}
        {showBothView && (
          <motion.div
            data-share-hide
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="mt-6 w-full max-w-xs mx-auto flex flex-col items-center gap-3"
          >
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
              onClick={() => { logInfo("PromDate: chat button clicked", { component: "PromDate", operation: "chatButton", extra: { matchId: promDate?.match?.id } }); navigate("/matches", { state: { fromPromDate: true, openMatchId: promDate?.match?.id } }); }}
            >
              <MessageCircle className="w-5 h-5" />
              Chat with {theirName}
            </Button>
            <div className="w-full flex gap-2">
              <Button
                variant="outline"
                size="default"
                className="flex-1 w-0 gap-2 border-slate-400/80 bg-slate-500/10 hover:bg-slate-500/20 text-foreground text-sm"
                disabled={isChangingFlow}
                onClick={() => { setChangeFlowError(null); setShowChangeFlowDialog(true); }}
              >
                <User className="w-4 h-4 shrink-0" />
                Looking for dates
              </Button>
              <Button
                variant="outline"
                size="default"
                className="flex-1 w-0 gap-2 text-destructive border-destructive/50 hover:bg-destructive/10 text-sm"
                disabled={isDeleting}
                onClick={() => { setDeleteError(null); setShowDeleteDialog(true); }}
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                Delete account
              </Button>
            </div>
          </motion.div>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-auto pt-8 pb-8 text-lg font-playfair text-primary text-center"
        >
          See you on the dance floor.
        </motion.p>
      </div>

      <AlertDialog open={showChangeFlowDialog} onOpenChange={(open) => { if (!open) setChangeFlowError(null); setShowChangeFlowDialog(open); }}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to looking for dates?</AlertDialogTitle>
            <AlertDialogDescription>
              No worries — we&apos;ll take you back to pick your vibe: still on the hunt for your plus-one, or already found them? You can change this anytime from your profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {changeFlowError && (
            <p className="text-sm text-destructive">{changeFlowError}</p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isChangingFlow}>Cancel</AlertDialogCancel>
            <Button
              variant="default"
              disabled={isChangingFlow}
              onClick={() => handleChangeFlowClick()}
            >
              {isChangingFlow ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave the dance floor?</AlertDialogTitle>
            <AlertDialogDescription>
              Just so you know — we&apos;ll remove your profile, your matches, and all your chats for good. You won&apos;t show up in anyone&apos;s feed anymore. We&apos;re a little sad to see you go, but the door&apos;s always open if you want to come back and start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDeleteAccount}>
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete account"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
