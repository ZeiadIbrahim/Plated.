"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SavedRecipe = {
  id: string;
  title: string;
  created_at: string;
  rating_value: number | null;
  rating_count: number | null;
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<SavedRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SavedRecipe | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setLoading(false);
        setError("Please sign in to view saved recipes.");
        return;
      }

      const { data, error: fetchError } = await supabase
        .from("recipes")
        .select("id,title,created_at,rating_value,rating_count")
        .order("created_at", { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setRecipes(data ?? []);
      }
      setLoading(false);
    };

    load();
  }, []);

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

          {loading ? (
            <p className="text-sm text-[#111111]/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-[#D9534F]">{error}</p>
          ) : recipes.length === 0 ? (
            <p className="text-sm text-[#111111]/70">
              No saved recipes yet.
            </p>
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
                  className="flex cursor-pointer flex-col gap-3 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] transition-transform duration-300 hover:-translate-y-0.5"
                >
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
                    {recipe.rating_value ? (
                      <span className="text-sm text-[#111111]/70">
                        ★ {recipe.rating_value.toFixed(1)}
                        {recipe.rating_count ? ` (${recipe.rating_count})` : ""}
                      </span>
                    ) : null}
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
            </div>
          )}
        </div>
      </section>

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
