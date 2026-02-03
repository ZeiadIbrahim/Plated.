"use client";

import Fraction from "fraction.js";
import convert, { Unit } from "convert-units";
import { useMemo } from "react";
import type { Recipe, RecipeIngredient } from "@/types/recipe";

export type ComputedIngredient = RecipeIngredient & {
  displayAmount: string | null;
  displayUnit: string | null;
};

const UNIT_ALIASES: Record<string, string> = {
  cups: "cup",
  cup: "cup",
  tbsp: "tbsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tsp: "tsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  oz: "oz",
  ounce: "oz",
  ounces: "oz",
  lb: "lb",
  lbs: "lb",
  pound: "lb",
  pounds: "lb",
  g: "g",
  gram: "g",
  grams: "g",
  ml: "ml",
  milliliter: "ml",
  milliliters: "ml",
  fahrenheit: "F",
  f: "F",
  celsius: "C",
  c: "C",
};

const METRIC_CONVERSIONS: Record<string, { to: string }> = {
  cup: { to: "ml" },
  tbsp: { to: "ml" },
  tsp: { to: "ml" },
  oz: { to: "g" },
  lb: { to: "g" },
  F: { to: "C" },
};

const normalizeUnit = (unit: string | null) => {
  if (!unit) return null;
  const key = unit.trim().toLowerCase();
  return UNIT_ALIASES[key] ?? unit;
};

const formatAmount = (value: number | null, unit: string | null, isMetric: boolean) => {
  if (value === null || Number.isNaN(value)) return null;

  if (isMetric && unit && ["ml", "g", "C"].includes(unit)) {
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return rounded.toString();
  }

  if (Number.isInteger(value)) return value.toString();

  const rounded = Math.round(value * 1000) / 1000;
  if (rounded < 0.01) {
    return rounded.toFixed(2).replace(/\.00$/, "");
  }

  return new Fraction(rounded).toFraction(true);
};

const scaleAmount = (
  baseAmount: number | null,
  originalServings: number,
  currentServings: number
) => {
  if (baseAmount === null) return null;
  if (!originalServings || !currentServings) return baseAmount;
  return (baseAmount / originalServings) * currentServings;
};

const convertAmount = (
  amount: number | null,
  unit: string | null,
  isMetric: boolean
) => {
  if (amount === null || !unit) return { amount, unit };
  const normalizedUnit = normalizeUnit(unit);
  if (!normalizedUnit) return { amount, unit };
  if (!isMetric) return { amount, unit: normalizedUnit };

  const conversion = METRIC_CONVERSIONS[normalizedUnit];
  if (!conversion) return { amount, unit: normalizedUnit };

  try {
    const converted = convert(amount)
      .from(normalizedUnit as Unit)
      .to(conversion.to as Unit);
    return { amount: converted, unit: conversion.to };
  } catch {
    return { amount, unit: normalizedUnit };
  }
};

export const useRecipeMath = (
  recipe: Recipe,
  currentServings: number,
  isMetric: boolean
) => {
  return useMemo(() => {
    const ingredients = recipe.ingredients.map((ingredient) => {
      const scaled = scaleAmount(
        ingredient.amount,
        recipe.original_servings,
        currentServings
      );
      const converted = convertAmount(scaled, ingredient.unit, isMetric);

      return {
        ...ingredient,
        amount: converted.amount,
        unit: converted.unit,
        displayAmount: formatAmount(converted.amount, converted.unit, isMetric),
        displayUnit: converted.unit,
      } satisfies ComputedIngredient;
    });

    return {
      title: recipe.title,
      servings: currentServings,
      ingredients,
      instructions: recipe.instructions,
    };
  }, [recipe, currentServings, isMetric]);
};
