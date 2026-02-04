import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SparkleBackground from "@/components/SparkleBackground";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { signOut } from "aws-amplify/auth";
import { uploadData } from "aws-amplify/storage";
import { getUserProfile, hasCompletedOnboarding, clearTestUser } from "@/utils/auth";
import { getInviteFrom, clearInviteFrom } from "@/utils/invite";
import { APP_URL } from "@/config";
import { sharePartnerInviteViaWhatsApp } from "@/utils/share";
import { ArrowRight, ArrowLeft, AlertTriangle, Bell, Check, Heart, LogOut, Mail, Upload, Image as ImageIcon, UserX, X } from "lucide-react";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

type OnboardingStep = 
  | "choice"             // First: "Looking for a date" vs "Already a couple"
  | "partnerRequest"     // Invite flow: accept/decline prom request
  | "welcome" 
  | "dateOfBirth" 
  | "notifications" 
  | "ageCohortGender" 
  | "sexualityIntention" 
  | "hometown"
  | "lifestyle"
  | "photoUpload"
  | "coupleYourName"     // Couple flow: your name
  | "couplePhotoUpload"  // Couple flow: your photo
  | "couplePartnerType"  // IIMA vs outside
  | "couplePartnerOutside" // Outside: partner name only
  | "couplePartnerIIMA";   // IIMA: partner name + email

interface ProfileData {
  name: string;
  email: string;
  dateOfBirth: string; // DD MM YYYY format
  age: number | null;
  cohort: string;
  gender: string;
  sexualOrientation: string;
  intention: string;
  hometown: string;
  notificationsEnabled: boolean;
  profilePicKey: string; // S3 key for profile picture
  partnerStatus: string; // "Still looking" vs "Already found" (set at choice step)
  partnerEmail: string;  // Partner's IIMA email (couple flow)
  partnerName: string;   // Partner's name (couple flow)
  partnerType: "" | "iima" | "outside"; // IIMA vs outside (couple flow)
  // Lifestyle preferences
  alcoholPreference: string;
  smokingPreference: string;
  foodPreference: string;
  favouritePlace: string;
  teaOrCoffee: string;
  mountainOrBeach: string;
  bio: string;
}

// First step: ask "Looking for a date" vs "Already a couple"
const CHOICE_STEP: OnboardingStep[] = ["choice"];

// Full profile flow (after "Looking for a date")
const FULL_FLOW_STEPS: OnboardingStep[] = [
  "welcome",
  "dateOfBirth",
  "notifications",
  "ageCohortGender",
  "sexualityIntention",
  "hometown",
  "lifestyle",
  "photoUpload",
];

// Couple flow (after "Already a couple"): name → photo → partner type → partner details
function getCoupleFlowSteps(partnerType: "" | "iima" | "outside"): OnboardingStep[] {
  const base: OnboardingStep[] = ["coupleYourName", "couplePhotoUpload", "couplePartnerType"];
  if (partnerType === "outside") return [...base, "couplePartnerOutside"];
  if (partnerType === "iima") return [...base, "couplePartnerIIMA"];
  return base;
}

// Invite flow: partner landed via invite link, sees request to accept/decline
const INVITE_FLOW_STEPS: OnboardingStep[] = ["partnerRequest"];

const alcoholOptions = ["Never", "Sometimes", "Regularly"];
const smokingOptions = ["Never", "Sometimes", "Regularly"];
const foodOptions = ["Veg", "Non-Veg", "Eggetarian", "No preference"];
const favouritePlaceOptions = ["Tea Post", "Library", "LKP", "CR", "Sports Complex", "Nestlé", "Heritage Walk", "Other"];
const teaOrCoffeeOptions = ["Tea", "Coffee", "Both"];
const mountainOrBeachOptions = ["Mountain", "Beach", "Both"];

const partnerStatusOptions = ["Still looking for my prom date 💫", "Already found my plus-one ✨"] as const;
const IIMA_EMAIL_SUFFIX = "@iima.ac.in";

const cohorts = ["PGP1", "PGP2", "PGPX", "PhD", "AA", "Staff", "Other"];
const genders = ["Man", "Woman", "Non-Binary"];
const sexualities = ["Straight", "Gay", "Bisexual", "Queer"];
const intentions = [
  "Date for Prom",
  "In a relationship, looking for a prom date",
  "Long Term",
  "Not Sure",
];

