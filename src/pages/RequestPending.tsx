import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "aws-amplify/auth";
import { getUrl } from "aws-amplify/storage";
import SparkleBackground from "@/components/SparkleBackground";
import PendingPartnerRequestView from "@/components/PendingPartnerRequestView";
import WithdrawModal, { type WithdrawFormData } from "@/components/WithdrawModal";
import { getUserProfileFromCognito, clearTestUser } from "@/utils/auth";
import { logError, logInfo } from "@/utils/logger";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { GOOGLE_LOGIN_CHECK, MATCHMAKING_ENABLED } from "@/config";
import { Button } from "@/components/ui/button";
import { Loader2, LogOut } from "lucide-react";

const client = generateClient<Schema>();

/**
 * Page shown when user has sent a partner invite (IIMA couple flow) and is waiting
 * for acceptance. No nav bar - only Share again and Withdraw options.
 */
export default function RequestPending() {
  const navigate = useNavigate();
  const [partnerDisplayName, setPartnerDisplayName] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [withdrawing, setWithdrawing] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  const authMode = !GOOGLE_LOGIN_CHECK ? ("apiKey" as const) : undefined;
  const opts = authMode ? { authMode } : undefined;

  const loadPendingRequest = useCallback(async () => {
    logInfo("RequestPending: loading pending request", { component: "RequestPending", operation: "loadPendingRequest" });
    const profile = await getUserProfileFromCognito();
    if (!profile?.email) {
      logInfo("RequestPending: no auth, redirecting to auth", { component: "RequestPending", operation: "loadPendingRequest" });
      navigate("/auth");
      return;
    }
    const { data: profiles } = await client.models.UserProfile.list(
      { filter: { email: { eq: profile.email } } },
      opts
    );
    const userProfile = profiles?.[0];
    if (!userProfile?.id) {
      navigate("/onboarding");
      return;
    }
    const { data: outgoing } = await client.models.MatchRequest.listMatchRequestByFromUserId(
      { fromUserId: userProfile.id },
      opts
    );
    const pending = (outgoing ?? []).find((r) => r.status === "pending");
    if (!pending) {
      logInfo("RequestPending: no pending request, redirecting", { component: "RequestPending", operation: "loadPendingRequest" });
      navigate(MATCHMAKING_ENABLED ? "/discover/profile" : "/matchmaking-soon");
      return;
    }
    logInfo("RequestPending: pending request loaded", { component: "RequestPending", operation: "loadPendingRequest", extra: { requestId: pending.id } });
    const nameFromBio = userProfile.bio?.match(/^Partner:\s*(.+)/)?.[1]?.trim();
    const nameFromEmail = pending.toEmail?.split("@")[0] || "your partner";
    setPartnerDisplayName(nameFromBio || nameFromEmail);
    setRequestId(pending.id);
    if (userProfile.profilePicKey) {
      try {
        const { url } = await getUrl({
          path: userProfile.profilePicKey,
          options: { bucket: "userPhotos" },
        });
        setMyPhotoUrl(url.toString());
      } catch (err) {
        logError(err, { component: "RequestPending", operation: "loadProfilePic", extra: { profilePicKey: userProfile.profilePicKey } });
        setMyPhotoUrl(null);
      }
    } else {
      setMyPhotoUrl(null);
    }
  }, [navigate, opts]);

  useEffect(() => {
    let cancelled = false;
    loadPendingRequest().finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadPendingRequest]);

  const handleWithdrawClick = () => { logInfo("RequestPending: withdraw modal opened", { component: "RequestPending", operation: "withdrawClick" }); setShowWithdrawModal(true); };

  const handleWithdrawConfirm = async (data: WithdrawFormData) => {
    if (!requestId) return;
    logInfo("RequestPending: withdraw confirmed", { component: "RequestPending", operation: "withdrawConfirm", extra: { requestId } });
    setWithdrawing(true);
    try {
      const profile = await getUserProfileFromCognito();
      if (!profile?.email) return;
      const { data: profiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: profile.email } } },
        opts
      );
      await client.models.MatchRequest.update(
        { id: requestId, status: "withdrawn" },
        opts
      );
      if (profiles?.[0]?.id) {
        await client.models.UserProfile.update(
          {
            id: profiles[0].id,
            bio: undefined,
            partnerStatus: "Still looking for my prom date 💫",
            partnerEmail: "",
            partnerName: "",
            sexualOrientation: data.sexualOrientation,
            intention: data.intention,
            hometown: data.hometown,
            foodPreference: "Flexible",
            onboardingCompleted: true,
          },
          opts
        );
        logInfo("RequestPending: withdraw complete, redirecting", { component: "RequestPending", operation: "withdrawConfirm" });
        navigate(MATCHMAKING_ENABLED ? "/discover/profile" : "/matchmaking-soon", {
          state: { refresh: true },
        });
      } else {
        logInfo("RequestPending: withdraw complete, redirecting", { component: "RequestPending", operation: "withdrawConfirm" });
        navigate(MATCHMAKING_ENABLED ? "/discover/profile" : "/matchmaking-soon", {
          state: { refresh: true },
        });
      }
    } catch (e) {
      logError(e, { component: "RequestPending", operation: "withdraw", extra: { requestId } });
      throw e;
    } finally {
      setWithdrawing(false);
    }
  };

  const handleLogout = async () => {
    logInfo("RequestPending: logout clicked", { component: "RequestPending", operation: "logout" });
    try {
      if (GOOGLE_LOGIN_CHECK) {
        await signOut();
      } else {
        clearTestUser();
      }
      navigate("/");
    } catch (err) {
      logError(err, { component: "RequestPending", operation: "logout" });
      if (!GOOGLE_LOGIN_CHECK) clearTestUser();
      navigate("/");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center w-full">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!partnerDisplayName || !requestId) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-dvh bg-gradient-midnight relative flex flex-col w-full">
      <SparkleBackground />
      <div className="relative z-10 flex flex-col flex-1 w-full max-w-[500px] mx-auto">
        <header className="p-4 border-b border-border/50 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold">
                Request Pending
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Waiting for {partnerDisplayName} to accept your invite
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-1.5 shrink-0 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <LogOut className="w-4 h-4" />
              Log out
            </Button>
          </div>
        </header>
        <div className="flex-1 flex flex-col min-h-0">
          <PendingPartnerRequestView
            partnerDisplayName={partnerDisplayName}
            onWithdraw={handleWithdrawClick}
            isWithdrawing={withdrawing}
            fromPhotoUrl={myPhotoUrl}
          />
        </div>
      </div>
      <WithdrawModal
        open={showWithdrawModal}
        onOpenChange={setShowWithdrawModal}
        onConfirm={handleWithdrawConfirm}
      />
    </div>
  );
}
