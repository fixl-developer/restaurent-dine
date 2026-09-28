import { useGuestQuote } from "@/hooks/useGuestQuote";
import type { GuestCartLine } from "@/lib/dto/guest";

export default function GuestQuote({ cart }: { cart: GuestCartLine[] }) {
  const quote = useGuestQuote(cart);
  if (!cart.length) return null;
  if (quote.isError)
    return (
      <div role="alert" className="text-sm text-red-700">
        <p>We couldn't calculate the current total.</p>
        <button className="underline" onClick={() => quote.refetch()}>
          Refresh total
        </button>
      </div>
    );
  if (!quote.data)
    return (
      <p role="status" className="text-sm text-gray-500">
        Calculating your total…
      </p>
    );
  const { totals, currency } = quote.data;
  const fmt = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      amount,
    );
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      <div className="flex justify-between">
        <span>Items & options</span>
        <span>{fmt(totals.subtotal + totals.modifierTotal)}</span>
      </div>
      {totals.serviceCharge > 0 && (
        <div className="flex justify-between">
          <span>Service charge</span>
          <span>{fmt(totals.serviceCharge)}</span>
        </div>
      )}
      <div className="flex justify-between">
        <span>{quote.data.taxInclusive ? "Tax included" : "Tax"}</span>
        <span>{fmt(totals.tax)}</span>
      </div>
      <div className="flex justify-between font-bold border-t pt-2">
        <span>Total before offers</span>
        <span>{fmt(totals.grand)}</span>
      </div>
      <p className="text-xs text-gray-500">
        Any eligible offers may lower your final total.
      </p>
    </div>
  );
}
