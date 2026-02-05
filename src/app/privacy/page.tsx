"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";

export default function PrivacyPage() {
  const router = useRouter();
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("plated.avatar");
  });
  const [headerInitial, setHeaderInitial] = useState(() => {
    if (typeof window === "undefined") return "P";
    return localStorage.getItem("plated.initial") ?? "P";
  });
  const [headerAvatarError, setHeaderAvatarError] = useState(false);

  useEffect(() => {
    const loadHeader = async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        setHeaderAvatarUrl(null);
        setHeaderInitial("P");
        return;
      }
      const { data: userData } = await supabase.auth.getUser();
      const metadata = userData.user?.user_metadata ?? {};
      const inferredName =
        metadata.full_name ??
        metadata.name ??
        metadata.given_name ??
        metadata.first_name ??
        user.email ??
        "P";
      setHeaderInitial(inferredName?.[0]?.toUpperCase() ?? "P");
      setHeaderAvatarUrl((metadata.avatar_url ?? metadata.picture) || null);
      setHeaderAvatarError(false);
    };

    loadHeader();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          setHeaderAvatarUrl(null);
          setHeaderInitial("P");
          return;
        }
        const metadata = session.user.user_metadata ?? {};
        const inferredName =
          metadata.full_name ??
          metadata.name ??
          metadata.given_name ??
          metadata.first_name ??
          session.user.email ??
          "P";
        setHeaderInitial(inferredName?.[0]?.toUpperCase() ?? "P");
        setHeaderAvatarUrl((metadata.avatar_url ?? metadata.picture) || null);
        setHeaderAvatarError(false);
      }
    );

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#FAFAFA]" suppressHydrationWarning>
      <Button
        onClick={async () => {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.push("/?profile=1");
          } else {
            router.push("/?auth=1");
          }
        }}
        variant="secondary"
        size="icon"
        className="fixed left-5 top-5 z-20 sm:left-5 sm:top-5"
        aria-label="Account"
      >
        {headerAvatarUrl && !headerAvatarError ? (
          <img
            src={headerAvatarUrl}
            alt="Profile"
            className="h-8 w-8 rounded-full object-cover"
            referrerPolicy="no-referrer"
            onError={() => setHeaderAvatarError(true)}
          />
        ) : (
          <span className="text-sm font-semibold text-[#111111]/80">
            {headerInitial}
          </span>
        )}
      </Button>
      <Button
        onClick={() => router.push("/")}
        variant="secondary"
        size="icon"
        className="fixed left-16 top-5 z-20 sm:left-5 sm:top-20"
        aria-label="Home"
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
          <path d="M4 11l8-6 8 6" />
          <path d="M6 10v10h12V10" />
        </svg>
      </Button>
      <section
        className="mx-auto w-full max-w-2xl px-4 py-12 pt-24 sm:px-6 sm:py-16"
        suppressHydrationWarning
      >
        <div className="flex flex-col gap-6" suppressHydrationWarning>
          <header className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
              Plated
            </p>
            <h1 className="text-3xl text-[#111111] sm:text-4xl">Privacy</h1>
            <p className="text-sm text-[#111111]/70">
              How we handle your data at Plated.
            </p>
          </header>

          <div
            className="grid gap-4 text-sm text-[#111111]/75 leading-relaxed"
            suppressHydrationWarning
          >
            <p>
              We collect only the information needed to provide your account and
              saved recipes. We do not sell your personal data.
            </p>
            <p>
              Saved recipes are scoped to your account and protected by database
              rules.
            </p>
            <p>
              We store basic profile details you choose to provide, such as your
              name and avatar.
            </p>
            <p>
              We use analytics only to improve the product experience and
              reliability.
            </p>
            <p>
              You may delete your account at any time from your profile.
            </p>
            <p>
              For questions, contact support through the app.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
