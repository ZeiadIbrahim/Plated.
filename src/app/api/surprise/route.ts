const fetchPixabayImage = async (query: string, recipe: Recipe) => {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return null;
  const url = new URL("https://pixabay.com/api/");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", query);
  url.searchParams.set("image_type", "photo");
  url.searchParams.set("orientation", "horizontal");
  url.searchParams.set("per_page", "24");
  const response = await fetch(url.toString());
  if (!response.ok) return null;
  const data = (await response.json()) as {
    hits?: Array<{ webformatURL?: string; largeImageURL?: string; tags?: string }>;
  };
  const photos = data.hits ?? [];
  if (!photos.length) return null;
  // Score by tags
  const recipeWords = [recipe.title, ...recipe.ingredients.map(i => i.item)].join(" ").toLowerCase().split(/\W+/);
  const scored = photos.map(photo => {
    const tags = (photo.tags ?? "").toLowerCase();
    const score = recipeWords.filter(word => word.length > 2 && tags.includes(word)).length;
    return { photo, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.photo;
  return best?.largeImageURL ?? best?.webformatURL ?? null;
};
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

type SurprisePreferences = {
  glutenFree?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  lactoseFree?: boolean;
  alcoholFree?: boolean;
  halal?: boolean;
  dairyFree?: boolean;
  nutFree?: boolean;
};

type MealDbMeal = Record<string, unknown>;

type RecipeIngredient = {
  group?: string | null;
  item: string;
  amount: number | null;
  unit: string | null;
  optional?: boolean | null;
};

type Recipe = {
  title: string;
  author?: string | null;
  original_servings: number;
  image_url?: string | null;
  allergens?: string[];
  tips?: string[];
  rating?: {
    value: number | null;
    count: number | null;
  };
  ingredients: RecipeIngredient[];
  instructions: string[];
};

const MEALDB_RANDOM = "https://www.themealdb.com/api/json/v1/1/random.php";

const ingredientKeywords = {
  gluten: [
    "wheat",
    "flour",
    "bread",
    "pasta",
    "noodle",
    "breadcrumbs",
    "barley",
    "rye",
    "couscous",
    "cracker",
    "crouton",
    "semolina",
    "soy sauce",
    "tortilla",
    "beer",
  ],
  dairy: [
    "milk",
    "cream",
    "cheese",
    "butter",
    "yogurt",
    "whey",
    "parmesan",
    "mozzarella",
    "cheddar",
    "ricotta",
    "ghee",
  ],
  alcohol: [
    "wine",
    "beer",
    "rum",
    "vodka",
    "whiskey",
    "bourbon",
    "brandy",
    "gin",
    "tequila",
    "liqueur",
    "cider",
    "champagne",
    "sherry",
    "marsala",
    "amaretto",
  ],
  pork: [
    "pork",
    "bacon",
    "ham",
    "prosciutto",
    "pancetta",
    "sausage",
    "chorizo",
    "salami",
    "pepperoni",
    "lard",
  ],
  nuts: [
    "almond",
    "walnut",
    "pecan",
    "hazelnut",
    "cashew",
    "pistachio",
    "peanut",
    "peanuts",
    "nut",
    "nuts",
    "macadamia",
    "pine nut",
  ],
};

const SYSTEM_PROMPT =
  "You are a meticulous recipe developer. Return ONLY valid JSON using this schema: { title: string, original_servings: number, rating: { value: null, count: null }, allergens: [string], tips: [string], ingredients: [{ group: string|null, item: string, amount: number|null, unit: string|null, optional: boolean|null }], instructions: [string] }. Use concise, realistic ingredient names. Use decimal numbers for amounts. If a unit is missing, set unit to null. Keep 6-12 ingredients and 6-10 steps. For allergens, only include items from: gluten, dairy, nuts, peanuts, soy, eggs, fish, shellfish, sesame, mustard, celery, sulfites, lupin, mollusks. Do not include ingredients that violate the provided dietary restrictions or allergies.";

const cleanInstruction = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(equipment|instructions|method|directions|steps)$/i.test(trimmed)) {
    return "";
  }
  const withoutPrefix = trimmed.replace(
    /^(step\s*\d+\s*[:.-]?|\d+\s*[\).:-])\s*/i,
    ""
  );
  const collapsed = withoutPrefix.replace(/\s{2,}/g, " ").trim();
  if (/^(equipment|instructions|method|directions|steps)$/i.test(collapsed)) {
    return "";
  }
  return collapsed;
};

