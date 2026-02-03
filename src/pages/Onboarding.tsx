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
import { ImageEditor } from "@/components/ImageEditor";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { signOut } from "aws-amplify/auth";
import { uploadData } from "aws-amplify/storage";
import { getUserProfile, hasCompletedOnboarding, clearTestUser } from "@/utils/auth";
import { ArrowRight, ArrowLeft, AlertTriangle, Bell, Check, Heart, LogOut, Mail, Upload, Image as ImageIcon, UserX, X } from "lucide-react";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

type OnboardingStep = 
  | "choice"           // First: "Looking for a date" vs "Already a couple"
  | "welcome" 
  | "dateOfBirth" 
  | "notifications" 
  | "ageCohortGender" 
  | "sexualityIntention" 
  | "hometown"
  | "lifestyle"
  | "photoUpload"
  | "coupleYourName"   // Couple flow: your name
  | "couplePartnerDetails"; // Couple flow: partner name + email

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

// Simplified couple flow (after "Already a couple")
const COUPLE_FLOW_STEPS: OnboardingStep[] = ["coupleYourName", "couplePartnerDetails"];

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
  const [flowChoice, setFlowChoice] = useState<"full" | "couple" | null>(null); // Set when user picks at choice step
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
    alcoholPreference: "",
    smokingPreference: "",
    foodPreference: "",
    favouritePlace: "",
    teaOrCoffee: "",
    mountainOrBeach: "",
    bio: "",
  });

  const [partnerEmailError, setPartnerEmailError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null); // For image editor
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Current steps: choice only, or full flow, or couple flow
  const effectiveSteps =
    flowChoice === null
      ? CHOICE_STEP
      : flowChoice === "full"
        ? FULL_FLOW_STEPS
        : COUPLE_FLOW_STEPS;
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
            navigate("/discover/profile");
            return;
          }
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

  // Handle file selection - show image editor
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

    // Create preview URL and show editor
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      setOriginalImageUrl(imageUrl);
      setShowImageEditor(true);
    };
    reader.readAsDataURL(file);
  };

  // Handle image editor save (cropped image)
  const handleImageEditorSave = (croppedImageUrl: string) => {
    // Convert blob URL back to File
    fetch(croppedImageUrl)
      .then((res) => res.blob())
      .then((blob) => {
        const file = new File([blob], "profile.jpg", { type: "image/jpeg" });
        setSelectedFile(file);
        setPreviewUrl(croppedImageUrl);
        setShowImageEditor(false);
        setOriginalImageUrl(null);
      })
      .catch((err) => {
        console.error("Error processing cropped image:", err);
        setUploadError("Failed to process image");
      });
  };

  // Handle image editor cancel
  const handleImageEditorCancel = () => {
    setShowImageEditor(false);
    setOriginalImageUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle file removal
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setOriginalImageUrl(null);
    setShowImageEditor(false);
    setProfile(prev => ({ ...prev, profilePicKey: "" }));
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // When user picks "Looking for a date" or "Already a couple" at the choice step
  const handleChoice = (option: (typeof partnerStatusOptions)[number]) => {
    setProfile(prev => ({ ...prev, partnerStatus: option }));
    if (option === "Still looking for my prom date 💫") {
      setFlowChoice("full");
      setStep("welcome");
    } else {
      setFlowChoice("couple");
      setStep("coupleYourName");
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
<<<<<<< HEAD
=======

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
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)

      // Check if storage is configured in amplify_outputs.json
      if (!(outputs as any).storage) {
        const errorMsg = "Storage bucket is not configured. Please run 'npx ampx sandbox' in the project root to sync the backend and create the S3 storage bucket.";
        console.error("[Onboarding] Storage not configured in amplify_outputs.json");
        console.error("[Onboarding] Available outputs:", Object.keys(outputs));
        throw new Error(errorMsg);
      }

<<<<<<< HEAD
      // Upload to S3 - use path callback to get the Cognito Identity ID
      // The path pattern 'profile-pics/{entity_id}/*' requires the actual Cognito Identity ID
      // Amplify will resolve {entity_id} to the identity ID via the path callback
      const result = await uploadData({
        path: ({ identityId }) => {
          // identityId is the Cognito Identity ID (even in test mode, Amplify creates an unauthenticated identity)
          if (!identityId) {
            throw new Error("Unable to get identity ID for S3 upload. Please ensure you're signed in.");
          }
          return `profile-pics/${identityId}/${fileName}`;
        },
=======
      // Upload to S3 - path callback ensures we use Cognito Identity ID (required by IAM policy)
      const result = await uploadData({
        path: pathFn,
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
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
<<<<<<< HEAD
=======
      let uploadedS3Key: string | undefined;
      // If photo is selected but not uploaded yet, upload it first
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
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
<<<<<<< HEAD
      await saveProfileToBackend();
=======
      
<<<<<<< HEAD
      // If we're on the last step (photoUpload), save profile to backend
      // Pass uploadedS3Key directly - React setState is async, so profile.profilePicKey may not be updated yet
      if (nextIndex >= steps.length) {
        await saveProfileToBackend(uploadedS3Key);
        return;
      }
=======
      // photoUpload is the last step — save profile to backend
      // Pass uploadedS3Key directly - React setState is async, so profile.profilePicKey may not be updated yet
      await saveProfileToBackend(uploadedS3Key);
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
      return;
    }

    // Couple flow: last step is couplePartnerDetails → save minimal and redirect
    if (step === "couplePartnerDetails") {
      await saveCoupleToBackend();
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
<<<<<<< HEAD
=======
      
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
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)

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
<<<<<<< HEAD
          profilePicKey: profile.profilePicKey || undefined,
          alcoholPreference: profile.alcoholPreference || undefined,
          smokingPreference: profile.smokingPreference || undefined,
          foodPreference: profile.foodPreference || undefined,
          favouritePlace: profile.favouritePlace || undefined,
          teaOrCoffee: profile.teaOrCoffee || undefined,
          mountainOrBeach: profile.mountainOrBeach || undefined,
          bio: profile.bio || undefined,
=======
          profilePicKey: profilePicKeyToSave || undefined,
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
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
        navigate("/discover/profile");
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

  const saveCoupleToBackend = async () => {
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
        bio: profile.partnerName.trim() ? `Partner: ${profile.partnerName.trim()}` : undefined,
        onboardingCompleted: true,
      };

      if (existingProfiles?.length) {
        // @ts-ignore - update args
        await client.models.UserProfile.update(
          { id: existingProfiles[0].id, ...minimalData },
          { authMode: authMode as "userPool" | "apiKey" }
        );
      } else {
        // @ts-ignore - create args
        await client.models.UserProfile.create(minimalData, { authMode: authMode as "userPool" | "apiKey" });
      }

      const currentUserId = currentUser?.userId ?? existingProfiles?.[0]?.id ?? "";
      const currentUserEmail = profile.email.trim().toLowerCase();
      try {
        // @ts-ignore - authMode
        const { data: partnerProfiles } = await client.models.UserProfile.list(
          { filter: { email: { eq: partnerEmailTrim } } },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        const partner = partnerProfiles?.[0];
        // @ts-ignore - MatchRequest create
        await client.models.MatchRequest.create(
          {
            fromUserId: currentUserId,
            fromEmail: currentUserEmail,
            fromName: profile.name || undefined,
            toEmail: partnerEmailTrim,
            toUserId: partner?.userId ?? undefined,
            status: "pending",
            createdAt: new Date().toISOString(),
          },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        if (!partner) {
          try {
            const appUrl = (await import("@/config")).APP_URL;
            await client.queries.sendPartnerInviteEmail({
              toEmail: partnerEmailTrim,
              fromName: profile.name || "Someone",
              appUrl,
            });
          } catch (_) {}
        }
      } catch (reqErr) {
        console.warn("[Onboarding] MatchRequest/invite failed:", reqErr);
      }

      let hasPending = false;
      try {
        // @ts-ignore - MatchRequest list
        const { data: requestsToMe } = await client.models.MatchRequest.listMatchRequestByToEmail(
          { toEmail: currentUserEmail },
          { authMode: authMode as "userPool" | "apiKey" }
        );
        hasPending = (requestsToMe ?? []).some((r: { status: string }) => r.status === "pending");
      } catch (_) {}
      navigate(hasPending ? "/matches" : "/discover/profile");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const prevStep = () => {
    // From first step of a flow, go back to choice
    if (step === "welcome" || step === "coupleYourName") {
      setStep("choice");
      setFlowChoice(null);
      return;
    }
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(effectiveSteps[prevIndex]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "choice":
        return true; // Advance via option buttons, not Next
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
      case "couplePartnerDetails": {
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
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <Heart className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="font-display text-2xl font-bold mb-2">Are you here for a date or already a couple?</h2>
              <p className="text-muted-foreground">
                We’ll tailor the next steps to you.
              </p>
            </div>
            <div className="space-y-3">
              {partnerStatusOptions.map((option) => (
                <Button
                  key={option}
                  variant={profile.partnerStatus === option ? "default" : "outline"}
                  className="w-full h-14 text-base justify-start px-6"
                  onClick={() => handleChoice(option)}
                >
                  <span className="w-5 h-5 mr-3 flex items-center justify-center shrink-0">
                    {profile.partnerStatus === option ? <Check className="w-5 h-5" /> : null}
                  </span>
                  {option}
                </Button>
              ))}
            </div>
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
<<<<<<< HEAD
              Hey {profile.name || "you"} 👋
=======
              Hi.
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Prom 2026 is calling – and so is your future date.{" "}
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
<<<<<<< HEAD
              <h2 className="font-display text-2xl font-bold mb-2">When did you enter this world?</h2>
              <p className="text-muted-foreground">So we know you&apos;re old enough to dance the night away</p>
=======
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
>>>>>>> ee807f5 (feat: mutual likes, match popup, Matches from backend, onboarding & discover UX)
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
              <Label className="text-base mb-3 block">Mess or outside?</Label>
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

            {/* Upload area */}
            {!previewUrl && !profile.profilePicKey ? (
              <div className="space-y-4">
                <Label htmlFor="photo-upload" className="text-base mb-3 block">
                  Drop your best pic
                </Label>
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="mb-2 text-sm text-foreground">
                      <span className="font-semibold">Tap to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF – max 5MB (no potato quality pls)
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <Label className="text-base mb-3 block text-center">Your profile photo</Label>
                <div className="relative w-48 h-48 mx-auto">
                  {/* Circular preview */}
                  <div className="relative w-full h-full rounded-full overflow-hidden border-4 border-primary/20 bg-muted shadow-lg ring-4 ring-background">
                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt="Profile preview"
                        className="w-full h-full object-cover"
                      />
                    ) : profile.profilePicKey ? (
                      <div className="w-full h-full flex flex-col items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-muted-foreground mb-2" />
                        <p className="text-xs text-muted-foreground text-center px-2">Uploaded</p>
                      </div>
                    ) : null}
                  </div>
                  {/* Remove button */}
                  {previewUrl && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-8 w-8 rounded-full shadow-lg"
                      onClick={handleRemoveFile}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
                {!profile.profilePicKey && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change photo
                    </Button>
                  </div>
                )}
              </div>
            )}

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

      case "couplePartnerDetails":
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
                }}
                onBlur={() => {
                  const email = profile.partnerEmail.trim().toLowerCase();
                  if (email && !email.endsWith(IIMA_EMAIL_SUFFIX)) {
                    setPartnerEmailError("Please enter a valid @iima.ac.in email");
                  } else if (email && email === profile.email.trim().toLowerCase()) {
                    setPartnerEmailError("You cannot add your own email");
                  } else {
                    setPartnerEmailError(null);
                  }
                }}
                className="text-base"
              />
              {partnerEmailError && (
                <p className="text-sm text-destructive mt-2">{partnerEmailError}</p>
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
      <div className="min-h-dvh bg-gradient-midnight flex items-center justify-center">
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
      <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
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
      <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex items-center justify-center p-4">
        <SparkleBackground />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-md"
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
    <div className="min-h-dvh bg-gradient-midnight relative overflow-hidden flex flex-col">
      <SparkleBackground />

      <div className="relative z-10 flex-1 flex flex-col">
        {/* Back Button, Progress Indicator, and Logout */}
        <div className="px-4 pt-4 pb-3">
          {/* Top row: Back Button and Logout */}
          <div className="flex items-center justify-between mb-3">
            {/* Back Button */}
            {currentStepIndex > 0 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={prevStep}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Oops, go back
                </Button>
            ) : (
              <div /> // Spacer to keep logout aligned right
            )}
            
            {/* Logout Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-1" />
              Logout
            </Button>
          </div>
          
          {/* Progress Indicator */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">
              {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-sm text-muted-foreground">
              {totalSteps - currentStepIndex - 1} to go – almost there!
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="glass rounded-3xl p-6 md:p-8">
              <AnimatePresence mode="wait">
                {renderStep()}
              </AnimatePresence>
            </div>
          </div>
        </main>

        {/* Next Button (hidden on choice step – user picks an option to advance) */}
        {step !== "choice" && (
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

      {/* Image Editor Modal */}
      <AnimatePresence>
        {showImageEditor && originalImageUrl && (
          <ImageEditor
            imageUrl={originalImageUrl}
            onSave={handleImageEditorSave}
            onCancel={handleImageEditorCancel}
            aspectRatio={1}
            shape="circle"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Onboarding;
