import { builderKind } from "@/components/pizza/ingredients";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Utensils, Plus, Rotate3d } from "lucide-react";
import { hasDishModel, startingPrice } from "@/components/counter/menuDisplay";
import type { PublicCategory, PublicMenuItem } from "@/lib/dto/guest";
import { PageTurn, usePageTurn } from "./PageTurn";
import DishArtwork from "./DishArtwork";
import "./menuBook.css";

type Props = {
  collection: string;
  items: PublicMenuItem[];
  categories: PublicCategory[];
  formatPrice: (price: number) => string;
  quantities: Map<string, number>;
  onAdd: (item: PublicMenuItem) => void;
  onInspect: (item: PublicMenuItem) => void;
};

export default function MenuBook({ collection, items, categories, formatPrice, quantities, onAdd, onInspect }: Props) {
  const [selection, setSelection] = useState({ collection, id: items[0]?.id });
  if (selection.collection !== collection) setSelection({ collection, id: items[0]?.id });
  const index = Math.max(0, items.findIndex((item) => item.id === selection.id));
  const current = items[index];
  const all = categories.flatMap((category) => category.items);
  const { turn, shown } = usePageTurn(current, (item) => all.findIndex((entry) => entry.id === item.id));
  const gesture = useRef<{ x: number; y: number } | null>(null);

  const dishRail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = dishRail.current;
    const active = rail?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!rail || !active) return;
    const left = active.offsetLeft - rail.scrollLeft;
    if (left < 0 || left + active.offsetWidth > rail.clientWidth) {
      rail.scrollTo({ left: active.offsetLeft - (rail.clientWidth - active.offsetWidth) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }, [current?.id, collection]);

  function move(step: number) {
    const next = items[index + step];
    if (next) setSelection({ collection, id: next.id });
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
            <Plus size={16} /> {item.pizzaBuilder?.enabled ? "Build your " + builderKind(item.pizzaBuilder) : quantity ? `Add again · ${quantity} in bag` : "Add to bag"}
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
        const step = event.key === "ArrowRight" ? 1 : -1;
        if (dishRail.current?.contains(event.target as Node)) {
          const buttons = Array.from(dishRail.current.querySelectorAll("button"));
          const button = buttons[buttons.indexOf(event.target as HTMLButtonElement) + step];
          if (button) { button.focus({ preventScroll: true }); button.click(); }
        } else move(step);
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
        <div className="mb-spread" data-turning={Boolean(turn)}>
          <DishArtwork key={(turn?.forward ? turn.from : current).id} item={turn?.forward ? turn.from : current} interactive={!turn} />
          <div className="mb-text-page" inert={Boolean(turn)}>{details(turn && !turn.forward ? turn.from : current)}</div>
          {turn && <PageTurn key={turn.to.id} forward={turn.forward}
            front={details(turn.forward ? turn.from : current, true)}
            back={<DishArtwork item={turn.forward ? current : turn.from} />} />}
          {turn && <div key={'mobile-' + turn.to.id} className={'mb-mobile-sheet ' + (turn.forward ? 'mb-out' : 'mb-in')} aria-hidden="true" inert>
            <DishArtwork item={turn.forward ? turn.from : current} />
            {details(turn.forward ? turn.from : current, true)}
          </div>}
          {turn && <div className="mb-mobile-base" aria-hidden="true" inert>
            <DishArtwork item={turn.forward ? current : turn.from} />
            {details(turn.forward ? current : turn.from, true)}
          </div>}
        </div>
      </div>
      {items.length > 1 && <div className="mb-dish-rail" ref={dishRail} role="navigation" aria-label="Jump to a dish">
        {items.map((item, position) => <button key={item.id} type="button"
          tabIndex={item.id === current.id ? 0 : -1}
          aria-current={item.id === current.id ? "page" : undefined}
          onClick={() => setSelection({ collection, id: item.id })}>
          <span className="mb-thumb" aria-hidden="true">
            <Utensils size={16} />
            {item.imageUrl && <img src={item.imageUrl} alt="" loading="lazy"
              key={item.imageUrl} onError={(event) => { event.currentTarget.hidden = true; }} />}
          </span>
          <span className="mb-dish-label">{item.name}</span><small>{position + 1}</small>
        </button>)}
      </div>}
      <nav className="mb-pager" aria-label="Menu pages">
        <button type="button" aria-label="Previous dish" aria-disabled={index === 0} onClick={() => move(-1)}><ChevronLeft size={18} /></button>
        <span aria-live="polite" aria-atomic="true"><span className="sr-only">{shown?.name}, </span>{turn ? "Turning page…" : `Dish ${index + 1} of ${items.length}`}</span>
        <button type="button" aria-label="Next dish" aria-disabled={index === items.length - 1} onClick={() => move(1)}><ChevronRight size={18} /></button>
      </nav>
    </section>
  );
}
