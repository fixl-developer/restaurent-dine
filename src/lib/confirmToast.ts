import { createElement } from "react";
import { createRoot } from "react-dom/client";
import Dialog from "@/components/ui/Dialog";

interface ConfirmOpts {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

/** Kept under its existing name for callers; confirmation is now a focused dialog. */
export function confirmToast(opts: ConfirmOpts | string): Promise<boolean> {
  const config = typeof opts === "string" ? { title: opts } : opts;
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const settle = (value: boolean) => {
      if (settled) return;
      settled = true;
      queueMicrotask(() => {
        root.unmount();
        host.remove();
        resolve(value);
      });
    };
    root.render(
      createElement(Dialog, {
        label: config.title,
        onClose: () => settle(false),
        className:
          "fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-5",
        children: createElement(
          "section",
          { className: "bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full" },
          createElement(
            "h2",
            { className: "text-xl font-bold text-[#302a30]" },
            config.title,
          ),
          createElement(
            "p",
            { className: "text-sm text-gray-600 mt-3 leading-6" },
            config.description ??
              (config.destructive
                ? "Please review this action before continuing."
                : "Confirm that you want to continue."),
          ),
          createElement(
            "div",
            { className: "flex justify-end flex-wrap gap-3 mt-6" },
            createElement(
              "button",
              { className: "ui-button", onClick: () => settle(false) },
              config.cancelLabel ?? "Cancel",
            ),
            createElement(
              "button",
              {
                className: config.destructive
                  ? "ui-button ui-button-danger"
                  : "ui-button ui-button-primary",
                onClick: () => settle(true),
              },
              config.confirmLabel ??
                (config.destructive ? "Delete" : "Confirm"),
            ),
          ),
        ),
      }),
    );
  });
}
