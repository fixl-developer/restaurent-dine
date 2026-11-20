import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Coffee } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { startingPrice } from "@/components/counter/menuDisplay";
import DishArtwork from "@/components/menuBook/DishArtwork";
import "./tableMenu.css";

export default function TableMenu() {
  const stage = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [selection, setSelection] = useState<string>();
  const menu = usePublicMenu({ channel: "window" });
  const formatPrice = useCurrencyFormatter();
  const pages = (menu.data?.categories ?? []).flatMap((category) =>
    category.items.map((item) => ({ item, category })),
  );
  const index = Math.max(0, pages.findIndex(({ item }) => item.id === selection));
  const page = pages[index];

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = false;
    function paint() {
      frame = 0;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const travelled = window.innerHeight - rect.top;
      const progress = Math.max(0, Math.min(1, travelled / Math.min(window.innerHeight * 0.7, rect.height * 0.85)));
      node.style.setProperty("--lid-angle", (motion.matches ? -180 : -180 * progress) + "deg");
      const depth = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - window.innerHeight / 2) / window.innerHeight));
      node.style.setProperty("--depth-offset", (motion.matches ? 0 : depth * 46) + "px");
    }
    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(paint);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    }, { rootMargin: "80px" });
    observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  function turn(offset: number) {
    const next = pages[index + offset];
    if (next) {
      setOpened(true);
      setDirection(offset > 0 ? "forward" : "back");
      setSelection(next.item.id);
    }
  }

  const status = menu.isLoading ? "Loading today’s menu…" :
    menu.isError ? "The menu is temporarily unavailable." : "The kitchen is updating its menu.";

  return (
    <section id="table-menu" className="table-menu" aria-labelledby="table-menu-heading">
      <div className="tm-intro">
        <h2 id="table-menu-heading">The table menu</h2>
        <Link to="/menu">Full menu <ArrowUpRight size={17} /></Link>
      </div>
      <div className="tm-stage" ref={stage} data-open={opened}>
        <div className="tm-room" aria-hidden="true" />
        <div className="tm-book">
          <div className="tm-paper">
            {page ? (
              <div key={page.item.id} className="tm-print">
                <span className="tm-category">{page.category.name}</span>
                <h3>{page.item.name}</h3>
                {page.item.description && <p>{page.item.description}</p>}
                <strong>{page.item.variants.length > 0 && "From "}{formatPrice(startingPrice(page.item))}</strong>
              </div>
            ) : <div className="tm-print"><BookOpen aria-hidden="true" /><p role="status">{status}</p></div>}
          </div>
          <div className="tm-cover" aria-hidden="true">
            <div className="tm-cloth"><Coffee size={28} /><span>Pinky Promise</span><small>Menu</small></div>
            <div className="tm-inside">
              {page ? <DishArtwork key={page.item.id} item={page.item} /> : <Coffee size={46} />}
            </div>
          </div>
          {opened && page && <div key={page.item.id} className={"tm-leaf tm-" + direction} aria-hidden="true" />}
        </div>
      </div>
      <div className="tm-controls">
        <div className="tm-pager" aria-label="Table menu pages" role="group">
          <button type="button" aria-label="Previous dish" disabled={index === 0} onClick={() => turn(-1)}><ArrowLeft size={18} /></button>
          <span aria-live="polite" aria-atomic="true">{page ? <> {index + 1} / {pages.length}<span className="sr-only">, {page.item.name}</span></> : "—"}</span>
          <button type="button" aria-label="Next dish" disabled={index + 1 >= pages.length} onClick={() => turn(1)}><ArrowRight size={18} /></button>
        </div>
        {page ? (
          <Link className="tm-action" to={'/menu?' + new URLSearchParams({ item: page.item.id, category: page.category.id })} aria-label={'View ' + page.item.name + ' on the menu'}>
            View dish <ArrowUpRight size={16} />
          </Link>
        ) : menu.isError && <button className="tm-action" onClick={() => menu.refetch()} disabled={menu.isFetching}>Retry menu</button>}
      </div>
    </section>
  );
}
