import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
import { submitCheckout } from "@/lib/checkoutDraft";
import { useAuthStore } from "@/stores/auth.store";
import CheckoutRecovery from "@/components/CheckoutRecovery";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Minus, Search, UtensilsCrossed, Send } from "lucide-react";
import { toast } from "sonner";
import Dialog from "@/components/ui/Dialog";
import PageState from "@/components/ui/PageState";
import GuestQuote from "@/components/GuestQuote";
import { CustomizeModal } from "@/pages/guest/GuestOrderPage";
import { usePublicMenu } from "@/hooks/useGuest";
import { useGuestQuote, cartItems } from "@/hooks/useGuestQuote";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { api } from "@/lib/api";
import type { GuestCartLine, PublicMenuItem } from "@/lib/dto/guest";
import type { OrderDto } from "@/lib/dto/orders";

export default function AssistedOrderDialog({
  table,
  onClose,
  onCreated,
}: {
  table?: { id: string; number: string };
  onClose: () => void;
  onCreated?: (order: OrderDto) => void;
}) {
  const menu = usePublicMenu({ channel: "dine_in" });
  const [search, setSearch] = useState("");
  const userId = useAuthStore((s) => s.user?.id);
  const draftScope = `staff:${userId}:${table?.id ?? "counter"}`;
  const { draft, field } = useCheckoutDraft(draftScope);
  const { cart, guestName: name, guestNotes: notes } = draft;
  const setCart = field("cart"),
    setName = field("guestName"),
    setNotes = field("guestNotes");
  const [customizing, setCustomizing] = useState<PublicMenuItem | null>(null);
  const quote = useGuestQuote(cart);
  const fmt = useCurrencyFormatter();
  const qc = useQueryClient();
  const items = useMemo(
    () =>
      menu.data?.categories
        .flatMap((c) => c.items)
        .filter((i) => i.name.toLowerCase().includes(search.toLowerCase())) ??
      [],
    [menu.data, search],
  );
  const place = useMutation({
    networkMode: "always",
    mutationFn: () =>
      submitCheckout<OrderDto>(draftScope, draft.key, {
        path: "/orders",
        principal: `staff:${userId}`,
        body: {
          tableId: table?.id,
          items: cartItems(cart),
          guestName: name.trim() || undefined,
          guestNotes: notes.trim() || undefined,
          maxTotal: quote.data?.totals.grand,
        },
      }),
    onSuccess: (order) => {
      ["orders", "tables", "table-sessions", "kds"].forEach((key) =>
        qc.invalidateQueries({ queryKey: [key] }),
      );
      toast.success(`Order ${order.orderNumber} sent`);
      onCreated?.(order);
      onClose();
    },
  });
  const close = () => {
    if (!place.isPending) onClose();
  };
  function add(item: PublicMenuItem) {
    if (item.variants.length || item.modifierGroups.length) {
      setCustomizing(item);
      return;
    }
    setCart((old) => [
      ...old,
      {
        key: crypto.randomUUID(),
        itemId: item.id,
        name: item.name,
        qty: 1,
        basePrice: item.basePrice,
        lineTotal: item.basePrice,
        modifiers: [],
      },
    ]);
  }
  function quantity(key: string, amount: number) {
    setCart((old) =>
      old
        .map((l) =>
          l.key === key
            ? {
                ...l,
                qty: l.qty + amount,
                lineTotal: (l.lineTotal / l.qty) * (l.qty + amount),
              }
            : l,
        )
        .filter((l) => l.qty > 0),
    );
  }
  if (draft.pending)
    return (
      <Dialog
        label="Recover assisted order"
        onClose={close}
        closeOnEscape={!place.isPending}
        className="fixed inset-0 z-50 bg-black/35 overflow-auto p-4"
      >
        <CheckoutRecovery
          busy={place.isPending}
          error={place.error}
          onRetry={() => place.mutate()}
        />
        {!place.isPending && (
          <button className="ui-button block mx-auto" onClick={close}>
            Close · attempt stays saved
          </button>
        )}
      </Dialog>
    );
  return (
    <Dialog
      label={
        table ? `Take order · Table ${table.number}` : "New assisted order"
      }
      onClose={close}
      closeOnEscape={!place.isPending}
      className="fixed inset-0 z-50 bg-black/35 flex items-center justify-center p-3 sm:p-6"
    >
      <div className="staff-surface assisted-order-panel">
        <header className="flex items-center justify-between gap-4 p-5 border-b bg-white">
          <div>
            <p className="ui-eyebrow">PERSONAL SERVICE</p>
            <h2 className="text-xl font-bold mt-1">
              {table
                ? `Table ${table.number} · Take order`
                : "New assisted order"}
            </h2>
          </div>
          <button
            className="ui-icon-button"
            aria-label="Close order builder"
            onClick={close}
            disabled={place.isPending}
          >
            <X size={18} />
          </button>
        </header>
        <div className="assisted-order-body">
          <section className="assisted-order-menu">
            <label className="relative block mb-4">
              <span className="sr-only">Search items</span>
              <Search className="absolute left-3 top-3" size={17} />
              <input
                placeholder="Search items"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border rounded-xl pl-10 pr-3 py-3 text-sm"
              />
            </label>
            {menu.isLoading ? (
              <PageState kind="loading" title="Loading menu…" />
            ) : menu.isError ? (
              <PageState
                kind="error"
                title="Menu unavailable"
                action={
                  <button className="ui-button" onClick={() => menu.refetch()}>
                    Try again
                  </button>
                }
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => add(item)}
                    className="text-left border rounded-xl p-4 bg-white hover:border-[var(--promise-berry)]"
                  >
                    <UtensilsCrossed
                      size={18}
                      className="text-[#086874] mb-3"
                    />
                    <strong className="block text-sm">{item.name}</strong>
                    <span className="flex justify-between text-sm mt-3">
                      {item.variants.length
                        ? "Choose options"
                        : fmt(item.basePrice)}
                      <Plus size={18} />
                    </span>
                  </button>
                ))}
              </div>
            )}
            {!menu.isLoading && !menu.isError && !items.length && (
              <PageState
                title="No items found"
                description="Try another search or check menu availability."
              />
            )}
          </section>
          <section className="assisted-order-check">
            <h3 className="font-bold mb-4">
              The order{" "}
              <span className="text-gray-500 font-normal">
                · {cart.reduce((n, l) => n + l.qty, 0)} items
              </span>
            </h3>
            {!cart.length && (
              <p className="text-sm text-gray-500 py-6">
                Choose items from the menu to start this order.
              </p>
            )}
            <div className="space-y-3">
              {cart.map((l) => (
                <article className="border rounded-xl p-3" key={l.key}>
                  <p className="font-semibold text-sm">{l.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {[l.variantName, ...l.modifiers.map((m) => m.name)]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm font-bold">
                      {fmt(l.lineTotal)}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label={`Remove one ${l.name}`}
                        className="ui-icon-button"
                        onClick={() => quantity(l.key, -1)}
                      >
                        <Minus size={15} />
                      </button>
                      <span>{l.qty}</span>
                      <button
                        aria-label={`Add one ${l.name}`}
                        className="ui-icon-button"
                        onClick={() => quantity(l.key, 1)}
                        disabled={l.qty >= 50}
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <label className="block text-xs font-semibold mt-5">
              Guest name (optional)
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="block w-full border rounded-xl p-3 mt-2 bg-white"
              />
            </label>
            <label className="block text-xs font-semibold mt-4">
              Order notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                rows={2}
                className="block w-full border rounded-xl p-3 mt-2 bg-white"
              />
            </label>
            <div className="my-5">
              <GuestQuote cart={cart} />
            </div>
            {place.error && (
              <p role="alert" className="text-red-700 text-sm mb-3">
                {place.error.message} Check the order list before retrying if
                the connection was interrupted.
              </p>
            )}
            <button
              className="ui-button ui-button-primary w-full"
              disabled={
                !cart.length ||
                !quote.data ||
                quote.isFetching ||
                quote.isError ||
                place.isPending
              }
              onClick={() => place.mutate()}
            >
              <Send size={16} />
              {place.isPending ? "Sending…" : "Send order"}
            </button>
            <p className="text-xs text-gray-500 mt-3 leading-5">
              Review choices with the guest before sending. Payment is collected
              separately.
            </p>
          </section>
        </div>
      </div>
      {customizing && (
        <CustomizeModal
          fmt={fmt}
          item={customizing}
          onClose={() => setCustomizing(null)}
          onAdd={(line) => {
            setCart((old) => [...old, line]);
            setCustomizing(null);
          }}
        />
      )}
    </Dialog>
  );
}
