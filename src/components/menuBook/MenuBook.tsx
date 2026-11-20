import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Rotate3d } from "lucide-react";
import { hasDishModel, startingPrice } from "@/components/counter/menuDisplay";
import type { PublicCategory, PublicMenuItem } from "@/lib/dto/guest";
import DishArtwork from "./DishArtwork";
import "./menuBook.css";

type Props = {
  items: PublicMenuItem[];
  categories: PublicCategory[];
  formatPrice: (price: number) => string;
  quantities: Map<string, number>;
  onAdd: (item: PublicMenuItem) => void;
  onInspect: (item: PublicMenuItem) => void;
};

export default function MenuBook({ items, categories, formatPrice, quantities, onAdd, onInspect }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.id);
  const index = Math.max(0, items.findIndex((item) => item.id === selectedId));
  const current = items[index];
  const [turn, setTurn] = useState<{ from: PublicMenuItem; forward: boolean; to: string } | null>(null);
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const liveTurn = turn?.to === current?.id ? turn : null;

  useEffect(() => {
    if (!turn) return;
    // Also releases the decorative leaf when animations are disabled.
    const timer = window.setTimeout(() => setTurn(null), 580);
    return () => window.clearTimeout(timer);
  }, [turn]);

  function move(step: number) {
    const next = items[index + step];
    if (!next) return;
    setTurn({ from: current, forward: step > 0, to: next.id });
    setSelectedId(next.id);
  }

  function details(item: PublicMenuItem, decorative = false) {
    const quantity = quantities.get(item.id) ?? 0;
    const category = categories.find((entry) => entry.id === item.categoryId);
    return (
      <div className="mb-details">
        <div className="mb-details-copy">
          {category && <p className="mb-category">{category.name}</p>}
          <h3>{item.name}</h3>
          {item.description && <p className="mb-description">{item.description}</p>}
          <div className="mb-facts">
            {item.foodType === "vegan" && <span>Vegan</span>}
            {item.foodType === "veg" && <span>Vegetarian</span>}
            {item.calories != null && <span>{item.calories} Cal</span>}
          </div>
          {!!item.allergens?.length && <p className="mb-allergens">Contains {item.allergens.join(", ")}</p>}
        </div>
        <div className="mb-order">
          <strong>{item.variants.length > 0 && <small>From </small>}{formatPrice(startingPrice(item))}</strong>
          <button type="button" tabIndex={decorative ? -1 : 0} onClick={() => onAdd(item)}>
            <Plus size={16} /> {quantity ? `Add again · ${quantity} in bag` : "Add to bag"}
          </button>
          {hasDishModel(item) && (
            <button type="button" className="mb-inspect" tabIndex={decorative ? -1 : 0} onClick={() => onInspect(item)}>
              <Rotate3d size={17} /> View dish in 3D
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!current) return null;
  return (
    <section className="mb-table" aria-label="Interactive menu book"
      onKeyDown={(event) => {
        if (event.altKey || event.metaKey || event.ctrlKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        move(event.key === "ArrowRight" ? 1 : -1);
      }}>
      <div className="mb-binding" onTouchStart={(event) => {
        const touch = event.touches[0];
        gesture.current = event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null;
      }} onTouchCancel={() => { gesture.current = null; }} onTouchEnd={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (!start || event.touches.length) return;
        const dx = event.changedTouches[0].clientX - start.x;
        const dy = event.changedTouches[0].clientY - start.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > 1.6 * Math.abs(dy)) move(dx < 0 ? 1 : -1);
      }}>
        <div className="mb-spread" key={current.id}>
          <DishArtwork item={current} interactive />
          {details(current)}
          {liveTurn && (
            <div className={'mb-leaf ' + (liveTurn.forward ? 'mb-next' : 'mb-prev')} aria-hidden="true" inert>
              <div className="mb-face mb-front">{details(liveTurn.forward ? liveTurn.from : current, true)}</div>
              <div className="mb-face mb-back"><DishArtwork item={liveTurn.forward ? current : liveTurn.from} /></div>
            </div>
          )}
        </div>
      </div>
      <nav className="mb-pager" aria-label="Menu pages">
        <button type="button" aria-label="Previous dish" aria-disabled={index === 0} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <span aria-live="polite" aria-atomic="true"><span className="sr-only">{current.name}, </span>Dish {index + 1} of {items.length}</span>
        <button type="button" aria-label="Next dish" aria-disabled={index === items.length - 1} onClick={() => move(1)}><ChevronRight size={18} /></button>
      </nav>
    </section>
  );
}