const normalizeInstructions = (steps: string[]) => {
  const cleaned = steps
    .map((step) => cleanInstruction(step))
    .filter(
      (step) =>
        !!step &&
        !/^step\s*\d+$/i.test(step) &&
        !/^\d+$/.test(step)
    );

  const merged: string[] = [];
  for (const step of cleaned) {
    if (!merged.length) {
      merged.push(step);
      continue;
    }
    const last = merged[merged.length - 1];
    const lastEnds = /[.!?]$/.test(last.trim());
    const shouldMerge = step.length < 40 || !lastEnds;
    if (shouldMerge) {
      merged[merged.length - 1] = `${last} ${step}`.replace(/\s{2,}/g, " ");
    } else {
      merged.push(step);
    }
  }

  return merged;
};

const extractJson = (value: string) => {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON payload found in model response.");
  }
  const jsonString = value.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
};

const normalizeIngredient = (ingredient: {
  group?: string | null;
  item?: string | null;
  amount?: number | string | null;
  unit?: string | null;
  optional?: boolean | null;
}) => {
  const rawItem = (ingredient.item ?? "").toString();
  const optionalFromText = /\boptional\b/i.test(rawItem);
  const cleanedItem = rawItem
    .replace(/\(\s*optional\s*\)/gi, "")
    .replace(/\boptional\b/gi, "")
    .replace(
      /^\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?\s*(?:[a-zA-Z]+|fl\s?oz|oz|g|kg|ml|l|tbsp|tsp|cup|cups|lb)s?\s*(?:\/\s*\d+(?:\.\d+)?(?:\s+\d+\/\d+)?\s*(?:[a-zA-Z]+|fl\s?oz|oz|g|kg|ml|l|tbsp|tsp|cup|cups|lb)s?)?\s*/i,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();

  const amount =
    ingredient.amount === null || ingredient.amount === undefined
      ? null
      : typeof ingredient.amount === "number"
        ? ingredient.amount
        : Number.parseFloat(ingredient.amount);

  return {
    group: ingredient.group ?? "Ingredients",
    item: cleanedItem || rawItem,
    amount: Number.isNaN(amount as number) ? null : (amount as number | null),
    unit: ingredient.unit ?? null,
    optional: ingredient.optional ?? optionalFromText,
  };
};

const normalizeAllergens = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const allowed = new Set([
    "gluten",
    "dairy",
    "nuts",
    "peanuts",
    "soy",
    "eggs",
    "fish",
    "shellfish",
    "sesame",
    "mustard",
    "celery",
    "sulfites",
    "lupin",
    "mollusks",
  ]);

  return value
    .map((item) => item?.toString().toLowerCase().trim())
    .filter((item): item is string => !!item && allowed.has(item));
};

const normalizeTips = (value: unknown) => {
  if (!value) return [] as string[];
  if (Array.isArray(value)) {
    return value
      .map((tip) => tip?.toString().trim())
      .filter((tip): tip is string => !!tip)
      .slice(0, 5);
  }
  if (typeof value === "string") {
    const parts = value
      .split(/\r?\n|•|-\s+|\d+\.|\d+\)/)
      .map((tip) => tip.trim())
      .filter(Boolean);
    return parts.slice(0, 5);
  }
  return [] as string[];
};

const normalizeGroupLabel = (value: string) => {
  const trimmed = value.replace(/:$/, "").trim();
  return trimmed.replace(/^for\s+the\s+/i, "");
};

