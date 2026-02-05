"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { mergeShoppingList, type ShoppingListItem } from "@/lib/shoppingList";
import type { Recipe } from "@/types/recipe";
import { Button } from "@/components/ui/Button";

type ShareNavigator = {
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
  clipboard?: { writeText: (text: string) => Promise<void> };
};

const STORAGE_KEY = "plated.shoppingList";
const CHECKED_KEY = "plated.shoppingChecked";

export default function ShoppingListPage() {
  const router = useRouter();
  const [recipeIds, setRecipeIds] = useState<string[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [aiList, setAiList] = useState<ShoppingListItem[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    try {
      const parsed = JSON.parse(stored) as string[];
      setRecipeIds(parsed);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(CHECKED_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, boolean>;
      setChecked(parsed);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(CHECKED_KEY, JSON.stringify(checked));
  }, [checked]);

  useEffect(() => {
    if (!recipeIds.length) return;
    const load = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Please sign in to view your shopping list.");
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("recipes")
        .select("payload")
        .in("id", recipeIds);

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRecipes((data ?? []).map((row) => row.payload as Recipe));
      }
      setLoading(false);
    };

    load();
  }, [recipeIds]);

  const list = useMemo(
    () => aiList ?? mergeShoppingList(recipes),
    [aiList, recipes]
  );

  const listText = useMemo(
    () =>
      list
        .map((item) => {
          const amount =
            item.amount !== null
              ? `${item.amount}${item.unit ? ` ${item.unit}` : ""}`
              : "";
          return `${amount} ${item.item}`.trim();
        })
        .join("\n"),
    [list]
  );

  useEffect(() => {
    if (!recipes.length) {
      setAiList(null);
      setAiError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setAiLoading(true);
      setAiError(null);
      try {
        const response = await fetch("/api/shopping-list", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipes }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error ?? "Unable to build shopping list.");
        }
        if (!cancelled) {
          const items = Array.isArray(data.items) ? data.items : [];
          setAiList(
            items.map((item: ShoppingListItem, index: number) => ({
              ...item,
              key: item.key ?? `${item.item}-${item.unit ?? ""}-${index}`,
              recipes: item.recipes ?? [],
            }))
          );
        }
      } catch (err) {
        if (!cancelled) {
          setAiError(err instanceof Error ? err.message : "Something went wrong");
          setAiList(null);
        }
      } finally {
        if (!cancelled) setAiLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [recipes]);

  const toggleChecked = (item: ShoppingListItem) => {
    setChecked((prev) => ({ ...prev, [item.key]: !prev[item.key] }));
  };

  const handleCopy = async () => {
    const nav =
      typeof globalThis !== "undefined"
        ? ((globalThis as any).navigator as ShareNavigator | undefined)
        : undefined;
    if (!nav?.clipboard) return;
    await nav.clipboard.writeText(listText);
  };

  const handleOpenWith = async () => {
    const nav =
      typeof globalThis !== "undefined"
        ? ((globalThis as any).navigator as ShareNavigator | undefined)
        : undefined;
    if (!nav) return;
    if ("share" in nav) {
      await nav.share?.({
        title: "Shopping list",
        text: listText,
      });
      return;
    }
    if (nav.clipboard) {
      await nav.clipboard.writeText(listText);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA] print-scope">
      <Button
        onClick={() => router.push("/recipes")}
        variant="secondary"
        size="icon"
        className="fixed left-5 top-5 z-20 print-hidden"
        aria-label="Back"
      >
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
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Button>

      <section className="mx-auto w-full max-w-2xl px-4 py-20 sm:px-6">
        <header className="flex flex-col gap-3 print-hidden">
          <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
            Plated.
          </p>
          <h1 className="text-3xl text-[#111111] sm:text-4xl">
            Shopping list
          </h1>
          <p className="text-sm text-[#111111]/70">
            Combined ingredients from your selected recipes.
          </p>
          {aiLoading ? (
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#111111]/50">
              Building smart list…
            </p>
          ) : aiError ? (
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#D9534F]">
              AI unavailable: {aiError}
            </p>
          ) : aiList ? (
            <p className="text-[11px] uppercase tracking-[0.2em] text-[#111111]/50">
              AI consolidated list
            </p>
          ) : null}
        </header>

        {loading ? (
          <p className="mt-6 text-sm text-[#111111]/70">Loading…</p>
        ) : error ? (
          <p className="mt-6 text-sm text-[#D9534F]">{error}</p>
        ) : list.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white/70 p-6 text-sm text-[#111111]/70">
            Select a few recipes from Saved Recipes to build a shopping list.
          </div>
        ) : (
          <>
            <div className="mt-6 grid gap-4 print-hidden">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleCopy}
                  variant="chip"
                  size="md"
                  className="px-4"
                >
                  Copy list
                </Button>
                <Button
                  onClick={handleOpenWith}
                  variant="chip"
                  size="md"
                  className="px-4"
                >
                  Open with
                </Button>
                <Button
                  onClick={() => window.print()}
                  variant="chip"
                  size="md"
                  className="px-4"
                >
                  Print
                </Button>
              </div>

              <div className="grid gap-3 rounded-2xl border border-black/10 bg-white/70 p-5">
                {list.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-3 text-sm text-[#111111]/80"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(checked[item.key])}
                      onChange={() => toggleChecked(item)}
                      className="mt-1 h-4 w-4 rounded border-black/30"
                    />
                    <div>
                      <p
                        className={checked[item.key] ? "line-through" : undefined}
                      >
                        {item.amount !== null
                          ? `${item.amount}${item.unit ? ` ${item.unit}` : ""}`
                          : ""} {item.item}
                      </p>
                      {item.recipes && item.recipes.length > 0 ? (
                        <p className="text-[11px] uppercase tracking-[0.2em] text-[#111111]/50">
                          {item.recipes.join(" · ")}
                        </p>
                      ) : null}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="print-only">
              <h1 className="text-2xl font-semibold text-[#111111]">
                Shopping list
              </h1>
              <ul className="mt-4 grid gap-2 text-sm text-[#111111]">
                {list.map((item) => (
                  <li key={`${item.key}-print`}>
                    {item.amount !== null
                      ? `${item.amount}${item.unit ? ` ${item.unit}` : ""}`
                      : ""} {item.item}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
