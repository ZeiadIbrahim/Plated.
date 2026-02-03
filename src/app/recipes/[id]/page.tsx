"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

type SavedRecipe = {
  id: string;
  payload: Recipe;
  source_url: string | null;
};

export default function SavedRecipePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [headerInitial, setHeaderInitial] = useState("P");
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cachedAvatar = localStorage.getItem("plated.avatar");
      const cachedInitial = localStorage.getItem("plated.initial");
      if (cachedAvatar) setHeaderAvatarUrl(cachedAvatar);
      if (cachedInitial) setHeaderInitial(cachedInitial);
    }

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

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Please sign in to view this recipe.");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("recipes")
        .select("id,payload,source_url")
        .eq("id", params.id)
        .maybeSingle();

      if (fetchError || !data) {
        setError(fetchError?.message ?? "Recipe not found.");
        return;
      }

      setRecipe(data.payload);
      setSourceUrl(data.source_url ?? null);
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
    };

    load();
  }, [params.id]);

  useEffect(() => {
    if (!chatOpen) return;
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [chatMessages, chatLoading, chatOpen]);

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
    <main className="min-h-screen bg-[#FAFAFA] pt-24 sm:pt-0">
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
        onClick={() => router.push("/recipes")}
        className="fixed left-16 top-5 z-20 inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-white/80 text-[#111111] shadow-[0_10px_25px_-18px_rgba(0,0,0,0.6)] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-white hover:shadow-[0_14px_32px_-18px_rgba(0,0,0,0.65)] sm:left-5 sm:top-20"
        aria-label="Saved recipes"
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
      {error ? (
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm text-[#D9534F]">{error}</p>
        </div>
      ) : recipe ? (
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
          <RecipeCard recipe={recipe} showSave={false} sourceUrl={sourceUrl} />
        </>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm text-[#111111]/70">Loading…</p>
        </div>
      )}
    </main>
  );
}
