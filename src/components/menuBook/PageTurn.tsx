import { useLayoutEffect, useState, type ReactNode } from "react";
import "./pageTurn.css";

type Turn<T> = { from: T; to: T; forward: boolean };

// Retain the outgoing sheet even when a filter removes it from the live menu.
export function usePageTurn<T extends { id: string }>(target: T | undefined, rank: (item: T) => number) {
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
    const finish = () => { setSettled(target); setTurn(null); };
    if (motion.matches) { finish(); return; }
    setTurn({ from: settled, to: target, forward });
    const timer = window.setTimeout(finish, 780);
    motion.addEventListener("change", finish);
    return () => { window.clearTimeout(timer); motion.removeEventListener("change", finish); };
  }, [target, settled, forward]);
  return { turn, shown: turn?.from ?? target };
}

export function PageTurn({ forward, front, back }: {
  forward: boolean; front: ReactNode; back: ReactNode;
}) {
  return <div className={'book-leaf ' + (forward ? 'book-forward' : 'book-backward')} aria-hidden="true" inert>
    <div className="book-face">{front}</div>
    <div className="book-face book-verso">{back}</div>
  </div>;
}
