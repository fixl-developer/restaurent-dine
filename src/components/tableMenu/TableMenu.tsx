import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Coffee } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { startingPrice } from "@/components/counter/menuDisplay";
import { useBookDrag } from "@/components/menuBook/useBookDrag";
import { BookHands, PageTurn, usePageTurn } from "@/components/menuBook/PageTurn";
import type { PublicMenuItem } from "@/lib/dto/guest";
import DishArtwork from "@/components/menuBook/DishArtwork";
import "./tableMenu.css";

export default function TableMenu() {
  const stage = useRef<HTMLDivElement>(null);
  const [opened, setOpened] = useState(false);
  const [selection, setSelection] = useState<string>();
  const menu = usePublicMenu({ channel: "window" });
  const formatPrice = useCurrencyFormatter();
  const pages = (menu.data?.categories ?? []).flatMap((category) =>
    category.items.map((item) => ({ item, category })),
  );
  const index = Math.max(0, pages.findIndex(({ item }) => item.id === selection));
  const page = pages[index];
  const { turn: autoTurn, shown, settle } = usePageTurn(page?.item, item => pages.findIndex(entry => entry.item.id === item.id));
  const drag = useBookDrag(page?.item, pages[index - 1]?.item, pages[index + 1]?.item, !!autoTurn, item => {
    setOpened(true); settle(item); setSelection(item.id);
  });
  const sheet = drag.sheet || autoTurn;
  const picture = sheet?.forward ? sheet.from : sheet?.to ?? page?.item;
  const entry = sheet && !sheet.forward ? sheet.from : sheet?.to ?? page?.item;

  function print(item: PublicMenuItem) {
    return <div className="tm-print">
      <span className="tm-category">{pages.find(row => row.item.id === item.id)?.category.name}</span>
      <h3>{item.name}</h3>
      {item.description && <p>{item.description}</p>}
      <strong>{item.variants.length > 0 && "From "}{formatPrice(startingPrice(item))}</strong>
    </div>;
  }


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
      <div className="tm-stage" ref={stage} data-open={opened || !!drag.sheet}>
        <div className="tm-room" aria-hidden="true" />
        <div className="tm-book book-draggable" {...drag.handlers} style={drag.style} data-scrubbing={!!drag.sheet}>
          <div className="tm-paper">
            {entry ? print(entry) : <div className="tm-print"><BookOpen aria-hidden="true" /><p role="status">{status}</p></div>}
          </div>
          <div className="tm-cover" aria-hidden="true">
            <div className="tm-cloth"><Coffee size={28} /><span>Pinky Promise</span><small>Menu</small></div>
            <div className="tm-inside">
              {picture ? <DishArtwork key={picture.id} item={picture} /> : <Coffee size={46} />}
            </div>
          </div>
          {sheet && <PageTurn key={sheet.to.id} forward={sheet.forward}
            front={<div className="tm-sheet-text">{print(sheet.forward ? sheet.from : sheet.to)}</div>}
            back={<div className="tm-sheet-art"><DishArtwork item={sheet.forward ? sheet.to : sheet.from} /></div>} />}
          <BookHands turning={!!sheet} forward={sheet?.forward} pageId={sheet?.to.id} />
        </div>
      </div>
      <div className="tm-controls">
        <div className="tm-pager" aria-label="Table menu pages" role="group">
          <button type="button" aria-label="Previous dish" disabled={index === 0} onClick={() => turn(-1)}><ArrowLeft size={18} /></button>
          <span aria-live="polite" aria-atomic="true">{sheet ? "Turning…" : page ? <> {index + 1} / {pages.length}<span className="sr-only">, {page.item.name}</span></> : "—"}</span>
          <button type="button" aria-label="Next dish" disabled={index + 1 >= pages.length} onClick={() => turn(1)}><ArrowRight size={18} /></button>
        </div>
        {shown ? (
          <Link className="tm-action" to={'/menu?' + new URLSearchParams({ item: shown.id, category: shown.categoryId })} aria-label={'View ' + shown.name + ' on the menu'}>
            View dish <ArrowUpRight size={16} />
          </Link>
        ) : menu.isError && <button className="tm-action" onClick={() => menu.refetch()} disabled={menu.isFetching}>Retry menu</button>}
      </div>
    </section>
  );
}