const Onboarding = () => {
  const navigate = useNavigate();
  
  // Auth state
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isValidEmail, setIsValidEmail] = useState<boolean | null>(null);

  // Profile state
  const [step, setStep] = useState<OnboardingStep>("choice");
  const [flowChoice, setFlowChoice] = useState<"full" | "couple" | "invite" | null>(null);
  const [inviteRequest, setInviteRequest] = useState<{
    id: string;
    fromUserId: string;
    fromEmail: string;
    fromName?: string;
  } | null>(null);
  const [inviteAccepting, setInviteAccepting] = useState(false);
  const [inviteDeclining, setInviteDeclining] = useState(false);
  const [profile, setProfile] = useState<ProfileData>({
    name: "",
    email: "",
    dateOfBirth: "",
    age: null,
    cohort: "",
    gender: "",
    sexualOrientation: "",
    intention: "",
    hometown: "",
    notificationsEnabled: false,
    profilePicKey: "",
    partnerStatus: "",
    partnerEmail: "",
    partnerName: "",
    partnerType: "",
    alcoholPreference: "",
    smokingPreference: "",
    foodPreference: "",
    favouritePlace: "",
    teaOrCoffee: "",
    mountainOrBeach: "",
    bio: "",
  });

  const [partnerEmailError, setPartnerEmailError] = useState<string | null>(null);
  const [partnerCheckStatus, setPartnerCheckStatus] = useState<"idle" | "checking" | "registered" | "not_registered">("idle");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showExpandedImage, setShowExpandedImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current steps: choice only, or full flow, or couple flow, or invite flow
  const effectiveSteps =
    flowChoice === null
      ? CHOICE_STEP
      : flowChoice === "invite"
        ? INVITE_FLOW_STEPS
        : flowChoice === "full"
          ? FULL_FLOW_STEPS
          : getCoupleFlowSteps(profile.partnerType as "" | "iima" | "outside");
  const currentStepIndex = effectiveSteps.indexOf(step);
  const totalSteps = effectiveSteps.length;

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      setIsCheckingAuth(true);
      try {
        const authProfile = await getUserProfile();
        
        if (authProfile && authProfile.email) {
          setIsAuthenticated(true);
          setUserEmail(authProfile.email);
          setUserName(authProfile.name || "");
          
          // Pre-populate email only; name is collected in Name & DOB step
          setProfile(prev => ({
            ...prev,
            email: authProfile.email || "",
          }));
          
          // Check if email is from IIMA domain
          const emailDomain = authProfile.email.toLowerCase();
          const isValidIIMAEmail = emailDomain.endsWith('@iima.ac.in');
          setIsValidEmail(isValidIIMAEmail);
          
          if (!isValidIIMAEmail) {
            console.log("Invalid email domain:", emailDomain);
            setIsCheckingAuth(false);
            return;
          }

          // Check if user has already completed onboarding
          const completed = await hasCompletedOnboarding();
          if (completed) {
            navigate("/discover/profile?openFilters=1");
            return;
          }

          // Check for pending partner request (invite link or someone sent request to this email)
          try {
            const { fetchAuthSession } = await import("aws-amplify/auth");
            const session = await fetchAuthSession();
            const auth = !!session.tokens;
            const authMode = auth ? "userPool" : "apiKey";
            const { data: requests } = await client.models.MatchRequest.listMatchRequestByToEmail(
              { toEmail: authProfile.email!.toLowerCase() },
              { authMode: authMode as "userPool" | "apiKey" }
            );
            const pendingList = (requests ?? []).filter((r) => r.status === "pending");
            const inviteFrom = getInviteFrom();
            // Prefer request from invite link if present, else use first pending
            const pending = inviteFrom && inviteFrom !== authProfile.email?.toLowerCase()
              ? pendingList.find((r) => r.fromEmail?.toLowerCase() === inviteFrom.toLowerCase())
              : pendingList[0];
            if (pending) {
              setInviteRequest({
                id: pending.id,
                fromUserId: pending.fromUserId ?? "",
                fromEmail: pending.fromEmail ?? "",
                fromName: pending.fromName ?? undefined,
              });
              // Stay on choice step; show "You have a request from X" vs "Look for a date"
            }
          } catch (_) {}
        } else {
          setIsAuthenticated(false);
          setShowAuthModal(true);
          setIsValidEmail(null);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
        setShowAuthModal(true);
        setIsValidEmail(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSignOut = async () => {
    try {
      if (GOOGLE_LOGIN_CHECK) {
        // Normal logout: use Amplify signOut
        await signOut();
      } else {
        // Test mode: clear test user from localStorage
        clearTestUser();
      }
      // Redirect to landing page
      navigate("/");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still clear test user and navigate even if signOut fails
      if (!GOOGLE_LOGIN_CHECK) {
        clearTestUser();
      }
      navigate("/");
    }
  };

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth || dateOfBirth.length !== 10) return null;
    
    const [day, month, year] = dateOfBirth.split(" ").map(Number);
    if (!day || !month || !year) return null;
    
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age >= 0 ? age : null;
  };

  const handleDateOfBirthChange = (value: string) => {
    // Format: DD MM YYYY
    // Remove all non-digits
    let digits = value.replace(/\D/g, "");
    
    // Limit to 8 digits (DDMMYYYY)
    if (digits.length > 8) {
      digits = digits.substring(0, 8);
    }
    
    // Format as DD MM YYYY
    let formatted = "";
    if (digits.length > 0) {
      formatted = digits.substring(0, 2); // DD
    }
    if (digits.length > 2) {
      formatted += " " + digits.substring(2, 4); // MM
    }
    if (digits.length > 4) {
      formatted += " " + digits.substring(4, 8); // YYYY
    }
    
    setProfile(prev => ({
      ...prev,
      dateOfBirth: formatted,
      age: calculateAge(formatted),
    }));
  };

  const handleNotificationsToggle = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      setProfile(prev => ({
        ...prev,
        notificationsEnabled: permission === "granted",
      }));
    } else {
      setProfile(prev => ({
        ...prev,
        notificationsEnabled: true, // Assume enabled if not supported
      }));
    }
  };

  // Handle file selection - simple preview
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setUploadError("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be less than 5MB");
      return;
    }

    setUploadError(null);
    setSelectedFile(file);

    // Create preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setProfile(prev => ({ ...prev, profilePicKey: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // When user picks "Looking for a date", "Already a couple", or "You have a request from X" at the choice step
  const handleChoice = (option: (typeof partnerStatusOptions)[number] | "request") => {
    if (option === "request") {
      // User chose to accept the pending partner request
      setFlowChoice("invite");
      setStep("partnerRequest");
      return;
    }
    setProfile(prev => ({ ...prev, partnerStatus: option }));
    if (option === "Still looking for my prom date 💫") {
      setFlowChoice("full");
      setStep("welcome");
    } else {
      setFlowChoice("couple");
      setStep("coupleYourName");
    }
  };

  // Check if partner email is already registered (has a UserProfile)
  const checkPartnerRegistered = async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.endsWith(IIMA_EMAIL_SUFFIX)) {
      setPartnerCheckStatus("idle");
      return;
    }
    if (trimmed === profile.email.trim().toLowerCase()) {
      setPartnerCheckStatus("idle");
      return;
    }
    setPartnerCheckStatus("checking");
    setPartnerEmailError(null);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const isAuthenticated = !!session.tokens;
      const authMode = isAuthenticated ? "userPool" : "apiKey";
      const { data: partnerProfiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: trimmed } } },
        { authMode: authMode as "userPool" | "apiKey" }
      );
      const isRegistered = (partnerProfiles?.length ?? 0) > 0;
      setPartnerCheckStatus(isRegistered ? "registered" : "not_registered");
    } catch (_) {
      setPartnerCheckStatus("idle");
    }
  };

  // Upload photo to S3
  const uploadPhotoToS3 = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `profile-${timestamp}.${fileExtension}`;

      // IMPORTANT: The storage access rule allow.entity('identity') requires the path to use
      // the Cognito Identity ID. Use the path callback so Amplify injects identityId.
      // This works for both authenticated users and unauthenticated (test mode) users -
      // both get an identity from the Identity Pool.
      const pathFn = ({ identityId }: { identityId: string }) =>
        `profile-pics/${identityId}/${fileName}`;

      console.log("[Onboarding] Uploading photo to S3:", {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storageConfigured: !!(outputs as any).storage,
        outputsKeys: Object.keys(outputs),
      });

      // Check if storage is configured in amplify_outputs.json
      if (!(outputs as any).storage) {
        const errorMsg = "Storage bucket is not configured. Please run 'npx ampx sandbox' in the project root to sync the backend and create the S3 storage bucket.";
        console.error("[Onboarding] Storage not configured in amplify_outputs.json");
        console.error("[Onboarding] Available outputs:", Object.keys(outputs));
        throw new Error(errorMsg);
      }

      // Upload to S3 - path callback ensures we use Cognito Identity ID (required by IAM policy)
      const result = await uploadData({
        path: pathFn,
        data: file,
        options: {
          contentType: file.type,
          bucket: 'userPhotos',
        },
      }).result;

      // result.path is the resolved S3 path (e.g. profile-pics/{identityId}/profile-xxx.jpg)
      const s3Path = (result as { path?: string }).path ?? `profile-pics/${fileName}`;
      console.log("[Onboarding] Photo uploaded successfully:", { path: s3Path, result });
      
      return s3Path;
    } catch (error) {
      console.error("[Onboarding] Error uploading photo:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to upload photo";
      
      // Provide helpful error message for missing bucket
      if (errorMessage.includes("NoBucket") || errorMessage.includes("bucket")) {
        throw new Error("Storage bucket not configured. Please run 'npx ampx sandbox' to sync the backend.");
      }
      
      throw new Error(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const nextStep = async () => {
    // Choice step: user advances by clicking an option (no Next button)
    if (step === "choice") return;

    // Full flow: photoUpload is last → upload then save
    if (step === "photoUpload") {
      let uploadedS3Key: string | undefined;
      // If photo is selected but not uploaded yet, upload it first
      if (selectedFile && !profile.profilePicKey) {
        try {
          setIsUploading(true);
          setUploadError(null);
          const s3Key = await uploadPhotoToS3(selectedFile);
          uploadedS3Key = s3Key;
          setProfile(prev => ({ ...prev, profilePicKey: s3Key }));
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : "Failed to upload photo");
          setIsUploading(false);
          return;
        }
      }
      
      // photoUpload is the last step — save profile to backend
      // Pass uploadedS3Key directly - React setState is async, so profile.profilePicKey may not be updated yet
      await saveProfileToBackend(uploadedS3Key);
      return;
    }

    // Couple flow: couplePhotoUpload - upload then next
    if (step === "couplePhotoUpload") {
      if (selectedFile && !profile.profilePicKey) {
        try {
          setIsUploading(true);
          setUploadError(null);
          const s3Key = await uploadPhotoToS3(selectedFile);
          setProfile(prev => ({ ...prev, profilePicKey: s3Key }));
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : "Failed to upload photo");
          setIsUploading(false);
          return;
        }
      }
      const nextIndex = effectiveSteps.indexOf(step) + 1;
      if (nextIndex < effectiveSteps.length) setStep(effectiveSteps[nextIndex]);
      return;
    }

    // Couple flow: couplePartnerType - user picks IIMA/Outside (no Next button)
    if (step === "couplePartnerType") return;

    // Couple flow: couplePartnerOutside - save and go to couple-complete
    if (step === "couplePartnerOutside") {
      await saveCoupleOutside();
      return;
    }

    // Couple flow: couplePartnerIIMA - save and send request or WhatsApp
    if (step === "couplePartnerIIMA") {
      await saveCoupleIIMA();
      return;
    }

    const nextIndex = currentStepIndex + 1;
    if (nextIndex < effectiveSteps.length) {
      setStep(effectiveSteps[nextIndex]);
    }
  };

  const saveProfileToBackend = async (profilePicKeyOverride?: string) => {
    // Use override when we just uploaded (React state may not have updated yet)
    const profilePicKeyToSave = profilePicKeyOverride ?? profile.profilePicKey;

    console.log("[Onboarding] ========================================");
    console.log("[Onboarding] Starting full profile save...");
    setIsSaving(true);
    setSaveError(null);
    
    try {
      const currentUser = await getUserProfile();
      
      // Log profile data before saving
      console.log("[Onboarding] Profile data to save:", {
        email: profile.email,
        name: profile.name,
        dateOfBirth: profile.dateOfBirth,
        age: profile.age,
        cohort: profile.cohort,
        gender: profile.gender,
        sexualOrientation: profile.sexualOrientation,
        intention: profile.intention,
        hometown: profile.hometown,
        notificationsEnabled: profile.notificationsEnabled,
        profilePicKey: profilePicKeyToSave,
        onboardingCompleted: true,
      });

        // Check if profile already exists for this email
        console.log("[Onboarding] Checking for existing profile with email:", profile.email);
        
        // Check authentication status to determine which auth mode to use
        const { fetchAuthSession } = await import("aws-amplify/auth");
        const session = await fetchAuthSession();
        const isAuthenticated = !!session.tokens;
        
        console.log("[Onboarding] Auth session:", {
          isAuthenticated,
          hasTokens: !!session.tokens,
          hasAccessToken: !!session.tokens?.accessToken,
          hasIdToken: !!session.tokens?.idToken,
        });
        
        // Use userPool auth if authenticated, otherwise use API key
        const authMode = isAuthenticated ? 'userPool' : 'apiKey';
        console.log("[Onboarding] Using auth mode:", authMode);
        
        const listStartTime = Date.now();
        // @ts-ignore - TypeScript types don't match runtime behavior for authMode
        const { data: existingProfiles, errors: listErrors } = await client.models.UserProfile.list(
          {
            filter: {
              email: {
                eq: profile.email,
              },
            },
          },
          { authMode: authMode as 'userPool' | 'apiKey' }
        );
        const listDuration = Date.now() - listStartTime;

        console.log("[Onboarding] Existing profiles check completed:", {
          duration: `${listDuration}ms`,
          found: existingProfiles?.length || 0,
          profiles: existingProfiles,
          errors: listErrors,
          errorCount: listErrors?.length || 0,
        });

        if (listErrors) {
          console.error("[Onboarding] Error checking existing profile:", {
            errors: listErrors,
            firstError: listErrors[0],
            errorMessage: listErrors[0]?.message,
          });
          throw new Error(listErrors[0]?.message || "Failed to check existing profile");
        }

        // Only include fields that exist on the deployed CreateUserProfileInput.
        const profileData = {
          email: profile.email,
          name: profile.name,
          dateOfBirth: profile.dateOfBirth,
          age: profile.age ?? undefined,
          cohort: profile.cohort,
          gender: profile.gender,
          sexualOrientation: profile.sexualOrientation,
          intention: profile.intention,
          hometown: profile.hometown,
          notificationsEnabled: profile.notificationsEnabled,
          profilePicKey: profilePicKeyToSave || undefined,
          alcoholPreference: profile.alcoholPreference || undefined,
          smokingPreference: profile.smokingPreference || undefined,
          foodPreference: profile.foodPreference || undefined,
          favouritePlace: profile.favouritePlace || undefined,
          teaOrCoffee: profile.teaOrCoffee || undefined,
          mountainOrBeach: profile.mountainOrBeach || undefined,
          bio: profile.bio || undefined,
          onboardingCompleted: true,
        };

        console.log("[Onboarding] Prepared profile data for save:", profileData);

        if (existingProfiles && existingProfiles.length > 0) {
          // Update existing profile
          const existingProfile = existingProfiles[0];
          console.log("[Onboarding] Found existing profile, updating:", {
            existingProfileId: existingProfile.id,
            existingEmail: existingProfile.email,
            existingOnboardingCompleted: existingProfile.onboardingCompleted,
            updateData: profileData,
            authMode,
          });

          const updateStartTime = Date.now();
          // @ts-ignore - TypeScript types don't match runtime behavior for update arguments
          const { data: updatedProfile, errors: updateErrors } = await client.models.UserProfile.update(
            {
              id: existingProfile.id,
              email: profileData.email,
              name: profileData.name,
              dateOfBirth: profileData.dateOfBirth,
              age: profileData.age,
              cohort: profileData.cohort,
              gender: profileData.gender,
              sexualOrientation: profileData.sexualOrientation,
              intention: profileData.intention,
              hometown: profileData.hometown,
              notificationsEnabled: profileData.notificationsEnabled,
              profilePicKey: profileData.profilePicKey,
              alcoholPreference: profileData.alcoholPreference,
              smokingPreference: profileData.smokingPreference,
              foodPreference: profileData.foodPreference,
              favouritePlace: profileData.favouritePlace,
              teaOrCoffee: profileData.teaOrCoffee,
              mountainOrBeach: profileData.mountainOrBeach,
              bio: profileData.bio,
              onboardingCompleted: profileData.onboardingCompleted,
            },
            { authMode: authMode as 'userPool' | 'apiKey' }
          );
          const updateDuration = Date.now() - updateStartTime;

          console.log("[Onboarding] Update operation completed:", {
            duration: `${updateDuration}ms`,
            success: !updateErrors,
            updatedProfile,
            errors: updateErrors,
            errorCount: updateErrors?.length || 0,
          });

          if (updateErrors) {
            console.error("[Onboarding] Failed to update profile:", {
              errors: updateErrors,
              firstError: updateErrors[0],
              errorMessage: updateErrors[0]?.message,
              profileId: existingProfile.id,
            });
            throw new Error(updateErrors[0]?.message || "Failed to update profile");
          }

          console.log("[Onboarding] ✅ Profile updated successfully:", {
            id: updatedProfile?.id,
            email: updatedProfile?.email,
            onboardingCompleted: updatedProfile?.onboardingCompleted,
          });
        } else {
          // Create new profile
          console.log("[Onboarding] No existing profile found, creating new profile");
          console.log("[Onboarding] Using auth mode:", authMode);

          const createStartTime = Date.now();
          // @ts-ignore - TypeScript types don't match runtime behavior for create arguments
          const { data: createdProfile, errors: createErrors } = await client.models.UserProfile.create(
            {
              email: profileData.email,
              name: profileData.name,
              dateOfBirth: profileData.dateOfBirth,
              age: profileData.age,
              cohort: profileData.cohort,
              gender: profileData.gender,
              sexualOrientation: profileData.sexualOrientation,
              intention: profileData.intention,
              hometown: profileData.hometown,
              notificationsEnabled: profileData.notificationsEnabled,
              profilePicKey: profileData.profilePicKey,
              alcoholPreference: profileData.alcoholPreference,
              smokingPreference: profileData.smokingPreference,
              foodPreference: profileData.foodPreference,
              favouritePlace: profileData.favouritePlace,
              teaOrCoffee: profileData.teaOrCoffee,
              mountainOrBeach: profileData.mountainOrBeach,
              bio: profileData.bio,
              onboardingCompleted: profileData.onboardingCompleted,
            },
            { authMode: authMode as 'userPool' | 'apiKey' }
          );
          const createDuration = Date.now() - createStartTime;

          console.log("[Onboarding] Create operation completed:", {
            duration: `${createDuration}ms`,
            success: !createErrors,
            createdProfile,
            errors: createErrors,
            errorCount: createErrors?.length || 0,
          });

          if (createErrors) {
            console.error("[Onboarding] Failed to create profile:", {
              errors: createErrors,
              firstError: createErrors[0],
              errorMessage: createErrors[0]?.message,
              profileData,
            });
            throw new Error(createErrors[0]?.message || "Failed to create profile");
          }

          console.log("[Onboarding] ✅ Profile created successfully:", {
            id: createdProfile?.id,
            email: createdProfile?.email,
            onboardingCompleted: createdProfile?.onboardingCompleted,
          });
        }
        
        console.log("[Onboarding] ✅ Profile save completed successfully!");
        const currentUserEmailForRequests = profile.email.trim().toLowerCase();
        try {
          const { data: requestsToMe } = await client.models.MatchRequest.listMatchRequestByToEmail(
            { toEmail: currentUserEmailForRequests },
            { authMode: authMode as 'userPool' | 'apiKey' }
          );
          const hasPending = (requestsToMe ?? []).some((r) => r.status === "pending");
          if (hasPending) {
            navigate("/matches");
            setIsSaving(false);
            return;
          }
        } catch (_) {}
        console.log("[Onboarding] Navigating to discover page...");
        console.log("[Onboarding] ========================================");
        navigate("/discover/profile?openFilters=1");
      } catch (error) {
        console.error("[Onboarding] ❌ Failed to save user profile:", {
          error,
          errorType: error?.constructor?.name,
          errorMessage: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          profileData: {
            email: profile.email,
            name: profile.name,
            dateOfBirth: profile.dateOfBirth,
            age: profile.age,
            cohort: profile.cohort,
            gender: profile.gender,
            sexualOrientation: profile.sexualOrientation,
            intention: profile.intention,
            hometown: profile.hometown,
            notificationsEnabled: profile.notificationsEnabled,
          },
        });
        console.log("[Onboarding] ========================================");
        setSaveError(error instanceof Error ? error.message : "Failed to save profile. Please try again.");
        setIsSaving(false);
      }
  };

  const saveCoupleOutside = async () => {
    console.log("[Onboarding] Saving couple flow (outside partner)...");
    setIsSaving(true);
    setSaveError(null);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const isAuthenticated = !!session.tokens;
      const authMode = isAuthenticated ? "userPool" : "apiKey";
      const partnerNameTrim = profile.partnerName.trim();
      if (!partnerNameTrim) {
        setSaveError("Please enter your partner's name.");
        setIsSaving(false);
        return;
      }
      // @ts-ignore
      const { data: existingProfiles, errors: listErrors } = await client.models.UserProfile.list(
        { filter: { email: { eq: profile.email } } },
        { authMode: authMode as "userPool" | "apiKey" }
      );
      if (listErrors) throw new Error(listErrors[0]?.message || "Failed to check profile");
      const minimalData = {
        email: profile.email,
        name: profile.name.trim() || undefined,
        profilePicKey: profile.profilePicKey || undefined,
        bio: `Partner: ${partnerNameTrim}`,
        onboardingCompleted: true,
      };
      if (existingProfiles?.length) {
        // @ts-ignore
        await client.models.UserProfile.update(
          { id: existingProfiles[0].id, ...minimalData },
          { authMode: authMode as "userPool" | "apiKey" }
        );
      } else {
        // @ts-ignore
        await client.models.UserProfile.create(minimalData, { authMode: authMode as "userPool" | "apiKey" });
      }
      navigate(`/prom-date?partnerName=${encodeURIComponent(partnerNameTrim)}&outside=1`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveCoupleIIMA = async () => {
    console.log("[Onboarding] Saving couple flow (minimal profile + partner link)...");
    setIsSaving(true);
    setSaveError(null);
    try {
      const currentUser = await getUserProfile();
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const isAuthenticated = !!session.tokens;
      const authMode = isAuthenticated ? "userPool" : "apiKey";
      const partnerEmailTrim = profile.partnerEmail.trim().toLowerCase();
      if (!partnerEmailTrim.endsWith(IIMA_EMAIL_SUFFIX)) {
        setSaveError("Partner email must be an @iima.ac.in address.");
        setIsSaving(false);
        return;
      }
      if (partnerEmailTrim === profile.email.trim().toLowerCase()) {
        setSaveError("You cannot add your own email as partner.");
        setIsSaving(false);
        return;
      }

      // @ts-ignore - authMode option
      const { data: existingProfiles, errors: listErrors } = await client.models.UserProfile.list(
        { filter: { email: { eq: profile.email } } },
        { authMode: authMode as "userPool" | "apiKey" }
      );
      if (listErrors) throw new Error(listErrors[0]?.message || "Failed to check profile");

      const minimalData = {
        email: profile.email,
        name: profile.name.trim() || undefined,
        profilePicKey: profile.profilePicKey || undefined,
        bio: profile.partnerName.trim() ? `Partner: ${profile.partnerName.trim()}` : undefined,
        onboardingCompleted: true,
      };

      let senderProfileId: string;
      if (existingProfiles?.length) {
        // @ts-ignore - update args
        await client.models.UserProfile.update(
          { id: existingProfiles[0].id, ...minimalData },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        senderProfileId = existingProfiles[0].id;
      } else {
        // @ts-ignore - create args
        const { data: created } = await client.models.UserProfile.create(minimalData, { authMode: authMode as "userPool" | "apiKey" });
        senderProfileId = created?.id ?? "";
      }
      const currentUserEmail = profile.email.trim().toLowerCase();
      try {
        // @ts-ignore - authMode
        const { data: partnerProfiles } = await client.models.UserProfile.list(
          { filter: { email: { eq: partnerEmailTrim } } },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        const partner = partnerProfiles?.[0];
        // @ts-ignore - MatchRequest create (fromUserId = UserProfile id for Match consistency)
        await client.models.MatchRequest.create(
          {
            fromUserId: senderProfileId,
            fromEmail: currentUserEmail,
            fromName: profile.name || undefined,
            toEmail: partnerEmailTrim,
            toUserId: partner?.id ?? undefined,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        if (!partner) {
          sharePartnerInviteViaWhatsApp(profile.name || "Someone", currentUserEmail);
        }
      } catch (reqErr) {
        console.warn("[Onboarding] MatchRequest/invite failed:", reqErr);
      }

      // Sender always goes to discover; show "request pending with partner" there
      navigate("/discover/profile?openFilters=1");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const prevStep = () => {
    if (step === "welcome" || step === "coupleYourName") {
      setStep("choice");
      setFlowChoice(null);
      return;
    }
    if (step === "partnerRequest") {
      clearInviteFrom();
      setInviteRequest(null);
      setStep("choice");
      setFlowChoice(null);
      return;
    }
    if (step === "couplePartnerOutside" || step === "couplePartnerIIMA") {
      setStep("couplePartnerType");
      setProfile(prev => ({ ...prev, partnerType: "" }));
      return;
    }
    if (step === "couplePartnerType") {
      setStep("couplePhotoUpload");
      return;
    }
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(effectiveSteps[prevIndex]);
    }
  };

  const handleInviteAccept = async () => {
    if (!inviteRequest || !profile.email) return;
    setInviteAccepting(true);
    setSaveError(null);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const auth = !!session.tokens;
      const authMode = auth ? "userPool" : "apiKey";
      const opts = { authMode: authMode as "userPool" | "apiKey" };

      // Create or get partner's UserProfile (partner might not have one yet)
      const { data: partnerProfiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: profile.email } } },
        opts
      );
      let partnerProfileId: string;
      if (partnerProfiles?.[0]?.id) {
        partnerProfileId = partnerProfiles[0].id;
        await client.models.UserProfile.update(
          { id: partnerProfileId, onboardingCompleted: true },
          opts
        );
      } else {
        const { data: created } = await client.models.UserProfile.create(
          {
            email: profile.email,
            name: profile.name || userName || undefined,
            userId: (await getUserProfile())?.userId ?? "",
            onboardingCompleted: true,
          },
          opts
        );
        partnerProfileId = created?.id ?? "";
      }
      if (!partnerProfileId) throw new Error("Could not create profile");

      await client.models.MatchRequest.update(
        { id: inviteRequest.id, status: "accepted" },
        opts
      );
      await client.models.Match.create(
        {
          user1Id: inviteRequest.fromUserId,
          user2Id: partnerProfileId,
          user1Email: inviteRequest.fromEmail,
          user2Email: profile.email,
          isPromDate: true,
          status: "active",
          createdAt: new Date().toISOString(),
        },
        opts
      );
      const { data: myProfiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: profile.email } } },
        opts
      );
      const { data: theirProfiles } = await client.models.UserProfile.list(
        { filter: { email: { eq: inviteRequest.fromEmail } } },
        opts
      );
      if (myProfiles?.[0]?.id) {
        await client.models.UserProfile.update(
          { id: myProfiles[0].id, excludeFromDiscovery: true },
          opts
        );
      }
      if (theirProfiles?.[0]?.id) {
        await client.models.UserProfile.update(
          { id: theirProfiles[0].id, excludeFromDiscovery: true },
          opts
        );
      }
      clearInviteFrom();
      navigate("/prom-date");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to accept. Please try again.");
    } finally {
      setInviteAccepting(false);
    }
  };

  const handleInviteDecline = async () => {
    if (!inviteRequest) return;
    setInviteDeclining(true);
    setSaveError(null);
    try {
      const { fetchAuthSession } = await import("aws-amplify/auth");
      const session = await fetchAuthSession();
      const auth = !!session.tokens;
      const authMode = auth ? "userPool" : "apiKey";
      await client.models.MatchRequest.update(
        { id: inviteRequest.id, status: "declined" },
        { authMode: authMode as "userPool" | "apiKey" }
      );
      clearInviteFrom();
      setInviteRequest(null);
      setFlowChoice("full");
      setStep("welcome");
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to decline. Please try again.");
    } finally {
      setInviteDeclining(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "choice":
        return true; // Advance via option buttons, not Next
      case "partnerRequest":
        return true; // Advance via Accept/Decline buttons
      case "welcome":
        return true;
      case "dateOfBirth":
        return profile.name.trim() !== "" && profile.dateOfBirth.length === 10 && profile.age !== null;
      case "notifications":
        return true;
      case "ageCohortGender":
        return profile.cohort !== "" && profile.gender !== "";
      case "sexualityIntention":
        return profile.sexualOrientation !== "" && profile.intention !== "";
      case "hometown":
        return profile.hometown.trim() !== "";
      case "lifestyle":
        return true;
      case "photoUpload":
        return profile.profilePicKey !== "" || selectedFile !== null;
      case "coupleYourName":
        return profile.name.trim() !== "";
      case "couplePhotoUpload":
        return profile.profilePicKey !== "" || selectedFile !== null;
      case "couplePartnerType":
        return true; // Advance via option buttons
      case "couplePartnerOutside":
        return profile.partnerName.trim() !== "";
      case "couplePartnerIIMA": {
        const email = profile.partnerEmail.trim().toLowerCase();
        if (!profile.partnerName.trim()) return false;
        if (!email.endsWith(IIMA_EMAIL_SUFFIX)) return false;
        if (email === profile.email.trim().toLowerCase()) return false;
        return true;
      }
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case "choice":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 w-full"
          >
            <div className="text-center mb-8">
              <Heart className="w-14 h-14 sm:w-16 sm:h-16 text-primary mx-auto mb-5" />
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3 px-2 leading-tight">
                {inviteRequest
                  ? "Someone wants to go to Prom with you!"
                  : "Are you here for a date or already a couple?"}
              </h2>
              <p className="text-muted-foreground">
                {inviteRequest
                  ? "Accept their request to become prom dates, or discover on your own."
                  : "We'll tailor the next steps to you."}
              </p>
            </div>
            <div className="space-y-3 sm:space-y-4">
              {((() => {
                const hasPendingRequest = !!inviteRequest;
                const requestOptionLabel = inviteRequest
                  ? `You have a request from ${inviteRequest.fromName || inviteRequest.fromEmail?.split("@")[0] || "Someone"} ✨`
                  : null;
                const choiceOptions = hasPendingRequest
                  ? ([requestOptionLabel!, "Still looking for my prom date 💫"] as const)
                  : partnerStatusOptions;
                return choiceOptions.map((option) => {
                  const isRequestOption = hasPendingRequest && option === requestOptionLabel;
                  const isSelected = isRequestOption ? false : profile.partnerStatus === option;
                  return (
                    <Button
                      key={option}
                      variant={isSelected ? "default" : "outline"}
                      className={`w-full h-auto min-h-[56px] sm:min-h-[64px] text-base sm:text-lg justify-center px-4 sm:px-6 py-4 sm:py-5 ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                      }`}
                      onClick={() => handleChoice(isRequestOption ? "request" : option)}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-5 h-5 sm:w-6 sm:h-6 mr-2 shrink-0" />
                          <span>{option}</span>
                        </>
                      ) : (
                        <span>{option}</span>
                      )}
                    </Button>
                  );
                });
              })())}
            </div>
          </motion.div>
        );

      case "partnerRequest":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">You&apos;ve got a prom invite!</h2>
              <p className="text-muted-foreground">
                {inviteRequest?.fromName || inviteRequest?.fromEmail?.split("@")[0] || "Someone"} wants to go to Prom with you.
              </p>
            </div>
            <div className="space-y-3">
              <Button
                variant="default"
                className="w-full h-14 text-base"
                onClick={handleInviteAccept}
                disabled={inviteAccepting || inviteDeclining}
              >
                {inviteAccepting ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Accept – Let&apos;s match!
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                className="w-full h-14 text-base"
                onClick={handleInviteDecline}
                disabled={inviteAccepting || inviteDeclining}
              >
                {inviteDeclining ? (
                  <>
                    <span className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                    Declining...
                  </>
                ) : (
                  <>
                    <X className="w-5 h-5 mr-2" />
                    Decline – I&apos;ll discover on my own
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              If you decline, you&apos;ll continue with the full onboarding and can discover, chat, and match later.
            </p>
          </motion.div>
        );

      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 text-center"
          >
            <h2 className="font-display text-3xl font-bold mb-4">
              Hey {profile.name || "you"} 👋
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prom 2026 is calling – and so is your future date.
              <br />
              <span className="text-primary">(Saree or suit, we got you)</span>
            </p>
            <p className="text-muted-foreground mt-4">
              Quick deets and you&apos;re in. No long forms, we promise – unlike those 2am case preps.
            </p>
          </motion.div>
        );

      case "dateOfBirth":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Name & Date of Birth</h2>
              <p className="text-muted-foreground">Tell us your name and when you were born</p>
            </div>
            <div>
              <Label htmlFor="name" className="text-base mb-3 block">
                Name
              </Label>
              <Input
                id="name"
                placeholder="Your name"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="dateOfBirth" className="text-base mb-3 block">
                Birthday (DD MM YYYY)
              </Label>
              <Input
                id="dateOfBirth"
                placeholder="DD MM YYYY"
                value={profile.dateOfBirth}
                onChange={(e) => handleDateOfBirthChange(e.target.value)}
                maxLength={10}
                className="text-center text-lg tracking-wider"
              />
              {profile.age !== null && (
                <p className="text-sm text-muted-foreground mt-2 text-center">
                  Age: {profile.age} years
                </p>
              )}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground text-center">
                ⚠️ Please use your real name only. Do not use incorrect or pseudo names.
              </p>
            </div>
          </motion.div>
        );

      case "notifications":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Bell className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Don&apos;t miss *the* match</h2>
              <p className="text-muted-foreground">
                Get a ping when someone likes you back – way more exciting than a 1:45 surprise
              </p>
            </div>
            <Button
              variant={profile.notificationsEnabled ? "default" : "outline"}
              className="w-full h-14 text-base"
              onClick={handleNotificationsToggle}
            >
              {profile.notificationsEnabled ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  I&apos;m in – notify me!
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5 mr-2" />
                  Yeah, I want to know
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Flip this anytime in settings
            </p>
          </motion.div>
        );

      case "ageCohortGender":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">About You</h2>
              <p className="text-muted-foreground">Tell us a bit about yourself</p>
            </div>

            {/* Age Display (read-only, calculated from DOB) */}
            <div>
              <Label className="text-base mb-3 block">Age</Label>
              <div className="glass rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {profile.age !== null ? `${profile.age} years` : "Enter date of birth first"}
                  </span>
                  {profile.age !== null && (
                    <span className="text-xs text-muted-foreground">Calculated from DOB</span>
                  )}
                </div>
              </div>
              {profile.age === null && (
                <p className="text-xs text-muted-foreground mt-2">
                  Age will be calculated from your date of birth
                </p>
              )}
            </div>

            {/* Cohort Dropdown */}
            <div>
              <Label htmlFor="cohort" className="text-base mb-3 block">
                Cohort
              </Label>
              <Select
                value={profile.cohort}
                onValueChange={(value) => setProfile(prev => ({ ...prev, cohort: value }))}
              >
                <SelectTrigger id="cohort" className="h-12 text-base">
                  <SelectValue placeholder="Select your cohort" />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((cohort) => (
                    <SelectItem key={cohort} value={cohort}>
                      {cohort}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender Dropdown */}
            <div>
              <Label htmlFor="gender" className="text-base mb-3 block">
                How do you identify?
              </Label>
              <Select
                value={profile.gender}
                onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger id="gender" className="h-12 text-base">
                  <SelectValue placeholder="Your call" />
                </SelectTrigger>
                <SelectContent>
                  {genders.map((gender) => (
                    <SelectItem key={gender} value={gender}>
                      {gender}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        );

      case "sexualityIntention":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Preferences</h2>
              <p className="text-muted-foreground">Help us understand what you're looking for</p>
            </div>

            {/* Sexuality Dropdown */}
            <div>
              <Label htmlFor="sexuality" className="text-base mb-3 block">
                Sexual Orientation
              </Label>
              <Select
                value={profile.sexualOrientation}
                onValueChange={(value) => setProfile(prev => ({ ...prev, sexualOrientation: value }))}
              >
                <SelectTrigger id="sexuality" className="h-12 text-base">
                  <SelectValue placeholder="What's your sexual orientation?" />
                </SelectTrigger>
                <SelectContent>
                  {sexualities.map((sexuality) => (
                    <SelectItem key={sexuality} value={sexuality}>
                      {sexuality}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intention Dropdown */}
            <div>
              <Label htmlFor="intention" className="text-base mb-3 block">
                What&apos;s the endgame?
              </Label>
              <Select
                value={profile.intention}
                onValueChange={(value) => setProfile(prev => ({ ...prev, intention: value }))}
              >
                <SelectTrigger id="intention" className="h-12 text-base">
                  <SelectValue placeholder="Just prom? Or more?" />
                </SelectTrigger>
                <SelectContent>
                  {intentions.map((intention) => (
                    <SelectItem key={intention} value={intention}>
                      {intention}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        );

      case "hometown":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Hometown</h2>
              <p className="text-muted-foreground">Where do you belong to?</p>
            </div>
            <div>
              <Label htmlFor="hometown" className="text-base mb-3 block">
                Hometown
              </Label>
              <Input
                id="hometown"
                placeholder="Enter your hometown"
                value={profile.hometown}
                onChange={(e) => setProfile(prev => ({ ...prev, hometown: e.target.value }))}
                className="text-base"
              />
            </div>
          </motion.div>
        );

      case "lifestyle":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Tea Post or Nestlé energy?</h2>
              <p className="text-muted-foreground">Optional – but helps your matches know the real you</p>
            </div>

            <div>
              <Label htmlFor="bio" className="text-base mb-3 block">In your own words</Label>
              <Textarea
                id="bio"
                placeholder="2am chai at Tea Post type? Or early bird library person? Sell yourself..."
                value={profile.bio}
                onChange={(e) => setProfile((prev) => ({ ...prev, bio: e.target.value }))}
                className="min-h-[80px] resize-none"
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground mt-1">{profile.bio.length}/300</p>
            </div>

            <div>
              <Label className="text-base mb-3 block">Alcohol</Label>
              <Select
                value={profile.alcoholPreference}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, alcoholPreference: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {alcoholOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-3 block">Smoke break person?</Label>
              <Select
                value={profile.smokingPreference}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, smokingPreference: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {smokingOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-3 block">What type of a snack are you?</Label>
              <Select
                value={profile.foodPreference}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, foodPreference: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Your food vibe" />
                </SelectTrigger>
                <SelectContent>
                  {foodOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-3 block">Tea or Coffee</Label>
              <Select
                value={profile.teaOrCoffee}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, teaOrCoffee: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {teaOrCoffeeOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-3 block">Mountain or beach person?</Label>
              <Select
                value={profile.mountainOrBeach}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, mountainOrBeach: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Weekend getaway vibes" />
                </SelectTrigger>
                <SelectContent>
                  {mountainOrBeachOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-base mb-3 block">Your spot on campus?</Label>
              <Select
                value={profile.favouritePlace}
                onValueChange={(v) => setProfile((prev) => ({ ...prev, favouritePlace: v }))}
              >
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Tea Post, LKP, Library...?" />
                </SelectTrigger>
                <SelectContent>
                  {favouritePlaceOptions.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </motion.div>
        );

      case "photoUpload":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Your best shot</h2>
              <p className="text-muted-foreground">The one that makes people double-tap. Prom-ready vibes only</p>
            </div>

            {/* File input (hidden) */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
              id="photo-upload"
            />

            {/* Simple upload */}
            <div className="space-y-4">
              <Label htmlFor="photo-upload" className="text-base mb-3 block text-center">
                {previewUrl ? "Profile photo" : "Upload your photo"}
              </Label>
              
              {previewUrl ? (
                <div className="space-y-3">
                  <div 
                    className="w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-border bg-muted cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowExpandedImage(true)}
                  >
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change photo
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
                >
                  <ImageIcon className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-foreground mb-1">
                    <span className="font-semibold">Click to upload</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPG or PNG, max 5MB
                  </p>
                </label>
              )}
            </div>

            {uploadError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive font-medium mb-2">{uploadError}</p>
                {uploadError.includes("bucket") || uploadError.includes("Storage") ? (
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Run <code className="bg-muted px-1 py-0.5 rounded text-xs">npx ampx sandbox</code> in your terminal to sync the backend and create the storage bucket.
                  </p>
                ) : null}
              </div>
            )}

            {isUploading && (
              <div className="flex items-center justify-center py-4">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mr-2" />
                <p className="text-sm text-muted-foreground">Getting you camera-ready...</p>
              </div>
            )}
          </motion.div>
        );

      case "coupleYourName":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Your name</h2>
              <p className="text-muted-foreground">What should we call you?</p>
            </div>
            <div>
              <Label htmlFor="coupleName" className="text-base mb-3 block">Name</Label>
              <Input
                id="coupleName"
                placeholder="Your name"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value.trim() }))}
                className="text-base"
              />
            </div>
          </motion.div>
        );

      case "couplePhotoUpload":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Add your photo</h2>
              <p className="text-muted-foreground">Your best shot – prom-ready vibes only</p>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" id="couple-photo-upload" />
            <div className="space-y-4">
              <Label htmlFor="couple-photo-upload" className="text-base mb-3 block text-center">
                {previewUrl ? "Profile photo" : "Upload your photo"}
              </Label>
              {previewUrl ? (
                <div className="space-y-3">
                  <div className="w-32 h-32 mx-auto rounded-full overflow-hidden border-2 border-border bg-muted cursor-pointer" onClick={() => setShowExpandedImage(true)}>
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                  <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    Change photo
                  </Button>
                </div>
              ) : (
                <label htmlFor="couple-photo-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                  <ImageIcon className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-semibold">Click to upload</p>
                  <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB</p>
                </label>
              )}
            </div>
            {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
            {isUploading && <div className="flex items-center justify-center py-4"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
          </motion.div>
        );

      case "couplePartnerType":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Where&apos;s your plus-one from?</h2>
              <p className="text-muted-foreground">Same campus or bringing someone from the outside world?</p>
            </div>
            <div className="flex flex-col gap-3">
              <Button
                variant={profile.partnerType === "iima" ? "default" : "outline"}
                className="h-14 w-full"
                onClick={() => { setProfile(prev => ({ ...prev, partnerType: "iima" })); setStep("couplePartnerIIMA"); }}
              >
                Campus cutie – fellow IIMA-er
              </Button>
              <Button
                variant={profile.partnerType === "outside" ? "default" : "outline"}
                className="h-14 w-full"
                onClick={() => { setProfile(prev => ({ ...prev, partnerType: "outside" })); setStep("couplePartnerOutside"); }}
              >
                My date&apos;s from beyond campus
              </Button>
            </div>
          </motion.div>
        );

      case "couplePartnerOutside":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Your partner&apos;s name</h2>
              <p className="text-muted-foreground">That&apos;s all we need – you&apos;re all set!</p>
            </div>
            <div>
              <Label htmlFor="partnerNameOutside" className="text-base mb-3 block">Partner&apos;s name</Label>
              <Input
                id="partnerNameOutside"
                placeholder="Partner's name"
                value={profile.partnerName}
                onChange={(e) => setProfile(prev => ({ ...prev, partnerName: e.target.value }))}
                className="text-base"
              />
            </div>
          </motion.div>
        );

      case "couplePartnerIIMA":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Your partner</h2>
              <p className="text-muted-foreground">Partner&apos;s name and IIMA email – we&apos;ll link you two.</p>
            </div>
            <div>
              <Label htmlFor="partnerName" className="text-base mb-3 block">Partner&apos;s name</Label>
              <Input
                id="partnerName"
                placeholder="Partner's name"
                value={profile.partnerName}
                onChange={(e) => {
                  setProfile((prev) => ({ ...prev, partnerName: e.target.value }));
                  setPartnerEmailError(null);
                }}
                className="text-base"
              />
            </div>
            <div>
              <Label htmlFor="partnerEmail" className="text-base mb-3 block">Partner&apos;s IIMA email</Label>
              <Input
                id="partnerEmail"
                type="email"
                placeholder="partner@iima.ac.in"
                value={profile.partnerEmail}
                onChange={(e) => {
                  setProfile((prev) => ({ ...prev, partnerEmail: e.target.value }));
                  setPartnerEmailError(null);
                  setPartnerCheckStatus("idle");
                }}
                onBlur={() => {
                  const email = profile.partnerEmail.trim().toLowerCase();
                  if (email && !email.endsWith(IIMA_EMAIL_SUFFIX)) {
                    setPartnerEmailError("Please enter a valid @iima.ac.in email");
                    setPartnerCheckStatus("idle");
                  } else if (email && email === profile.email.trim().toLowerCase()) {
                    setPartnerEmailError("You cannot add your own email");
                    setPartnerCheckStatus("idle");
                  } else {
                    setPartnerEmailError(null);
                    if (email) void checkPartnerRegistered(email);
                  }
                }}
                className="text-base"
              />
              {partnerEmailError && (
                <p className="text-sm text-destructive mt-2">{partnerEmailError}</p>
              )}
              {partnerCheckStatus === "checking" && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Checking if they&apos;re on Prom Connect...
                </p>
              )}
              {partnerCheckStatus === "registered" && (
                <p className="text-sm text-green-600 dark:text-green-400 mt-2 flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  They&apos;re on Prom Connect – they&apos;ll get a match request when they accept.
                </p>
              )}
              {partnerCheckStatus === "not_registered" && (
                <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                  No profile yet – we&apos;ll send them an invite to join.
                </p>
              )}
            </div>
          </motion.div>
        );

      default:
        return null;
    }
  };

  // Show loading while checking auth
  if (isCheckingAuth) {
    return (
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center w-full">
        <SparkleBackground />
        <div className="relative z-10 text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Show auth required modal
  if (showAuthModal || !isAuthenticated) {
    return (
      <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4 w-full">
        <SparkleBackground />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-sm"
        >
          <div className="glass rounded-2xl p-6 text-center border border-destructive/20">
            <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Hey, you need to sign in first</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Prom Connect is IIMA-only – sign in with your campus email to get started.
            </p>
            <Button 
              variant="gold" 
              className="w-full"
              onClick={() => navigate("/auth")}
            >
              Go to Sign In
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Show only the centered banner if email is invalid
  if (isValidEmail === false) {
    return (
      <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4 w-full">
        <SparkleBackground />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md mx-auto"
        >
          <div className="glass rounded-3xl p-8 md:p-10 border border-white/20 shadow-float relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10 pointer-events-none" />
            
            <div className="relative z-10 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6 border border-destructive/30"
              >
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </motion.div>

              <h2 className="font-display text-2xl md:text-3xl font-bold mb-3 text-foreground">
                IIMA Community Only
              </h2>

              <p className="text-muted-foreground mb-2 leading-relaxed">
                Prom matchmaking is exclusively for the IIMA community.
              </p>
              <p className="text-muted-foreground mb-8 leading-relaxed">
                Please sign in with your{" "}
                <span className="text-primary font-semibold">@iima.ac.in</span> email address.
              </p>

              <Button
                variant="gold"
                size="lg"
                className="w-full"
                onClick={handleSignOut}
              >
                Sign Out & Try Again
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col w-full">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col w-full max-w-[500px] mx-auto">
        {/* Onboarding header: back, step counter, logout on same line; progress bar below */}
        <header className="shrink-0 border-b border-primary/20 bg-background/70 backdrop-blur-md">
          <div className="px-4 pt-4 pb-4">
            {/* Single row: Back | Step counter | Log out */}
            <div className="flex items-center justify-between gap-3 mb-3">
              {currentStepIndex > 0 ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="gap-1.5 shrink-0 border-primary/30 text-foreground/90 hover:bg-primary/10 hover:text-foreground hover:border-primary/50"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Button>
              ) : (
                <div className="w-16 shrink-0" aria-hidden />
              )}
              <span className="font-display text-sm font-semibold text-foreground shrink-0">
                Step {currentStepIndex + 1} of {totalSteps}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="gap-1.5 shrink-0 rounded-full px-3 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </Button>
            </div>
            {/* Progress bar */}
            <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary shadow-[0_0_12px_rgba(212,168,75,0.4)]"
                initial={{ width: 0 }}
                animate={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-4 sm:p-6 w-full min-h-0">
          <div className="w-full max-w-md mx-auto">
            <div className="glass rounded-3xl p-6 sm:p-8 md:p-10">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Next Button (hidden on choice/partnerRequest/couplePartnerType – user picks option to advance) */}
        {step !== "choice" && step !== "partnerRequest" && step !== "couplePartnerType" && (
          <div className="px-4 pb-6 pt-4">
            {saveError && (
              <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive text-center">{saveError}</p>
              </div>
            )}
            <Button
              variant="gold"
              size="lg"
              className="w-full h-14 text-base font-semibold"
              onClick={nextStep}
              disabled={!canProceed() || isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin mr-2" />
                  Almost there...
                </>
              ) : (
                <>
                  Let&apos;s go
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Expanded Image Modal */}
      <AnimatePresence>
        {showExpandedImage && previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setShowExpandedImage(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewUrl}
                alt="Profile preview"
                className="w-full h-auto max-h-[90vh] object-contain rounded-lg"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setShowExpandedImage(false)}
              >
                <X className="w-5 h-5" />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
