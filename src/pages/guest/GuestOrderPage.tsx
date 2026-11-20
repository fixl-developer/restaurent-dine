import GuestVisit, { type VisitAccess } from "@/components/tableService/GuestVisit";
import { useMutation } from "@tanstack/react-query";
import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
import { submitCheckout } from "@/lib/checkoutDraft";
import CheckoutRecovery from "@/components/CheckoutRecovery";
import type { GuestOrderDto } from "@/lib/dto/guest";
import GuestHeader from "@/components/ui/GuestHeader";
import Dialog from "@/components/ui/Dialog";
import ResizeHandle from "@/components/ui/ResizeHandle";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import GuestQuote from "@/components/GuestQuote";
import { useGuestQuote } from "@/hooks/useGuestQuote";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Leaf,
  Flame,
  X,
  Check,
  Store,
  Loader2,
  AlertCircle,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { usePublicMenu, useGuestOrder } from "@/hooks/useGuest";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import type {
  GuestCartLine,
  PublicMenuItem,
  PublicModifierGroup,
} from "@/lib/dto/guest";

// A guest has no auth token, so "is there already an open order on this
// table" can't be answered by the staff-only order-list endpoint — instead
// we remember the guest's own last order id for this table/QR in
// localStorage and poll its live status via the public guest endpoint.
function lastOrderStorageKey(tableId?: string, qrSlug?: string) {
  return `smartdine:lastOrder:${tableId ?? qrSlug ?? "unknown"}`;
}
function getLastOrderId(tableId?: string, qrSlug?: string): string | null {
  try {
    return localStorage.getItem(lastOrderStorageKey(tableId, qrSlug));
  } catch {
    return null;
  }
}
function setLastOrderId(
  tableId: string | undefined,
  qrSlug: string | undefined,
  orderId: string,
) {
  try {
    localStorage.setItem(lastOrderStorageKey(tableId, qrSlug), orderId);
  } catch {
    /* localStorage unavailable — non-fatal, just skip "existing order" detection */
  }
}

const FOOD_TYPE_BADGE: Record<string, { color: string; label: string }> = {
  veg: { color: "bg-emerald-100 text-emerald-700", label: "● Veg" },
  vegan: { color: "bg-emerald-100 text-emerald-700", label: "● Vegan" },
  non_veg: { color: "bg-red-100 text-red-700", label: "● Non-Veg" },
  egg: { color: "bg-amber-100 text-amber-700", label: "● Egg" },
};

export default function GuestOrderPage() {
  const [params] = useSearchParams();
  const qr = params.get("qr");
  if (!qr) return <GuestMenu access={{allowed:false}} />;
  return <GuestVisit key={qr} qr={qr}>{access =>
    <GuestMenu key={access.scope ?? qr} access={access} />
  }</GuestVisit>;
}

