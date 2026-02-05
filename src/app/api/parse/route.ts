import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "Extract the recipe from this text. Return ONLY valid JSON in this format: { title, original_servings (number), rating: { value (number|null), count (number|null) }, allergens: [string], tips: [string], ingredients: [{ group, item, amount (number), unit, optional (boolean) }], instructions: [string] }. Use group as the section heading (e.g., 'Toppings', 'Sauce'); default to 'Ingredients' if none. If a unit is missing, make it null. If an ingredient is optional, set optional to true. Convert fractions to decimals. For allergens, only include relevant items from this list: gluten, dairy, nuts, peanuts, soy, eggs, fish, shellfish, sesame, mustard, celery, sulfites, lupin, mollusks. For rating, infer from page if present; otherwise null. For tips, extract practical tips or tricks from the text (max 5).";

const cleanText = ($: CheerioAPI) => {
  const $root = $.root().clone();
  $root.find("script, style, noscript").remove();
  const text = $root.find("body").text();
  return text.replace(/\s+/g, " ").trim();
};

const resolveImageUrl = (value: string, pageUrl: string) => {
  if (!value) return "";
  if (value.startsWith("data:")) return "";
  if (value.startsWith("//")) {
    try {
      const base = new URL(pageUrl);
      return `${base.protocol}${value}`;
    } catch {
      return "";
    }
  }
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return "";
  }
};

const extractRecipeImage = ($: CheerioAPI, pageUrl: string) => {
  const metaSelectors = [
    "meta[property='og:image']",
    "meta[property='og:image:url']",
    "meta[name='og:image']",
    "meta[name='twitter:image']",
    "meta[property='twitter:image']",
  ];

  for (const selector of metaSelectors) {
    const content = $(selector).attr("content");
    if (content) {
      const resolved = resolveImageUrl(content, pageUrl);
      if (resolved) return resolved;
    }
  }

  let imageFromSchema = "";
  $("script[type='application/ld+json']").each((_, element) => {
    if (imageFromSchema) return;
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as unknown;
      const stack: unknown[] = [data];
      while (stack.length && !imageFromSchema) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;
        if (Array.isArray(current)) {
          stack.push(...current);
          continue;
        }
        const value = current as Record<string, unknown>;
        const typeValue = value["@type"];
        const isRecipe = Array.isArray(typeValue)
          ? typeValue.some((item) =>
              typeof item === "string" ? item.toLowerCase() === "recipe" : false
            )
          : typeof typeValue === "string"
            ? typeValue.toLowerCase() === "recipe"
            : false;

        if (isRecipe && value.image) {
          const image = value.image as unknown;
          if (typeof image === "string") {
            imageFromSchema = resolveImageUrl(image, pageUrl);
          } else if (Array.isArray(image)) {
            const first = image.find((item) => typeof item === "string") as
              | string
              | undefined;
            if (first) imageFromSchema = resolveImageUrl(first, pageUrl);
          } else if (typeof image === "object" && image !== null) {
            const imageUrl = (image as Record<string, unknown>).url;
            if (typeof imageUrl === "string") {
              imageFromSchema = resolveImageUrl(imageUrl, pageUrl);
            }
          }
        }

        Object.values(value).forEach((child) => stack.push(child));
      }
    } catch {
      return;
    }
  });

  return imageFromSchema || "";
};

const isRecipeStructuredData = ($: CheerioAPI) => {
  let found = false;

  $("script[type='application/ld+json']").each((_, element) => {
    if (found) return;
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as unknown;
      const stack: unknown[] = [data];
      while (stack.length) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;
        if (Array.isArray(current)) {
          stack.push(...current);
          continue;
        }
        const value = current as Record<string, unknown>;
        const typeValue = value["@type"];
        if (typeof typeValue === "string") {
          if (typeValue.toLowerCase() === "recipe") {
            found = true;
            return;
          }
        }
        if (Array.isArray(typeValue)) {
          const hasRecipe = typeValue
            .map((item) => (typeof item === "string" ? item.toLowerCase() : ""))
            .includes("recipe");
          if (hasRecipe) {
            found = true;
            return;
          }
        }
        Object.values(value).forEach((child) => stack.push(child));
      }
    } catch {
      return;
    }
  });

  if (found) return true;

  const microdata = $("[itemscope][itemtype*='schema.org/Recipe']");
  return microdata.length > 0;
};

