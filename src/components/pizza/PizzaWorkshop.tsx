import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import {
  Check,
  Flame,
  Package,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import type { PublicMenuItem, PublicModifierGroup } from "@/lib/dto/guest";
import KitchenPreview from "./KitchenPreview";
import PizzaPie from "./PizzaPie";
import {
  builderKind,
  ingredientPhoto,
  builderIngredients,
  type BuilderKind,
  type IngredientArt,
} from "./ingredients";
import { recipeSelection } from "./recipeSelection";
import "./workshop.css";

const kinds = ["pizza", "burger", "taco"] as const;
const kitchens = {
  pizza: {
    name: "Pizza",
    title: "Top it. Bake it.",
    finish: "Box it.",
    dress: "Tap an ingredient or drag it onto the dough.",
    cook: "Bake my pizza",
    cooking: "Baking…",
    ready: "Fresh from the oven. Fold the lid to finish.",
    pack: "Close the box",
    base: "Tomato base",
  },
  burger: {
    name: "Burger",
    title: "Stack it. Press it.",
    finish: "Wrap it.",
    dress: "Build your burger, then lift the layers for a closer look.",
    cook: "Grill my burger",
    cooking: "Grilling…",
    ready: "Off the grill. Fold the checkerboard wrap around your stack.",
    pack: "Wrap the burger",
    base: "Bun & patty",
  },
  taco: {
    name: "Tacos",
    title: "Fill it. Turn it.",
    finish: "Fold it.",
    dress: "Layer the fillings onto the tortilla and turn the plate.",
    cook: "Toast my taco",
    cooking: "Toasting…",
    ready: "Warm from the griddle. Fold the sleeve around your taco.",
    pack: "Fold the sleeve",
    base: "Tortilla & beans",
  },
};
function sampleGroup(kind: BuilderKind): PublicModifierGroup {
  const names = Object.entries(builderIngredients[kind]);
  return {
    id: "house",
    name: kind === "pizza" ? "Pizza toppings" : "Fillings",
    isRequired: false,
    minSelections: 0,
    maxSelections: names.length,
    modifiers: names
      .filter(([art]) => art !== "pepperoni")
      .map(([id, name], i) => ({
        id,
        name,
        pizzaArt: id as IngredientArt,
        priceDelta: 0,
        isDefault: i === 0,
      })),
  };
}
type Stage = "dress" | "baking" | "baked" | "boxed";
function Workbench({
  item,
  kind,
  active,
}: {
  item?: PublicMenuItem;
  kind: BuilderKind;
  active: boolean;
}) {
  const config = kitchens[kind];
  const groups = item?.modifierGroups ?? [sampleGroup(kind)];
  const [selected, setSelected] = useState(() => recipeSelection(groups));
  const [stage, setStage] = useState<Stage>("dress");
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [near, setNear] = useState(false);
  const bench = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!tray.current || !("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(tray.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (stage !== "baking") return;
    const t = window.setTimeout(
      () => setStage("baked"),
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1700,
    );
    return () => window.clearTimeout(t);
  }, [stage]);
  const selectedOptions = groups.flatMap((g) =>
    g.modifiers.filter((m) => selected[g.id]?.includes(m.id)),
  );
  const required = groups.find(
    (g) =>
      g.isRequired &&
      (selected[g.id]?.length ?? 0) < Math.max(1, g.minSelections),
  );
  function choose(group: PublicModifierGroup, id: string, addOnly = false) {
    if (stage !== "dress") return;
    const ids = selected[group.id] ?? [];
    if (addOnly && ids.includes(id)) return;
    if (
      !ids.includes(id) &&
      group.maxSelections > 1 &&
      ids.length >= group.maxSelections
    ) {
      setNotice(
        "Choose up to " + group.maxSelections + " from " + group.name + ".",
      );
      return;
    }
    setNotice("");
    setSelected({
      ...selected,
      [group.id]: ids.includes(id)
        ? ids.filter((v) => v !== id)
        : group.maxSelections === 1
          ? [id]
          : [...ids, id],
    });
  }
  function drop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("application/x-kitchen-ingredient");
    const group = groups.find((g) => g.modifiers.some((m) => m.id === id));
    if (group) choose(group, id, true);
  }
  function advance() {
    if (stage === "dress" && required) {
      setNotice("Choose " + required.name + " first.");
      return;
    }
    setNotice("");
    setStage(
      stage === "dress" ? "baking" : stage === "baked" ? "boxed" : "dress",
    );
  }
  const params = item
    ? new URLSearchParams({
        item: item.id,
        category: item.categoryId,
        recipe: selectedOptions.map((m) => m.id).join(","),
      })
    : null;
  const action =
    stage === "dress"
      ? config.cook
      : stage === "baking"
        ? config.cooking
        : stage === "baked"
          ? config.pack
          : "Open and remix";
  const Icon =
    stage === "boxed" ? RotateCcw : stage === "baked" ? Package : Flame;
  return (
    <div
      className="pw-slide"
      hidden={!active}
      ref={tray}
      data-kind={kind}
      data-stage={stage}
      role="group"
      aria-label={config.name}
    >
      <div className="pw-inner">
        <header className="pw-head">
          <p>The {kind === "taco" ? "taco" : kind} kitchen</p>
          <h2>
            {config.title} <em>{config.finish}</em>
          </h2>
        </header>
        <div
          className="pw-bench"
          ref={bench}
          data-over={dragOver}
          onPointerMove={(e) => {
            if (
              e.pointerType !== "mouse" ||
              window.matchMedia("(prefers-reduced-motion: reduce)").matches
            )
              return;
            const r = e.currentTarget.getBoundingClientRect();
            e.currentTarget.style.setProperty(
              "--lean",
              ((e.clientX - r.left) / r.width) * 8 - 4 + "deg",
            );
            e.currentTarget.style.setProperty(
              "--nod",
              ((e.clientY - r.top) / r.height) * 5 - 2.5 + "deg",
            );
          }}
          onPointerLeave={() => {
            bench.current?.style.removeProperty("--lean");
            bench.current?.style.removeProperty("--nod");
          }}
          onDragOver={(e) => {
            if (
              stage === "dress" &&
              e.dataTransfer.types.includes("application/x-kitchen-ingredient")
            ) {
              e.preventDefault();
              e.dataTransfer.dropEffect = "copy";
              setDragOver(true);
            }
          }}
          onDragLeave={(e) => {
            if (
              !(e.relatedTarget instanceof Node) ||
              !e.currentTarget.contains(e.relatedTarget)
            )
              setDragOver(false);
          }}
          onDrop={drop}
        >
          <div className="pw-cloth" aria-hidden="true" />
          <div className="pw-pinch" aria-hidden="true">
            <img
              alt=""
              src={
                kind === "pizza"
                  ? "/pizza/basil.webp"
                  : kind === "burger"
                    ? "/kitchen/burger-tomato.webp"
                    : "/kitchen/taco-avocado.webp"
              }
              loading="lazy"
            />
          </div>
          {kind === "pizza" ? (
            <div
              className="pw-box"
              role="img"
              aria-label={
                stage === "boxed"
                  ? "Closed Pinky Promise pizza box"
                  : "Open Pinky Promise Café & Restaurant pizza box with " +
                    (selectedOptions.map((m) => m.name).join(", ") ||
                      "tomato base")
              }
            >
              <div className="pw-floor" />
              <div className="pw-paper" />
              <div className="pw-folds" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
              <div className="pw-food">
                {near && (
                  <PizzaPie
                    choices={selectedOptions}
                    baseImageUrl={item?.pizzaBuilder?.baseImageUrl}
                  />
                )}
              </div>
              <div className="pw-heat">
                <i />
                <i />
                <i />
              </div>
              <div className="pw-wall pw-front" />
              <div className="pw-wall pw-back" />
              <div className="pw-wall pw-left" />
              <div className="pw-wall pw-right" />
              <div className="pw-lid">
                <div className="pw-lid-inside">
                  <div className="pw-lid-stamp">
                    <img
                      src="/brand/logo.png"
                      alt=""
                      draggable={false}
                      loading="lazy"
                    />
                  </div>
                </div>
                <div className="pw-lid-print" />
              </div>
            </div>
          ) : (
            <div className="pw-parcel">
              {near && (
                <KitchenPreview
                  kind={kind}
                  choices={selectedOptions}
                  scale={1}
                />
              )}
              {stage === "boxed" && (
                <div className="pw-wrap">
                  <img
                    src="/brand/logo.png"
                    alt="Pinky Promise Café"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}
          <aside className="pw-ticket" aria-label="Current recipe">
            <span>Pinky Promise</span>
            <strong>{item?.name || config.name}</strong>
            <small>
              {selectedOptions.map((m) => m.name).join(" · ") || config.base}
            </small>
          </aside>
        </div>
        <div className="pw-counter">
          <p className="pw-instruction" role="status">
            {notice ||
              (stage === "boxed"
                ? "Packed and ready. Remix your recipe or explore the menu."
                : stage === "baked"
                  ? config.ready
                  : stage === "baking"
                    ? config.cooking
                    : config.dress)}
          </p>
          <div className="pw-groups">
            {groups.map((g) => (
              <fieldset key={g.id} disabled={stage !== "dress"}>
                <legend>{g.name}</legend>
                <div className="pw-ingredients">
                  {g.modifiers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      draggable={stage === "dress"}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          "application/x-kitchen-ingredient",
                          m.id,
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={() => setDragOver(false)}
                      aria-pressed={selected[g.id]?.includes(m.id) ?? false}
                      onClick={() => choose(g, m.id)}
                    >
                      {ingredientPhoto(kind, m.pizzaArt) && (
                        <img
                          loading="lazy"
                          draggable={false}
                          src={ingredientPhoto(kind, m.pizzaArt)}
                          alt=""
                        />
                      )}
                      <span>{m.name}</span>
                      {selected[g.id]?.includes(m.id) && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="pw-actions">
            <button
              type="button"
              disabled={stage === "baking"}
              onClick={advance}
            >
              <Icon size={18} />
              {action}
            </button>
            {stage === "boxed" && (
              <Link to={params ? "/menu?" + params : "/menu"}>
                {item ? "Choose size & order" : "Explore the menu"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
export default function PizzaWorkshop() {
  const { data } = usePublicMenu({ channel: "window" });
  const [slide, setSlide] = useState(0);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const items = data?.categories.flatMap((c) => c.items) ?? [];
  function step(direction: number) {
    setSlide((current) => (current + direction + kinds.length) % kinds.length);
  }
  return (
    <section
      id="pizza-kitchen"
      className="pw"
      data-kind={kinds[slide]}
      aria-label="Interactive café kitchen"
      aria-roledescription="carousel"
      onTouchStart={(e) => {
        if (
          e.touches.length !== 1 ||
          (e.target as Element).closest("button,a,input,.pw-groups")
        ) {
          gesture.current = null;
          return;
        }
        gesture.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchCancel={() => {
        gesture.current = null;
      }}
      onTouchEnd={(e) => {
        const from = gesture.current;
        gesture.current = null;
        if (!from) return;
        const dx = e.changedTouches[0].clientX - from.x,
          dy = e.changedTouches[0].clientY - from.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > 1.5 * Math.abs(dy))
          step(dx < 0 ? 1 : -1);
      }}
    >
      <div
        className="pw-switch"
        role="group"
        aria-label="Choose a kitchen"
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
            e.preventDefault();
            step(e.key === "ArrowLeft" ? -1 : 1);
          }
        }}
      >
        <button
          type="button"
          aria-label="Previous kitchen"
          onClick={() => step(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        {kinds.map((k, i) => (
          <button
            key={k}
            type="button"
            aria-pressed={slide === i}
            onClick={() => setSlide(i)}
          >
            {kitchens[k].name}
          </button>
        ))}
        <button type="button" aria-label="Next kitchen" onClick={() => step(1)}>
          <ChevronRight size={18} />
        </button>
      </div>
      {kinds.map((kind, i) => {
        const item = items.find(
          (it) =>
            it.pizzaBuilder?.enabled && builderKind(it.pizzaBuilder) === kind,
        );
        return (
          <Workbench
            key={kind + (item?.id ?? "sample")}
            kind={kind}
            item={item}
            active={slide === i}
          />
        );
      })}
    </section>
  );
}
