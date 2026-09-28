import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSplitInvoice } from "@/hooks/useBilling";
import { useAuthStore } from "@/stores/auth.store";
import type { InvoiceDto } from "@/lib/dto/billing";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
export default function InvoiceControls({ invoice }: { invoice: InvoiceDto }) {
  const allowed = useAuthStore((s) => s.hasPermission("billing:create"));
  const fmt = useCurrencyFormatter(invoice.currency ?? "INR");
  const qc = useQueryClient();
  const split = useSplitInvoice();
  const [tip, setTip] = useState(String(invoice.tip ?? 0));
  const [mode, setMode] = useState<"equal" | "custom" | "item">("equal");
  const [count, setCount] = useState(2);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [assignment, setAssignment] = useState<Record<string, number>>({});
  const tipMutation = useMutation({
    mutationFn: () =>
      api.patch(`/invoices/${invoice._id}/tip`, { amount: Number(tip) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["invoices"] }),
  });
  const groups = Array.from(
    { length: Math.min(20, Math.max(2, count || 2)) },
    (_, i) => i,
  );
  function applySplit() {
    split.mutate({
      id: invoice._id,
      mode,
      ...(mode === "equal"
        ? { equalCount: count }
        : {
            splits: groups.map((i) => ({
              label: `Guest ${i + 1}`,
              ...(mode === "custom"
                ? { amount: Number(amounts[i] ?? "0") }
                : {
                    orderItemIds: invoice.lineItems
                      .filter((l) => assignment[l.orderItemId ?? ""] === i)
                      .map((l) => l.orderItemId!),
                  }),
            })),
          }),
    });
  }
  if (
    !allowed ||
    invoice.status !== "final" ||
    invoice.paymentStatus !== "unpaid" ||
    invoice.amountPaid > 0 ||
    invoice.amountRefunded
  )
    return null;
  return (
    <section className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <h3 className="font-semibold text-sm">Tip & split bill</h3>
      {!invoice.splits.length && (
        <div>
          <label className="text-xs block">
            Guest-approved tip
            <input
              type="number"
              min={0}
              step="0.01"
              className="border rounded-lg p-2 w-full mt-1"
              value={tip}
              onChange={(e) => setTip(e.target.value)}
            />
          </label>
          <button
            className="border rounded-lg px-3 py-2 mt-2 text-xs"
            disabled={tipMutation.isPending}
            onClick={() => tipMutation.mutate()}
          >
            Save tip
          </button>
          {tipMutation.error && (
            <p role="alert" className="text-red-700 text-xs mt-2">
              {tipMutation.error.message}
            </p>
          )}
        </div>
      )}
      <div className="flex gap-3">
        <label className="text-xs flex-1">
          Split method
          <select
            className="block w-full border rounded-lg p-2 mt-1"
            value={mode}
            onChange={(e) => setMode(e.target.value as typeof mode)}
          >
            <option value="equal">Equal</option>
            <option value="custom">Custom amounts</option>
            <option value="item">By item</option>
          </select>
        </label>
        <label className="text-xs">
          Guests
          <input
            className="block border rounded-lg p-2 mt-1 w-20"
            type="number"
            min={2}
            max={20}
            value={count}
            onChange={(e) => {
              setCount(Number(e.target.value));
              setAssignment({});
            }}
          />
        </label>
      </div>
      {mode === "custom" &&
        groups.map((i) => (
          <label key={i} className="block text-xs">
            Guest {i + 1}
            <input
              className="block w-full border rounded-lg p-2 mt-1"
              type="number"
              min="0.01"
              step="0.01"
              value={amounts[i] ?? ""}
              onChange={(e) => setAmounts({ ...amounts, [i]: e.target.value })}
            />
          </label>
        ))}
      {mode === "item" &&
        invoice.lineItems.map((l) => (
          <label key={l.orderItemId} className="block text-xs">
            {l.qty} × {l.name}
            <select
              className="block w-full border rounded-lg p-2 mt-1"
              value={assignment[l.orderItemId ?? ""] ?? ""}
              onChange={(e) =>
                setAssignment({
                  ...assignment,
                  [l.orderItemId ?? ""]: Number(e.target.value),
                })
              }
            >
              <option value="" disabled>
                Assign guest
              </option>
              {groups.map((i) => (
                <option key={i} value={i}>
                  Guest {i + 1}
                </option>
              ))}
            </select>
          </label>
        ))}
      <p className="text-xs text-gray-500">
        Splits include tax, service charge and tip. Total:{" "}
        {fmt(invoice.grand + (invoice.tip ?? 0))}.
      </p>
      <button
        disabled={
          split.isPending ||
          tipMutation.isPending ||
          !Number.isInteger(count) ||
          count < 2 ||
          count > 20
        }
        className="bg-[#086874] text-white rounded-lg p-2 w-full text-sm disabled:opacity-40"
        onClick={applySplit}
      >
        {split.isPending
          ? "Saving split…"
          : invoice.splits.length
            ? "Replace unpaid split"
            : "Split bill"}
      </button>
      {split.error && (
        <p role="alert" className="text-red-700 text-xs">
          {split.error.message}
        </p>
      )}
    </section>
  );
}