const extractRecipeStructuredData = (
  $: CheerioAPI
): Record<string, unknown> | null => {
  let recipeData: Record<string, unknown> | null = null;

  $("script[type='application/ld+json']").each((_, element) => {
    if (recipeData) return;
    const raw = $(element).contents().text();
    if (!raw) return;

    try {
      const data = JSON.parse(raw) as unknown;
      const stack: unknown[] = [data];
      while (stack.length && !recipeData) {
        const current = stack.pop();
        if (!current || typeof current !== "object") continue;
        if (Array.isArray(current)) {
          stack.push(...current);
          continue;
        }
        const value = current as Record<string, unknown>;
        const typeValue = value["@type"];
        const isRecipe = Array.isArray(typeValue)
          ? typeValue.some((item) =>
              typeof item === "string" ? item.toLowerCase() === "recipe" : false
            )
          : typeof typeValue === "string"
            ? typeValue.toLowerCase() === "recipe"
            : false;
        if (isRecipe) {
          recipeData = value;
          return;
        }
        Object.values(value).forEach((child) => stack.push(child));
      }
    } catch {
      return;
    }
  });

  return recipeData;
};

const normalizeRecipeYield = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (match) return Number.parseInt(match[0], 10);
  }
  return null;
};

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

const normalizeSchemaInstructions = (value: unknown) => {
  if (!value) return [] as string[];
  if (typeof value === "string") return normalizeInstructions([value]);
  if (Array.isArray(value)) {
    const steps = value.flatMap((item) => {
      if (typeof item === "string") return [item];
      if (item && typeof item === "object") {
        const text = (item as Record<string, unknown>).text;
        if (typeof text === "string") return [text];
      }
      return [] as string[];
    });
    return normalizeInstructions(steps);
  }
  if (typeof value === "object") {
    const text = (value as Record<string, unknown>).text;
    if (typeof text === "string") return normalizeInstructions([text]);
  }
  return [] as string[];
};

const looksLikeRecipeText = (text: string) => {
  const lower = text.toLowerCase();
  const ingredientSignals = [
    "ingredients",
    "instructions",
    "directions",
    "prep time",
    "cook time",
    "servings",
  ];
  const hits = ingredientSignals.filter((signal) => lower.includes(signal)).length;
  return hits >= 2;
};

const looksPaywalled = (html: string, text: string) => {
  const haystack = `${html} ${text}`.toLowerCase();
  const signals = [
    "subscribe to continue",
    "subscribe to read",
    "subscribe now",
    "subscription required",
    "member-only",
    "members only",
    "premium content",
    "sign in to read",
    "log in to read",
    "already a subscriber",
    "start your free trial",
    "paywall",
    "continue reading",
    "unlock this recipe",
    "this content is for subscribers",
  ];

  return signals.some((signal) => haystack.includes(signal));
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

const TIPS_PROMPT =
  "Generate 3-5 practical cooking tips for this recipe based on the ingredients and instructions. Return ONLY valid JSON in this format: { tips: [string] }. Keep each tip concise.";

const buildTipsContext = (recipe: {
  title: string;
  ingredients: Array<{ item: string }>;
  instructions: string[];
}) => {
  const ingredientLines = recipe.ingredients
    .map((ingredient) => `- ${ingredient.item}`)
    .join("\n");
  const instructionLines = recipe.instructions
    .map((step) => `- ${step}`)
    .join("\n");

  return `Recipe: ${recipe.title}\nIngredients:\n${ingredientLines}\nInstructions:\n${instructionLines}`;
};

const normalizeGroupLabel = (value: string) => {
  const trimmed = value.replace(/:$/, "").trim();
  return trimmed.replace(/^for\s+the\s+/i, "");
};

const applyIngredientGrouping = (
  ingredients: ReturnType<typeof normalizeIngredient>[]
) => {
  let currentGroup = "Ingredients";
  const grouped: ReturnType<typeof normalizeIngredient>[] = [];

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

const normalizeAuthor = (value: unknown): string | null => {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeAuthor(item);
      if (normalized) return normalized;
    }
    return null;
  }
  if (typeof value === "object") {
    const name = (value as Record<string, unknown>).name;
    if (typeof name === "string") {
      const trimmed = name.trim();
      return trimmed ? trimmed : null;
    }
  }
  return null;
};

const normalizeRating = (value: unknown) => {
  if (!value || typeof value !== "object") {
    return { value: null, count: null };
  }
  const rating = value as { value?: number; count?: number };
  const parsedValue =
    typeof rating.value === "number" && rating.value >= 0
      ? rating.value
      : null;
  const parsedCount =
    typeof rating.count === "number" && rating.count >= 0
      ? rating.count
      : null;
  return { value: parsedValue, count: parsedCount };
};

