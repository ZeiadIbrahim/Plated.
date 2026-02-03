"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const faqs = [
  {
    question: "How does the recipe parser work?",
    answer:
      "Paste a recipe URL and Plated. extracts the core structure: title, servings, ingredients, and steps.",
  },
  {
    question: "Can I edit saved recipes?",
    answer:
      "Yes. You can rename saved recipes, and update your profile details at any time.",
  },
  {
    question: "Why do some recipes fail to import?",
    answer:
      "Some sites block automated access, require logins, or present paywalls. In those cases, Plated. can't read the full recipe text.",
  },
  {
    question: "What happens with paywalled recipes?",
    answer:
      "If a recipe is behind a subscription, we’ll let you know so you can choose a free source instead.",
  },
  {
    question: "How do allergies get detected?",
    answer:
      "Plated. analyzes ingredient names to surface common allergens like gluten and dairy.",
  },
  {
    question: "Do you support metric conversions?",
    answer:
      "Yes. Toggle the Metric switch to convert common units and scale servings.",
  },
  {
    question: "Can I change servings after saving?",
    answer:
      "Yes. Serving adjustments are interactive on each recipe and update ingredient amounts instantly.",
  },
  {
    question: "Where do the ratings come from?",
    answer:
      "If a rating appears on the source page, Plated. will capture it when possible. Otherwise, it stays empty.",
  },
  {
    question: "Can I delete my account?",
    answer:
      "Yes. Use the profile panel to delete your account and saved recipes at any time.",
  },
  {
    question: "Is my data private?",
    answer:
      "Your saved recipes are scoped to your account. We do not share your data.",
  },
];

export default function FAQPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
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
      <button
        type="button"
        onClick={async () => {
          const { data } = await supabase.auth.getSession();
          if (data.session) {
            router.push("/?profile=1");
          } else {
            router.push("/?auth=1");
          }
        }}
        className="fixed left-5 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] sm:left-5 sm:top-5"
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
      </button>
      <button
        type="button"
        onClick={() => router.push("/")}
        className="fixed left-16 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] sm:left-5 sm:top-20"
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
      </button>
      <section
        className="mx-auto w-full max-w-2xl px-4 py-12 pt-24 sm:px-6 sm:py-16"
        suppressHydrationWarning
      >
        <div className="flex flex-col gap-6" suppressHydrationWarning>
          <header className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
              Plated
            </p>
            <h1 className="text-3xl text-[#111111] sm:text-4xl">FAQs</h1>
            <p className="text-sm text-[#111111]/70">
              Everything you need to know about Plated.
            </p>
          </header>

          <div className="grid gap-4" suppressHydrationWarning>
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <button
                  key={item.question}
                  type="button"
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                  className="text-left rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/20"
                >
                  <div
                    className="flex items-center justify-between gap-4"
                    suppressHydrationWarning
                  >
                    <h2 className="text-base text-[#111111]">
                      {item.question}
                    </h2>
                    <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                      {isOpen ? "Close" : "Open"}
                    </span>
                  </div>
                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100 mt-3"
                        : "grid-rows-[0fr] opacity-0 mt-0"
                    }`}
                    suppressHydrationWarning
                  >
                    <p className="overflow-hidden text-sm text-[#111111]/70">
                      {item.answer}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
