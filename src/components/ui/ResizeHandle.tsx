/**
 * Left-edge drag handle for right-anchored slide-over drawers.
 * Place as the first child of a `relative` panel. Drag to resize,
 * double-click to reset, arrow keys to nudge.
 */
export default function ResizeHandle({
  onPointerDown,
  onDoubleClick,
  onKeyDown,
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel (drag, double-click to reset)"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
      title="Drag to resize · double-click to reset"
      className="group absolute left-0 top-0 z-30 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none select-none focus:outline-none"
    >
      <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-gray-200 transition-colors group-hover:bg-[var(--promise-berry)] group-focus:bg-[var(--promise-berry)]" />
      <div className="absolute top-1/2 left-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gray-300 transition-colors group-hover:bg-[var(--promise-berry)]" />
    </div>
  );
}