const extractMealDbId = (value: string) => {
  try {
    const parsed = new URL(value);
    if (!parsed.hostname.includes("themealdb.com")) return null;
    const id = parsed.searchParams.get("i");
    return id?.trim() || null;
  } catch {
    return null;
  }
};

const parseFractionAmount = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(" ")) {
    const [whole, fraction] = trimmed.split(" ");
    const wholeValue = Number.parseFloat(whole);
    const fractionValue: number | null = parseFractionAmount(fraction);
    if (!Number.isNaN(wholeValue) && fractionValue !== null) {
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

const fetchMealDbRecipe = async (id: string) => {
  const response = await fetch(
    `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${id}`
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { meals?: Record<string, unknown>[] };
  const meal = data.meals?.[0];
  if (!meal) return null;

  const title = (meal.strMeal as string | undefined) ?? "Untitled Recipe";
  const instructionsRaw =
    (meal.strInstructions as string | undefined) ?? "";
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
      .filter(Boolean) as ReturnType<typeof normalizeIngredient>[]
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

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? null;
    const configuredModel =
      process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

    const generateTips = async (recipe: {
      title: string;
      ingredients: Array<{ item: string }>;
      instructions: string[];
    }) => {
      if (!apiKey) return [] as string[];
      if (!recipe.ingredients.length || !recipe.instructions.length) {
        return [] as string[];
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const context = buildTipsContext(recipe);
      const runTipsModel = async (modelName: string) => {
        const model = genAI.getGenerativeModel({
          model: modelName,
          systemInstruction: TIPS_PROMPT,
        });
        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: context }],
            },
          ],
        });
        return result.response.text();
      };

      let text: string;
      try {
        text = await runTipsModel(configuredModel);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (!message.toLowerCase().includes("not found")) {
          throw error;
        }
        const models = await listAvailableModels(apiKey);
        if (!models.length) {
          throw error;
        }
        const fallback = pickFallbackModel(models);
        text = await runTipsModel(fallback);
      }

      const json = extractJson(text) as { tips?: unknown };
      return normalizeTips(json.tips);
    };

    const mealDbId = extractMealDbId(url);
    if (mealDbId) {
      const mealDbRecipe = await fetchMealDbRecipe(mealDbId);
      if (!mealDbRecipe) {
        return NextResponse.json(
          { error: "Unable to fetch recipe from TheMealDB." },
          { status: 400 }
        );
      }
      if (!mealDbRecipe.tips.length) {
        const tips = await generateTips(mealDbRecipe);
        if (tips.length) {
          return NextResponse.json(
            { ...mealDbRecipe, tips },
            { status: 200 }
          );
        }
      }
      return NextResponse.json(mealDbRecipe, { status: 200 });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Add 10s timeout to recipe page fetch
    let response: Response | null = null;
    response = await fetch(url);
    if (!response.ok) {
      if ([402, 403, 451].includes(response.status)) {
        return NextResponse.json(
          {
            error:
              "This recipe appears to be behind a paywall. Please use a free recipe source.",
          },
          { status: 402 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 400 }
      );
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const cleaned = cleanText($);
    const imageUrl = extractRecipeImage($, url);

    const hasStructuredRecipe = isRecipeStructuredData($);
    const hasRecipeText = looksLikeRecipeText(cleaned);
    if (!hasStructuredRecipe && !hasRecipeText) {
      return NextResponse.json(
        { error: "This link doesn’t look like a recipe page." },
        { status: 400 }
      );
    }

    if (looksPaywalled(html, cleaned)) {
      return NextResponse.json(
        {
          error:
            "This recipe appears to be behind a paywall. Please use a free recipe source.",
        },
        { status: 402 }
      );
    }

    const structured = extractRecipeStructuredData($);
    type ParsedRecipe = {
      title: string;
      author: string | null;
      original_servings: number;
      image_url: string | null;
      rating: { value: number | null; count: number | null };
      allergens: string[];
      tips: string[];
      ingredients: ReturnType<typeof normalizeIngredient>[];
      instructions: string[];
    };

    let structuredRecipe: ParsedRecipe | null = null;
    let needsEnrichment = false;

    if (structured) {
      const title = structured["name"];
      const servings = normalizeRecipeYield(structured["recipeYield"]);
      const ingredientsRaw = structured["recipeIngredient"];
      const instructionsRaw = structured["recipeInstructions"];
      const rating = structured["aggregateRating"] as
        | { ratingValue?: number | string; ratingCount?: number | string }
        | undefined;

      const structuredIngredients = applyIngredientGrouping(
        Array.isArray(ingredientsRaw)
          ? ingredientsRaw
              .map((item) => (typeof item === "string" ? item : ""))
              .filter(Boolean)
              .map((item) => normalizeIngredient({ item }))
          : []
      );
      const structuredInstructions = normalizeSchemaInstructions(instructionsRaw);

      if (structuredIngredients.length && structuredInstructions.length) {
        const normalized: ParsedRecipe = {
          title: typeof title === "string" ? title : "Untitled Recipe",
          author: normalizeAuthor(structured["author"]),
          original_servings:
            typeof servings === "number" && Number.isFinite(servings)
              ? servings
              : 1,
          image_url: imageUrl || null,
          rating: normalizeRating({
            value:
              rating?.ratingValue !== undefined
                ? Number(rating.ratingValue)
                : null,
            count:
              rating?.ratingCount !== undefined
                ? Number(rating.ratingCount)
                : null,
          }),
          allergens: [],
          tips: [],
          ingredients: structuredIngredients,
          instructions: structuredInstructions,
        };
        const groups = Array.from(
          new Set(
            normalized.ingredients.map(
              (ingredient) => ingredient.group?.trim() || "Ingredients"
            )
          )
        );
        const hasGrouping = groups.length > 1 || groups[0] !== "Ingredients";
        needsEnrichment = !hasGrouping || normalized.tips.length === 0;
        structuredRecipe = normalized;
        if (!needsEnrichment) {
          return NextResponse.json(normalized, { status: 200 });
        }
      }
    }

    if (!cleaned) {
      return NextResponse.json(
        { error: "No text content found" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const runModel = async (modelName: string) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
      });
      // Add 10s timeout to LLM call
      const result = await model.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: cleaned }],
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
        throw error;
      }

      const models = await listAvailableModels(apiKey);
      if (!models.length) {
        throw error;
      }

      const fallback = pickFallbackModel(models);
      // Only try fallback if the first model fails, not just slow
      text = await runModel(fallback);
    }

    const json = extractJson(text) as {
      title?: string;
      author?: string;
      original_servings?: number;
      rating?: { value?: number | null; count?: number | null } | null;
      allergens?: string[];
      tips?: string[];
      ingredients?: Array<{
        group?: string | null;
        item?: string | null;
        amount?: number | string | null;
        unit?: string | null;
        optional?: boolean | null;
      }>;
      instructions?: string[];
    };

    let normalized: ParsedRecipe = {
      title: json.title ?? "Untitled Recipe",
      author: json.author ?? null,
      original_servings: Number.isFinite(json.original_servings)
        ? Number(json.original_servings)
        : 1,
      image_url: imageUrl || null,
      rating: normalizeRating(json.rating),
      allergens: normalizeAllergens(json.allergens),
      tips: normalizeTips(json.tips),
      ingredients: applyIngredientGrouping(
        Array.isArray(json.ingredients)
          ? json.ingredients.map(normalizeIngredient)
          : []
      ),
      instructions: Array.isArray(json.instructions)
        ? normalizeInstructions(json.instructions)
        : [],
    };

    if (!normalized.tips.length) {
      const tips = await generateTips(normalized);
      if (tips.length) {
        normalized = { ...normalized, tips };
      }
    }

    if (structuredRecipe) {
      let merged = {
        ...structuredRecipe,
        ...normalized,
        image_url:
          imageUrl || normalized.image_url || structuredRecipe.image_url || null,
        ingredients: normalized.ingredients.length
          ? normalized.ingredients
          : structuredRecipe.ingredients,
        instructions: normalized.instructions.length
          ? normalized.instructions
          : structuredRecipe.instructions,
        tips: normalized.tips.length ? normalized.tips : structuredRecipe.tips,
        rating:
          normalized.rating.value !== null || normalized.rating.count !== null
            ? normalized.rating
            : structuredRecipe.rating,
        author: normalized.author || structuredRecipe.author || null,
      };
      if (!merged.tips.length) {
        const tips = await generateTips(merged);
        if (tips.length) {
          merged = { ...merged, tips };
        }
      }
      return NextResponse.json(merged, { status: 200 });
    }

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
