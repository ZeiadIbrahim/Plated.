import { describe, expect, it } from "vitest";
import { mergeShoppingList } from "@/lib/shoppingList";

const makeRecipe = (title: string, ingredients: Array<{ item: string; amount: number | null; unit: string | null }>) => ({
  title,
  original_servings: 2,
  ingredients,
  instructions: [],
});

describe("mergeShoppingList", () => {
  it("merges amounts when units match", () => {
    const list = mergeShoppingList([
      makeRecipe("A", [{ item: "Olive oil", amount: 1, unit: "tbsp" }]),
      makeRecipe("B", [{ item: "olive oil", amount: 2, unit: "tbsp" }]),
    ]);

    expect(list).toHaveLength(1);
    expect(list[0].amount).toBe(3);
  });

  it("keeps separate items when units differ", () => {
    const list = mergeShoppingList([
      makeRecipe("A", [{ item: "Sugar", amount: 1, unit: "cup" }]),
      makeRecipe("B", [{ item: "Sugar", amount: 200, unit: "g" }]),
    ]);

    expect(list.length).toBeGreaterThan(1);
  });

  it("includes recipe titles", () => {
    const list = mergeShoppingList([
      makeRecipe("A", [{ item: "Salt", amount: null, unit: null }]),
      makeRecipe("B", [{ item: "Salt", amount: null, unit: null }]),
    ]);

    expect(list[0].recipes).toContain("A");
    expect(list[0].recipes).toContain("B");
  });
});
