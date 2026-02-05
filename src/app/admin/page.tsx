"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/Button";

type AdminRecipe = {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
  source_url: string | null;
};

type AdminUser = {
  id: string;
  email: string | null;
  created_at: string;
  role: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<AdminRecipe[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setLoading(false);
        setError("Please sign in.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const metadataRole = userData.user?.user_metadata?.role;
      const appRole = userData.user?.app_metadata?.role;
      const admin = metadataRole === "admin" || appRole === "admin";
      setIsAdmin(admin);

      if (!admin) {
        setLoading(false);
        setError("Admin access required.");
        return;
      }

      const [usersResponse, recipesResponse] = await Promise.all([
        fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/recipes", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const usersPayload = await usersResponse.json();
      const recipesPayload = await recipesResponse.json();

      if (!usersResponse.ok) {
        setError(usersPayload?.error ?? "Unable to load users.");
        setLoading(false);
        return;
      }

      if (!recipesResponse.ok) {
        setError(recipesPayload?.error ?? "Unable to load recipes.");
        setLoading(false);
        return;
      }

      setUsers(usersPayload.users ?? []);
      setRecipes(recipesPayload.recipes ?? []);
      setLoading(false);
    };

    load();
  }, []);

  const deleteRecipe = async (id: string) => {
    if (deletingId) return;
    const confirmed = window.confirm("Delete this recipe? This can’t be undone.");
    if (!confirmed) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    setDeletingId(id);
    const response = await fetch(`/api/admin/recipes?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setRecipes((prev) => prev.filter((item) => item.id !== id));
    }
    setDeletingId(null);
  };

  const deleteUser = async (id: string) => {
    if (deletingUserId) return;
    const confirmed = window.confirm(
      "Delete this user and all their recipes? This can’t be undone."
    );
    if (!confirmed) return;

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    setDeletingUserId(id);
    const response = await fetch(`/api/admin/users?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      setUsers((prev) => prev.filter((user) => user.id !== id));
      setRecipes((prev) => prev.filter((recipe) => recipe.user_id !== id));
      if (selectedUserId === id) {
        setSelectedUserId(null);
      }
    }
    setDeletingUserId(null);
  };

  const loadRecipesForUser = async (id: string | null) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return;

    const url = id ? `/api/admin/recipes?user_id=${id}` : "/api/admin/recipes";
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (response.ok) {
      setRecipes(payload.recipes ?? []);
    }
  };

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <section className="mx-auto w-full max-w-4xl px-4 py-16 sm:px-6">
        <div className="flex flex-col gap-6">
          <header className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                Admin console
              </p>
              <h1 className="text-3xl text-[#111111] sm:text-4xl">Plated Admin</h1>
              <p className="text-sm text-[#111111]/70">
                Manage recipes across all users.
              </p>
            </div>
            <Button
              onClick={() => router.push("/")}
              variant="chip"
              size="md"
              className="px-4 text-[#111111]/70"
            >
              Back home
            </Button>
          </header>

          {loading ? (
            <p className="text-sm text-[#111111]/70">Loading…</p>
          ) : error ? (
            <p className="text-sm text-[#D9534F]">{error}</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <div className="grid gap-4 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.35)]">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                    Users
                  </p>
                  <Button
                    onClick={() => {
                      setSelectedUserId(null);
                      loadRecipesForUser(null);
                    }}
                    variant="ghost"
                    size="sm"
                    className="text-[#111111]/60"
                  >
                    All recipes
                  </Button>
                </div>
                <div className="grid gap-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className={`rounded-xl border px-4 py-3 text-xs uppercase tracking-[0.2em] transition-all duration-200 ${
                        selectedUserId === user.id
                          ? "border-black/30 bg-black/5 text-[#111111]"
                          : "border-black/10 text-[#111111]/70"
                      }`}
                    >
                      <Button
                        onClick={() => {
                          setSelectedUserId(user.id);
                          loadRecipesForUser(user.id);
                        }}
                        variant="ghost"
                        size="md"
                        className="w-full text-left normal-case tracking-normal font-normal"
                      >
                        <div className="text-sm normal-case tracking-normal">
                          {user.email ?? "No email"}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#111111]/50">
                          <span>{user.id.slice(0, 8)}</span>
                          {user.role ? <span>• {user.role}</span> : null}
                        </div>
                      </Button>
                      <div className="mt-3">
                        <Button
                          onClick={() => deleteUser(user.id)}
                          disabled={deletingUserId === user.id}
                          variant="destructive"
                          size="sm"
                          className="px-3 py-1 text-[10px]"
                        >
                          {deletingUserId === user.id ? "Deleting…" : "Delete user"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
                    Recipes
                  </p>
                  <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/50">
                    {selectedUserId ? "Filtered" : "All"}
                  </span>
                </div>
                {recipes.length === 0 ? (
                  <p className="text-sm text-[#111111]/60">
                    No recipes found.
                  </p>
                ) : (
                  <div className="grid gap-4">
                    {recipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_20px_50px_-40px_rgba(0,0,0,0.35)]"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-col gap-1">
                            <p className="text-lg text-[#111111]">
                              {recipe.title}
                            </p>
                            <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/50">
                              {new Date(recipe.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/50">
                            {recipe.user_id}
                          </span>
                        </div>
                        {recipe.source_url ? (
                          <a
                            href={recipe.source_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs uppercase tracking-[0.2em] text-[#111111]/60 underline decoration-black/20 underline-offset-4"
                          >
                            Source
                          </a>
                        ) : null}
                        <div>
                          <Button
                            onClick={() => deleteRecipe(recipe.id)}
                            disabled={deletingId === recipe.id}
                            variant="destructive"
                            size="md"
                            className="px-4"
                          >
                            {deletingId === recipe.id ? "Deleting…" : "Delete"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
