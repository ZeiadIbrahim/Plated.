import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as cheerio from "cheerio";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "Extract the recipe from this text. Return ONLY valid JSON in this format: { title, original_servings (number), rating: { value (number|null), count (number|null) }, allergens: [string], tips: [string], ingredients: [{ group, item, amount (number), unit, optional (boolean) }], instructions: [string] }. Use group as the section heading (e.g., 'Toppings', 'Sauce'); default to 'Ingredients' if none. If a unit is missing, make it null. If an ingredient is optional, set optional to true. Convert fractions to decimals. For allergens, only include relevant items from this list: gluten, dairy, nuts, peanuts, soy, eggs, fish, shellfish, sesame, mustard, celery, sulfites, lupin, mollusks. For rating, infer from page if present; otherwise null. For tips, extract practical tips or tricks from the text (max 5).";

const cleanText = (html: string) => {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  const text = $("body").text();
  return text.replace(/\s+/g, " ").trim();
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
  if (!Array.isArray(value)) return [];
  return value
    .map((tip) => tip?.toString().trim())
    .filter((tip): tip is string => !!tip)
    .slice(0, 5);
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(url);
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch URL" },
        { status: 400 }
      );
    }

    const html = await response.text();
    const cleaned = cleanText(html);

    if (!cleaned) {
      return NextResponse.json(
        { error: "No text content found" },
        { status: 400 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const configuredModel =
      process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

    const runModel = async (modelName: string) => {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
      });

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
      text = await runModel(fallback);
    }

    const json = extractJson(text) as {
      title?: string;
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

    const normalized = {
      title: json.title ?? "Untitled Recipe",
      original_servings: Number.isFinite(json.original_servings)
        ? Number(json.original_servings)
        : 1,
      rating: normalizeRating(json.rating),
      allergens: normalizeAllergens(json.allergens),
      tips: normalizeTips(json.tips),
      ingredients: Array.isArray(json.ingredients)
        ? json.ingredients.map(normalizeIngredient)
        : [],
      instructions: Array.isArray(json.instructions)
        ? json.instructions
        : [],
    };

    return NextResponse.json(normalized, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
