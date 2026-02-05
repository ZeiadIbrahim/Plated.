"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

export default function SharePage() {
  const params = useParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from("shared_recipes")
        .select("payload,source_url")
        .eq("id", params.id)
        .maybeSingle();

      if (fetchError || !data) {
        setError("This shared recipe is unavailable.");
        setLoading(false);
        return;
      }

      setRecipe(data.payload as Recipe);
      setSourceUrl(data.source_url ?? null);
      setLoading(false);
    };

    load();
  }, [params.id]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] px-4 py-16">
        <p className="text-sm text-[#111111]/70">Loading…</p>
      </main>
    );
  }

  if (error || !recipe) {
    return (
      <main className="min-h-screen bg-[#FAFAFA] px-4 py-16">
        <p className="text-sm text-[#D9534F]">{error ?? "Not found"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#FAFAFA]">
      <RecipeCard recipe={recipe} showSave={false} sourceUrl={sourceUrl} />
    </main>
  );
}