const applyIngredientGrouping = (ingredients: RecipeIngredient[]) => {
  let currentGroup = "Ingredients";
  const grouped: RecipeIngredient[] = [];

  for (const ingredient of ingredients) {
    const item = ingredient.item?.trim() ?? "";
    const explicitGroup = ingredient.group?.trim();
    if (explicitGroup && explicitGroup !== "Ingredients") {
      currentGroup = explicitGroup;
      grouped.push({ ...ingredient, group: explicitGroup });
      continue;
    }

    const looksLikeHeader =
      !ingredient.amount &&
      !ingredient.unit &&
      !!item &&
      (/:$/.test(item) ||
        /^(for\s+the|additions?|toppings?|topping|sauce|dressing|filling|crust|base|marinade|mix|glaze|garnish|to serve|optional)/i.test(
          item
        ) ||
        (/^[A-Z0-9\s&-]{3,}$/.test(item) && item.split(" ").length <= 6));

    if (looksLikeHeader) {
      currentGroup = normalizeGroupLabel(item) || currentGroup;
      continue;
    }

    grouped.push({
      ...ingredient,
      group: ingredient.group ?? currentGroup,
    });
  }

  return grouped;
};

const parseFractionAmount = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null as number | null;
  if (trimmed.includes(" ")) {
    const [whole, rest] = trimmed.split(/\s+/);
    const wholeValue = Number.parseFloat(whole);
    const fractionValue = parseFractionAmount(rest);
    if (Number.isFinite(wholeValue) && fractionValue !== null) {
      return wholeValue + fractionValue;
    }
  }
  if (trimmed.includes("/")) {
    const [numerator, denominator] = trimmed.split("/");
    const numeratorValue = Number.parseFloat(numerator);
    const denominatorValue = Number.parseFloat(denominator);
    if (
      Number.isFinite(numeratorValue) &&
      Number.isFinite(denominatorValue) &&
      denominatorValue !== 0
    ) {
      return numeratorValue / denominatorValue;
    }
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isNaN(numeric) ? null : numeric;
};

