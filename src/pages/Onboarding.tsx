import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowRight, ArrowLeft, AlertTriangle, Bell, Check, LogOut, Upload, Image as ImageIcon, X } from "lucide-react";
import { GOOGLE_LOGIN_CHECK } from "@/config";
import { Amplify } from "aws-amplify";
import outputs from "../../amplify_outputs.json";
import "@aws-amplify/ui-react/styles.css";

Amplify.configure(outputs);

const client = generateClient<Schema>();

type OnboardingStep = 
  | "welcome" 
  | "dateOfBirth" 
  | "notifications" 
  | "ageCohortGender" 
  | "sexualityIntention" 
  | "hometown"
  | "photoUpload";

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
}

const steps: OnboardingStep[] = [
  "welcome",
  "dateOfBirth",
  "notifications",
  "ageCohortGender",
  "sexualityIntention",
  "hometown",
  "photoUpload",
];

const cohorts = ["PGP1", "PGP2", "PGPX", "PhD", "AA", "Staff", "Other"];
const genders = ["Man", "Woman", "Non-Binary"];
const sexualities = ["Straight", "Gay", "Bisexual", "Queer"];
const intentions = ["Date for Prom", "Long Term", "Not Sure"];

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
  const [step, setStep] = useState<OnboardingStep>("welcome");
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
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  
  // Photo upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;

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
          
          // Pre-populate name and email from Google
          setProfile(prev => ({
            ...prev,
            name: authProfile.name || "",
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

  // Handle file selection
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

    setSelectedFile(file);
    setUploadError(null);

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

  // Upload photo to S3
  const uploadPhotoToS3 = async (file: File): Promise<string> => {
    setIsUploading(true);
    setUploadError(null);

    try {
      // Get current user to use their ID as part of the path
      const currentUser = await getUserProfile();
      const userId = currentUser?.userId || currentUser?.email?.replace(/[^a-zA-Z0-9]/g, "_") || "anonymous";
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = file.name.split('.').pop() || 'jpg';
      const fileName = `profile-${timestamp}.${fileExtension}`;
      
      // For Amplify Gen 2, the path pattern uses {entity_id} which gets replaced
      // with the authenticated user's identity ID. In test mode, we'll use the userId directly.
      // The storage definition pattern is: profile-pics/{entity_id}/*
      // But we need to use the actual path format that matches the access pattern
      const s3Path = `profile-pics/${userId}/${fileName}`;

      console.log("[Onboarding] Uploading photo to S3:", {
        path: s3Path,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        userId,
        storageConfigured: !!(outputs as any).storage,
        outputsKeys: Object.keys(outputs),
      });

      // Check if storage is configured in amplify_outputs.json
      // If not, the backend needs to be synced with 'npx ampx sandbox'
      if (!(outputs as any).storage) {
        const errorMsg = "Storage bucket is not configured. Please run 'npx ampx sandbox' in the project root to sync the backend and create the S3 storage bucket.";
        console.error("[Onboarding] Storage not configured in amplify_outputs.json");
        console.error("[Onboarding] Available outputs:", Object.keys(outputs));
        throw new Error(errorMsg);
      }

      // Upload to S3 using the storage bucket
      // The path should match the storage definition pattern: profile-pics/{entity_id}/*
      // Specify the storage resource name 'userPhotos' as defined in amplify/data/resource.ts
      const result = await uploadData({
        path: s3Path,
        data: file,
        options: {
          contentType: file.type,
          bucket: 'userPhotos', // Storage resource name from amplify/data/resource.ts
        },
      }).result;

      console.log("[Onboarding] Photo uploaded successfully:", result);
      
      // Return the S3 key (path)
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
    const nextIndex = currentStepIndex + 1;
    
    // Handle photo upload step
    if (step === "photoUpload") {
      // If photo is selected but not uploaded yet, upload it first
      if (selectedFile && !profile.profilePicKey) {
        try {
          setIsUploading(true);
          setUploadError(null);
          const s3Key = await uploadPhotoToS3(selectedFile);
          setProfile(prev => ({ ...prev, profilePicKey: s3Key }));
          console.log("[Onboarding] Photo uploaded, S3 key:", s3Key);
        } catch (error) {
          setUploadError(error instanceof Error ? error.message : "Failed to upload photo");
          setIsUploading(false);
          return; // Don't proceed if upload fails
        }
      }
      
      // If we're on the last step (photoUpload), save profile to backend
      if (nextIndex >= steps.length) {
        await saveProfileToBackend();
        return;
      }
    }
    
    if (nextIndex < steps.length) {
      setStep(steps[nextIndex]);
    } else {
      // This should not happen as photoUpload is now the last step
      await saveProfileToBackend();
    }
  };

  const saveProfileToBackend = async () => {
    console.log("[Onboarding] ========================================");
    console.log("[Onboarding] Starting profile save process...");
    console.log("[Onboarding] Step: photoUpload (final step)");
    setIsSaving(true);
    setSaveError(null);
    
    try {
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
        profilePicKey: profile.profilePicKey,
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
          profilePicKey: profile.profilePicKey || undefined,
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
        console.log("[Onboarding] Navigating to discover page...");
        console.log("[Onboarding] ========================================");
        // Successfully saved - navigate to discover
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

  const prevStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "welcome":
        return true;
      case "dateOfBirth":
        return profile.dateOfBirth.length === 10 && profile.age !== null;
      case "notifications":
        return true; // Optional
      case "ageCohortGender":
        return profile.cohort !== "" && profile.gender !== "";
      case "sexualityIntention":
        return profile.sexualOrientation !== "" && profile.intention !== "";
      case "hometown":
        return profile.hometown.trim() !== "";
      case "photoUpload":
        return profile.profilePicKey !== "" || selectedFile !== null;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 text-center"
          >
            <h2 className="font-display text-3xl font-bold mb-4">
              Hi {profile.name || "there"},
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Get ready to match with someone for Prom{" "}
              <span className="text-primary">(and maybe more)</span>.
            </p>
            <p className="text-muted-foreground mt-4">
              Next, we require your details to create your profile.
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
              <h2 className="font-display text-2xl font-bold mb-2">Date of Birth</h2>
              <p className="text-muted-foreground">Enter your date of birth</p>
            </div>
            <div>
              <Label htmlFor="dateOfBirth" className="text-base mb-3 block">
                Date of Birth (DD MM YYYY)
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
              <h2 className="font-display text-2xl font-bold mb-2">Enable Notifications</h2>
              <p className="text-muted-foreground">
                Stay updated about matches and messages through browser and email notifications
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
                  Notifications Enabled
                </>
              ) : (
                <>
                  <Bell className="w-5 h-5 mr-2" />
                  Enable Notifications
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              You can change this later in settings
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
                Gender
              </Label>
              <Select
                value={profile.gender}
                onValueChange={(value) => setProfile(prev => ({ ...prev, gender: value }))}
              >
                <SelectTrigger id="gender" className="h-12 text-base">
                  <SelectValue placeholder="How do you identify?" />
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
                Intention
              </Label>
              <Select
                value={profile.intention}
                onValueChange={(value) => setProfile(prev => ({ ...prev, intention: value }))}
              >
                <SelectTrigger id="intention" className="h-12 text-base">
                  <SelectValue placeholder="What are you looking for?" />
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

      case "photoUpload":
        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="text-center mb-6">
              <h2 className="font-display text-2xl font-bold mb-2">Profile Photo</h2>
              <p className="text-muted-foreground">Upload a photo of yourself</p>
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
                  Select Photo
                </Label>
                <label
                  htmlFor="photo-upload"
                  className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="mb-2 text-sm text-foreground">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground">
                      PNG, JPG, GIF up to 5MB
                    </p>
                  </div>
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <Label className="text-base mb-3 block">Profile Photo</Label>
                <div className="relative w-full aspect-square max-w-xs mx-auto rounded-xl overflow-hidden border-2 border-border bg-muted">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="Profile preview"
                      className="w-full h-full object-cover"
                    />
                  ) : profile.profilePicKey ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground ml-2">Photo uploaded</p>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={handleRemoveFile}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                {!profile.profilePicKey && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Photo
                  </Button>
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
                <p className="text-sm text-muted-foreground">Uploading photo...</p>
              </div>
            )}
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
            <h2 className="font-display text-xl font-bold mb-2">Sign In Required</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You need to sign in with your IIMA account to continue with onboarding.
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
                Back
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
              Step {currentStepIndex + 1} of {totalSteps}
            </span>
            <span className="text-sm text-muted-foreground">
              {totalSteps - currentStepIndex - 1} steps remaining
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

        {/* Next Button */}
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
                Saving...
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
