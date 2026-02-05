"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";
import {
  parseRecipeFilters,
  serializeRecipeFilters,
  type RecipeFilterState,
} from "@/lib/recipeFilters";

type SavedRecipe = {
  id: string;
  title: string;
  created_at: string;
  rating_value: number | null;
  rating_count: number | null;
  is_favorite: boolean;
};

type Collection = {
  id: string;
  name: string;
  color: string | null;
};

const PAGE_SIZE = 20;
const SHOPPING_STORAGE_KEY = "plated.shoppingList";
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

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedRecipe | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [filters, setFilters] = useState<RecipeFilterState>({
    query: "",
    tags: [],
    collections: [],
    favoritesOnly: false,
    hasRating: false,
    sort: "recent",
  });
  const [queryInput, setQueryInput] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionEditor, setCollectionEditor] = useState<Collection | null>(null);
  const [collectionNameDraft, setCollectionNameDraft] = useState("");
  const [collectionColorDraft, setCollectionColorDraft] = useState("");
  const [collectionRecipeIds, setCollectionRecipeIds] = useState<string[]>([]);
  const [collectionRecipeOptions, setCollectionRecipeOptions] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [collectionLoading, setCollectionLoading] = useState(false);
  const [collectionError, setCollectionError] = useState<string | null>(null);
  const [showCollectionCreate, setShowCollectionCreate] = useState(false);
  const [collectionCreateName, setCollectionCreateName] = useState("");
  const [collectionCreateColor, setCollectionCreateColor] = useState("");
  const [showCollectionManager, setShowCollectionManager] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [headerAvatarUrl, setHeaderAvatarUrl] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("plated.avatar");
  });
  const [headerInitial, setHeaderInitial] = useState(() => {
    if (typeof window === "undefined") return "P";
    return localStorage.getItem("plated.initial") ?? "P";
  });
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.collections.length > 0 ||
    filters.favoritesOnly ||
    filters.hasRating ||
    filters.sort !== "recent";

  const paramsString = searchParams.toString();

  useEffect(() => {
    const parsed = parseRecipeFilters(new URLSearchParams(paramsString));
    setFilters({ ...parsed, tags: [], collections: parsed.collections ?? [] });
    setQueryInput(parsed.query);
    setPage(0);
  }, [paramsString]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(SHOPPING_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as string[];
      setSelectedIds(parsed);
    } catch {
      return;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SHOPPING_STORAGE_KEY, JSON.stringify(selectedIds));
  }, [selectedIds]);

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
    const { data, error: fetchError } = await supabase
      .from("collections")
      .select("id,name,color")
      .order("created_at", { ascending: true });
    if (fetchError?.message?.includes("color")) {
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
      return;
    }
    if (!fetchError) {
      setCollections(data ?? []);
    }
  };

  const loadCollectionRecipeOptions = async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [] as Array<{ id: string; title: string }>;
    const { data } = await supabase
      .from("recipes")
      .select("id,title")
      .order("created_at", { ascending: false });
    return data ?? [];
  };

  const openCollectionEditor = async (collection: Collection) => {
    setCollectionEditor(collection);
    setCollectionNameDraft(collection.name);
    const storedColors = readCollectionColors();
    setCollectionColorDraft(collection.color ?? storedColors[collection.id] ?? "");
    setCollectionError(null);
    setCollectionLoading(true);

    const [{ data: joinData }, recipeOptions] = await Promise.all([
      supabase
        .from("collection_recipes")
        .select("recipe_id")
        .eq("collection_id", collection.id),
      loadCollectionRecipeOptions(),
    ]);

    setCollectionRecipeIds((joinData ?? []).map((row) => row.recipe_id));
    setCollectionRecipeOptions(recipeOptions);
    setCollectionLoading(false);
  };

  const closeCollectionEditor = () => {
    setCollectionEditor(null);
    setCollectionNameDraft("");
    setCollectionRecipeIds([]);
    setCollectionRecipeOptions([]);
    setCollectionError(null);
    setCollectionLoading(false);
  };

  const saveCollectionEdits = async () => {
    if (!collectionEditor) return;
    const name = collectionNameDraft.trim() || collectionEditor.name;
    if (!collectionColorDraft) {
      setCollectionError("Please choose a color for your collection.");
      return;
    }
    setCollectionLoading(true);
    setCollectionError(null);

    const { error: updateError } = await supabase
      .from("collections")
      .update({ name, color: collectionColorDraft })
      .eq("id", collectionEditor.id);

    if (updateError?.message?.includes("color")) {
      const { error: fallbackError } = await supabase
        .from("collections")
        .update({ name })
        .eq("id", collectionEditor.id);
      if (fallbackError) {
        setCollectionError(fallbackError.message);
        setCollectionLoading(false);
        return;
      }
      writeCollectionColor(collectionEditor.id, collectionColorDraft);
    } else if (updateError) {
      setCollectionError(updateError.message);
      setCollectionLoading(false);
      return;
    } else {
      writeCollectionColor(collectionEditor.id, collectionColorDraft);
    }

    await supabase
      .from("collection_recipes")
      .delete()
      .eq("collection_id", collectionEditor.id);

    if (collectionRecipeIds.length) {
      await supabase.from("collection_recipes").insert(
        collectionRecipeIds.map((recipeId) => ({
          collection_id: collectionEditor.id,
          recipe_id: recipeId,
        }))
      );
    }

    setCollections((prev) =>
      prev.map((item) =>
        item.id === collectionEditor.id
          ? { ...item, name, color: collectionColorDraft }
          : item
      )
    );
    setCollectionLoading(false);
    closeCollectionEditor();
  };

  const deleteCollection = async (collectionId: string) => {
    setCollectionLoading(true);
    setCollectionError(null);
    await supabase.from("collection_recipes").delete().eq("collection_id", collectionId);
    const { error: deleteError } = await supabase
      .from("collections")
      .delete()
      .eq("id", collectionId);

    if (deleteError) {
      setCollectionError(deleteError.message);
      setCollectionLoading(false);
      return;
    }

    setCollections((prev) => prev.filter((item) => item.id !== collectionId));
    if (filters.collections.includes(collectionId)) {
      updateFilters({ collections: [] });
    }
    if (collectionEditor?.id === collectionId) {
      closeCollectionEditor();
    }
    setCollectionLoading(false);
  };

  const createCollection = async () => {
    const name = collectionCreateName.trim();
    if (!name) return;
    if (!collectionCreateColor) {
      setCollectionError("Please choose a color for your collection.");
      return;
    }
    setCollectionLoading(true);
    setCollectionError(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setCollectionError("Please sign in to manage collections.");
      setCollectionLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from("collections")
      .insert({ name, user_id: userData.user.id, color: collectionCreateColor })
      .select("id,name,color")
      .single();

    if (insertError?.message?.includes("color")) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("collections")
        .insert({ name, user_id: userData.user.id })
        .select("id,name")
        .single();
      if (fallbackError || !fallbackData) {
        setCollectionError(fallbackError?.message ?? "Unable to create collection.");
        setCollectionLoading(false);
        return;
      }
      writeCollectionColor(fallbackData.id, collectionCreateColor);
      setCollections((prev) => [...prev, { ...fallbackData, color: collectionCreateColor }]);
      setCollectionCreateName("");
      setCollectionCreateColor("");
      setShowCollectionCreate(false);
      setCollectionLoading(false);
      return;
    }

    if (insertError || !data) {
      setCollectionError(insertError?.message ?? "Unable to create collection.");
      setCollectionLoading(false);
      return;
    }

    writeCollectionColor(data.id, collectionCreateColor);
    setCollections((prev) => [...prev, data]);
    setCollectionCreateName("");
    setCollectionCreateColor("");
    setShowCollectionCreate(false);
    setCollectionLoading(false);
  };

  const toggleCollectionRecipe = (recipeId: string) => {
    setCollectionRecipeIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  useEffect(() => {
    loadCollections();
  }, []);


  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        setError("Please sign in to view saved recipes.");
        return;
      }

      let filteredRecipeIds: string[] | null = null;
      if (filters.collections.length) {
        const { data: joinData, error: joinError } = await supabase
          .from("collection_recipes")
          .select("recipe_id")
          .in("collection_id", filters.collections);

        if (joinError) {
          setError(joinError.message);
          setRecipes([]);
          setHasMore(false);
          setLoading(false);
          return;
        }

        const ids = Array.from(
          new Set((joinData ?? []).map((row) => row.recipe_id))
        );
        if (ids.length === 0) {
          setRecipes([]);
          setHasMore(false);
          setLoading(false);
          return;
        }
        filteredRecipeIds = ids;
      }

      let query = supabase
        .from("recipes")
        .select("id,title,created_at,rating_value,rating_count,is_favorite")
        .order(
          filters.sort === "rating"
            ? "rating_value"
            : filters.sort === "title"
              ? "title"
              : "created_at",
          { ascending: filters.sort === "title" }
        );

      if (filteredRecipeIds) {
        query = query.in("id", filteredRecipeIds);
      }

      if (filters.query) {
        query = query.ilike("title", `%${filters.query}%`);
      }
      if (filters.favoritesOnly) {
        query = query.eq("is_favorite", true);
      }
      if (filters.hasRating) {
        query = query.not("rating_value", "is", null);
      }

      const start = page * PAGE_SIZE;
      const end = start + PAGE_SIZE - 1;
      const { data, error: fetchError } = await query.range(start, end);

      if (fetchError) {
        setError(fetchError.message);
        setRecipes([]);
        setHasMore(false);
      } else {
        const next = data ?? [];
        setRecipes((prev) => (page === 0 ? next : [...prev, ...next]));
        setHasMore(next.length === PAGE_SIZE);
      }
      setLoading(false);
    };

    load();
  }, [filters, page]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (queryInput === filters.query) return;
      updateFilters({ query: queryInput });
    }, 350);

    return () => window.clearTimeout(id);
  }, [queryInput, filters.query]);

  const startRename = (recipe: SavedRecipe) => {
    setEditingId(recipe.id);
    setTitleDraft(recipe.title);
  };

  const saveRename = async (id: string) => {
    const { error: updateError } = await supabase
      .from("recipes")
      .update({ title: titleDraft })
      .eq("id", id);

    if (!updateError) {
      setRecipes((prev) =>
        prev.map((recipe) =>
          recipe.id === id ? { ...recipe, title: titleDraft } : recipe
        )
      );
      setEditingId(null);
      setTitleDraft("");
    }
  };

  const updateFilters = (partial: Partial<RecipeFilterState>) => {
    const next = { ...filters, ...partial, tags: [] };
    setFilters(next);
    setPage(0);
    const query = serializeRecipeFilters(next);
    router.replace(query ? `/recipes?${query}` : "/recipes", { scroll: false });
  };

  const toggleCollectionFilter = (collectionId: string) => {
    const nextCollections = filters.collections.includes(collectionId)
      ? []
      : [collectionId];
    updateFilters({ collections: nextCollections });
  };

  const toggleFavorite = async (recipe: SavedRecipe) => {
    const nextValue = !recipe.is_favorite;
    const { error: updateError } = await supabase
      .from("recipes")
      .update({ is_favorite: nextValue })
      .eq("id", recipe.id);

    if (!updateError) {
      setRecipes((prev) =>
        prev.map((item) =>
          item.id === recipe.id ? { ...item, is_favorite: nextValue } : item
        )
      );
    }
  };

  const toggleSelected = (recipeId: string) => {
    setSelectedIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };


  const deleteRecipe = async (id: string) => {
    setDeleteLoading(true);
    const { error: deleteError } = await supabase
      .from("recipes")
      .delete()
      .eq("id", id);

    if (!deleteError) {
      setRecipes((prev) => prev.filter((recipe) => recipe.id !== id));
    }
    setDeleteLoading(false);
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
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
      <section className="mx-auto w-full max-w-2xl px-4 py-12 pt-24 sm:px-6 sm:py-16">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
              Plated.
            </p>
            <h1 className="text-3xl text-[#111111] sm:text-4xl">
              Saved recipes
            </h1>
            <p className="text-sm text-[#111111]/70">
              Manage your saved recipes and return to them anytime.
            </p>
          </header>

          <div className="grid gap-4 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.35)]">
            <div className="grid gap-2">
              <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                Search
              </span>
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search saved recipes"
                className="rounded-full border border-black/10 bg-white px-4 py-3 text-sm text-[#111111] outline-none transition-colors duration-300 focus:border-black/40"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => updateFilters({ favoritesOnly: !filters.favoritesOnly })}
                variant="chip"
                size="md"
                active={filters.favoritesOnly}
              >
                Favorites
              </Button>
              <div className="flex items-center gap-2 rounded-full border border-black/10 px-4 py-2 text-xs uppercase tracking-[0.2em] text-[#111111]/70">
                Sort
                <select
                  value={filters.sort}
                  onChange={(event) =>
                    updateFilters({ sort: event.target.value as RecipeFilterState["sort"] })
                  }
                  className="bg-transparent text-xs uppercase tracking-[0.2em] text-[#111111] outline-none"
                >
                  <option value="recent">Recent</option>
                  <option value="rating">Rating</option>
                  <option value="title">Title</option>
                </select>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Collections
                </span>
                {collections.length ? (
                  <Button
                    onClick={() => setShowCollectionManager(true)}
                    variant="chip"
                    size="sm"
                  >
                    Manage
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {collections.map((collection) => {
                  const color = collection.color ?? "#111111";
                  const isActive = filters.collections.includes(collection.id);
                  return (
                    <Button
                      key={collection.id}
                      onClick={() => toggleCollectionFilter(collection.id)}
                      variant="chip"
                      size="sm"
                      style={
                        isActive
                          ? { backgroundColor: color, borderColor: color, color: "#ffffff" }
                          : { borderColor: `${color}55`, color: "#111111" }
                      }
                      className="flex items-center"
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      {collection.name}
                    </Button>
                  );
                })}
                <Button
                  onClick={() => {
                    setCollectionError(null);
                    setShowCollectionCreate((prev) => !prev);
                  }}
                  variant="chip"
                  size="iconSm"
                  aria-label="Create collection"
                >
                  +
                </Button>
              </div>
              {showCollectionCreate ? (
                <div className="grid gap-2 rounded-2xl border border-black/10 bg-white/70 p-3">
                  <input
                    value={collectionCreateName}
                    onChange={(event) => setCollectionCreateName(event.target.value)}
                    placeholder="New collection"
                    className="rounded-full border border-black/10 bg-white px-4 py-2 text-xs text-[#111111] outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {COLLECTION_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setCollectionCreateColor(color);
                          setCollectionError(null);
                        }}
                        className={`relative h-7 w-7 rounded-full border transition-all duration-300 ${
                          collectionCreateColor === color
                            ? "border-black/60 ring-2 ring-black/40 ring-offset-2"
                            : "border-black/10"
                        }`}
                        style={{ backgroundColor: color }}
                        aria-label={`Use ${color}`}
                      >
                        {collectionCreateColor === color ? (
                          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    ))}
                    <Button
                      onClick={createCollection}
                      disabled={collectionLoading}
                      variant="primary"
                      size="sm"
                      className="ml-auto px-4 py-2 text-xs"
                    >
                      {collectionLoading ? "Creating…" : "Create"}
                    </Button>
                  </div>
                </div>
              ) : null}
              {collectionError ? (
                <p className="text-sm text-[#D9534F]">{collectionError}</p>
              ) : null}
            </div>

            <Button
              onClick={() => router.push("/shopping-list")}
              disabled={selectedIds.length === 0}
              variant="primary"
              size="md"
              className="self-start px-4"
            >
              Create shopping list
              {selectedIds.length ? ` (${selectedIds.length})` : ""}
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-[#111111]/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-[#D9534F]">{error}</p>
          ) : recipes.length === 0 ? (
            <div className="grid gap-3 rounded-2xl border border-black/10 bg-white/70 p-6 text-sm text-[#111111]/70">
              <p>
                {hasActiveFilters
                  ? "No recipes match these filters."
                  : "No saved recipes yet."}
              </p>
              {hasActiveFilters ? (
                <Button
                  onClick={() => updateFilters({
                    query: "",
                    tags: [],
                    collections: [],
                    favoritesOnly: false,
                    hasRating: false,
                    sort: "recent",
                  })}
                  variant="chip"
                  size="md"
                  className="self-start px-4"
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() => router.push("/")}
                  variant="chip"
                  size="md"
                  className="self-start px-4"
                >
                  Parse your first recipe
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              {recipes.map((recipe) => (
                <div
                  key={recipe.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/recipes/${recipe.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/recipes/${recipe.id}`);
                    }
                  }}
                  className="relative flex cursor-pointer flex-col gap-3 rounded-2xl border border-black/10 bg-white/70 p-5 pb-10 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] transition-transform duration-300 hover:-translate-y-0.5"
                >
                  <label
                    className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full border border-black/10 bg-white/80 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/60"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(recipe.id)}
                      onChange={() => toggleSelected(recipe.id)}
                      className="h-3 w-3 accent-[#D9534F]"
                    />
                    Select
                  </label>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleFavorite(recipe);
                    }}
                    aria-label={
                      recipe.is_favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    className={`absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-all duration-300 ${
                      recipe.is_favorite
                        ? "border-[#D9534F] bg-[#D9534F] text-white"
                        : "border-[#D9534F]/30 bg-white/80 text-[#D9534F] hover:border-[#D9534F]/60 hover:bg-[#D9534F]/10"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill={recipe.is_favorite ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20.8 12.5c-1.6 4.1-6.6 8-8.8 9.5-2.2-1.5-7.2-5.4-8.8-9.5C1.7 8.7 4.3 6 7.5 6c1.9 0 3.6 1 4.5 2.6C12.9 7 14.6 6 16.5 6c3.2 0 5.8 2.7 4.3 6.5Z" />
                    </svg>
                  </button>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      {editingId === recipe.id ? (
                        <input
                          value={titleDraft}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                          onChange={(event) => setTitleDraft(event.target.value)}
                          className="rounded-full border border-black/10 bg-white px-3 py-2 text-sm text-[#111111] outline-none"
                        />
                      ) : (
                        <span className="text-lg text-[#111111]">
                          {recipe.title}
                        </span>
                      )}
                      <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/50">
                        {new Date(recipe.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-[#111111]/70">
                      {recipe.rating_value ? (
                        <span>
                          ★ {recipe.rating_value.toFixed(1)}
                          {recipe.rating_count ? ` (${recipe.rating_count})` : ""}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {editingId === recipe.id ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          saveRename(recipe.id);
                        }}
                        className="rounded-full bg-[#111111] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white"
                      >
                        Save
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          startRename(recipe);
                        }}
                        className="rounded-full border border-black/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]/70"
                      >
                        Rename
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(recipe);
                      }}
                      className="rounded-full border border-[#D9534F]/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#D9534F]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {hasMore && !loading && (
                <button
                  type="button"
                  onClick={() => setPage((prev) => prev + 1)}
                  className="self-center rounded-full border border-black/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
                >
                  Load more
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {showCollectionManager && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/50">
                  Collections
                </p>
                <h2 className="text-2xl text-[#111111]">Manage collections</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowCollectionManager(false)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {collections.length === 0 ? (
                <p className="text-sm text-[#111111]/70">
                  No collections yet.
                </p>
              ) : (
                collections.map((collection) => {
                  const color = collection.color ?? "#111111";
                  return (
                    <div
                      key={`${collection.id}-manage`}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-left text-sm text-[#111111]/80 transition-all duration-300 hover:-translate-y-0.5"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setShowCollectionManager(false);
                          openCollectionEditor(collection);
                        }}
                        className="flex flex-1 items-center gap-2 text-left"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        {collection.name}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCollectionManager(false);
                            openCollectionEditor(collection);
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30"
                          aria-label={`Edit ${collection.name}`}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCollection(collection.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9534F]/30 text-[#D9534F] transition-all duration-300 hover:-translate-y-0.5 hover:border-[#D9534F]/60"
                          aria-label={`Delete ${collection.name}`}
                        >
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M9 9v8" />
                            <path d="M15 9v8" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {collectionEditor && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/50">
                  Edit collection
                </p>
                <h2 className="text-2xl text-[#111111]">
                  {collectionEditor.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeCollectionEditor}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-4">
              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Name
                </span>
                <input
                  value={collectionNameDraft}
                  onChange={(event) => setCollectionNameDraft(event.target.value)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-[#111111] outline-none"
                />
              </div>
              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Color theme
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {COLLECTION_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setCollectionColorDraft(color);
                        setCollectionError(null);
                      }}
                      className={`relative h-7 w-7 rounded-full border transition-all duration-300 ${
                        collectionColorDraft === color
                          ? "border-black/60 ring-2 ring-black/40 ring-offset-2"
                          : "border-black/10"
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label={`Use ${color}`}
                    >
                      {collectionColorDraft === color ? (
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">
                          ✓
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
                  Recipes in this collection
                </span>
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-black/10 bg-white/70 p-3">
                  {collectionLoading ? (
                    <p className="text-sm text-[#111111]/70">Loading recipes…</p>
                  ) : collectionRecipeOptions.length === 0 ? (
                    <p className="text-sm text-[#111111]/70">
                      No saved recipes yet.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {collectionRecipeOptions.map((recipe) => (
                        <label
                          key={recipe.id}
                          className="flex items-center justify-between gap-4 rounded-xl border border-black/5 bg-white px-3 py-2 text-sm text-[#111111]/80"
                        >
                          <span>{recipe.title}</span>
                          <input
                            type="checkbox"
                            checked={collectionRecipeIds.includes(recipe.id)}
                            onChange={() => toggleCollectionRecipe(recipe.id)}
                            className="h-4 w-4 accent-[#D9534F]"
                          />
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {collectionError ? (
                <p className="text-sm text-[#D9534F]">{collectionError}</p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={saveCollectionEdits}
                disabled={collectionLoading}
                className="cursor-pointer rounded-full bg-[#111111] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-black disabled:opacity-60"
              >
                {collectionLoading ? "Saving…" : "Save changes"}
              </button>
              <button
                type="button"
                onClick={closeCollectionEditor}
                className="cursor-pointer rounded-full border border-black/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/50 px-4 py-6 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-[#D9534F]/20 bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.55)] animate-modal-in">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#D9534F]/70">
                  Delete recipe
                </p>
                <h2 className="text-2xl text-[#111111]">
                  Remove this recipe?
                </h2>
                <p className="text-sm text-[#111111]/70">
                  “{deleteTarget.title}” will be removed from your saved recipes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 rounded-2xl border border-[#D9534F]/20 bg-[#D9534F]/5 p-4 text-sm text-[#111111]/80">
              This action can’t be undone.
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={async () => {
                  if (!deleteTarget) return;
                  await deleteRecipe(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteLoading}
                className="cursor-pointer rounded-full bg-[#D9534F] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C94743] disabled:opacity-60"
              >
                {deleteLoading ? "Deleting…" : "Confirm delete"}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="cursor-pointer rounded-full border border-black/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
