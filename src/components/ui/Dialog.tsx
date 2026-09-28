import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type ReactNode,
  type MouseEventHandler,
} from "react";
import { createPortal } from "react-dom";

const dialogStack: HTMLElement[] = [];
let originalOverflow = "";

/** Keeps focus in the topmost dialog, restores its trigger, and supports Escape. */
export default function Dialog({
  children,
  onClose,
  label,
  className = "",
  closeOnEscape = true,
  onClick,
  style,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  className?: string;
  closeOnEscape?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  useEffect(() => {
    const element = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialogStack.length) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    dialogStack.push(element);
    const focusable = () =>
      Array.from(
        element.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
        ),
      ).filter(
        (node) => node.getClientRects().length > 0 && !node.closest("[inert]"),
      );
    (focusable()[0] ?? element).focus();
    const onKey = (event: KeyboardEvent) => {
      if (dialogStack.at(-1) !== element) return;
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          element.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === element)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    const onFocus = (event: FocusEvent) => {
      if (
        dialogStack.at(-1) === element &&
        !element.contains(event.target as Node)
      )
        (focusable()[0] ?? element).focus();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      dialogStack.splice(dialogStack.indexOf(element), 1);
      if (!dialogStack.length) document.body.style.overflow = originalOverflow;
      if (previous?.isConnected) previous.focus();
    };
  }, [closeOnEscape]);
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      id={id}
      tabIndex={-1}
      onClick={onClick}
      style={style}
      className={`promise-dialog ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
