import { useState, type CSSProperties } from "react";
import { Check, X } from "lucide-react";
import Dialog from "@/components/ui/Dialog";
import type { PublicMenuItem, PublicModifierGroup } from "@/lib/dto/guest";
import { pizzaBase, pizzaIngredients, type PizzaArt } from "./ingredients";
import "./pizza.css";

type Props = {
  item: PublicMenuItem;
  variantId?: string;
  setVariantId: (id: string) => void;
  selected: Record<string, string[]>;
  toggle: (group: PublicModifierGroup, id: string) => void;
  notes: string;
  setNotes: (text: string) => void;
  total: number;
  fmt: (price: number) => string;
  missing?: PublicModifierGroup;
  onClose: () => void;
  onAdd: () => void;
};
const artSettings: Record<PizzaArt, [number, number, number]> = {
  mozzarella: [48, 8, 1],
  pepperoni: [10, 15, 2],
  mushroom: [11, 12, 3],
  olive: [18, 7, 4],
  basil: [9, 10, 5],
  pepper: [11, 12, 6],
  onion: [12, 12, 7],
  tomato: [9, 14, 8],
};

function ToppingLayer({ art, id }: { art: PizzaArt; id: string }) {
  const [count, width, offset] = artSettings[art];
  return (
    <div className="pizza-layer">
      {Array.from({ length: count }, (_, i) => {
        const seed = id.charCodeAt(id.length - 1) + offset;
        const jitter = Math.sin(i * 27.3 + seed);
        const angle = i * 2.39996 + seed * 0.86 + jitter * 0.16;
        const radius = 36 * Math.sqrt((i + 0.4) / count);
        return (
          <span
            key={i}
            style={
              {
                left: 50 + radius * Math.cos(angle) + "%",
                top: 50 + radius * Math.sin(angle) + "%",
                width: width * (1 + 0.18 * jitter) + "%",
                "--turn": i * 67 + offset * 19 + "deg",
                "--delay": i * 9 + "ms",
              } as CSSProperties
            }
          >
            <img alt="" src={"/pizza/" + art + ".webp"} draggable={false} />
          </span>
        );
      })}
    </div>
  );
}

export default function PizzaBuilder({
  item,
  variantId,
  setVariantId,
  selected,
  toggle,
  notes,
  setNotes,
  total,
  fmt,
  missing,
  onClose,
  onAdd,
}: Props) {
  const choices = item.modifierGroups.flatMap((g) =>
    g.modifiers.filter((m) => selected[g.id]?.includes(m.id)),
  );
  const layers = choices
    .filter((m) => m.pizzaArt && m.pizzaArt in pizzaIngredients)
    .sort((a, b) => artSettings[a.pizzaArt!][2] - artSettings[b.pizzaArt!][2]);
  const [failedBase, setFailedBase] = useState(false);
  const variantIndex = item.variants.findIndex((v) => v.id === variantId);
  const scale =
    item.variants.length > 1
      ? 0.87 + (0.13 * Math.max(0, variantIndex)) / (item.variants.length - 1)
      : 1;
  return (
    <Dialog
      onClose={onClose}
      label={"Build your pizza: " + item.name}
      className="pizza-dialog"
    >
      <div className="pizza-scrim" onClick={onClose} />
      <div className="pizza-builder">
        <header className="pizza-head">
          <div>
            <p>{item.name}</p>
            <h2>
              Build your <em>pizza.</em>
            </h2>
          </div>
          <button
            type="button"
            className="pizza-close"
            onClick={onClose}
            aria-label="Close pizza builder"
          >
            <X />
          </button>
        </header>
        <div className="pizza-content">
          <div
            className="pizza-stage"
            role="img"
            aria-label={
              item.name +
              ", " +
              (choices.map((m) => m.name).join(", ") || "tomato base")
            }
          >
            <div
              className="pizza-pie"
              style={{ "--size": scale } as CSSProperties}
            >
              <img
                className="pizza-base"
                src={
                  (!failedBase && item.pizzaBuilder?.baseImageUrl) || pizzaBase
                }
                onError={() => setFailedBase(true)}
                alt=""
              />
              {layers.map((m) => (
                <ToppingLayer key={m.id} id={m.id} art={m.pizzaArt!} />
              ))}
            </div>
          </div>
          <div className="pizza-options">
            {!!item.variants.length && (
              <fieldset>
                <legend>Size</legend>
                <div className="pizza-sizes">
                  {item.variants.map((v) => (
                    <button
                      type="button"
                      key={v.id}
                      aria-pressed={v.id === variantId}
                      onClick={() => setVariantId(v.id)}
                    >
                      {v.name}
                      <small>
                        {fmt(v.absolutePrice ?? item.basePrice + v.priceDelta)}
                      </small>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {item.modifierGroups.map((g) => (
              <fieldset key={g.id}>
                <legend>{g.name}</legend>
                <p className="pizza-hint">
                  {g.isRequired
                    ? "Choose at least " + Math.max(1, g.minSelections)
                    : "Optional"}
                  {g.maxSelections > 0 ? " · Up to " + g.maxSelections : ""}
                </p>
                <div className="pizza-tiles">
                  {g.modifiers.map((m) => {
                    const on = selected[g.id]?.includes(m.id) ?? false;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(g, m.id)}
                      >
                        {m.pizzaArt && (
                          <img src={"/pizza/" + m.pizzaArt + ".webp"} alt="" />
                        )}
                        {on && <Check className="pizza-tick" size={15} />}
                        <strong>{m.name}</strong>
                        <small>
                          {m.priceDelta > 0
                            ? "+" + fmt(m.priceDelta)
                            : m.priceDelta < 0
                              ? fmt(m.priceDelta)
                              : "Included"}
                        </small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <details>
              <summary>Special instructions</summary>
              <textarea
                aria-label="Special instructions"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </details>
          </div>
        </div>
        <footer>
          <p aria-live="polite">
            {missing
              ? "Choose " + missing.name + " to continue"
              : choices.map((m) => m.name).join(" · ") || "Tomato base"}
          </p>
          <button className="pizza-add" disabled={!!missing} onClick={onAdd}>
            Add to order <strong>{fmt(total)}</strong>
          </button>
        </footer>
      </div>
    </Dialog>
  );
}
