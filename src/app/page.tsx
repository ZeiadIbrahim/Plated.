"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [url, setUrl] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [authUserEmail, setAuthUserEmail] = useState<string | null>(null);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileFirstName, setProfileFirstName] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState("");
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const [profileAvatarError, setProfileAvatarError] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [usedPrompts, setUsedPrompts] = useState<string[]>([]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const baseSuggestions = useMemo(() => {
    if (!recipe) return [] as string[];
    const ingredientText = recipe.ingredients
      .map((item) => item.item)
      .join(" ")
      .toLowerCase();
    const instructionsText = recipe.instructions.join(" ").toLowerCase();
    const has = (pattern: RegExp) => pattern.test(ingredientText);
    const suggestions: string[] = [];

    if (has(/\bsalt\b/)) {
      suggestions.push("How can I reduce the salt?");
    }
    if (has(/\b(butter|cream|milk|cheese|yogurt|dairy)\b/)) {
      suggestions.push("Suggest a dairy-free substitute.");
    }
    if (has(/\begg/)) {
      suggestions.push("What can I use instead of eggs?");
    }
    if (has(/\b(flour|wheat|breadcrumbs|bread|pasta|gluten)\b/)) {
      suggestions.push("How can I make this gluten-free?");
    }
    if (has(/\b(sugar|honey|maple|sweetener|syrup)\b/)) {
      suggestions.push("How do I reduce the sugar?");
    }
    if (has(/\b(chicken|beef|pork|turkey|fish|salmon|tuna|shrimp)\b/)) {
      suggestions.push("How can I make this vegetarian?");
    }
    if (/\b(bake|roast)\b/.test(instructionsText)) {
      suggestions.push("Any tips for a crispier finish?");
    }

    const evergreen = [
      "Can I make this ahead of time?",
      "How should I store leftovers?",
      "What sides pair well with this?",
      "How do I scale this for a crowd?",
    ];

    return Array.from(new Set([...suggestions, ...evergreen]));
  }, [recipe]);
  const chatSuggestions = useMemo(() => {
    if (!recipe) return [] as string[];
    const lastUser = [...chatMessages]
      .reverse()
      .find((message) => message.role === "user")?.content
      .toLowerCase();
    const contextual: string[] = [];

    if (lastUser?.includes("gluten")) {
      contextual.push("What swaps keep the texture similar?");
    }
    if (lastUser?.includes("dairy")) {
      contextual.push("Will the flavor change with the swap?");
    }
    if (lastUser?.includes("egg")) {
      contextual.push("How should I adjust baking time?");
    }
    if (lastUser?.includes("salt") || lastUser?.includes("sodium")) {
      contextual.push("How can I keep it flavorful without salt?");
    }
    if (lastUser?.includes("vegetarian") || lastUser?.includes("vegan")) {
      contextual.push("What protein swap works best here?");
    }

    const unique = Array.from(
      new Set([...contextual, ...baseSuggestions])
    ).filter((prompt) => !usedPrompts.includes(prompt));

    return unique.slice(0, 4);
  }, [baseSuggestions, chatMessages, recipe, usedPrompts]);

  const normalizeAvatarUrl = (value: unknown) => {
    if (typeof value !== "string") return "";
    if (!value.trim()) return "";
    return value;
  };

  const persistHeaderIdentity = (avatar: string | null, initial: string) => {
    if (typeof window === "undefined") return;
    if (avatar) {
      localStorage.setItem("plated.avatar", avatar);
    } else {
      localStorage.removeItem("plated.avatar");
    }
    localStorage.setItem("plated.initial", initial);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const cachedAvatar = localStorage.getItem("plated.avatar");
    const cachedInitial = localStorage.getItem("plated.initial");
    if (cachedAvatar) {
      setHeaderAvatarUrl(cachedAvatar);
    }
    if (cachedInitial) {
      setProfileFirstName(cachedInitial);
    }
  }, []);

  useEffect(() => {
    if (!recipe) return;
    setChatMessages([
      {
        role: "assistant",
        content:
          "Ask me about substitutions, timing, or how to adjust this recipe.",
      },
    ]);
    setChatInput("");
    setChatError(null);
    setChatOpen(false);
    setUsedPrompts([]);
  }, [recipe]);

  useEffect(() => {
    if (!chatOpen) return;
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [chatMessages, chatLoading, chatOpen]);

  const strengthScore = (() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (password.length >= 12) score += 1;
    return Math.min(score, 4);
  })();

  const strengthLabel =
    strengthScore <= 1
      ? "Weak"
      : strengthScore === 2
        ? "Medium"
        : "Strong";

  const strengthColor =
    strengthScore <= 1
      ? "bg-[#D9534F]"
      : strengthScore === 2
        ? "bg-[#111111]/60"
        : "bg-[#111111]";

  const strengthWidths = [12, 40, 65, 85, 100];
  const strengthWidth = strengthWidths[strengthScore] ?? 12;

  const resetAuthState = () => {
    setAuthError(null);
    setAuthSuccess(null);
  };

  async function loadProfile() {
    setProfileError(null);
    setProfileMessage(null);
    setProfileLoading(true);

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      const message = error?.message ?? "Unable to load profile.";
      if (message.includes("User from sub claim in JWT does not exist")) {
        await supabase.auth.signOut();
        setIsSignedIn(false);
        setShowProfile(false);
        setShowAuth(true);
      } else {
        setProfileError(message);
      }
      setProfileLoading(false);
      return;
    }

    const metadata = data.user.user_metadata ?? {};
    const inferredName =
      metadata.full_name ??
      metadata.name ??
      metadata.given_name ??
      metadata.first_name ??
      "";
    setProfileFirstName(
      (metadata.first_name ?? inferredName)?.split(" ")[0] ?? ""
    );
    setProfileBio(metadata.bio ?? "");
    const avatarSource = normalizeAvatarUrl(
      metadata.avatar_url ?? metadata.picture
    );
    setProfileAvatarError(false);
    setProfileAvatarUrl(avatarSource);
    setProfileAvatarPreview(avatarSource);
    setProfileLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsSignedIn(!!data.session);
      setAuthUserEmail(data.session?.user.email ?? null);
      setAuthChecking(false);
      if (data.session) {
        const { data: userData } = await supabase.auth.getUser();
        const metadata = userData.user?.user_metadata ?? {};
        const inferredName =
          metadata.full_name ??
          metadata.name ??
          metadata.given_name ??
          metadata.first_name ??
          "";
        const firstName =
          (metadata.first_name ?? inferredName)?.split(" ")[0] ?? "";
        setProfileFirstName(firstName);
        const avatarUrl = normalizeAvatarUrl(metadata.avatar_url ?? metadata.picture);
        setHeaderAvatarError(false);
        setHeaderAvatarUrl(avatarUrl || null);
        persistHeaderIdentity(avatarUrl || null, (firstName?.[0] ?? "P").toUpperCase());
      } else {
        setHeaderAvatarUrl(null);
      }
    };

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setIsSignedIn(!!session);
        setAuthUserEmail(session?.user.email ?? null);
        if (!session) {
          setHeaderAvatarUrl(null);
          setProfileFirstName("");
          persistHeaderIdentity(null, "P");
        } else {
          supabase.auth.getUser().then(({ data: userData }) => {
            const metadata = userData.user?.user_metadata ?? {};
            const inferredName =
              metadata.full_name ??
              metadata.name ??
              metadata.given_name ??
              metadata.first_name ??
              "";
            const firstName =
              (metadata.first_name ?? inferredName)?.split(" ")[0] ?? "";
            setProfileFirstName(firstName);
            const avatarUrl = normalizeAvatarUrl(
              metadata.avatar_url ?? metadata.picture
            );
            setHeaderAvatarError(false);
            setHeaderAvatarUrl(avatarUrl || null);
            persistHeaderIdentity(avatarUrl || null, (firstName?.[0] ?? "P").toUpperCase());
          });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const wantsAuth = searchParams.get("auth") === "1";
    const wantsProfile = searchParams.get("profile") === "1";

    if (wantsAuth) {
      setShowAuth(true);
      router.replace("/");
      return;
    }

    if (wantsProfile) {
      if (isSignedIn) {
        setShowProfile(true);
        loadProfile();
      } else {
        setShowAuth(true);
      }
      router.replace("/");
    }
  }, [isSignedIn, router, searchParams]);

  const handleProfileSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileError(null);
    setProfileMessage(null);
    setProfileLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setProfileError(userError?.message ?? "Unable to load profile.");
      setProfileLoading(false);
      return;
    }

    let avatarUrl = profileAvatarUrl;

    if (profileAvatarFile) {
      const fileExt = profileAvatarFile.name.split(".").pop() ?? "png";
      const filePath = `${userData.user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, profileAvatarFile, { upsert: true });

      if (uploadError) {
        setProfileError(uploadError.message);
        setProfileLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      avatarUrl = publicUrlData.publicUrl;
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        first_name: profileFirstName,
        full_name: profileFirstName,
        bio: profileBio,
        avatar_url: avatarUrl,
      },
    });

    if (error) {
      setProfileError(error.message);
      setProfileLoading(false);
      return;
    }

    setHeaderAvatarError(false);
    setHeaderAvatarUrl(avatarUrl ?? null);
    persistHeaderIdentity(avatarUrl ?? null, (profileFirstName?.[0] ?? "P").toUpperCase());
    setProfileFirstName(profileFirstName);
    setProfileMessage("Profile updated successfully.");
    setProfileLoading(false);
  };

  const handleSignOut = async () => {
    setProfileError(null);
    setProfileMessage(null);
    await supabase.auth.signOut();
    setIsSignedIn(false);
    setShowProfile(false);
  };

  const handleDeleteAccount = async () => {
    setProfileError(null);
    setProfileMessage(null);
    setProfileLoading(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setProfileError("You must be signed in to delete your account.");
      setProfileLoading(false);
      return;
    }

    const response = await fetch("/api/delete-account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        await supabase.auth.signOut();
        setIsSignedIn(false);
        setShowProfile(false);
        setShowAuth(true);
        setProfileMessage("Account already deleted. Please sign in again.");
      } else {
        const data = await response.json().catch(() => null);
        setProfileError(data?.error ?? "Unable to delete account. Please try again.");
      }
      setProfileLoading(false);
      return;
    }

    setProfileMessage("Account deleted.");
    await supabase.auth.signOut();
    setIsSignedIn(false);
    setProfileLoading(false);
    setShowProfile(false);
    setShowDeleteConfirm(false);
    setShowAuth(true);
  };

  const handleSignUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);

    if (!authEmail || !password || !fullName) {
      setAuthError("Please complete all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }

    setAuthLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: authEmail,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("already registered") || message.includes("already exists")) {
        setAuthError("An account already exists with this email. Please sign in.");
      } else {
        setAuthError(error.message);
      }
      setAuthLoading(false);
      return;
    }

    if (data.session) {
      setIsSignedIn(true);
      setAuthSuccess("Success! You're signed in.");
      setTimeout(() => setShowAuth(false), 1200);
    } else {
      setAuthSuccess("Account created. Please sign in.");
    }
    setAuthLoading(false);
  };

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }

    setIsSignedIn(true);
    setAuthSuccess("Signed in successfully.");
    setTimeout(() => setShowAuth(false), 800);
    setAuthLoading(false);
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    setAuthSuccess(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    setSaveMessage(null);

    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to parse recipe");
      }

      setRecipe(data as Recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!recipe) return;
    setSaveMessage(null);

    if (!isSignedIn) {
      setShowAuth(true);
      return;
    }

    setIsSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setShowAuth(true);
      setIsSaving(false);
      return;
    }

    const { data: existing } = await supabase
      .from("recipes")
      .select("id")
      .eq("user_id", user.id)
      .eq("source_url", url)
      .maybeSingle();

    if (existing) {
      setSaveMessage("Already saved.");
      setIsSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from("recipes").insert({
      user_id: user.id,
      title: recipe.title,
      original_servings: recipe.original_servings,
      source_url: url,
      payload: recipe,
      rating_value: recipe.rating?.value ?? null,
      rating_count: recipe.rating?.count ?? null,
      allergens: recipe.allergens ?? [],
      tips: recipe.tips ?? [],
    });

    if (insertError) {
      setSaveMessage("Unable to save recipe.");
      setIsSaving(false);
      return;
    }

    setSaveMessage("Saved to your recipes.");
    setIsSaving(false);
  };

  const handleChatSubmit = async (promptOverride?: string | unknown) => {
    if (!recipe) return;
    const overrideText = typeof promptOverride === "string" ? promptOverride : null;
    const question = (overrideText ?? chatInput).trim();
    if (!question) return;
    if (!overrideText) {
      setChatInput("");
    }
    if (overrideText) {
      setUsedPrompts((prev) =>
        prev.includes(overrideText) ? prev : [...prev, overrideText]
      );
    }
    setChatError(null);
    setChatLoading(true);
    setChatMessages((prev) => [
      ...prev,
      { role: "user", content: question },
    ]);

    try {
      const response = await fetch("/api/recipe-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe,
          question,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to answer right now.");
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer ?? "" },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChatLoading(false);
    }
  };

  const formatChatMessage = (value: string) => {
    const escaped = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return withBold.replace(/\n/g, "<br />");
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <button
        type="button"
        onClick={() => {
          if (isSignedIn) {
            setShowProfile(true);
            loadProfile();
          } else {
            setShowAuth(true);
          }
        }}
        className="fixed left-5 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] sm:left-5 sm:top-5"
        aria-label="Account"
      >
        {isSignedIn && headerAvatarUrl && !headerAvatarError ? (
          <img
            src={headerAvatarUrl}
            alt="Profile"
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setHeaderAvatarError(true)}
          />
        ) : isSignedIn ? (
          <span className="text-sm font-semibold text-[#111111]/80">
            {(profileFirstName?.[0] ?? authUserEmail?.[0] ?? "P").toUpperCase()}
          </span>
        ) : (
          <svg
            className="animate-icon-breathe"
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="8" r="3.2" />
            <path d="M5 20c1.8-4.2 11.2-4.2 14 0" />
          </svg>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          if (isSignedIn) {
            router.push("/recipes");
          } else {
            setShowAuth(true);
          }
        }}
        className="fixed left-16 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] sm:left-5 sm:top-20"
        aria-label="Recipes"
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 4h9a3 3 0 0 1 3 3v13H6z" />
          <path d="M6 4v16" />
          <path d="M9 8h6" />
          <path d="M9 12h6" />
        </svg>
      </button>
      <section className="mx-auto w-full max-w-2xl px-4 pb-6 pt-24 sm:px-6 sm:pt-16">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-4 animate-fade-up">
            <p className="text-5xl font-semibold leading-none tracking-tight text-[#111111] sm:text-6xl">
              Plated.
            </p>
            <h1 className="text-3xl leading-tight text-[#111111] sm:text-4xl">
              Import a recipe URL.
            </h1>
            <p className="text-sm text-[#111111]/70 sm:text-base">
              Paste a recipe link and let us extract ingredients and
              instructions. No ads. No life stories.
            </p>
          </header>

          <form
            onSubmit={handleSubmit}
            className="grid gap-4 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.4)]"
          >
            <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
              Recipe URL
              <input
                id="recipe-url"
                name="recipeUrl"
                type="url"
                required
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/recipe"
                className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
              />
            </label>
            <button
              type="submit"
              disabled={isLoading}
              className="group inline-flex cursor-pointer items-center justify-center gap-3 rounded-full bg-[#111111] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_14px_36px_-22px_rgba(17,17,17,0.8)] hover:ring-1 hover:ring-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <span className="h-4 w-4 rounded-full border border-white/40 border-t-white animate-spin-slow" />
                  Parsing…
                </>
              ) : (
                "Parse Recipe"
              )}
            </button>
            {error && <p className="text-sm text-[#D9534F]">{error}</p>}
          </form>
        </div>
      </section>

      {recipe && (
        <>
          <section className="mx-auto w-full max-w-2xl px-4 pb-8 sm:px-6">
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)]">
              <button
                type="button"
                onClick={() => setChatOpen((prev) => !prev)}
                className={`flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-all duration-500 ${
                  chatOpen
                    ? "bg-black/5"
                    : "bg-white/80 hover:bg-black/5"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white shadow-[0_12px_30px_-20px_rgba(0,0,0,0.5)]">
                    <svg
                      aria-hidden="true"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-[#111111]/70"
                    >
                      <path d="M12 2v2" />
                      <path d="M12 20v2" />
                      <path d="M4.9 4.9l1.4 1.4" />
                      <path d="M17.7 17.7l1.4 1.4" />
                      <path d="M2 12h2" />
                      <path d="M20 12h2" />
                      <path d="M4.9 19.1l1.4-1.4" />
                      <path d="M17.7 6.3l1.4-1.4" />
                      <circle cx="12" cy="12" r="4" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                      Plated Assist
                    </p>
                    <h2 className="text-lg text-[#111111]">
                      Ask about this recipe
                    </h2>
                    <p className="text-sm text-[#111111]/70">
                      Substitutions, timing, and ingredient swaps—instantly.
                    </p>
                  </div>
                </div>
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  {chatOpen ? "Close" : "Open"}
                </span>
              </button>

              <div
                className={`grid transition-all duration-500 ease-out ${
                  chatOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
              >
                <div className="overflow-hidden px-6 pb-6">
                  <div
                    ref={chatScrollRef}
                    className="flex max-h-80 flex-col gap-4 overflow-y-auto rounded-2xl border border-black/10 bg-white/60 p-4"
                  >
                    {chatMessages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-[0_18px_45px_-35px_rgba(0,0,0,0.5)] ${
                            message.role === "user"
                              ? "bg-[#111111] text-white"
                              : "bg-white text-[#111111]/80"
                          }`}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: formatChatMessage(message.content),
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {chatLoading ? (
                      <div className="flex justify-start">
                        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-[#111111]/70">
                          Thinking…
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {chatError ? (
                    <p className="mt-3 text-sm text-[#D9534F]">{chatError}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {chatSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          if (chatLoading) return;
                          handleChatSubmit(suggestion);
                        }}
                        className="rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <input
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleChatSubmit();
                        }
                      }}
                      placeholder="Ask about swaps, timing, or ingredients…"
                      className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                    />
                    <button
                      type="button"
                      onClick={handleChatSubmit}
                      disabled={chatLoading || !chatInput.trim()}
                      className="inline-flex items-center justify-center rounded-full bg-[#111111] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_14px_36px_-22px_rgba(17,17,17,0.8)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Ask
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <RecipeCard
            recipe={recipe}
            onSave={() => {
              if (!isSignedIn || authChecking) {
                setShowAuth(true);
                return;
              }
              handleSaveRecipe();
            }}
            isSaving={isSaving}
            saveMessage={saveMessage}
          />
        </>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-black/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                  Plated.
                </p>
                <h2 className="text-2xl text-[#111111]">
                  Save your recipes
                </h2>
                <p className="text-sm text-[#111111]/70">
                  {isSignedIn
                    ? `Signed in as ${authUserEmail ?? "your account"}.`
                    : "Please sign in or create an account to save recipes."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAuth(false)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-6 flex gap-2 rounded-full border border-black/10 p-1">
              <button
                type="button"
                onClick={() => {
                  setAuthMode("sign-in");
                  resetAuthState();
                }}
                className={`flex-1 cursor-pointer rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
                  authMode === "sign-in"
                    ? "bg-[#111111] text-white"
                    : "text-[#111111]/70 hover:bg-black/5"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode("sign-up");
                  resetAuthState();
                }}
                className={`flex-1 cursor-pointer rounded-full px-4 py-2 text-xs uppercase tracking-[0.2em] transition-all duration-300 ${
                  authMode === "sign-up"
                    ? "bg-[#111111] text-white"
                    : "text-[#111111]/70 hover:bg-black/5"
                }`}
              >
                Sign up
              </button>
            </div>

            {authMode === "sign-in" && (
              <form className="mt-6 grid gap-4" onSubmit={handleSignIn}>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.6 20.4H42V20H24v8h11.3C33.4 32.5 29 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.6z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 16.2 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.1 4 9.3 8.5 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.1 0 9.8-1.9 13.3-5.1l-6.1-5.1C29 35.5 26.6 36 24 36c-5 0-9.3-3.2-10.9-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.4H42V20H24v8h11.3c-1 2.9-3.3 5.2-6.3 6.9l6.1 5.1C39 37.2 44 31.6 44 24c0-1.3-.1-2.7-.4-3.6z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#111111]/50">
                  <span className="h-px flex-1 bg-black/10" />
                  or
                  <span className="h-px flex-1 bg-black/10" />
                </div>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Email
                  <input
                    id="signin-email"
                    name="signinEmail"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                  />
                </label>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Password
                  <div className="relative">
                    <input
                      id="signin-password"
                      name="signinPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-full border border-black/10 bg-white px-4 py-3 pr-12 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 text-[#111111]/60 transition-colors duration-300 hover:text-[#111111] ${
                        showPassword ? "animate-eye-toggle" : ""
                      }`}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                          <circle cx="12" cy="12" r="3.5" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12s3.5-6 9-6c2.1 0 3.9.6 5.3 1.4" />
                          <path d="M21 12s-3.5 6-9 6c-2.1 0-3.9-.6-5.3-1.4" />
                          <path d="M4 4l16 16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                {authError && (
                  <p className="text-sm text-[#D9534F]">{authError}</p>
                )}
                {authSuccess && (
                  <p className="text-sm text-[#111111]/70 animate-success-pulse">
                    {authSuccess}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 cursor-pointer rounded-full bg-[#111111] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
                >
                  {authLoading ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}

            {authMode === "sign-up" && (
              <form className="mt-6 grid gap-4" onSubmit={handleSignUp}>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                >
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 48 48"
                  >
                    <path
                      fill="#FFC107"
                      d="M43.6 20.4H42V20H24v8h11.3C33.4 32.5 29 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.6z"
                    />
                    <path
                      fill="#FF3D00"
                      d="M6.3 14.7l6.6 4.8C14.7 16.2 19 12 24 12c3 0 5.7 1.1 7.8 2.9l5.7-5.7C34 6.1 29.3 4 24 4 16.1 4 9.3 8.5 6.3 14.7z"
                    />
                    <path
                      fill="#4CAF50"
                      d="M24 44c5.1 0 9.8-1.9 13.3-5.1l-6.1-5.1C29 35.5 26.6 36 24 36c-5 0-9.3-3.2-10.9-7.6l-6.5 5C9.5 39.6 16.2 44 24 44z"
                    />
                    <path
                      fill="#1976D2"
                      d="M43.6 20.4H42V20H24v8h11.3c-1 2.9-3.3 5.2-6.3 6.9l6.1 5.1C39 37.2 44 31.6 44 24c0-1.3-.1-2.7-.4-3.6z"
                    />
                  </svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-[#111111]/50">
                  <span className="h-px flex-1 bg-black/10" />
                  or
                  <span className="h-px flex-1 bg-black/10" />
                </div>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Full name
                  <input
                    id="signup-fullname"
                    name="signupFullName"
                    type="text"
                    required
                    placeholder="Your name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                  />
                </label>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Email
                  <input
                    id="signup-email"
                    name="signupEmail"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                  />
                </label>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Password
                  <div className="relative">
                    <input
                      id="signup-password"
                      name="signupPassword"
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="w-full rounded-full border border-black/10 bg-white px-4 py-3 pr-12 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 text-[#111111]/60 transition-colors duration-300 hover:text-[#111111] ${
                        showPassword ? "animate-eye-toggle" : ""
                      }`}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                          <circle cx="12" cy="12" r="3.5" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12s3.5-6 9-6c2.1 0 3.9.6 5.3 1.4" />
                          <path d="M21 12s-3.5 6-9 6c-2.1 0-3.9-.6-5.3-1.4" />
                          <path d="M4 4l16 16" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-[0.2em] text-[#111111]/60">
                    <span>Password strength</span>
                    <span className="text-[#111111]">{strengthLabel}</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-black/10">
                    <div
                      className={`h-1.5 rounded-full transition-all duration-300 ${strengthColor}`}
                      style={{ width: `${strengthWidth}%` }}
                    />
                  </div>
                </label>
                <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Confirm password
                  <div className="relative">
                    <input
                      id="signup-confirm"
                      name="signupConfirm"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      className="w-full rounded-full border border-black/10 bg-white px-4 py-3 pr-12 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 text-[#111111]/60 transition-colors duration-300 hover:text-[#111111] ${
                        showConfirmPassword ? "animate-eye-toggle" : ""
                      }`}
                      aria-label={
                        showConfirmPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                          <circle cx="12" cy="12" r="3.5" />
                        </svg>
                      ) : (
                        <svg
                          aria-hidden="true"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 12s3.5-6 9-6c2.1 0 3.9.6 5.3 1.4" />
                          <path d="M21 12s-3.5 6-9 6c-2.1 0-3.9-.6-5.3-1.4" />
                          <path d="M4 4l16 16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </label>
                {authError && (
                  <p className="text-sm text-[#D9534F]">{authError}</p>
                )}
                {authSuccess && (
                  <p className="text-sm text-[#111111]/70 animate-success-pulse">
                    {authSuccess}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={authLoading}
                  className="mt-2 cursor-pointer rounded-full bg-[#111111] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
                >
                  {authLoading ? "Creating account…" : "Create account"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {showProfile && isSignedIn && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                  Profile
                </p>
                <h2 className="text-2xl text-[#111111]">Your details</h2>
                <p className="text-sm text-[#111111]/70">
                  Signed in as {authUserEmail ?? "your account"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowProfile(false)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <form className="mt-6 grid gap-4" onSubmit={handleProfileSave}>
              <div className="flex flex-col items-center gap-3">
                <label
                  className="group relative flex h-28 w-28 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-black/10 bg-black/5 transition-all duration-300 hover:-translate-y-1 hover:border-black/30 hover:shadow-[0_18px_40px_-26px_rgba(0,0,0,0.6)]"
                  aria-label="Upload profile picture"
                >
                  {profileAvatarPreview ? (
                    <img
                      src={profileAvatarPreview}
                      alt="Profile"
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setProfileAvatarError(true);
                        setProfileAvatarPreview("");
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-[#111111]/70">
                      {(profileFirstName?.[0] ?? authUserEmail?.[0] ?? "P").toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[11px] uppercase tracking-[0.2em] text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    Change
                  </div>
                  <input
                    id="profile-avatar"
                    name="profileAvatar"
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      setProfileAvatarFile(file);
                      if (file) {
                        setProfileAvatarPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="sr-only"
                  />
                </label>
                <p className="text-xs uppercase tracking-[0.2em] text-[#111111]/50">
                  Click to upload
                </p>
              </div>

              <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                First name
                <input
                  id="profile-first-name"
                  name="profileFirstName"
                  type="text"
                  value={profileFirstName}
                  onChange={(event) => setProfileFirstName(event.target.value)}
                  className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                />
              </label>

              <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                Email
                <p className="rounded-full border border-black/10 bg-black/5 px-4 py-3 text-sm text-[#111111]/70">
                  {authUserEmail ?? "—"}
                </p>
              </div>

              <label className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                Bio
                <textarea
                  id="profile-bio"
                  name="profileBio"
                  rows={3}
                  value={profileBio}
                  onChange={(event) => setProfileBio(event.target.value)}
                  className="rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
                />
              </label>


              {profileError && (
                <p className="text-sm text-[#D9534F]">{profileError}</p>
              )}
              {profileMessage && (
                <p className="text-sm text-[#111111]/70 animate-success-pulse">
                  {profileMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={profileLoading}
                className="mt-2 cursor-pointer rounded-full bg-[#111111] px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
              >
                {profileLoading ? "Saving…" : "Save changes"}
              </button>

              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="cursor-pointer rounded-full border border-black/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                >
                  Sign out
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="cursor-pointer rounded-full border border-[#D9534F]/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#D9534F] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D9534F] hover:bg-[#D9534F]/10"
                >
                  Delete account
                </button>
              </div>

              {showDeleteConfirm && (
                <div className="mt-4 rounded-2xl border border-[#D9534F]/20 bg-[#D9534F]/5 p-4 text-sm text-[#111111]/80 animate-modal-in">
                  <p className="font-semibold text-[#111111]">
                    This will permanently delete your account.
                  </p>
                  <p className="mt-1 text-[#111111]/70">
                    This action cannot be undone.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="cursor-pointer rounded-full bg-[#D9534F] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C94743]"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="cursor-pointer rounded-full border border-black/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
