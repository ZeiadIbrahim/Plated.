export type RecipeSort = "recent" | "rating" | "title";

export type RecipeFilterState = {
  query: string;
  tags: string[];
  collections: string[];
  favoritesOnly: boolean;
  hasRating: boolean;
  sort: RecipeSort;
};

export const normalizeTag = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

export const parseRecipeFilters = (params: URLSearchParams): RecipeFilterState => {
  const query = params.get("q") ?? "";
  const tagsRaw = params.get("tags") ?? "";
  const tags = tagsRaw
    .split(",")
    .map((tag) => normalizeTag(tag))
    .filter(Boolean);
  const collectionsRaw = params.get("collections") ?? "";
  const collections = collectionsRaw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const favoritesOnly = params.get("fav") === "1";
  const hasRating = params.get("rating") === "1";
  const sort = (params.get("sort") as RecipeSort) ?? "recent";
  return {
    query,
    tags,
    collections,
    favoritesOnly,
    hasRating,
    sort: ["recent", "rating", "title"].includes(sort) ? sort : "recent",
  };
};

export const serializeRecipeFilters = (state: RecipeFilterState) => {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.tags.length) params.set("tags", state.tags.join(","));
  if (state.collections.length) {
    params.set("collections", state.collections.join(","));
  }
  if (state.favoritesOnly) params.set("fav", "1");
  if (state.hasRating) params.set("rating", "1");
  if (state.sort !== "recent") params.set("sort", state.sort);
  return params.toString();
};
