import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import "./pageTurn.css";

type Turn<T> = { from: T; to: T; forward: boolean };

// Retain the outgoing sheet even when a filter removes it from the live menu.
export function usePageTurn<T extends { id: string }>(
  target: T | undefined,
  rank: (item: T) => number,
) {
  const hasPage = Boolean(target);
  useEffect(() => {
    if (
      hasPage &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      const hand = new Image();
      hand.src = "/kitchen/page-hand.webp";
    }
  }, [hasPage]);
  const [settled, setSettled] = useState(target);
  const [turn, setTurn] = useState<Turn<T> | null>(null);
  const forward = settled && target ? rank(target) >= rank(settled) : true;
  useLayoutEffect(() => {
    if (!target || !settled || target.id === settled.id) {
      setSettled(target);
      setTurn(null);
      return;
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finish = () => {
      setSettled(target);
      setTurn(null);
    };
    if (motion.matches) {
      finish();
      return;
    }
    setTurn({ from: settled, to: target, forward });
    const timer = window.setTimeout(finish, 780);
    motion.addEventListener("change", finish);
    return () => {
      window.clearTimeout(timer);
      motion.removeEventListener("change", finish);
    };
  }, [target, settled, forward]);
  return { turn, shown: turn?.from ?? target };
}

export function PageTurn({
  forward,
  front,
  back,
}: {
  forward: boolean;
  front: ReactNode;
  back: ReactNode;
}) {
  const hands = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const overlay = hands.current;
    const book = overlay?.parentElement;
    if (!book || !overlay) return;
    const markers = Array.from(
      book.querySelectorAll<HTMLElement>(".book-grip-point"),
    );
    let frame = 0;
    function followEdge() {
      if (!overlay) return;
      const marker = markers.find((node) => node.getClientRects().length);
      if (!marker) return;
      const grip = marker.getBoundingClientRect();
      const bounds = overlay.getBoundingClientRect();
      if (bounds.width && bounds.height) {
        overlay.style.setProperty(
          "--grip-x",
          (100 * (grip.x - bounds.x)) / bounds.width + "%",
        );
        overlay.style.setProperty(
          "--grip-y",
          (100 * (grip.y - bounds.y)) / bounds.height + "%",
        );
      }
      frame = requestAnimationFrame(followEdge);
    }
    followEdge();
    return () => cancelAnimationFrame(frame);
  }, [forward]);
  return (
    <>
      <div
        className={"book-leaf " + (forward ? "book-forward" : "book-backward")}
        aria-hidden="true"
        inert
      >
        <i className="book-grip-point" />
        <div className="book-face">{front}</div>
        <div className="book-face book-verso">{back}</div>
      </div>
      <div
        ref={hands}
        className="book-hands"
        data-forward={forward}
        aria-hidden="true"
        inert
      >
        <i className="book-anchor-hand" />
        <i className="book-moving-hand" />
      </div>
    </>
  );
}
