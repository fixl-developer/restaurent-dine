import { useMutation } from "@tanstack/react-query";
import { useCheckoutDraft } from "@/hooks/useCheckoutDraft";
import { submitCheckout } from "@/lib/checkoutDraft";
import { ApiError } from "@/lib/api";
import CheckoutRecovery from "@/components/CheckoutRecovery";
import {
  dishCutout,
  drinksCategory,
  hasDishModel,
  startingPrice,
} from "@/components/counter/menuDisplay";
import type { GuestOrderDto } from "@/lib/dto/guest";
import CategoryRail from "@/components/menuBook/CategoryRail";
import DishArtwork from "@/components/menuBook/DishArtwork";
import MenuBook from "@/components/menuBook/MenuBook";
import DishViewer from "@/components/windowTable/DishViewer";
import GuestHeader from "@/components/ui/GuestHeader";
import PageState from "@/components/ui/PageState";
import Dialog from "@/components/ui/Dialog";
import ResizeHandle from "@/components/ui/ResizeHandle";
import { useResizableWidth } from "@/hooks/useResizableWidth";
import { BookOpen, Coffee, Grid2X2, Info } from "lucide-react";
import GuestQuote from "@/components/GuestQuote";
import { useGuestQuote } from "@/hooks/useGuestQuote";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { CustomizeModal } from "./GuestOrderPage";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  Plus,
  Minus,
  ShoppingBag,
  X,
  Store,
  Loader2,
  Phone,
  ShieldCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  usePublicMenu,
  useRequestGuestOtp,
  useVerifyGuestOtp,
} from "@/hooks/useGuest";
import type { GuestCartLine, PublicMenuItem } from "@/lib/dto/guest";

const TOKEN_STORAGE_KEY = "sd_guest_token";
const TOKEN_PHONE_KEY = "sd_guest_phone";
const TOKEN_EXPIRES_KEY = "sd_guest_token_expires";

function loadStoredToken(): { token: string; phone: string } | null {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const phone = localStorage.getItem(TOKEN_PHONE_KEY);
  const expires = localStorage.getItem(TOKEN_EXPIRES_KEY);
  if (!token || !phone || !expires) return null;
  if (Date.now() > Number(expires)) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_PHONE_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
    return null;
  }
  return { token, phone };
}

