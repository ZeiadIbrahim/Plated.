export type RecipeIngredient = {
  group?: string | null;
  item: string;
  amount: number | null;
  unit: string | null;
  optional?: boolean | null;
};

export type Recipe = {
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
