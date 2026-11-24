export const pizzaIngredients = {
  mozzarella: "Mozzarella",
  pepperoni: "Pepperoni",
  mushroom: "Mushroom",
  olive: "Black olive",
  basil: "Basil",
  pepper: "Sweet pepper",
  onion: "Red onion",
  tomato: "Tomato",
} as const;
export type PizzaArt = keyof typeof pizzaIngredients;
export interface PizzaBuilderConfig {
  enabled: true;
  baseImageUrl?: string;
}
export const pizzaBase = "/pizza/base.webp";
