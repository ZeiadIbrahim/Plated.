import type { Recipe } from "@/types/recipe";

export type ShoppingListItem = {
  key: string;
  item: string;
  amount: number | null;
  unit: string | null;
  recipes: string[];
};

const normalizeItemKey = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (/(all[- ]purpose|plain|white) flour/.test(base)) {
    return "flour";
  }

  return base;
};

const normalizeItemLabel = (value: string) => {
  const key = normalizeItemKey(value);
  if (key === "flour") return "Flour";
  return value;
};

export const mergeShoppingList = (recipes: Recipe[]) => {
  const map = new Map<string, ShoppingListItem>();

  recipes.forEach((recipe) => {
    recipe.ingredients.forEach((ingredient) => {
      const baseKey = normalizeItemKey(ingredient.item);
      const amount = typeof ingredient.amount === "number" ? ingredient.amount : null;
      const unit = ingredient.unit ?? null;
      const unitKey = unit ?? "unitless";
      const key = `${baseKey}::${unitKey}`;
      const recipeTitle = recipe.title;

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          key,
          item: normalizeItemLabel(ingredient.item),
          amount,
          unit,
          recipes: [recipeTitle],
        });
        return;
      }

      if (existing.amount !== null && amount !== null) {
        existing.amount += amount;
      }

      if (!existing.recipes.includes(recipeTitle)) {
        existing.recipes.push(recipeTitle);
      }
    });
  });

  return Array.from(map.values());
};
