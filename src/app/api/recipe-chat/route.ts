import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";

const SYSTEM_PROMPT =
  "You are a warm, friendly culinary assistant with a light sense of humor. Use the provided recipe context as primary guidance. Offer practical substitutions, cooking tips, timing, serving adjustments, and simple side suggestions. If asked about a side you mentioned (e.g., coleslaw), give a quick, minimal recipe or outline using common pantry items. Keep responses short: 2-4 concise sentences or 3-5 bullets max. Use emojis sparingly (0-2 per response). If a question is off-topic (politics, finance, general trivia), reply: 'I can only help with this recipe—ingredients, substitutions, measurements, and cooking steps.' If a question is medical, say you are not a medical professional and suggest consulting a qualified source.";

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
    const { recipe, question } = (await request.json()) as {
      recipe?: unknown;
      question?: string;
    };

    if (!recipe || !question?.trim()) {
      return NextResponse.json(
        { error: "Missing recipe or question" },
        { status: 400 }
      );
    }

    const normalizedQuestion = question.toLowerCase();
    const offTopicSignals = [
      "politics",
      "election",
      "president",
      "religion",
      "war",
      "government",
      "crypto",
      "stocks",
      "finance",
      "relationship",
      "dating",
      "medical",
      "diagnose",
    ];
    const isOffTopic = offTopicSignals.some((signal) =>
      normalizedQuestion.includes(signal)
    );

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

    const prompt = `Recipe context (JSON):\n${JSON.stringify(
      recipe,
      null,
      2
    )}\n\nUser question: ${question}\n\nIf off-topic: ${
      isOffTopic ? "Yes" : "No"
    }\n\nAnswer:`;

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

    return NextResponse.json({ answer: text.trim() }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
