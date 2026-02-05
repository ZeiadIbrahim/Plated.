import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type DiscoveryPreferences = {
  glutenFree?: boolean;
  vegan?: boolean;
  vegetarian?: boolean;
  lactoseFree?: boolean;
  alcoholFree?: boolean;
  halal?: boolean;
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
};

const getIngredients = (meal: Record<string, unknown>) =>
  Array.from({ length: 20 })
    .map((_, index) => meal[`strIngredient${index + 1}`] as string | undefined)
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

const matchesPreferences = (meal: Record<string, unknown>, prefs: DiscoveryPreferences) => {
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
  if (prefs.lactoseFree && hasKeyword(ingredientKeywords.dairy)) return false;
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

export async function POST(request: Request) {
  try {
    const { preferences, deviceId } = (await request.json()) as {
      preferences?: DiscoveryPreferences;
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

    for (let attempt = 0; attempt < 15; attempt += 1) {
      const response = await fetch(MEALDB_RANDOM);
      if (!response.ok) continue;
      const data = (await response.json()) as { meals?: Record<string, unknown>[] };
      const meal = data.meals?.[0];
      if (!meal) continue;
      const mealId = meal.idMeal as string | undefined;
      if (!mealId) continue;
      if (!matchesPreferences(meal, preferences ?? {})) continue;

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

      return NextResponse.json({ url }, { status: 200 });
    }

    return NextResponse.json(
      { error: "No new recipes available. Try fewer filters." },
      { status: 404 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
