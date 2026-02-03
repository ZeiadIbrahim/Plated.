"use client";

import { useEffect, useState } from "react";
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

  useEffect(() => {
    let mounted = true;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsSignedIn(!!data.session);
      setAuthUserEmail(data.session?.user.email ?? null);
      setAuthChecking(false);
    };

    loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setIsSignedIn(!!session);
        setAuthUserEmail(session?.user.email ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const resetAuthState = () => {
    setAuthError(null);
    setAuthSuccess(null);
  };

  const loadProfile = async () => {
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
    setProfileAvatarUrl(metadata.avatar_url ?? "");
    setProfileAvatarPreview(metadata.avatar_url ?? "");
    setProfileLoading(false);
  };

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
        className="fixed left-5 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)]"
        aria-label="Account"
      >
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
      </button>
      <section className="mx-auto w-full max-w-2xl px-4 pb-6 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-col gap-8">
          <header className="flex flex-col gap-4 animate-fade-up">
            <p className="text-5xl font-semibold leading-none tracking-tight text-[#111111] sm:text-6xl">
              Plated.
            </p>
            <h1 className="text-3xl leading-tight text-[#111111] sm:text-4xl">
              Import a recipe from any URL
            </h1>
            <p className="text-sm text-[#111111]/70 sm:text-base">
              Paste a recipe link and let us extract ingredients and
              instructions.
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
        <RecipeCard
          recipe={recipe}
          onSave={() => {
            if (!isSignedIn || authChecking) {
              setShowAuth(true);
            }
          }}
        />
      )}

      {showAuth && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-black/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                  Plated
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
                    />
                  ) : (
                    <div className="text-xs uppercase tracking-[0.2em] text-[#111111]/40">
                      Add photo
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
