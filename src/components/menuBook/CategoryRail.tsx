import { useLayoutEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicCategory } from "@/lib/dto/guest";

type Props = {
  categories: PublicCategory[];
  selected: string;
  onSelect: (id: string) => void;
};

export default function CategoryRail({ categories, selected, onSelect }: Props) {
  const root = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [edges, setEdges] = useState({ start: true, end: true });

  function measure() {
    const rail = viewport.current!;
    const start = rail.scrollLeft <= 1;
    const end = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
    setEdges((old) => old.start === start && old.end === end ? old : { start, end });
  }

  function reveal(button: HTMLButtonElement, center = false) {
    const rail = viewport.current!;
    const left = button.offsetLeft - rail.scrollLeft;
    if (left >= 0 && left + button.offsetWidth <= rail.clientWidth) return;
    rail.scrollTo({
      left: center ? button.offsetLeft - (rail.clientWidth - button.offsetWidth) / 2
        : left < 0 ? button.offsetLeft : button.offsetLeft + button.offsetWidth - rail.clientWidth,
      behavior: "auto",
    });
  }

  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      setOverflow(strip.current!.offsetWidth > root.current!.clientWidth + 1);
      measure();
    });
    observer.observe(root.current!);
    observer.observe(viewport.current!);
    observer.observe(strip.current!);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const active = strip.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
    if (active) reveal(active, true);
    measure();
  }, [selected, categories, overflow]);

  function page(direction: number) {
    const rail = viewport.current!;
    rail.scrollBy({
      left: direction * Math.max(100, rail.clientWidth * .8),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }

  const options = [{ id: "all", name: "All dishes" }, ...categories];
  return (
    <nav ref={root} className="menu-rail" aria-label="Menu categories">
      <div className="menu-rail-window" data-left={!edges.start} data-right={!edges.end}>
        <div className="menu-rail-scroll" ref={viewport} onScroll={measure}>
          <div className="menu-rail-strip" ref={strip} onKeyDown={(event) => {
            const buttons = Array.from(event.currentTarget.querySelectorAll("button"));
            const from = buttons.indexOf(event.target as HTMLButtonElement);
            if (from < 0) return;
            let to = from;
            switch (event.key) {
              case "ArrowLeft": to = Math.max(0, from - 1); break;
              case "ArrowRight": to = Math.min(buttons.length - 1, from + 1); break;
              case "Home": to = 0; break;
              case "End": to = buttons.length - 1; break;
              default: return;
            }
            event.preventDefault();
            buttons[to].focus({ preventScroll: true });
          }}>
            {options.map(({ id, name }) => (
              <button type="button" key={id} title={name} aria-pressed={selected === id}
                onFocus={(event) => reveal(event.currentTarget)}
                onClick={() => onSelect(id)}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
      {overflow && (
        <div className="menu-rail-arrows">
          <button type="button" aria-label="Scroll categories left" disabled={edges.start} onClick={() => page(-1)}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Scroll categories right" disabled={edges.end} onClick={() => page(1)}><ChevronRight size={18} /></button>
        </div>
      )}
    </nav>
  );
}
