import { render, screen } from "@testing-library/react";
import { RecipeCard } from "@/components/RecipeCard";
import type { Recipe } from "@/types/recipe";

describe("RecipeCard", () => {
  it("renders recipe title", () => {
    const recipe: Recipe = {
      title: "Test Recipe",
      original_servings: 2,
      ingredients: [
        { item: "Flour", amount: 200, unit: "g" },
        { item: "Eggs", amount: 2, unit: null },
      ],
      instructions: ["Mix", "Bake"],
    };

    render(<RecipeCard recipe={recipe} showSave={false} />);
    expect(screen.getByRole("heading", { name: /test recipe/i })).toBeInTheDocument();
  });
});