const parseMealDbMeasure = (value?: string) => {
  if (!value) return { amount: null as number | null, unit: null as string | null };
  const cleaned = value
    .trim()
    .replace(/½/g, "1/2")
    .replace(/¼/g, "1/4")
    .replace(/¾/g, "3/4")
    .replace(/⅓/g, "1/3")
    .replace(/⅔/g, "2/3")
    .replace(/⅛/g, "1/8")
    .replace(/⅜/g, "3/8")
    .replace(/⅝/g, "5/8")
    .replace(/⅞/g, "7/8")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (!cleaned) {
    return { amount: null, unit: null };
  }

  const match = cleaned.match(
    /^(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(.*)$/
  );
  if (!match) {
    return { amount: null, unit: null };
  }

  const amountValue = parseFractionAmount(match[1]);
  const unitValue = match[2]?.trim() || null;
  return { amount: amountValue, unit: unitValue };
};

const getIngredients = (meal: MealDbMeal) =>
  Array.from({ length: 20 })
    .map((_, index) => meal[`strIngredient${index + 1}`] as string | undefined)
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

const matchesPreferences = (meal: MealDbMeal, prefs: SurprisePreferences) => {
  const category = (meal.strCategory as string | undefined)?.toLowerCase() ?? "";
  const tags = (meal.strTags as string | undefined)?.toLowerCase() ?? "";
  const ingredients = getIngredients(meal);
  const ingredientText = ingredients.join(" ");
  const hasKeyword = (list: string[]) =>
    list.some((keyword) => ingredientText.includes(keyword));

  if (prefs.vegan) {
    if (!(category.includes("vegan") || tags.includes("vegan"))) return false;
  }
  if (prefs.vegetarian) {
    if (
      !(
        category.includes("vegetarian") ||
        category.includes("vegan") ||
        tags.includes("vegetarian") ||
        tags.includes("vegan")
      )
    )
      return false;
  }
  if (prefs.glutenFree && hasKeyword(ingredientKeywords.gluten)) return false;
  if ((prefs.lactoseFree || prefs.dairyFree) && hasKeyword(ingredientKeywords.dairy)) {
    return false;
  }
  if (prefs.nutFree && hasKeyword(ingredientKeywords.nuts)) return false;
  if (prefs.alcoholFree && hasKeyword(ingredientKeywords.alcohol)) return false;
  if (prefs.halal) {
    if (hasKeyword(ingredientKeywords.alcohol)) return false;
    if (hasKeyword(ingredientKeywords.pork)) return false;
  }
  return true;
};

const getAuthToken = (request: Request) => {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
};

const listAvailableModels = async (apiKey: string) => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!response.ok) {
    throw new Error("Failed to list Gemini models");
  }
  const data = (await response.json()) as {
    models?: { name: string; supportedGenerationMethods?: string[] }[];
  };

  return (data.models ?? [])
    .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
    .map((model) => model.name.replace(/^models\//, ""));
};

const pickFallbackModel = (models: string[]) => {
  const preferred = models.find((model) => model.includes("gemini-1.5-flash"));
  return preferred ?? models[0];
};

const getPreferenceSummary = (preferences: SurprisePreferences) => {
  const labels: string[] = [];
  if (preferences.vegan) labels.push("Vegan");
  if (preferences.vegetarian) labels.push("Vegetarian");
  if (preferences.glutenFree) labels.push("Gluten-free");
  if (preferences.lactoseFree || preferences.dairyFree) labels.push("Dairy-free");
  if (preferences.nutFree) labels.push("Nut-free");
  if (preferences.alcoholFree) labels.push("Alcohol-free");
  if (preferences.halal) labels.push("Halal");
  return labels.length ? labels.join(", ") : "No special restrictions";
};

const fetchMealDbRecipe = (meal: MealDbMeal): Recipe => {
  const title = (meal.strMeal as string | undefined) ?? "Untitled Recipe";
  const instructionsRaw = (meal.strInstructions as string | undefined) ?? "";
  const instructions = normalizeInstructions(
    instructionsRaw
      .split(/\r?\n/)
      .map((step) => step.trim())
      .filter(Boolean)
  );
  const imageUrl = (meal.strMealThumb as string | undefined) ?? null;

  const ingredients = applyIngredientGrouping(
    Array.from({ length: 20 })
      .map((_, index) => {
        const ingredient = meal[`strIngredient${index + 1}`] as
          | string
          | undefined;
        const measure = meal[`strMeasure${index + 1}`] as string | undefined;
        if (!ingredient || !ingredient.trim()) return null;
        const parsedMeasure = parseMealDbMeasure(measure);
        if (parsedMeasure.amount !== null || parsedMeasure.unit) {
          return normalizeIngredient({
            item: ingredient.trim(),
            amount: parsedMeasure.amount,
            unit: parsedMeasure.unit,
          });
        }
        const label = measure
          ? `${measure.trim()} ${ingredient.trim()}`
          : ingredient.trim();
        return normalizeIngredient({ item: label });
      })
      .filter(Boolean) as RecipeIngredient[]
  );

  return {
    title,
    author: null,
    original_servings: 2,
    image_url: imageUrl,
    rating: { value: null, count: null },
    allergens: [],
    tips: [],
    ingredients,
    instructions,
  };
};

const getRandomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const buildImageQuery = (title: string, ingredients: RecipeIngredient[], preferences: SurprisePreferences) => {
  // Try to extract main ingredient and dish type
  const mainIngredient = ingredients.length ? ingredients[0].item : "food";
  const dishType = /soup|salad|cake|bread|pasta|curry|stew|pie|sandwich|taco|pizza|burger|rice|noodle|grill|roast|bake|cookie|muffin|pancake|omelette|casserole|dip|wrap|skewer|skillet|fritter|pudding|tart|scone|salsa|chili|cobbler|crumble|sundae|smoothie|drink|cocktail|juice|sauce|spread|jam|jelly|syrup|ice cream|sherbet|sorbet|custard|flan|souffle|mousse|trifle|parfait|granola|bar|snack|appetizer|starter|entree|main|side|dessert|breakfast|brunch|lunch|dinner/i.exec(title)?.[0] || "dish";
  const pref = getPreferenceSummary(preferences);
  let query = `${mainIngredient} ${dishType}`;
  if (pref !== "No special restrictions") query += ` ${pref}`;
  return query.trim();
};

const fetchPexelsImage = async (query: string, recipe: Recipe) => {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;
  const url = new URL("https://api.pexels.com/v1/search");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "24");
  url.searchParams.set("orientation", "landscape");

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: apiKey,
    },
  });

  if (!response.ok) return null;
  const data = (await response.json()) as {
    photos?: Array<{ src?: { large?: string; landscape?: string }, alt?: string }>;
  };
  let photos = data.photos ?? [];
  if (!photos.length) {
    // Fallback: try with just the dish type
    const fallbackUrl = new URL("https://api.pexels.com/v1/search");
    fallbackUrl.searchParams.set("query", /[a-zA-Z]+/.exec(query)?.[0] || "food");
    fallbackUrl.searchParams.set("per_page", "24");
    fallbackUrl.searchParams.set("orientation", "landscape");
    const fallbackResp = await fetch(fallbackUrl.toString(), { headers: { Authorization: apiKey } });
    if (!fallbackResp.ok) return null;
    const fallbackData = (await fallbackResp.json()) as typeof data;
    photos = fallbackData.photos ?? [];
    if (!photos.length) return null;
  }
  // Score photos by alt text match to recipe title/ingredients
  const recipeWords = [recipe.title, ...recipe.ingredients.map(i => i.item)].join(" ").toLowerCase().split(/\W+/);
  const scored = photos.map(photo => {
    const alt = (photo.alt ?? "").toLowerCase();
    const score = recipeWords.filter(word => word.length > 2 && alt.includes(word)).length;
    return { photo, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.photo;
  return best?.src?.landscape ?? best?.src?.large ?? null;
};

const fetchUnsplashImage = async (query: string, recipe: Recipe) => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return null;
  const url = new URL("https://api.unsplash.com/search/photos");
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "24");
  url.searchParams.set("orientation", "landscape");
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
    },
  });
  if (!response.ok) return null;
  const data = (await response.json()) as {
    results?: Array<{ urls?: { regular?: string; full?: string }, alt_description?: string }>;
  };
  const photos = data.results ?? [];
  if (!photos.length) return null;
  // Score by alt_description
  const recipeWords = [recipe.title, ...recipe.ingredients.map(i => i.item)].join(" ").toLowerCase().split(/\W+/);
  const scored = photos.map(photo => {
    const alt = (photo.alt_description ?? "").toLowerCase();
    const score = recipeWords.filter(word => word.length > 2 && alt.includes(word)).length;
    return { photo, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.photo;
  return best?.urls?.regular ?? best?.urls?.full ?? null;
};

const generateAiRecipe = async (preferences: SurprisePreferences) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "GEMINI_API_KEY is not configured" } as const;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const configuredModel =
    process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

  const preferenceText = getPreferenceSummary(preferences);
  const prompt = `Dietary restrictions and allergies: ${preferenceText}.

Create a brand-new recipe that strictly follows these restrictions. Return the JSON now.`;

  const runModel = async (modelName: string) => {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    return result.response.text();
  };

  let text: string;

  try {
    text = await runModel(configuredModel);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!message.toLowerCase().includes("not found")) {
      return { error: message || "AI generation failed" } as const;
    }

    const models = await listAvailableModels(apiKey);
    if (!models.length) {
      return { error: message || "AI generation failed" } as const;
    }

    const fallback = pickFallbackModel(models);
    text = await runModel(fallback);
  }

  const json = extractJson(text) as Partial<Recipe> & {
    ingredients?: Array<Partial<RecipeIngredient>>;
    instructions?: string[];
    tips?: unknown;
    allergens?: unknown;
  };

  const rawIngredients = Array.isArray(json.ingredients)
    ? json.ingredients.map((item) => normalizeIngredient(item))
    : [];
  const normalizedIngredients = applyIngredientGrouping(rawIngredients);
  const rawInstructions = Array.isArray(json.instructions)
    ? json.instructions
    : [];
  const normalizedInstructions = normalizeInstructions(rawInstructions);

  const recipe: Recipe = {
    title: json.title?.toString().trim() || "Surprise Recipe",
    author: null,
    original_servings:
      typeof json.original_servings === "number" && json.original_servings > 0
        ? Math.round(json.original_servings)
        : 2,
    image_url: null,
    rating: { value: null, count: null },
    allergens: normalizeAllergens(json.allergens),
    tips: normalizeTips(json.tips),
    ingredients: normalizedIngredients,
    instructions: normalizedInstructions,
  };

  if (!recipe.ingredients.length || !recipe.instructions.length) {
    return { error: "AI recipe was incomplete" } as const;
  }

  return { recipe } as const;
};

