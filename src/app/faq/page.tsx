"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";

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
            <h1 className="text-3xl text-[#111111] sm:text-4xl">FAQs</h1>
            <p className="text-sm text-[#111111]/70">
              Everything you need to know about Plated.
            </p>
          </header>

          <div className="flex flex-col gap-4" suppressHydrationWarning>
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <div key={item.question} className="w-full">
                  <Button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    variant="ghost"
                    size="lg"
                    className="w-full text-left normal-case tracking-normal font-semibold rounded-2xl border border-black/10 bg-white/80 px-4 py-4 sm:px-6 sm:py-5 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 hover:border-black/20 focus:outline-none focus:ring-2 focus:ring-[#4f8cff]/30"
                    style={{ minHeight: 56 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-base sm:text-lg text-[#111111] leading-snug">
                        {item.question}
                      </span>
                      <span className="text-xs sm:text-sm uppercase tracking-[0.2em] text-[#111111]/60">
                        {isOpen ? "Close" : "Open"}
                      </span>
                    </div>
                  </Button>
                  <div
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${
                      isOpen ? 'max-h-40 opacity-100 mt-2 sm:mt-3' : 'max-h-0 opacity-0 mt-0'
                    }`}
                    aria-hidden={!isOpen}
                  >
                    <div className="bg-white/90 rounded-b-2xl border border-t-0 border-black/10 px-4 py-3 sm:px-6 sm:py-4 text-sm sm:text-base text-[#111111]/80 leading-relaxed wrap-break-word shadow-[0_2px_8px_-4px_rgba(0,0,0,0.06)]">
                      {item.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