export default function GuestWindowPage() {
  const fmtINR = useCurrencyFormatter();
  const [inspection, setInspection] = useState<PublicMenuItem | null>(null);
  const [customizingItem, setCustomizingItem] = useState<PublicMenuItem | null>(
    null,
  );
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const qrSlug = params.get("qr") ?? undefined;

  const [guestToken, setGuestToken] = useState<string | null>(
    () => loadStoredToken()?.token ?? null,
  );
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(
    () => loadStoredToken()?.phone ?? null,
  );

  const menuQuery = usePublicMenu({ channel: "window" });

  const [menuView, setMenuView] = useState<"book" | "grid">("book");
  const [search, setSearch] = useState("");
  const draftScope = `pickup:${qrSlug ?? "counter"}`;
  const { draft, field } = useCheckoutDraft(draftScope);
  const { cart, guestName, guestNotes, pickupAt } = draft;
  const setCart = field("cart"),
    setGuestName = field("guestName"),
    setGuestNotes = field("guestNotes"),
    setPickupAt = field("pickupAt");
  const [cartOpen, setCartOpen] = useState(false);
  const {
    width: cartWidth,
    onPointerDown: onCartResize,
    onKeyDown: onCartResizeKey,
    reset: resetCartWidth,
  } = useResizableWidth({
    storageKey: "pinky.guestCartWidth",
    defaultWidth: 448,
  });
  const [showOtpModal, setShowOtpModal] = useState(false);

  const menu = menuQuery.data;

  const categories = menu?.categories ?? [];
  const requestedCategory = params.get("category");
  const activeCategory =
    categories.find((c) => c.id === requestedCategory)?.id ??
    (params.get("collection") === "drinks"
      ? drinksCategory(categories)?.id
      : undefined) ??
    "all";

  function setActiveCategory(id: string) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete("collection");
        if (id === "all") next.delete("category");
        else next.set("category", id);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    const id = params.get("item");
    if (!id || !menu) return;
    const item = menu.categories
      .flatMap((category) => category.items)
      .find((candidate) => candidate.id === id);
    if (item && hasDishModel(item)) setInspection(item);
    else if (item) setCustomizingItem(item);
    else toast.info("This item is no longer on the menu.");
    const next = new URLSearchParams(params);
    next.delete("item");
    setParams(next, { replace: true });
  }, [menu, params, setParams]);

  const filteredItems = useMemo(() => {
    if (!menu) return [];
    const all = menu.categories.flatMap((c) => c.items);
    const q = search.toLowerCase().trim();
    if (q) {
      return all.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? "").toLowerCase().includes(q),
      );
    }
    return activeCategory === "all"
      ? all
      : all.filter((i) => i.categoryId === activeCategory);
  }, [menu, search, activeCategory]);

  function addItem(item: PublicMenuItem) {
    if (item.variants.length > 0 || item.modifierGroups.length > 0) {
      setCustomizingItem(item);
      return;
    }
    setCart((prev) => {
      const existing = prev.find(
        (l) => l.itemId === item.id && l.modifiers.length === 0,
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

  const quantities = useMemo(() => {
    const counts = new Map<string, number>();
    for (const line of cart) counts.set(line.itemId, (counts.get(line.itemId) ?? 0) + line.qty);
    return counts;
  }, [cart]);

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

  function handleVerified(token: string, phone: string, expiresInMin: number) {
    setGuestToken(token);
    setVerifiedPhone(phone);
    const expiresAt = Date.now() + expiresInMin * 60_000;
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    localStorage.setItem(TOKEN_PHONE_KEY, phone);
    localStorage.setItem(TOKEN_EXPIRES_KEY, String(expiresAt));
    setShowOtpModal(false);
  }

  function handleSignOut() {
    setGuestToken(null);
    setVerifiedPhone(null);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_PHONE_KEY);
    localStorage.removeItem(TOKEN_EXPIRES_KEY);
  }

  const placeOrder = useMutation({
    networkMode: "always",
    mutationFn: () =>
      submitCheckout<GuestOrderDto>(draftScope, draft.key, {
        path: "/guest/orders/window",
        noAuth: true,
        guestToken: guestToken ?? undefined,
        principal: `guest:${verifiedPhone}`,
        body: {
          qrSlug,
          maxTotal: quote.data?.totals.grand,
          guestName: guestName || undefined,
          guestNotes: guestNotes || undefined,
          pickupLocal: pickupAt || undefined,
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
      }),
    onSuccess: (order) => {
      toast.success(`Order ${order.orderNumber} confirmed!`);
      navigate(`/track/${order.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
      if (error instanceof ApiError && error.status === 401) {
        setGuestToken(null);
        setShowOtpModal(true);
      }
    },
  });
  function handlePlace() {
    if (placeOrder.isPending) return;
    if (
      !guestToken ||
      (draft.pending && draft.pending.principal !== `guest:${verifiedPhone}`)
    ) {
      setShowOtpModal(true);
      return;
    }
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
          onRetry={handlePlace}
          verify={
            !guestToken || draft.pending.principal !== `guest:${verifiedPhone}`
          }
        />
        {showOtpModal && (
          <OtpModal
            onClose={() => setShowOtpModal(false)}
            onVerified={handleVerified}
          />
        )}
      </div>
    );

  if (menuQuery.isLoading) {
    return (
      <div className="min-h-screen bg-[#fff8ef]">
        <GuestHeader />
        <PageState kind="loading" title="Getting the menu ready…" />
      </div>
    );
  }

  if (menuQuery.isError)
    return (
      <div className="min-h-screen bg-[#fff8ef] grid place-content-center gap-4 text-center p-6">
        <h1 className="text-2xl font-bold">The menu is taking a moment.</h1>
        <p>
          We couldn't load the current menu. Please try again or ask our team.
        </p>
        <button
          className="text-[var(--promise-berry)] underline"
          onClick={() => menuQuery.refetch()}
        >
          Try again
        </button>
        <Link to="/">Back to Pinky Promise</Link>
      </div>
    );

  return (
    <div className="guest-menu">
      {inspection && (
        <DishViewer
          dish={inspection}
          onClose={() => setInspection(null)}
          onAdd={() => {
            setInspection(null);
            addItem(inspection);
          }}
        />
      )}
      {customizingItem && (
        <CustomizeModal
          fmt={fmtINR}
          item={customizingItem}
          onClose={() => setCustomizingItem(null)}
          onAdd={(line) => {
            setCart((previous) => [...previous, line]);
            setCustomizingItem(null);
          }}
        />
      )}
      <GuestHeader />
      <section className="guest-menu-heading">
        <div>
          <h1>The café menu</h1>
          <p><ShoppingBag size={16} aria-hidden="true" /> Order ahead and pay at pickup.</p>
          <p>Dining in? Scan the QR code at your table.</p>
          {verifiedPhone && (
            <p className="mt-2">
              Signed in as {verifiedPhone} ·{" "}
              <button onClick={handleSignOut} className="underline">
                Sign out
              </button>
            </p>
          )}
        </div>
        <img src="/counter/bar.webp" alt="" className="guest-menu-counter" />
      </section>
      <div className="guest-menu-toolbar">
        <div className="guest-toolbar-inner">
          <div className="guest-search">
            <Search size={17} />
            <input
              aria-label="Search menu"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search the menu…"
            />
            {search && (
              <button aria-label="Clear search" onClick={() => setSearch("")}>
                <X size={16} />
              </button>
            )}
          </div>
          <CategoryRail categories={categories} selected={activeCategory} onSelect={(id) => {
            setActiveCategory(id);
            setSearch("");
          }} />
        </div>
      </div>
      <main className="guest-catalog">
        <div className="guest-catalog-title">
          <h2>
            {search
              ? "Your search"
              : activeCategory === "all"
                ? "All dishes"
                : menu?.categories.find((c) => c.id === activeCategory)?.name}
          </h2>
          <div className="mb-view-controls">
          <span aria-live="polite">
            {filteredItems.length}{" "}
            {filteredItems.length === 1 ? "dish" : "dishes"}
          </span>
          <div className="mb-view-switch" role="group" aria-label="Menu layout">
            <button type="button" aria-pressed={menuView === "book"} onClick={() => setMenuView("book")}><BookOpen size={16} /> Book</button>
            <button type="button" aria-pressed={menuView === "grid"} onClick={() => setMenuView("grid")}><Grid2X2 size={16} /> Grid</button>
          </div>
          </div>
        </div>
        {filteredItems.length === 0 && (
          <PageState
            title={search ? "No bites found" : "Something good is on the way"}
            description={
              search
                ? "Try a different name or explore all our favorites."
                : "Our team is updating this menu. Please check again soon."
            }
            action={
              search ? (
                <button
                  className="ui-button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("all");
                  }}
                >
                  Explore the menu
                </button>
              ) : (
                <button
                  className="ui-button"
                  onClick={() => menuQuery.refetch()}
                >
                  Refresh menu
                </button>
              )
            }
          />
        )}
        {menuView === "book" ? (
          <MenuBook key={JSON.stringify([activeCategory, search])} items={filteredItems} categories={categories}
            formatPrice={fmtINR} quantities={quantities} onAdd={addItem} onInspect={setInspection} />
        ) : (
        <div className="guest-menu-grid">
          {filteredItems.map((item) => {
            const inCart = quantities.get(item.id) ?? 0;
            return (
              <article className="guest-menu-card" key={item.id}>
                <div className="guest-food-image">
                  {dishCutout(item) ? (
                    <DishArtwork item={item} interactive />
                  ) : item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} loading="lazy" />
                  ) : (
                    <div className="guest-food-placeholder" aria-hidden="true">
                      <Coffee size={40} strokeWidth={1} />
                      <span>Pinky Promise</span>
                    </div>
                  )}
                </div>
                <div className="guest-food-body">
                  <span className="guest-food-category">
                    {
                      menu?.categories.find((c) => c.id === item.categoryId)
                        ?.name
                    }
                  </span>
                  <h3>{item.name}</h3>
                  {hasDishModel(item) && (
                    <button
                      className="dish-preview-link"
                      onClick={() => setInspection(item)}
                    >
                      View in 3D
                    </button>
                  )}
                  {item.description && <p>{item.description}</p>}
                  <div className="guest-food-tags">
                    {["veg", "vegan"].includes(item.foodType) && (
                      <span>
                        {item.foodType === "vegan" ? "Vegan" : "Vegetarian"}
                      </span>
                    )}
                    {item.calories != null && <span>{item.calories} Cal</span>}
                  </div>
                  {!!item.allergens?.length && (
                    <p>Contains: {item.allergens.join(", ")}</p>
                  )}
                  <div className="guest-food-footer">
                    <strong>
                      {item.variants.length > 0 && <small>From </small>}
                      {fmtINR(startingPrice(item))}
                    </strong>
                    <button onClick={() => addItem(item)}>
                      <Plus size={15} />
                      {inCart ? `${inCart} ADDED` : "ADD"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
        )}
        <p className="guest-allergy-note">
          <Info size={16} />
          Have an allergy? Talk to our team before ordering so we can help you
          choose.
        </p>
      </main>

      {menu?.combos?.length ? (
        <section className="guest-catalog">
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
                  <span className="font-bold">{fmtINR(combo.price)}</span>
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
        <button onClick={() => setCartOpen(true)} className="guest-cart-button">
          <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center text-sm font-bold">
            {cartCount}
          </div>
          <span className="text-sm font-bold">
            View cart · {fmtINR(cartTotal)}
          </span>
          <ShoppingBag className="w-4 h-4" />
        </button>
      )}

      {cartOpen && (
        <Dialog
          onClose={() => setCartOpen(false)}
          label="Your order"
          className="fixed inset-0 z-50 flex justify-end"
        >
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setCartOpen(false)}
          />
          <div
            className="relative w-full bg-white shadow-2xl h-full overflow-y-auto z-10 flex flex-col"
            style={{ width: cartWidth, maxWidth: "95vw" }}
          >
            <ResizeHandle
              onPointerDown={onCartResize}
              onDoubleClick={resetCartWidth}
              onKeyDown={onCartResizeKey}
            />
            <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
              <h3 className="font-bold text-gray-900">Your order</h3>
              <button
                aria-label="Close cart"
                onClick={() => setCartOpen(false)}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3 flex-1">
              {cart.map((line) => (
                <div
                  key={line.key}
                  className="bg-gray-50 rounded-2xl p-3 flex items-start gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">
                      {line.name}
                    </p>
                    <p className="text-sm font-bold text-gray-900 mt-1">
                      {fmtINR(line.lineTotal)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      aria-label={`Remove ${line.name}`}
                      onClick={() => removeLine(line.key)}
                    >
                      <X className="w-4 h-4 text-gray-300 hover:text-red-500" />
                    </button>
                    <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-1">
                      <button
                        aria-label={`Remove one ${line.name}`}
                        onClick={() => adjustQty(line.key, -1)}
                        className="p-1"
                      >
                        <Minus className="w-3 h-3 text-gray-500" />
                      </button>
                      <span className="text-xs font-bold w-4 text-center">
                        {line.qty}
                      </span>
                      <button
                        aria-label={`Add one ${line.name}`}
                        onClick={() => adjustQty(line.key, 1)}
                        className="p-1"
                      >
                        <Plus className="w-3 h-3 text-[#086874]" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="border-t border-gray-100 pt-3 space-y-2.5">
                <input
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  aria-label="Your name (optional)"
                  placeholder="Your name (optional)"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#086874]"
                />
                <div>
                  <label
                    htmlFor="pickup-local"
                    className="text-[10px] uppercase font-semibold text-gray-500 flex items-center gap-1 mb-1"
                  >
                    <Clock className="w-3 h-3" /> Pickup date & time · Pacific
                    (optional)
                  </label>
                  <input
                    type="datetime-local"
                    id="pickup-local"
                    value={pickupAt}
                    onChange={(event) => setPickupAt(event.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#086874]"
                  />
                </div>
                <textarea
                  value={guestNotes}
                  onChange={(e) => setGuestNotes(e.target.value)}
                  aria-label="Special requests"
                  placeholder="Special requests…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#086874]"
                />
              </div>
              <div className="border-t border-gray-100 pt-3 text-sm">
                <GuestQuote cart={cart} />
                <p className="mt-2 text-xs text-gray-500">Pay at pickup.</p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
              <button
                onClick={handlePlace}
                disabled={
                  placeOrder.isPending ||
                  !quote.data ||
                  quote.isError ||
                  quote.isFetching
                }
                className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {placeOrder.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !guestToken ? (
                  <ShieldCheck className="w-4 h-4" />
                ) : null}
                {!guestToken ? "Verify phone & place order" : "Place order"}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {showOtpModal && (
        <OtpModal
          onClose={() => setShowOtpModal(false)}
          onVerified={handleVerified}
        />
      )}
    </div>
  );
}

function OtpModal({
  onClose,
  onVerified,
}: {
  onClose: () => void;
  onVerified: (token: string, phone: string, expiresInMin: number) => void;
}) {
  const requestOtp = useRequestGuestOtp();
  const verifyOtp = useVerifyGuestOtp();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function send() {
    if (!phone.match(/^\+?[1-9]\d{7,14}$/)) {
      toast.error("Enter a valid phone (e.g. +13105550123)");
      return;
    }
    const r = await requestOtp.mutateAsync(phone);
    setSentTo(r.sentTo ?? phone);
    toast.success(`OTP sent to ${r.sentTo}`);
  }

  async function verify() {
    if (!code) {
      toast.error("Enter the OTP code");
      return;
    }
    const r = await verifyOtp.mutateAsync({ phone, code });
    if (r.verified) {
      onVerified(r.guestToken, r.phone, r.expiresInMin);
      toast.success("Phone verified");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--promise-berry)]" />
            <h3 className="font-bold text-gray-900">Verify your phone</h3>
          </div>
          <button aria-label="Close dialog" onClick={onClose}>
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Phone number
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={Boolean(sentTo)}
                placeholder="+13105550123"
                type="tel"
                autoComplete="tel"
                aria-label="Phone number"
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#086874] disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          </div>

          {sentTo && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                OTP code (sent to {sentTo})
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                aria-label="Verification code"
                autoComplete="one-time-code"
                placeholder="123456"
                inputMode="numeric"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#086874] text-center text-lg font-mono tracking-widest"
              />
              <p className="text-[10px] text-gray-500 mt-1.5">
                Didn’t get a code? Check your phone number or ask our team for
                help.
              </p>
            </div>
          )}

          {!sentTo ? (
            <button
              onClick={send}
              disabled={requestOtp.isPending}
              className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl font-bold disabled:opacity-50"
            >
              {requestOtp.isPending ? "Sending..." : "Send OTP"}
            </button>
          ) : (
            <div className="space-y-2">
              <button
                onClick={verify}
                disabled={verifyOtp.isPending}
                className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl font-bold disabled:opacity-50"
              >
                {verifyOtp.isPending ? "Verifying..." : "Verify & continue"}
              </button>
              <button
                onClick={() => setSentTo(null)}
                className="w-full text-xs text-gray-500 py-2"
              >
                Wrong number? Start over
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
