"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RecipeCard } from "@/components/RecipeCard";
import { Button } from "@/components/ui/Button";
import type { Recipe, RecipeIngredient } from "@/types/recipe";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

const createMessageId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const COLLECTION_COLORS = [
  "#111111",
  "#D9534F",
  "#2F855A",
  "#1D4ED8",
  "#9333EA",
  "#D97706",
  "#0891B2",
  "#475569",
];
const COLLECTION_COLOR_STORAGE_KEY = "plated.collectionColors";

export default function SavedRecipePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [shareId, setShareId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [collections, setCollections] = useState<
    Array<{ id: string; name: string; color: string | null }>
  >([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");
  const [collectionColor, setCollectionColor] = useState("");
  const [showCollectionInput, setShowCollectionInput] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(null);
  const [headerInitial, setHeaderInitial] = useState("P");
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showChatOptions, setShowChatOptions] = useState(false);
  const [usedPrompts, setUsedPrompts] = useState<string[]>([]);
  const [feedbackVotes, setFeedbackVotes] = useState<
    Record<string, "up" | "down">
  >({});
  const [dietPrefs, setDietPrefs] = useState({
    glutenFree: false,
    dairyFree: false,
    nutFree: false,
    vegan: false,
    vegetarian: false,
  });
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const baseSuggestions = useMemo(() => {
    if (!recipe) return [] as string[];
    const titleShort = recipe.title.split(" ").slice(0, 5).join(" ");
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

    if (titleShort) {
      suggestions.unshift(`Best side for ${titleShort}?`);
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

    return unique.slice(0, 2);
  }, [baseSuggestions, chatMessages, recipe, usedPrompts]);
  const groupedIngredients = useMemo(() => {
    if (!recipe) return [] as Array<{ title: string | null; items: RecipeIngredient[] }>;
    const groups: Array<{ title: string | null; items: RecipeIngredient[] }> = [];

    recipe.ingredients.forEach((ingredient) => {
      const title = ingredient.group?.trim() || null;
      const last = groups[groups.length - 1];

      if (!last || last.title !== title) {
        groups.push({ title, items: [ingredient] });
      } else {
        last.items.push(ingredient);
      }
    });

    return groups;
  }, [recipe]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    const cachedAvatar = localStorage.getItem("plated.avatar");
    const cachedInitial = localStorage.getItem("plated.initial") ?? "P";
    if (cachedAvatar) {
      setHeaderAvatarUrl(cachedAvatar);
    }
    setHeaderInitial(cachedInitial);
  }, [isMounted]);

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

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Please sign in to view this recipe.");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("recipes")
        .select("id,payload,source_url,is_favorite")
        .eq("id", params.id)
        .maybeSingle();

      if (fetchError || !data) {
        setError(fetchError?.message ?? "Recipe not found.");
        return;
      }

      setRecipe(data.payload);
      setSourceUrl(data.source_url ?? null);
      setIsFavorite(Boolean(data.is_favorite));
      setChatMessages([
        {
          id: createMessageId(),
          role: "assistant",
          content:
            "Ask me about substitutions, timing, or how to adjust this recipe.",
        },
      ]);
      setChatInput("");
      setChatError(null);
      setChatOpen(false);
      setShowSuggestions(false);
      setUsedPrompts([]);
      setFeedbackVotes({});

      const { data: shareData } = await supabase
        .from("shared_recipes")
        .select("id")
        .eq("recipe_id", params.id)
        .is("revoked_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setShareId(shareData?.id ?? null);
    };

    load();
  }, [params.id]);

  useEffect(() => {
    if (!chatOpen) return;
    const container = chatScrollRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [chatMessages, chatLoading, chatOpen]);

  const handleChatSubmit = async (
    promptOverride?: string | unknown,
    options?: { skipUser?: boolean; regenerate?: boolean }
  ) => {
    if (!recipe) return;
    const overrideText = typeof promptOverride === "string" ? promptOverride : null;
    const question = (overrideText ?? chatInput).trim();
    if (!question) return;
    if (!overrideText && !options?.skipUser) {
      setChatInput("");
    }
    if (overrideText) {
      setUsedPrompts((prev) =>
        prev.includes(overrideText) ? prev : [...prev, overrideText]
      );
    }
    setChatError(null);
    setChatLoading(true);
    setChatMessages((prev) => {
      const next = options?.regenerate
        ? prev.filter((message, index) =>
            message.role !== "assistant" || index !== prev.length - 1
          )
        : prev;
      return options?.skipUser
        ? next
        : [...next, { id: createMessageId(), role: "user", content: question }];
    });

    try {
      const response = await fetch("/api/recipe-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe,
          question,
          preferences: dietPrefs,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Unable to answer right now.");
      }

      setChatMessages((prev) => [
        ...prev,
        { id: createMessageId(), role: "assistant", content: data.answer ?? "" },
      ]);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setChatLoading(false);
    }
  };

  const clearChat = () => {
    setChatMessages([
      {
        id: createMessageId(),
        role: "assistant",
        content: "Ask me about substitutions, timing, or how to adjust this recipe.",
      },
    ]);
    setChatInput("");
    setChatError(null);
    setUsedPrompts([]);
  };

  const regenerateAnswer = () => {
    const lastUser = [...chatMessages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setChatMessages((prev) => {
      const indexFromEnd = [...prev]
        .reverse()
        .findIndex((m) => m.role === "assistant");
      if (indexFromEnd === -1) return prev;
      const removeIndex = prev.length - 1 - indexFromEnd;
      return prev.filter((_, index) => index !== removeIndex);
    });
    handleChatSubmit(lastUser.content, { skipUser: true, regenerate: true });
  };

  const copyLastAnswer = async () => {
    const lastAssistant = [...chatMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    await navigator.clipboard.writeText(lastAssistant.content);
  };

  const sendFeedback = async (message: ChatMessage, vote: "up" | "down") => {
    setFeedbackVotes((prev) => ({ ...prev, [message.id]: vote }));
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("chat_feedback").insert({
      user_id: userData.user?.id ?? null,
      recipe_id: params.id,
      message_id: message.id,
      vote,
      question: [...chatMessages]
        .reverse()
        .find((item) => item.role === "user")?.content,
      answer: message.content,
      preferences: dietPrefs,
    });
  };

  const formatChatMessage = (value: string) => {
    const escaped = value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const withBold = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    return withBold.replace(/\n/g, "<br />");
  };

  const updateFavorite = async () => {
    const nextValue = !isFavorite;
    const { error: updateError } = await supabase
      .from("recipes")
      .update({ is_favorite: nextValue })
      .eq("id", params.id);
    if (!updateError) {
      setIsFavorite(nextValue);
    }
  };

  const shareViaWeb = async (url: string) => {
    if (!recipe) return false;
    if (typeof navigator === "undefined" || !("share" in navigator)) return false;
    try {
      await navigator.share({
        title: recipe.title,
        text: `Check out this recipe for ${recipe.title}.`,
        url,
      });
      return true;
    } catch {
      return false;
    }
  };

  const createShare = async () => {
    if (!recipe) return null as string | null;
    setShareLoading(true);
    setShareError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setShareError("Please sign in to share.");
      setShareLoading(false);
      return null;
    }

    const { data, error: insertError } = await supabase
      .from("shared_recipes")
      .insert({
        recipe_id: params.id,
        user_id: userData.user.id,
        title: recipe.title,
        source_url: sourceUrl,
        payload: recipe,
      })
      .select("id")
      .single();

    if (insertError) {
      setShareError(insertError.message);
      setShareLoading(false);
      return null;
    }

    setShareId(data.id);
    setShareLoading(false);
    return data.id;
  };

  const handleShare = async () => {
    if (!recipe) return;
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    let nextShareId = shareId;

    if (!nextShareId) {
      nextShareId = await createShare();
    }

    if (!nextShareId) return;
    const url = `${baseUrl}/share/${nextShareId}`;
    const shared = await shareViaWeb(url);

    if (!shared) {
      await navigator.clipboard.writeText(url);
    }
  };

  const readCollectionColors = () => {
    if (typeof window === "undefined") return {} as Record<string, string>;
    try {
      const stored = localStorage.getItem(COLLECTION_COLOR_STORAGE_KEY);
      return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch {
      return {} as Record<string, string>;
    }
  };

  const writeCollectionColor = (id: string, color: string) => {
    if (typeof window === "undefined") return;
    const next = { ...readCollectionColors(), [id]: color };
    localStorage.setItem(COLLECTION_COLOR_STORAGE_KEY, JSON.stringify(next));
  };

  const loadCollections = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: collectionData, error: collectionError } = await supabase
      .from("collections")
      .select("id,name,color")
      .order("created_at", { ascending: true });

    if (collectionError?.message?.includes("color")) {
      const { data: fallbackData } = await supabase
        .from("collections")
        .select("id,name")
        .order("created_at", { ascending: true });
      const stored = readCollectionColors();
      setCollections(
        (fallbackData ?? []).map((item) => ({
          ...item,
          color: stored[item.id] ?? null,
        }))
      );
    } else {
      setCollections(collectionData ?? []);
    }

    const { data: joinData } = await supabase
      .from("collection_recipes")
      .select("collection_id")
      .eq("recipe_id", params.id);
    setCollectionIds((joinData ?? []).map((row) => row.collection_id));
  };

  useEffect(() => {
    if (!recipe) return;
    loadCollections();
  }, [recipe]);

  const toggleCollection = async (collectionId: string) => {
    const isSelected = collectionIds.includes(collectionId);
    if (isSelected) {
      await supabase
        .from("collection_recipes")
        .delete()
        .eq("collection_id", collectionId)
        .eq("recipe_id", params.id);
      setCollectionIds((prev) => prev.filter((id) => id !== collectionId));
    } else {
      await supabase.from("collection_recipes").insert({
        collection_id: collectionId,
        recipe_id: params.id,
      });
      setCollectionIds((prev) => [...prev, collectionId]);
    }
  };

  const createCollection = async () => {
    const name = collectionInput.trim();
    if (!name) return;
    if (!collectionColor) {
      setCollectionError("Please choose a color for your collection.");
      return;
    }
    setCollectionError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("collections")
      .insert({ name, user_id: userData.user.id, color: collectionColor })
      .select("id,name,color")
      .single();
    if (error?.message?.includes("color")) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("collections")
        .insert({ name, user_id: userData.user.id })
        .select("id,name")
        .single();
      if (fallbackError || !fallbackData) return;
      writeCollectionColor(fallbackData.id, collectionColor);
      setCollections((prev) => [...prev, { ...fallbackData, color: collectionColor }]);
      setCollectionInput("");
      setCollectionColor("");
      setShowCollectionInput(false);
      await toggleCollection(fallbackData.id);
      return;
    }
    if (error || !data) return;
    writeCollectionColor(data.id, collectionColor);
    setCollections((prev) => [...prev, data]);
    setCollectionInput("");
    setCollectionColor("");
    setShowCollectionInput(false);
    await toggleCollection(data.id);
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] pt-24 sm:pt-0 print-scope">
      {recipe ? (
        <div className="print-only px-8 py-6 text-[#111111]">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold">{recipe.title}</h1>
              {recipe.author ? (
                <p className="text-sm text-[#111111]/70">By {recipe.author}</p>
              ) : null}
              {sourceUrl ? (
                <p className="text-xs text-[#111111]/60">Source: {sourceUrl}</p>
              ) : null}
            </div>
            <div className="text-right text-sm text-[#111111]/70">
              <p>{recipe.original_servings} servings</p>
              {recipe.rating?.value ? (
                <p>
                  ★ {recipe.rating.value.toFixed(1)}
                  {recipe.rating.count ? ` (${recipe.rating.count})` : ""}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-8 grid gap-8">
            <section>
              <h2 className="text-lg font-semibold">Ingredients</h2>
              <div className="mt-3 space-y-4">
                {groupedIngredients.map((group, index) => (
                  <div key={`${group.title ?? "items"}-${index}`}>
                    {group.title ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]/60">
                        {group.title}
                      </p>
                    ) : null}
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {group.items.map((ingredient, itemIndex) => (
                        <li key={`${ingredient.item}-${itemIndex}`}>
                          {ingredient.amount ? `${ingredient.amount} ` : ""}
                          {ingredient.unit ? `${ingredient.unit} ` : ""}
                          {ingredient.item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h2 className="text-lg font-semibold">Instructions</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                {recipe.instructions.map((step, index) => (
                  <li key={`${step}-${index}`}>{step}</li>
                ))}
              </ol>
            </section>
            {recipe.tips?.length ? (
              <section>
                <h2 className="text-lg font-semibold">Tips</h2>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                  {recipe.tips.map((tip, index) => (
                    <li key={`${tip}-${index}`}>{tip}</li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      ) : null}
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
        className="fixed left-5 top-5 z-20 sm:left-5 sm:top-5 print-hidden"
        aria-label="Account"
      >
        {isMounted && headerAvatarUrl && !headerAvatarError ? (
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
        onClick={() => router.push("/recipes")}
        variant="secondary"
        size="icon"
        className="fixed left-16 top-5 z-20 sm:left-5 sm:top-20 print-hidden"
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
      </Button>
      {error ? (
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm text-[#D9534F]">{error}</p>
        </div>
      ) : recipe ? (
        <>
          <RecipeCard recipe={recipe} showSave={false} sourceUrl={sourceUrl} />
          <section className="mx-auto w-full max-w-2xl px-4 pb-4 sm:px-6">
            <div className="relative grid gap-4 rounded-2xl border border-black/10 bg-white/70 p-5">
              <Button
                onClick={updateFavorite}
                aria-label={
                  isFavorite ? "Remove from favorites" : "Add to favorites"
                }
                variant="ghost"
                size="icon"
                className={`absolute right-4 top-4 h-9 w-9 ${
                  isFavorite
                    ? "border border-[#D9534F] bg-[#D9534F] text-white"
                    : "border border-[#D9534F]/30 bg-white/80 text-[#D9534F] hover:border-[#D9534F]/60 hover:bg-[#D9534F]/10"
                }`}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill={isFavorite ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20.8 12.5c-1.6 4.1-6.6 8-8.8 9.5-2.2-1.5-7.2-5.4-8.8-9.5C1.7 8.7 4.3 6 7.5 6c1.9 0 3.6 1 4.5 2.6C12.9 7 14.6 6 16.5 6c3.2 0 5.8 2.7 4.3 6.5Z" />
                </svg>
              </Button>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => window.print()}
                  variant="chip"
                  size="md"
                  className="px-4 print:hidden"
                >
                  Print
                </Button>
                <Button
                  onClick={handleShare}
                  disabled={shareLoading}
                  variant="chip"
                  size="md"
                  className="px-4"
                >
                  {shareLoading ? "Sharing…" : "Share"}
                </Button>
              </div>

              {shareError ? (
                <p className="text-sm text-[#D9534F]">{shareError}</p>
              ) : null}

              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Collections
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {collections.map((collection) => {
                    const isActive = collectionIds.includes(collection.id);
                    const color = collection.color ?? "#111111";
                    return (
                      <button
                        key={collection.id}
                        type="button"
                        onClick={() => toggleCollection(collection.id)}
                        style={
                          isActive
                            ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
                            : { borderColor: `${color}55`, color: "#111111" }
                        }
                        className="flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 hover:-translate-y-0.5"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {collection.name}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setCollectionError(null);
                      setShowCollectionInput((prev) => !prev);
                    }}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-black/10 text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30"
                    aria-label="Create collection"
                  >
                    +
                  </button>
                </div>
                {showCollectionInput ? (
                  <div className="grid gap-2 rounded-2xl border border-black/10 bg-white/70 p-3">
                    <input
                      value={collectionInput}
                      onChange={(event) => setCollectionInput(event.target.value)}
                      placeholder="New collection"
                      className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs text-[#111111] outline-none"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      {COLLECTION_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setCollectionColor(color);
                            setCollectionError(null);
                          }}
                          className={`relative h-7 w-7 rounded-full border transition-all duration-300 ${
                            collectionColor === color
                              ? "border-black/60 ring-2 ring-black/40 ring-offset-2"
                              : "border-black/10"
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label={`Use ${color}`}
                        >
                          {collectionColor === color ? (
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                              ✓
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={createCollection}
                        className="ml-auto rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]/70"
                      >
                        Create
                      </button>
                    </div>
                    {collectionError ? (
                      <p className="text-xs text-[#D9534F]">{collectionError}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </section>
          <section className="mx-auto w-full max-w-2xl px-4 pb-12 pt-6 sm:px-6 print-hidden">
            <h2 className="mb-4 text-lg font-semibold text-[#111111] sm:text-xl">
              Ask about this recipe
            </h2>
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
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                      Plated. AI Assist
                    </p>
                    <p className="text-sm text-[#111111]/70">
                      Substitutions, timing, and ingredient swaps - instantly.
                    </p>
                </div>
                <span className="text-[#111111]/60">
                  <svg
                    aria-hidden="true"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`transition-transform duration-500 ${
                      chatOpen ? "rotate-180" : "animate-bounce"
                    }`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
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
                    className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto rounded-2xl bg-white/60 p-4 sm:max-h-96"
                  >
                    {chatMessages.map((message, index) => (
                      <div
                        key={message.id ?? `${message.role}-${index}`}
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
                              : "bg-[#F4F1EC] text-[#111111]/80"
                          }`}
                        >
                          <span
                            dangerouslySetInnerHTML={{
                              __html: formatChatMessage(message.content),
                            }}
                          />
                          {message.role === "assistant" && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#111111]/50">
                              <button
                                type="button"
                                onClick={() =>
                                  navigator.clipboard.writeText(message.content)
                                }
                                className="rounded-full border border-black/10 px-2 py-1 text-[#111111]/60"
                              >
                                Copy
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {chatLoading ? (
                      <div className="flex justify-start">
                        <div className="rounded-2xl bg-[#F4F1EC] px-4 py-3 text-sm text-[#111111]/70">
                          Thinking…
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {chatError ? (
                    <p className="mt-3 text-sm text-[#D9534F]">{chatError}</p>
                  ) : null}

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

                  <div className="mt-4 grid gap-3">
                    <button
                      type="button"
                      onClick={() => setShowChatOptions((prev) => !prev)}
                      className="self-start rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                    >
                      {showChatOptions ? "Hide options" : "More options"}
                    </button>

                    {showChatOptions ? (
                      <div className="grid gap-3 rounded-2xl border border-black/10 bg-white/60 p-4">
                        <button
                          type="button"
                          onClick={() => setShowSuggestions((prev) => !prev)}
                          className={`self-start rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 ${
                            showSuggestions
                              ? "border border-black/40 bg-black text-white"
                              : "border border-black/10 text-[#111111]/70 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                          }`}
                        >
                          {showSuggestions ? "Hide prompts" : "Show prompts"}
                        </button>
                        {showSuggestions && (
                          <div className="grid gap-2">
                            {chatSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                type="button"
                                onClick={() => {
                                  if (chatLoading) return;
                                  handleChatSubmit(suggestion);
                                }}
                                className="w-full rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#111111]/60 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={clearChat}
                            className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/60"
                          >
                            Clear chat
                          </button>
                          <button
                            type="button"
                            onClick={regenerateAnswer}
                            className="rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/60"
                          >
                            Regenerate
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-3">
                          {([
                            ["glutenFree", "Gluten-free"],
                            ["dairyFree", "Dairy-free"],
                            ["nutFree", "Nut-free"],
                            ["vegan", "Vegan"],
                            ["vegetarian", "Vegetarian"],
                          ] as const).map(([key, label]) => (
                            <label
                              key={key}
                              className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/60"
                            >
                              <span>{label}</span>
                              <span className="relative inline-flex h-5 w-9 items-center">
                                <input
                                  type="checkbox"
                                  checked={dietPrefs[key]}
                                  onChange={() =>
                                    setDietPrefs((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                  className="peer sr-only"
                                />
                                <span className="h-5 w-9 rounded-full bg-black/10 transition peer-checked:bg-black/60" />
                                <span className="absolute left-1 h-3 w-3 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
          <p className="text-sm text-[#111111]/70">Loading…</p>
        </div>
      )}
    </main>
  );
}
