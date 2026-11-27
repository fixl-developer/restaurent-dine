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
  burger: {
    sauce: "Burger sauce",
    cheddar: "Cheddar",
    bacon: "Bacon",
    pickle: "Pickles",
    onion: "Caramelized onion",
    jalapeno: "Jalapeños",
    tomato: "Sliced tomato",
    lettuce: "Lettuce",
  },
  taco: {
    salsa: "Pico de gallo",
    corn: "Sweet corn",
    avocado: "Avocado",
    "sour-cream": "Sour cream",
    cheddar: "Grated cheddar",
    jalapeno: "Jalapeños",
  },
} as const;
export type BuilderKind = keyof typeof builderIngredients;
export type IngredientArt =
  | PizzaArt
  | "cheddar"
  | "lettuce"
  | "bacon"
  | "pickle"
  | "sauce"
  | "jalapeno"
  | "salsa"
  | "avocado"
  | "corn"
  | "sour-cream";
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
const svgIngredients: Partial<Record<BuilderKind, ReadonlySet<string>>> = {
  burger: new Set(["sauce", "bacon", "pickle", "onion", "jalapeno"]),
  taco: new Set(["corn", "sour-cream", "jalapeno"]),
};
export function ingredientPhoto(kind: BuilderKind, art?: IngredientArt | null) {
  if (
    !art ||
    !Object.prototype.hasOwnProperty.call(builderIngredients[kind], art)
  )
    return undefined;
  const ext = svgIngredients[kind]?.has(art) ? "svg" : "webp";
  return kind === "pizza"
    ? "/pizza/" + art + "." + ext
    : "/kitchen/" + kind + "-" + art + "." + ext;
}
