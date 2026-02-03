"use client";

import { useMemo, useState } from "react";
import { useRecipeMath } from "@/hooks/useRecipeMath";
import type { Recipe } from "@/types/recipe";

type RecipeCardProps = {
  recipe: Recipe;
  onSave?: () => void;
  isSaving?: boolean;
  saveMessage?: string | null;
  showSave?: boolean;
  sourceUrl?: string | null;
};

const servingsLabel = (value: number) => `${value} serving${value === 1 ? "" : "s"}`;

const ALLERGEN_RULES: Record<string, { label: string }> = {
  gluten: { label: "G" },
  dairy: { label: "L" },
  eggs: { label: "E" },
  nuts: { label: "N" },
  peanuts: { label: "P" },
  soy: { label: "S" },
  fish: { label: "F" },
  shellfish: { label: "H" },
  sesame: { label: "Se" },
  mustard: { label: "M" },
  celery: { label: "C" },
  sulfites: { label: "Su" },
  lupin: { label: "Lu" },
  mollusks: { label: "Mo" },
};

const renderAllergenIcon = (allergen: string) => {
  switch (allergen) {
    case "gluten":
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 4v16" />
          <path d="M8 8c2 0 2-2 4-2" />
          <path d="M8 12c2 0 2-2 4-2" />
          <path d="M8 16c2 0 2-2 4-2" />
        </svg>
      );
    case "dairy":
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 4h8l-1 4H9L8 4Z" />
          <path d="M7 8h10v12H7z" />
        </svg>
      );
    case "eggs":
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5c-4 0-6 4-6 8a6 6 0 0 0 12 0c0-4-2-8-6-8Z" />
        </svg>
      );
    case "fish":
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 12c4-4 12-4 16 0-4 4-12 4-16 0Z" />
          <circle cx="16" cy="12" r="1" />
        </svg>
      );
    case "nuts":
    case "peanuts":
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M8 6c3-2 5 2 3 4" />
          <path d="M16 18c-3 2-5-2-3-4" />
          <path d="M7 9c0 4 4 8 8 8" />
        </svg>
      );
    default:
      return (
        <svg
          aria-hidden="true"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      );
  }
};

const inferAllergens = (item: string) => {
  const text = item.toLowerCase();
  const matches = new Set<string>();

  if (
    /\b(bread|panko|breadcrumbs|flour|wheat|pasta|noodle|tortilla|bun|crouton|cracker|barley|rye)\b/.test(
      text
    )
  ) {
    matches.add("gluten");
  }
  if (/(milk|cream|cheese|butter|yogurt|whey|parmesan|mozzarella|cheddar|ricotta)/.test(text)) {
    matches.add("dairy");
  }
  if (/\b(egg|eggs|mayonnaise|mayo)\b/.test(text)) {
    matches.add("eggs");
  }
  if (/\b(almond|walnut|pecan|hazelnut|cashew|pistachio)\b/.test(text)) {
    matches.add("nuts");
  }
  if (/\b(peanut|peanuts)\b/.test(text)) {
    matches.add("peanuts");
  }
  if (/\b(soy|tofu|edamame|miso|tempeh|soy sauce)\b/.test(text)) {
    matches.add("soy");
  }
  if (/\b(tuna|salmon|cod|anchovy|anchovies|fish)\b/.test(text)) {
    matches.add("fish");
  }
  if (/\b(shrimp|prawn|crab|lobster|shellfish|scallop|mussel|clam|oyster)\b/.test(text)) {
    matches.add("shellfish");
    matches.add("mollusks");
  }
  if (/\b(sesame|tahini)\b/.test(text)) {
    matches.add("sesame");
  }
  if (/\b(mustard)\b/.test(text)) {
    matches.add("mustard");
  }
  if (/\b(celery)\b/.test(text)) {
    matches.add("celery");
  }
  if (/\b(sulfite|sulphite|wine|vinegar)\b/.test(text)) {
    matches.add("sulfites");
  }
  if (/\b(lupin)\b/.test(text)) {
    matches.add("lupin");
  }

  return Array.from(matches);
};

