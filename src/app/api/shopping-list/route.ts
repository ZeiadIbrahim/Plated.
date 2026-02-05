import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

type ShoppingListItem = {
  item: string;
  amount: number | null;
  unit: string | null;
  notes?: string | null;
  recipes?: string[];
};

const SYSTEM_PROMPT =
  "You are a precise kitchen assistant. Build a consolidated shopping list from multiple recipes. Merge equivalent items (e.g., plain flour and all-purpose flour). Keep units consistent; do NOT sum across different units. If a unit differs, create separate line items. Use null for unknown amount or unit. Keep item names short. Return ONLY valid JSON in this format: { items: [{ item, amount, unit, notes, recipes }] }.";

const extractJson = (value: string) => {
  const firstBrace = value.indexOf("{");
  const lastBrace = value.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("No JSON payload found in model response.");
  }
  const jsonString = value.slice(firstBrace, lastBrace + 1);
  return JSON.parse(jsonString);
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
    const { recipes } = (await request.json()) as {
      recipes?: Array<{
        title?: string;
        ingredients?: Array<{
          item?: string;
          amount?: number | null;
          unit?: string | null;
        }>;
      }>;
    };

    if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
      return NextResponse.json(
        { error: "Missing recipes" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const configuredModel =
      process.env.GEMINI_MODEL ?? "gemini-1.5-flash-latest";

    const prompt = `Recipes (JSON):\n${JSON.stringify(recipes, null, 2)}\n\nReturn the consolidated shopping list JSON now.`;

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
        throw error;
      }

      const models = await listAvailableModels(apiKey);
      if (!models.length) {
        throw error;
      }

      const fallback = pickFallbackModel(models);
      text = await runModel(fallback);
    }

    const json = extractJson(text) as { items?: ShoppingListItem[] };
    const items = Array.isArray(json.items) ? json.items : [];

    const normalized = items
      .map((item) => ({
        item: item.item?.toString().trim() ?? "",
        amount:
          typeof item.amount === "number" && Number.isFinite(item.amount)
            ? item.amount
            : null,
        unit: item.unit ? item.unit.toString().trim() : null,
        notes: item.notes ? item.notes.toString().trim() : null,
        recipes: Array.isArray(item.recipes)
          ? item.recipes.map((recipe) => recipe.toString().trim()).filter(Boolean)
          : [],
      }))
      .filter((item) => item.item.length > 0);

    return NextResponse.json({ items: normalized }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