export async function POST(request: Request) {
  try {
    const { preferences, deviceId } = (await request.json()) as {
      preferences?: SurprisePreferences;
      deviceId?: string;
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error." },
        { status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    const token = getAuthToken(request);
    if (token) {
      const { data } = await admin.auth.getUser(token);
      userId = data.user?.id ?? null;
    }

    const lookupDevice = userId ? null : deviceId ?? null;
    if (!userId && !lookupDevice) {
      return NextResponse.json(
        { error: "Missing device identifier." },
        { status: 400 }
      );
    }

    const prefs = preferences ?? {};
    const pickAi = Math.random() < 0.5;

    if (!pickAi) {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        let response: Response | null = null;
        try {
          response = await Promise.race([
            fetch(MEALDB_RANDOM),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000)),
          ]);
        } catch {
          continue;
        }
        if (!response || !response.ok) continue;
        const data = (await response.json()) as { meals?: MealDbMeal[] };
        const meal = data.meals?.[0];
        if (!meal) continue;
        const mealId = meal.idMeal as string | undefined;
        if (!mealId) continue;
        if (!matchesPreferences(meal, prefs)) continue;

        const matchTarget = userId
          ? `user_id.eq.${userId}`
          : `device_id.eq.${lookupDevice}`;

        const { data: existing } = await admin
          .from("discovery_history")
          .select("id")
          .eq("source", "themealdb")
          .eq("external_id", mealId)
          .or(matchTarget)
          .maybeSingle();

        if (existing) continue;

        await admin.from("discovery_history").insert({
          user_id: userId,
          device_id: lookupDevice,
          source: "themealdb",
          external_id: mealId,
        });

        const url = `https://www.themealdb.com/meal.php?i=${mealId}`;
        const recipe = fetchMealDbRecipe(meal);
        return NextResponse.json(
          { recipe, source: "themealdb", sourceUrl: url },
          { status: 200 }
        );
      }
    }

    // AI branch: add 10s timeout to LLM, parallelize image fetches with 10s timeout each
    let aiResultUnknown: unknown;
    try {
      aiResultUnknown = await Promise.race([
        generateAiRecipe(prefs),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 20000)),
      ]);
    } catch (err) {
      return NextResponse.json({ error: "AI recipe generation timed out" }, { status: 500 });
    }
    // Type guard for aiResult
    if (
      typeof aiResultUnknown === "object" &&
      aiResultUnknown !== null &&
      ("error" in aiResultUnknown || "recipe" in aiResultUnknown)
    ) {
      if ("error" in aiResultUnknown) {
        return NextResponse.json({ error: (aiResultUnknown as any).error }, { status: 500 });
      }
      const aiResult = aiResultUnknown as { recipe: Recipe };
      const imageQuery = buildImageQuery(aiResult.recipe.title, aiResult.recipe.ingredients, prefs);
      // Run all image fetches in parallel with 10s timeout each
      const [pexels, unsplash, pixabay] = await Promise.all([
        Promise.race([
          fetchPexelsImage(imageQuery, aiResult.recipe),
          new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
        ]),
        Promise.race([
          fetchUnsplashImage(imageQuery, aiResult.recipe),
          new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
        ]),
        Promise.race([
          fetchPixabayImage(imageQuery, aiResult.recipe),
          new Promise((resolve) => setTimeout(() => resolve(null), 10000)),
        ]),
      ]);
      let image = pexels || unsplash || pixabay;
      if (typeof image === "string" && image) {
        aiResult.recipe.image_url = image;
      }

      const externalId = getRandomId();

      await admin.from("discovery_history").insert({
        user_id: userId,
        device_id: lookupDevice,
        source: "ai",
        external_id: externalId,
      });

      return NextResponse.json(
        { recipe: aiResult.recipe, source: "ai", sourceUrl: `ai:${externalId}` },
        { status: 200 }
      );
    } else {
      return NextResponse.json({ error: "AI recipe generation failed (unexpected type)" }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
