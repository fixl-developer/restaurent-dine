import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drag-to-resize width for right-anchored slide-over drawers.
 * Width is clamped to [min, viewport*0.95] and persisted to localStorage so
 * the chosen size is remembered across drawers and reloads.
 */
export function useResizableWidth(opts: {
  storageKey?: string;
  defaultWidth: number;
  min?: number;
  max?: number;
}) {
  const { storageKey = "pinky.adminDrawerWidth", defaultWidth, min = 360, max = 1200 } = opts;

  const viewportMax = useCallback(
    () => (typeof window === "undefined" ? max : Math.min(max, Math.round(window.innerWidth * 0.95))),
    [max],
  );
  const clamp = useCallback(
    (w: number) => Math.min(viewportMax(), Math.max(min, w)),
    [min, viewportMax],
  );

  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    const saved = Number(window.localStorage.getItem(storageKey));
    return saved && !Number.isNaN(saved) ? saved : defaultWidth;
  });
  const dragging = useRef(false);

  // persist whenever the width settles
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, String(Math.round(width)));
  }, [width, storageKey]);

  // keep within bounds if the window is resized
  useEffect(() => {
    const onResize = () => setWidth((w) => clamp(w));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      // right-anchored: width grows as the pointer moves toward the left edge
      setWidth(clamp(window.innerWidth - e.clientX));
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, [clamp]);

  const reset = useCallback(() => setWidth(clamp(defaultWidth)), [clamp, defaultWidth]);

  // keyboard nudge for accessibility
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowLeft") setWidth((w) => clamp(w + 24));
      else if (e.key === "ArrowRight") setWidth((w) => clamp(w - 24));
    },
    [clamp],
  );

  return { width, onPointerDown, onKeyDown, reset };
}
