import { useEffect, useRef, useState, type DragEvent } from "react";
import { Link } from "react-router-dom";
import { Check, Flame, Package, RotateCcw } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import type { PublicMenuItem, PublicModifierGroup } from "@/lib/dto/guest";
import PizzaPie from "./PizzaPie";
import { pizzaIngredients, type PizzaArt } from "./ingredients";
import { recipeSelection } from "./recipeSelection";
import "./workshop.css";

const houseGroup: PublicModifierGroup = {
  id: "house",
  name: "Toppings",
  isRequired: false,
  minSelections: 0,
  maxSelections: 6,
  modifiers: (
    [
      "mozzarella",
      "mushroom",
      "olive",
      "basil",
      "pepper",
      "onion",
    ] as PizzaArt[]
  ).map((art) => ({
    id: art,
    name: pizzaIngredients[art],
    pizzaArt: art,
    priceDelta: 0,
    isDefault: art === "mozzarella",
  })),
};
type Stage = "dress" | "baking" | "baked" | "boxed";
const prompts = {
  dress: "Tap an ingredient or drag it onto the dough.",
  baking: "The crust is browning. Watch the edges.",
  baked: "Fresh from the oven. Fold the lid to finish.",
  boxed: "Your creation is boxed. Pick a size on the menu to order it.",
};
function Workbench({ item }: { item?: PublicMenuItem }) {
  const groups = item?.modifierGroups ?? [houseGroup];
  const [selected, setSelected] = useState(() => recipeSelection(groups));
  const [stage, setStage] = useState<Stage>("dress");
  const [notice, setNotice] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [near, setNear] = useState(false);
  const bench = useRef<HTMLDivElement>(null);
  const tray = useRef<HTMLElement>(null);
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
    const id = e.dataTransfer.getData("application/x-pizza-topping");
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
      ? "Bake my pizza"
      : stage === "baking"
        ? "Baking…"
        : stage === "baked"
          ? "Close the box"
          : "Open and remix";
  const Icon =
    stage === "boxed" ? RotateCcw : stage === "baked" ? Package : Flame;
  return (
    <section
      id="pizza-kitchen"
      className="pw"
      ref={tray}
      aria-labelledby="pw-title"
      data-stage={stage}
    >
      <div className="pw-inner">
        <header className="pw-head">
          <p>THE PIZZA KITCHEN</p>
          <h2 id="pw-title">
            Top it. Bake it. <em>Box it.</em>
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
              e.dataTransfer.types.includes("application/x-pizza-topping")
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
          <div
            className="pw-box"
            role="img"
            aria-label={
              stage === "boxed"
                ? "Closed Pinky Promise pizza box"
                : "Open pizza box with " +
                  (selectedOptions.map((m) => m.name).join(", ") ||
                    "tomato base")
            }
          >
            <div className="pw-floor" />
            <div className="pw-paper" />
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
              <div className="pw-lid-inside" />
              <div className="pw-lid-print" />
            </div>
          </div>
        </div>
        <div className="pw-counter">
          <p className="pw-instruction" role="status">
            {notice ||
              (stage === "boxed" && !item
                ? "Open the box to remix your toppings, or explore the café menu."
                : prompts[stage])}
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
                          "application/x-pizza-topping",
                          m.id,
                        );
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onDragEnd={() => setDragOver(false)}
                      aria-pressed={selected[g.id]?.includes(m.id) ?? false}
                      onClick={() => choose(g, m.id)}
                    >
                      {m.pizzaArt && (
                        <img
                          loading="lazy"
                          draggable={false}
                          src={"/pizza/" + m.pizzaArt + ".webp"}
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
    </section>
  );
}
export default function PizzaWorkshop() {
  const { data } = usePublicMenu({ channel: "window" });
  const item = data?.categories
    .flatMap((c) => c.items)
    .find((i) => i.pizzaBuilder?.enabled);
  return <Workbench key={item?.id ?? "sample"} item={item} />;
}
