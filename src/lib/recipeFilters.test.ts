import { describe, expect, it } from "vitest";
import { normalizeTag, parseRecipeFilters, serializeRecipeFilters } from "@/lib/recipeFilters";

describe("normalizeTag", () => {
  it("normalizes spacing and casing", () => {
    expect(normalizeTag("  WeekNight  Meals ")).toBe("weeknight meals");
  });
});

describe("recipe filter query params", () => {
  it("round-trips filter state", () => {
    const params = new URLSearchParams(
      "q=chicken&tags=weeknight%2Cgluten-free&fav=1&rating=1&sort=rating"
    );
    const state = parseRecipeFilters(params);
    expect(state.query).toBe("chicken");
    expect(state.tags).toEqual(["weeknight", "gluten-free"]);
    expect(state.favoritesOnly).toBe(true);
    expect(state.hasRating).toBe(true);
    expect(state.sort).toBe("rating");

    const serialized = serializeRecipeFilters(state);
    expect(serialized).toContain("q=chicken");
    expect(serialized).toContain("tags=weeknight%2Cgluten-free");
    expect(serialized).toContain("fav=1");
    expect(serialized).toContain("rating=1");
    expect(serialized).toContain("sort=rating");
  });
});