function GuestMenu({access}:{access:VisitAccess}) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qrSlug = params.get("qr") ?? undefined;
  const tableId = params.get("table") ?? undefined;
  const fmt = useCurrencyFormatter();

  const menuQuery = usePublicMenu({ channel: "dine_in" });
  const [lastOrderId, setLastOrderIdState] = useState<string | null>(() =>
    access.allowed ? getLastOrderId(access.scope ?? tableId, qrSlug) : null,
  );
  const lastOrderQuery = useGuestOrder(lastOrderId);
  const lastOrder =
    lastOrderQuery.data &&
    ["placed", "accepted", "preparing"].includes(lastOrderQuery.data.status)
      ? lastOrderQuery.data
      : null;

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const draftScope = access.scope ?? `table:${qrSlug ?? "unknown"}`;
  const { draft, field } = useCheckoutDraft(draftScope);
  const { cart, guestName, guestPhone, guestNotes } = draft;
  const setCart = field("cart"),
    setGuestName = field("guestName"),
    setGuestPhone = field("guestPhone"),
    setGuestNotes = field("guestNotes");
  const [cartOpen, setCartOpen] = useState(false);
  const [customizingItem, setCustomizingItem] = useState<PublicMenuItem | null>(
    null,
  );
  const [addToExistingMode, setAddToExistingMode] = useState(false);

  const menu = menuQuery.data;

  useEffect(() => {
    if (menu && !activeCategory && menu.categories.length > 0) {
      setActiveCategory(menu.categories[0].id);
    }
  }, [menu, activeCategory]);

  const filteredItems = useMemo(() => {
    if (!menu) return [];
    const all = menu.categories.flatMap((c) => c.items);
    const q = search.toLowerCase().trim();
    if (q) {
      return all.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          (i.description ?? "").toLowerCase().includes(q),
      );
    }
    return all.filter((i) => i.categoryId === activeCategory);
  }, [menu, search, activeCategory]);

  function addSimpleItem(item: PublicMenuItem) {
    if (!access.allowed) {
      toast.info("Join your table before adding dishes");
      document.querySelector<HTMLElement>('[aria-label="Table service"]')?.scrollIntoView({block:"center"});
      return;
    }
    if (item.modifierGroups.length > 0 || item.variants.length > 0) {
      setCustomizingItem(item);
      return;
    }
    setCart((prev) => {
      const existing = prev.find(
        (l) => l.itemId === item.id && !l.variantId && l.modifiers.length === 0,
      );
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key
            ? { ...l, qty: l.qty + 1, lineTotal: l.basePrice * (l.qty + 1) }
            : l,
        );
      }
      return [
        ...prev,
        {
          key: `${item.id}-${Date.now()}`,
          itemId: item.id,
          name: item.name,
          imageUrl: item.imageUrl,
          qty: 1,
          basePrice: item.basePrice,
          modifiers: [],
          lineTotal: item.basePrice,
        },
      ];
    });
  }

  function adjustQty(key: string, delta: number) {
    setCart(
      (prev) =>
        prev
          .map((l) => {
            if (l.key !== key) return l;
            const newQty = l.qty + delta;
            if (newQty <= 0) return null;
            const unitPrice = l.lineTotal / l.qty;
            return { ...l, qty: newQty, lineTotal: unitPrice * newQty };
          })
          .filter(Boolean) as GuestCartLine[],
    );
  }

  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.lineTotal, 0);
  const quote = useGuestQuote(cart);

  const placeOrder = useMutation({
    networkMode: "always",
    mutationFn: () => {
      const adding = addToExistingMode && lastOrder;
      return submitCheckout<GuestOrderDto>(draftScope, draft.key, {
        path: adding
          ? `/guest/orders/${lastOrder.id}/items`
          : "/guest/orders/dine-in",
        principal: access.scope ?? `table:${qrSlug}`,
        visitToken: access.token,
        noAuth: true,
        body: {
          ...(adding
            ? {}
            : {
                qrSlug,
                guestPhone: guestPhone || undefined,
                guestName: guestName || undefined,
                guestNotes: guestNotes || undefined,
              }),
          maxTotal: quote.data?.totals.grand,
          items: cart.map((l) => ({
            itemId: l.itemId || undefined,
            comboId: l.comboId,
            variantId: l.variantId,
            qty: l.qty,
            notes: l.notes,
            modifiers: l.modifiers.map((m) => ({
              groupId: m.groupId,
              modifierId: m.modifierId,
            })),
          })),
        },
      });
    },
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} confirmed!`);
      setLastOrderId(access.scope ?? tableId, qrSlug, order.id);
      setLastOrderIdState(order.id);
      navigate(`/track/${order.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });
  function handlePlaceOrder() {
    if (!access.allowed) {toast.error("Join your table before ordering");return;}
    if (placeOrder.isPending) return;
    if (
      !draft.pending &&
      (!quote.data || quote.isError || quote.isFetching || !cart.length)
    ) {
      toast.error("Review the current cart total before placing your order");
      return;
    }
    placeOrder.mutate();
  }
  if (draft.pending)
    return (
      <div className="min-h-screen bg-[#fff8ef] px-4">
        <GuestHeader />
        <CheckoutRecovery
          busy={placeOrder.isPending}
          error={placeOrder.error}
          onRetry={handlePlaceOrder}
        />
      </div>
    );

  if (!qrSlug)
    return (
      <div className="min-h-screen bg-[#fff8ef] grid place-content-center text-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Order from your table</h1>
        <p>Scan the QR code on your table, or ask our team for help.</p>
        <a href="/menu" className="text-[var(--promise-berry)] underline">
          Browse the pickup menu
        </a>
      </div>
    );

  if (menuQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-[var(--promise-berry)] animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (menuQuery.isError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50 p-6">
        <div className="text-center max-w-sm">
          <p className="text-base font-semibold text-gray-800 mb-1">
            Menu unavailable
          </p>
          <p className="text-sm text-gray-500 mb-4">
            We can't load the menu right now. Please ask staff for help.
          </p>
          <button
            onClick={() => menuQuery.refetch()}
            className="px-4 py-2 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fff8ef] pb-24">
      <GuestHeader />
      {access.panel}
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center">
            <Store className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900">
              {tableId ? "Your table’s menu" : "Order from your table"}
            </h1>
            <p className="text-[11px] text-gray-500">
              We’ll bring your order to your table.
            </p>
          </div>
          <div className="text-right text-[11px]">
            <p className="font-semibold text-gray-900">
              {guestName || "Guest"}
            </p>
            <p className="text-gray-500">{guestPhone || "No phone"}</p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              aria-label="Search dishes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 bg-gray-50"
            />
          </div>
        </div>

        {!search && (
          <div className="max-w-3xl mx-auto px-4 pb-3 overflow-x-auto">
            <div className="flex gap-1.5">
              {menu?.categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(c.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeCategory === c.id
                      ? "bg-[var(--promise-berry)] text-white"
                      : "bg-white text-gray-600 border border-gray-200"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Existing Order Alert */}
      {lastOrder && (
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div
            className={`rounded-2xl p-4 border ${addToExistingMode ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`}
          >
            <div className="flex items-start gap-3">
              <AlertCircle
                className={`w-5 h-5 flex-shrink-0 mt-0.5 ${addToExistingMode ? "text-green-600" : "text-amber-600"}`}
              />
              <div className="flex-1">
                <h3
                  className={`text-sm font-semibold ${addToExistingMode ? "text-green-900" : "text-amber-900"}`}
                >
                  {addToExistingMode
                    ? "✓ Adding to existing order"
                    : "Existing order detected"}
                </h3>
                <p
                  className={`text-xs mt-1 ${addToExistingMode ? "text-green-700" : "text-amber-700"}`}
                >
                  {addToExistingMode
                    ? "Select items below to add to this order"
                    : "There's already an active order on this table. You can:"}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => navigate(`/track/${lastOrder.id}`)}
                    className={`text-xs font-semibold px-3 py-2 rounded-lg hover:transition-colors ${
                      addToExistingMode
                        ? "bg-green-100 text-green-800 hover:bg-green-200"
                        : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                    }`}
                  >
                    View Order
                  </button>
                  <button
                    onClick={() => {
                      setAddToExistingMode(!addToExistingMode);
                      setCart([]);
                    }}
                    className={`text-xs font-semibold px-3 py-2 border rounded-lg hover:transition-colors ${
                      addToExistingMode
                        ? "bg-green-100 border-green-300 text-green-800 hover:bg-green-200"
                        : "bg-white border-amber-200 text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    {addToExistingMode ? "✓ Adding Items" : "Add More Items"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Items */}
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-2">
        {filteredItems.length === 0 && (
          <div className="text-center py-16 text-sm text-gray-500">
            No items match your search.
          </div>
        )}
        {filteredItems.map((item) => (
          <MenuItemCard
            key={item.id}
            fmt={fmt}
            item={item}
            cartQty={cart
              .filter((l) => l.itemId === item.id)
              .reduce((s, l) => s + l.qty, 0)}
            onAdd={() => addSimpleItem(item)}
          />
        ))}
      </main>

      {/* Floating cart bar */}
      {menu?.combos?.length ? (
        <section className="max-w-3xl mx-auto px-4 py-6">
          <h2 className="text-xl font-bold text-[#302a30] mb-4">
            Better together · Combos
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {menu.combos.map((combo) => (
              <article
                key={combo.id}
                className="rounded-2xl border border-brand-100 bg-white p-4"
              >
                {combo.imageUrl && (
                  <img
                    src={combo.imageUrl}
                    alt={combo.name}
                    loading="lazy"
                    className="w-full h-36 object-cover rounded-xl mb-3"
                  />
                )}
                <h3 className="font-bold">{combo.name}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {combo.description}
                </p>
                <div className="flex justify-between items-center mt-4">
                  <span className="font-bold">{fmt(combo.price)}</span>
                  <button
                    className="rounded-lg px-4 py-2 bg-[var(--promise-berry)] text-white text-sm"
                    onClick={() =>
                      setCart((previous) => [
                        ...previous,
                        {
                          key: `combo-${combo.id}-${Date.now()}`,
                          itemId: "",
                          comboId: combo.id,
                          name: combo.name,
                          imageUrl: combo.imageUrl,
                          qty: 1,
                          basePrice: combo.price,
                          modifiers: [],
                          lineTotal: combo.price,
                        },
                      ])
                    }
                  >
                    Add combo
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[var(--promise-berry)] text-white rounded-full pl-4 pr-5 py-3 shadow-2xl shadow-brand-500/40 flex items-center gap-3 hover:bg-[var(--promise-berry-dark)] transition-colors"
        >
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
            {cartCount}
          </div>
          <span className="text-sm font-bold">
            View cart · {fmt(cartTotal)}
          </span>
          <ShoppingBag className="w-4 h-4" />
        </button>
      )}

      {/* Item customization modal */}
      {customizingItem && (
        <CustomizeModal
          fmt={fmt}
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAdd={(line) => {
            setCart((prev) => [...prev, line]);
            setCustomizingItem(null);
          }}
        />
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <CartDrawer
          fmt={fmt}
          cart={cart}
          guestName={guestName}
          guestPhone={guestPhone}
          guestNotes={guestNotes}
          onUpdateName={setGuestName}
          onUpdatePhone={setGuestPhone}
          onUpdateNotes={setGuestNotes}
          onClose={() => setCartOpen(false)}
          onAdjustQty={adjustQty}
          onRemove={removeLine}
          onPlace={handlePlaceOrder}
          placing={
            placeOrder.isPending ||
            !quote.data ||
            quote.isError ||
            quote.isFetching
          }
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function MenuItemCard({
  fmt,
  item,
  cartQty,
  onAdd,
}: {
  fmt: (amount: number) => string;
  item: PublicMenuItem;
  cartQty: number;
  onAdd: () => void;
}) {
  const badge = FOOD_TYPE_BADGE[item.foodType];
  const hasOptions = item.modifierGroups.length > 0 || item.variants.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-3.5 flex items-start gap-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {badge && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${badge.color}`}
            >
              {badge.label}
            </span>
          )}
          {item.spiceLevel > 0 && (
            <span className="text-[10px] text-red-500 font-semibold flex items-center gap-0.5">
              {Array(item.spiceLevel)
                .fill(0)
                .map((_, i) => (
                  <Flame key={i} className="w-2.5 h-2.5 fill-current" />
                ))}
            </span>
          )}
          {item.tags.includes("vegan") && (
            <Leaf className="w-3 h-3 text-emerald-600" />
          )}
        </div>
        <h3 className="text-sm font-semibold text-gray-900">{item.name}</h3>
        {item.description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm font-bold text-gray-900">
            {fmt(item.basePrice)}
          </span>
          {item.prepTimeMinutes > 0 && (
            <span className="text-[10px] text-gray-500">
              · {item.prepTimeMinutes} min
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-20 h-20 rounded-xl object-cover mb-2"
          />
        ) : (
          <div className="w-20 h-20 bg-brand-50 rounded-xl flex items-center justify-center mb-2">
            <Store className="w-6 h-6 text-brand-300" />
          </div>
        )}
        {cartQty > 0 ? (
          <button
            onClick={onAdd}
            className="w-20 py-1.5 bg-[var(--promise-berry)] text-white rounded-lg text-xs font-bold"
          >
            {cartQty} ADDED
          </button>
        ) : (
          <button
            onClick={onAdd}
            className="w-20 py-1.5 border border-brand-500 text-brand-600 rounded-lg text-xs font-bold hover:bg-brand-50 transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3 h-3" /> ADD
            {hasOptions && <span className="text-[8px] ml-0.5">+</span>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function CustomizeModal({
  fmt,
  item,
  onClose,
  onAdd,
}: {
  fmt: (amount: number) => string;
  item: PublicMenuItem;
  onClose: () => void;
  onAdd: (line: GuestCartLine) => void;
}) {
  const [variantId, setVariantId] = useState(item.variants[0]?.id);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>(
    {},
  );
  const [notes, setNotes] = useState("");

  function toggleMod(group: PublicModifierGroup, modifierId: string) {
    setSelectedMods((prev) => {
      const cur = prev[group.id] ?? [];
      const isOn = cur.includes(modifierId);
      let next: string[];
      if (isOn) {
        next = cur.filter((m) => m !== modifierId);
      } else if (group.maxSelections === 1) {
        next = [modifierId];
      } else if (group.maxSelections > 0 && cur.length >= group.maxSelections) {
        toast.error(`Max ${group.maxSelections} selections for ${group.name}`);
        return prev;
      } else {
        next = [...cur, modifierId];
      }
      return { ...prev, [group.id]: next };
    });
  }

  const variant = item.variants.find((v) => v.id === variantId);
  const variantPrice = variant
    ? (variant.absolutePrice ?? item.basePrice + variant.priceDelta)
    : item.basePrice;

  const modifierTotal = item.modifierGroups.reduce((sum, group) => {
    const ids = selectedMods[group.id] ?? [];
    return (
      sum +
      group.modifiers
        .filter((m) => ids.includes(m.id))
        .reduce((s, m) => s + m.priceDelta, 0)
    );
  }, 0);

  const lineTotal = variantPrice + modifierTotal;

  const missingRequired = item.modifierGroups
    .filter((g) => g.isRequired)
    .find(
      (g) => (selectedMods[g.id]?.length ?? 0) < Math.max(1, g.minSelections),
    );

  function submit() {
    if (missingRequired) {
      toast.error(`Please choose ${missingRequired.name}`);
      return;
    }
    const modifiers = item.modifierGroups.flatMap((g) =>
      (selectedMods[g.id] ?? []).map((modId) => {
        const m = g.modifiers.find((mm) => mm.id === modId)!;
        return {
          groupId: g.id,
          modifierId: modId,
          name: m.name,
          priceDelta: m.priceDelta,
        };
      }),
    );
    onAdd({
      key: `${item.id}-${Date.now()}`,
      itemId: item.id,
      variantId: variant?.id,
      variantName: variant?.name,
      name: item.name,
      imageUrl: item.imageUrl,
      qty: 1,
      basePrice: lineTotal,
      modifiers,
      notes: notes || undefined,
      lineTotal,
    });
  }

  return (
    <Dialog
      onClose={onClose}
      label="Customize your order"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto z-10">
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{item.name}</h3>
          <button aria-label="Close dialog" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {item.description && <p className="text-sm text-gray-700">{item.description}</p>}
          {item.variants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">
                Choose size
              </p>
              <div className="space-y-1.5">
                {item.variants.map((v) => {
                  const price =
                    v.absolutePrice ?? item.basePrice + v.priceDelta;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-center justify-between border rounded-xl px-3 py-2.5 cursor-pointer transition-colors ${
                        variantId === v.id
                          ? "border-brand-500 bg-brand-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          checked={variantId === v.id}
                          onChange={() => setVariantId(v.id)}
                          className="accent-brand-500"
                        />
                        <span className="text-sm">{v.name}</span>
                      </div>
                      <span className="text-sm font-semibold">
                        {fmt(price)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {item.modifierGroups.map((g) => (
            <div key={g.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-gray-700">
                  {g.name}
                  {g.isRequired && <span className="text-red-500 ml-1">*</span>}
                </p>
                <span className="text-[10px] text-gray-500">
                  {g.maxSelections > 0
                    ? `Choose up to ${g.maxSelections}`
                    : "Choose any"}
                </span>
              </div>
              <div className="space-y-1.5">
                {g.modifiers.map((m) => {
                  const isOn = selectedMods[g.id]?.includes(m.id) ?? false;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center justify-between border rounded-xl px-3 py-2 cursor-pointer transition-colors ${
                        isOn ? "border-brand-500 bg-brand-50" : "border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => toggleMod(g, m.id)}
                          className="w-4 h-4 accent-brand-600"
                        />
                        <span className="text-sm">{m.name}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {m.priceDelta > 0 ? `+${fmt(m.priceDelta)}` : "free"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="text-xs font-semibold text-gray-700 mb-1.5">
              Special instructions
            </p>
            <textarea
              aria-label="Less spicy, no onion..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Less spicy, no onion..."
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
          <button
            onClick={submit}
            disabled={Boolean(missingRequired)}
            className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl font-bold disabled:bg-gray-300 transition-colors"
          >
            Add to cart · {fmt(lineTotal)}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CartDrawer({
  fmt,
  cart,
  guestName,
  guestPhone,
  guestNotes,
  onUpdateName,
  onUpdatePhone,
  onUpdateNotes,
  onClose,
  onAdjustQty,
  onRemove,
  onPlace,
  placing,
}: {
  fmt: (amount: number) => string;
  cart: GuestCartLine[];
  guestName: string;
  guestPhone: string;
  guestNotes: string;
  onUpdateName: (v: string) => void;
  onUpdatePhone: (v: string) => void;
  onUpdateNotes: (v: string) => void;
  onClose: () => void;
  onAdjustQty: (key: string, delta: number) => void;
  onRemove: (key: string) => void;
  onPlace: () => void;
  placing: boolean;
}) {
  const {
    width: cartWidth,
    onPointerDown: onCartResize,
    onKeyDown: onCartResizeKey,
    reset: resetCartWidth,
  } = useResizableWidth({ storageKey: "pinky.guestCartWidth", defaultWidth: 448 });
  return (
    <Dialog
      onClose={onClose}
      label="Your order"
      className="fixed inset-0 z-50 flex justify-end"
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative w-full bg-white shadow-2xl h-full overflow-y-auto z-10 flex flex-col"
        style={{ width: cartWidth, maxWidth: "95vw" }}
      >
        <ResizeHandle
          onPointerDown={onCartResize}
          onDoubleClick={resetCartWidth}
          onKeyDown={onCartResizeKey}
        />
        <div className="sticky top-0 bg-gradient-to-r from-brand-50 to-brand-50 px-5 py-4 border-b border-brand-100 z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-600" />
              <h3 className="font-bold text-gray-900">Your order</h3>
            </div>
            <button aria-label="Close dialog" onClick={onClose}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          {guestName && (
            <p className="text-xs text-gray-600">
              👤 <strong>{guestName}</strong>
            </p>
          )}
          <p className="text-[10px] text-gray-500 mt-1">
            {cart.length} item{cart.length !== 1 ? "s" : ""} •{" "}
            {cart.reduce((s, l) => s + l.qty, 0)} qty
          </p>
        </div>

        <div className="px-5 py-4 space-y-3 flex-1">
          {cart.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-12">
              Your cart is empty.
            </p>
          )}
          {cart.map((line) => (
            <div key={line.key} className="bg-gray-50 rounded-2xl p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {line.name}
                    {line.variantName && (
                      <span className="text-gray-500 font-normal">
                        {" "}
                        · {line.variantName}
                      </span>
                    )}
                  </p>
                  {line.modifiers.length > 0 && (
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {line.modifiers.map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {line.notes && (
                    <p className="text-[11px] text-gray-500 italic mt-0.5">
                      {line.notes}
                    </p>
                  )}
                  <p className="text-sm font-bold text-gray-900 mt-1.5">
                    {fmt(line.lineTotal)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => onRemove(line.key)}>
                    <X className="w-4 h-4 text-gray-300 hover:text-red-500" />
                  </button>
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-1">
                    <button
                      onClick={() => onAdjustQty(line.key, -1)}
                      className="p-1"
                    >
                      <Minus className="w-3 h-3 text-gray-500" />
                    </button>
                    <span className="text-xs font-bold w-4 text-center">
                      {line.qty}
                    </span>
                    <button
                      onClick={() => onAdjustQty(line.key, 1)}
                      className="p-1"
                    >
                      <Plus className="w-3 h-3 text-brand-600" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {cart.length > 0 && (
            <>
              <div className="border-t border-gray-100 pt-3 space-y-2.5">
                <p className="text-xs font-semibold text-gray-700">
                  Your details (optional)
                </p>
                <input
                  aria-label="Your name"
                  value={guestName}
                  onChange={(e) => onUpdateName(e.target.value)}
                  placeholder="Your name"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                />
                <input
                  aria-label="Phone (+1...)"
                  value={guestPhone}
                  onChange={(e) => onUpdatePhone(e.target.value)}
                  placeholder="Phone (+1...)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                />
                <textarea
                  aria-label="Allergies or special requests..."
                  value={guestNotes}
                  onChange={(e) => onUpdateNotes(e.target.value)}
                  placeholder="Allergies or special requests..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                />
              </div>
              <div className="border-t border-gray-100 pt-3">
                <GuestQuote cart={cart} />
              </div>
            </>
          )}
        </div>

        {cart.length > 0 && (
          <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
            <button
              onClick={onPlace}
              disabled={placing}
              className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Place order
            </button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
