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
export const builderIngredients = {
  pizza: pizzaIngredients,
  burger: { cheddar: "Cheddar", lettuce: "Lettuce", tomato: "Sliced tomato" },
  taco: {
    salsa: "Pico de gallo",
    avocado: "Avocado",
    cheddar: "Grated cheddar",
  },
} as const;
export type BuilderKind = keyof typeof builderIngredients;
export type IngredientArt =
  | PizzaArt
  | "cheddar"
  | "lettuce"
  | "salsa"
  | "avocado";
export interface PizzaBuilderConfig {
  kind?: BuilderKind; // Existing pizza configurations omit the kind.
  enabled: true;
  baseImageUrl?: string;
}
export const pizzaBase = "/pizza/base.webp";

export function builderKind(config?: PizzaBuilderConfig | null): BuilderKind {
  return config?.kind ?? "pizza";
}
export function builderPhoto(config: PizzaBuilderConfig) {
  const kind = builderKind(config);
  return kind === "pizza"
    ? config.baseImageUrl || pizzaBase
    : "/kitchen/" + kind + "-menu.webp";
}
export function ingredientPhoto(kind: BuilderKind, art?: IngredientArt | null) {
  if (
    !art ||
    !Object.prototype.hasOwnProperty.call(builderIngredients[kind], art)
  )
    return undefined;
  return kind === "pizza"
    ? "/pizza/" + art + ".webp"
    : "/kitchen/" + kind + "-" + art + ".webp";
}
