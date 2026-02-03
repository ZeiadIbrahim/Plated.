export type RecipeIngredient = {
  group?: string | null;
  item: string;
  amount: number | null;
  unit: string | null;
  optional?: boolean | null;
};

export type Recipe = {
  title: string;
  original_servings: number;
  allergens?: string[];
  tips?: string[];
  rating?: {
    value: number | null;
    count: number | null;
  };
  ingredients: RecipeIngredient[];
  instructions: string[];
};
