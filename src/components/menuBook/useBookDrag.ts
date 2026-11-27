import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";

type Sheet<T> = { from: T; to: T; forward: boolean; progress: number };
type Gesture<T> = {
  id: number;
  x: number;
  y: number;
  width: number;
  sheet?: Sheet<T>;
};

export function useBookDrag<T extends { id: string }>(
  current: T | undefined,
  previous: T | undefined,
  next: T | undefined,
  busy: boolean,
  select: (page: T) => void,
) {
  const gesture = useRef<Gesture<T> | null>(null);
  const frame = useRef(0);
  const [sheet, setSheet] = useState<Sheet<T> | null>(null);
  useEffect(() => {
    setSheet(null);
    return () => {
      cancelAnimationFrame(frame.current);
      frame.current = 0;
      gesture.current = null;
    };
  }, [current?.id, previous?.id, next?.id]);
  const visible =
    sheet?.from.id === current?.id &&
    (sheet?.to.id === previous?.id || sheet?.to.id === next?.id)
      ? sheet
      : null;

  function release(commit: boolean) {
    const preview = gesture.current?.sheet;
    gesture.current = null;
    if (!preview) return;
    const active = preview;
    const end = commit ? 1 : 0;
    const began = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 260 * Math.abs(end - active.progress);
    function settle(now: number) {
      const t = duration ? Math.min(1, (now - began) / duration) : 1;
      if (t < 1) {
        setSheet({
          ...active!,
          progress: end + (active.progress - end) * (1 - t) ** 2,
        });
        frame.current = requestAnimationFrame(settle);
      } else {
        frame.current = 0;
        setSheet(null);
        if (commit) select(active.to);
      }
    }
    frame.current = requestAnimationFrame(settle);
  }

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLDivElement>) {
      if (
        !e.isPrimary ||
        e.button !== 0 ||
        busy ||
        frame.current ||
        !current ||
        (e.target as Element).closest(
          "button,a,input,select,textarea,[contenteditable=true]",
        )
      )
        return;
      gesture.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        width: e.currentTarget.clientWidth,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove(e: PointerEvent<HTMLDivElement>) {
      const g = gesture.current;
      if (!g || !current || g.id !== e.pointerId) return;
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (!g.sheet) {
        if (Math.abs(dy) > 9 && Math.abs(dy) > Math.abs(dx)) {
          gesture.current = null;
          return;
        }
        if (Math.abs(dx) < 7 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
        const to = dx < 0 ? next : previous;
        if (!to) return;
        g.sheet = { from: current, to, forward: dx < 0, progress: 0 };
      }
      const signed = g.sheet.forward ? -dx : dx;
      g.sheet = {
        ...g.sheet,
        progress: Math.max(
          0,
          Math.min(1, signed / Math.max(1, g.width * 0.72)),
        ),
      };
      setSheet(g.sheet);
    },
    onPointerUp(e: PointerEvent<HTMLDivElement>) {
      const g = gesture.current;
      if (g?.id === e.pointerId) release(!!g.sheet && g.sheet.progress >= 0.3);
    },
    onPointerCancel(e: PointerEvent<HTMLDivElement>) {
      if (gesture.current?.id === e.pointerId) release(false);
    },
    onLostPointerCapture(e: PointerEvent<HTMLDivElement>) {
      if (gesture.current?.id === e.pointerId) release(false);
    },
  };
  const rotation = visible
    ? visible.forward
      ? visible.progress
      : 1 - visible.progress
    : 0;
  const style = {
    "--sheet-angle": -180 * rotation + "deg",
    "--mobile-angle": -96 * rotation + "deg",
  } as CSSProperties;
  return { handlers, sheet: visible, style };
}
