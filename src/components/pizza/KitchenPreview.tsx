import { useState, type CSSProperties } from "react";
import { Layers, RotateCw } from "lucide-react";
import type { IngredientArt } from "./ingredients";
import "./kitchen.css";

type KitchenKind = "burger" | "taco";

const burgerOrder = [
  "bottom",
  "patty",
  "sauce",
  "cheddar",
  "bacon",
  "pickle",
  "onion",
  "jalapeno",
  "tomato",
  "lettuce",
  "top",
] as const;

const tacoOrder = [
  "tortilla",
  "beans",
  "corn",
  "salsa",
  "avocado",
  "sour-cream",
  "cheddar",
  "jalapeno",
] as const;

// Vertical separation between each ingredient's contact surface, as a percentage of the stage.
const burgerRise: Record<(typeof burgerOrder)[number], number> = {
  bottom: 8,
  patty: 8,
  sauce: 1,
  cheddar: 2,
  bacon: 3,
  pickle: 1,
  onion: 2,
  jalapeno: 1,
  tomato: 3,
  lettuce: 4,
  top: 0,
};

const svgParts = new Set([
  "sauce",
  "bacon",
  "pickle",
  "onion",
  "jalapeno",
  "corn",
  "sour-cream",
]);
function partExt(part: string) {
  return svgParts.has(part) ? "svg" : "webp";
}

export default function KitchenPreview({
  kind,
  choices,
  scale,
  patties = 1,
}: {
  kind: KitchenKind;
  choices: { pizzaArt?: IngredientArt | null }[];
  scale: number;
  patties?: number;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState(0);
  const selected = new Set<string>(
    choices.flatMap((m) => (m.pizzaArt ? [m.pizzaArt] : [])),
  );
  const burger = burgerOrder
    .filter(
      (art) =>
        art === "bottom" ||
        art === "patty" ||
        art === "top" ||
        selected.has(art),
    )
    .flatMap((part) =>
      part === "patty" ? Array.from({ length: patties }, () => part) : [part],
    );
  const taco = tacoOrder.filter(
    (art) => art === "tortilla" || art === "beans" || selected.has(art),
  );
  const separation = open ? 19 : 0;
  const height =
    burger.reduce((sum, part) => sum + burgerRise[part], 0) +
    separation * (burger.length - 1);
  // The top bun occupies 46% of the stage at its natural aspect ratio.
  // Fit the complete silhouette, even when all optional layers are lifted.
  const stackScale = Math.min(1, 92 / (height + 46));
  let offset = 0;
  let pattyIndex = 0;
  return (
    <div className={"kitchen-preview kitchen-" + kind}>
      <div className={kind === "burger" ? "burger-setting" : "taco-setting"}>
        {kind === "burger" && (
          <div className="burger-contact" aria-hidden="true" />
        )}
        <div
          className="kitchen-food"
          style={
            {
              "--portion": kind === "burger" ? scale * stackScale : scale,
            } as CSSProperties
          }
          aria-hidden="true"
        >
          {kind === "burger" ? (
            burger.map((part) => {
              const bottom = offset;
              offset += burgerRise[part] + separation;
              const copy = part === "patty" ? pattyIndex++ : 0;
              return (
                <img
                  key={part + copy}
                  data-layer={part}
                  data-reversed={copy % 2 === 1}
                  className={"burger-piece piece-" + part}
                  style={{ bottom: bottom + "%" }}
                  src={"/kitchen/burger-" + part + "." + partExt(part)}
                  alt=""
                  draggable={false}
                />
              );
            })
          ) : (
            <div
              className="taco-plate"
              style={{ transform: "rotate(" + (turns * 45 - 12) + "deg)" }}
            >
              {taco.map((part) => (
                <img
                  key={part}
                  className={"taco-piece piece-" + part}
                  src={"/kitchen/taco-" + part + "." + partExt(part)}
                  alt=""
                  draggable={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {kind === "burger" ? (
        <button
          type="button"
          className="kitchen-inspect"
          aria-pressed={open}
          aria-label={
            (open ? "Close the stack" : "Lift the layers") +
            ", " +
            patties +
            (patties === 1 ? " patty" : " patties")
          }
          onClick={() => setOpen(!open)}
        >
          <Layers size={15} />
          {open ? "Close the stack" : "Lift the layers"}
        </button>
      ) : (
        <button
          type="button"
          className="kitchen-inspect"
          onClick={() => setTurns((n) => n + 1)}
        >
          <RotateCw size={15} />
          Turn the taco
        </button>
      )}
    </div>
  );
}