export const RecipeCard = ({
  recipe,
  onSave,
  isSaving,
  saveMessage,
  showSave = true,
  sourceUrl,
}: RecipeCardProps) => {
  const [servings, setServings] = useState(recipe.original_servings);
  const [isMetric, setIsMetric] = useState(false);
  const computed = useRecipeMath(recipe, servings, isMetric);

  const sliderRange = useMemo(() => {
    const min = Math.max(1, recipe.original_servings - 4);
    const max = recipe.original_servings + 6;
    return { min, max };
  }, [recipe.original_servings]);

  const groupedIngredients = useMemo(() => {
    return computed.ingredients.reduce<Record<string, typeof computed.ingredients>>(
      (acc, ingredient) => {
        const group = ingredient.group?.trim() || "Ingredients";
        if (!acc[group]) acc[group] = [];
        acc[group].push(ingredient);
        return acc;
      },
      {}
    );
  }, [computed.ingredients]);

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-col gap-8 animate-fade-up">
        <header className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.3em] text-[#111111]/60">
            Plated. Recipe
          </p>
          {recipe.image_url ? (
            <div className="group relative overflow-hidden rounded-3xl border border-black/10 bg-white/80 shadow-[0_20px_50px_-35px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-0 bg-linear-to-br from-black/10 via-transparent to-black/15 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <img
                src={recipe.image_url}
                alt={computed.title}
                loading="lazy"
                className="aspect-video w-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              />
            </div>
          ) : null}
          <h1 className="text-4xl leading-tight text-[#111111]">
            {computed.title}
          </h1>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs uppercase tracking-[0.2em] text-[#111111]/60 underline decoration-black/20 underline-offset-4 transition-colors duration-300 hover:text-[#111111]"
            >
              Original source
            </a>
          ) : null}
          <div className="flex flex-wrap items-center gap-3 text-sm text-[#111111]/70">
            <span>{servingsLabel(computed.servings)}</span>
            <span>•</span>
            <span>{isMetric ? "Metric" : "Imperial"}</span>
            {recipe.rating?.value ? (
              <>
                <span>•</span>
                <span className="inline-flex items-center gap-2">
                  <span className="text-[#111111]">★</span>
                  {recipe.rating.value.toFixed(1)}
                  {recipe.rating.count ? (
                    <span className="text-[#111111]/60">
                      ({recipe.rating.count})
                    </span>
                  ) : null}
                </span>
              </>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_30px_80px_-45px_rgba(0,0,0,0.4)]">
          <div className="grid gap-2">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#111111]/50">
              Adjust servings
            </span>
            <input
              type="range"
              min={sliderRange.min}
              max={sliderRange.max}
              value={servings}
              onChange={(event) => setServings(Number(event.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-black/10"
            />
            <div className="flex items-center justify-between text-xs text-[#111111]/60">
              <span>{servingsLabel(sliderRange.min)}</span>
              <span>{servingsLabel(sliderRange.max)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-[#111111]/70">Units</span>
              <button
                type="button"
                onClick={() => setIsMetric((prev) => !prev)}
                className="cursor-pointer rounded-full border border-black/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-[#111111] transition-all duration-300 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5 hover:shadow-[0_8px_20px_-14px_rgba(17,17,17,0.6)] hover:ring-1 hover:ring-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/50"
              >
                {isMetric ? "Metric" : "Imperial"}
              </button>
            </div>
            {showSave ? (
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving}
                className="cursor-pointer rounded-full bg-[#D9534F] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#C94743] hover:shadow-[0_12px_28px_-18px_rgba(217,83,79,0.7)] hover:ring-1 hover:ring-[#D9534F]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9534F] disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
            ) : null}
          </div>
          {saveMessage ? (
            <p className="text-xs uppercase tracking-[0.2em] text-[#111111]/60">
              {saveMessage}
            </p>
          ) : null}
        </div>

        <div className="grid gap-10">
          <section className="grid gap-6">
            <h2 className="text-lg uppercase tracking-[0.2em] text-[#111111]/70">
              Ingredients
            </h2>
            <div className="grid gap-6">
              {Object.entries(groupedIngredients).map(([group, items]) => (
                <div key={group} className="grid gap-3">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[#111111]/70">
                    {group}
                  </h3>
                  <div className="h-px w-full bg-black/10" />
                  <ul className="grid gap-3 text-base leading-relaxed text-[#111111]">
                    {items.map((ingredient, index) => {
                      const inferred = inferAllergens(ingredient.item);
                      return (
                        <li
                          key={`${ingredient.item}-${index}`}
                          className="flex flex-wrap items-center gap-3"
                        >
                          <span className="min-w-30 font-semibold">
                            {ingredient.displayAmount ?? ""}
                            {ingredient.displayAmount && ingredient.displayUnit
                              ? " "
                              : ""}
                            {ingredient.displayUnit ?? ""}
                          </span>
                          <span className="text-[#111111]/80">
                            {ingredient.item}
                          </span>
                          {inferred.length > 0 && (
                            <span className="flex flex-wrap gap-2">
                              {inferred.map((allergen) => (
                                <span
                                  key={`${ingredient.item}-${allergen}`}
                                  className="group relative inline-flex items-center gap-1 rounded-full border border-black/10 bg-white px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/70 transition-all duration-200 hover:-translate-y-0.5 hover:border-black/30 hover:bg-black/5 hover:text-[#111111]"
                                >
                                  <span aria-hidden="true" className="group-hover:scale-110">
                                    {renderAllergenIcon(allergen)}
                                  </span>
                                  <span className="font-semibold">
                                    {ALLERGEN_RULES[allergen]?.label ?? allergen[0]}
                                  </span>
                                  <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 w-max -translate-x-1/2 rounded-full border border-black/10 bg-white px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[#111111]/70 opacity-0 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.4)] transition-all duration-200 group-hover:opacity-100">
                                    Contains {allergen}
                                  </span>
                                </span>
                              ))}
                            </span>
                          )}
                          {ingredient.optional ? (
                            <span className="text-xs uppercase tracking-[0.2em] text-[#111111]/40">
                              optional
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-4">
            <h2 className="text-lg uppercase tracking-[0.2em] text-[#111111]/70">
              Instructions
            </h2>
            <ol className="grid gap-4 text-base leading-relaxed text-[#111111]">
              {computed.instructions.map((step, index) => (
                <li key={`${step}-${index}`} className="flex gap-4">
                  <span className="text-sm font-semibold text-[#111111]/50">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="text-[#111111]/80">{step}</p>
                </li>
              ))}
            </ol>
          </section>

          {recipe.tips && recipe.tips.length > 0 && (
            <section className="grid gap-4">
              <h2 className="text-lg uppercase tracking-[0.2em] text-[#111111]/70">
                Tips & Tricks
              </h2>
              <ul className="grid gap-3 text-base leading-relaxed text-[#111111]">
                {recipe.tips.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="flex gap-3">
                    <span className="text-sm font-semibold text-[#111111]/50">
                      •
                    </span>
                    <p className="text-[#111111]/80">{tip}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </section>
  );
};
