import GuestHeader from "@/components/ui/GuestHeader";
import PageState from "@/components/ui/PageState";
import { formatCurrency } from "@/lib/currencies";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Sparkles,
  Star,
  Hand,
  Droplet,
  Receipt,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useGuestOrder,
  useSendGuestRequest,
  useSubmitGuestFeedback,
} from "@/hooks/useGuest";
import { useSocket } from "@/hooks/useSocket";
import GuestStripeCheckout from "@/components/GuestStripeCheckout";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import type { OrderStatus } from "@/lib/dto/orders";
import { GUEST_REQUEST_LABELS, type GuestRequestType } from "@/lib/dto/guest";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_FLOW: OrderStatus[] = [
  "placed",
  "accepted",
  "preparing",
  "ready",
  "served",
  "settled",
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Order placed",
  accepted: "Confirmed by staff",
  preparing: "In the kitchen",
  ready: "Ready to serve",
  served: "Served — enjoy!",
  settled: "Bill settled",
  cancelled: "Cancelled",
};

const REQUEST_ICONS: Record<GuestRequestType, React.ElementType> = {
  call_waiter: Hand,
  water: Droplet,
  bill: Receipt,
  other: Sparkles,
};

export default function GuestTrackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const qc = useQueryClient();
  const configuredFmt = useCurrencyFormatter();
  const orderQuery = useGuestOrder(orderId ?? null);
  const sendRequest = useSendGuestRequest();
  const submitFeedback = useSubmitGuestFeedback();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [requestNote, setRequestNote] = useState("");
  const [otherOpen, setOtherOpen] = useState(false);

  // Live updates via /guest socket joined by orderId
  useSocket(
    "/guest",
    {
      "delivery:updated": () =>
        qc.invalidateQueries({ queryKey: ["guest-order", orderId] }),
      "order:updated": () =>
        qc.invalidateQueries({ queryKey: ["guest-order", orderId] }),
      "order:status_changed": () =>
        qc.invalidateQueries({ queryKey: ["guest-order", orderId] }),
      "order:item_status_changed": () =>
        qc.invalidateQueries({ queryKey: ["guest-order", orderId] }),
    },
    { query: orderId ? { orderId } : {}, enabled: Boolean(orderId) },
  );

  const order = orderQuery.data;
  const fmt = (value: number) =>
    order?.currency
      ? formatCurrency(value, order.currency)
      : configuredFmt(value);

  if (orderQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-50">
        <Loader2 className="w-8 h-8 text-[var(--promise-berry)] animate-spin" />
      </div>
    );
  }

  if (!order)
    return (
      <div className="min-h-screen bg-[#fff8ef]">
        <GuestHeader />
        <PageState
          kind="error"
          title="We couldn’t open this order"
          description="Use the private link from your order confirmation, or ask our team for help."
          action={
            <>
              <button
                className="ui-button"
                onClick={() => orderQuery.refetch()}
              >
                Try again
              </button>
              <Link className="ui-button" to="/menu">
                Back to the menu
              </Link>
            </>
          }
        />
      </div>
    );

  const flowIndex = STATUS_FLOW.indexOf(order.status);
  const isCancelled = order.status === "cancelled";
  const isWindow =
    !order.delivery &&
    (order.fulfillment === "pickup" || order.channel === "window");
  const statusLabel = (status: OrderStatus) =>
    isWindow && status === "ready"
      ? "Ready for pickup"
      : isWindow && status === "served"
        ? "Picked up — enjoy!"
        : STATUS_LABEL[status];
  const canRequest =
    !order.delivery && !["settled", "cancelled"].includes(order.status);
  const canFeedback = order.status === "served" || order.status === "settled";
  const canPay =
    !isCancelled &&
    order.status !== "settled" &&
    order.paymentStatus !== "paid" &&
    order.totals.grand > 0;

  return (
    <div className="min-h-screen bg-[#fff8ef] pb-12">
      <GuestHeader />
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <p className="text-[10px] uppercase font-semibold text-[var(--promise-berry)] tracking-wider">
            Order Tracker
          </p>
          <h1 className="text-xl font-bold text-gray-900">
            #{order.orderNumber}
            {isWindow && order.windowToken && (
              <span className="ml-2 text-base text-violet-600">
                · Token {order.windowToken}
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-500 mt-0.5 capitalize">
            {order.channel.replace("_", "-")}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {orderQuery.isError && (
          <PageState
            kind="error"
            title="Updates are temporarily unavailable"
            description="You’re viewing the last saved status. Please retry or ask the café for the latest update."
            action={
              <button
                className="ui-button"
                onClick={() => orderQuery.refetch()}
              >
                Refresh order status
              </button>
            }
          />
        )}
        {order.pickupAt && (
          <p className="bg-white rounded-xl border p-4 text-sm">
            Pickup requested for{" "}
            {new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Los_Angeles",
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(order.pickupAt))}{" "}
            Pacific
          </p>
        )}
        {/* Status hero */}
        <div
          className={`rounded-2xl p-5 ${isCancelled ? "bg-red-50 border border-red-200" : order.status === "ready" ? "bg-emerald-50 border border-emerald-200" : "bg-white border border-gray-200"} shadow-sm`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isCancelled
                  ? "bg-red-100 text-red-600"
                  : order.status === "ready"
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-brand-100 text-brand-600"
              }`}
            >
              {order.status === "preparing" ? (
                <ChefHat className="w-6 h-6" />
              ) : order.status === "ready" ? (
                <Sparkles className="w-6 h-6" />
              ) : order.status === "served" || order.status === "settled" ? (
                <CheckCircle2 className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">
                {order.delivery
                  ? {
                      pending: "Delivery arranged",
                      assigned: "Delivery staff assigned",
                      dispatched: "Out for delivery",
                      delivered: "Delivered — enjoy!",
                      failed:
                        "Delivery needs attention — please contact the restaurant",
                      cancelled: "Delivery cancelled",
                    }[order.delivery.status]
                  : statusLabel(order.status)}
              </p>
              {!isCancelled &&
                order.estimatedPrepMinutes > 0 &&
                order.status !== "served" &&
                order.status !== "settled" && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    Est. prep time: {order.estimatedPrepMinutes} min
                  </p>
                )}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {!isCancelled && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">
              Progress
            </h3>
            <div className="space-y-3">
              {STATUS_FLOW.map((s, idx) => {
                const reached = idx <= flowIndex;
                const current = idx === flowIndex;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        reached
                          ? current
                            ? "bg-[var(--promise-berry)] text-white"
                            : "bg-brand-100 text-brand-600"
                          : "bg-gray-100 text-gray-300"
                      }`}
                    >
                      {reached && !current ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : (
                        <span className="text-[10px] font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        current
                          ? "font-bold text-gray-900"
                          : reached
                            ? "text-gray-700"
                            : "text-gray-500"
                      }`}
                    >
                      {statusLabel(s)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bill */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 text-sm">Your Bill</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--promise-berry)]">
              #{order.orderNumber}
            </span>
          </div>

          {/* Line items */}
          <div className="divide-y divide-gray-50">
            {order.items
              .filter((i) => i.status !== "cancelled")
              .map((item) => (
                <div
                  key={item.id}
                  className="px-5 py-3 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {item.qty}× {item.name}
                      {item.variantName && (
                        <span className="text-gray-500 font-normal">
                          {" "}
                          ({item.variantName})
                        </span>
                      )}
                    </p>
                    {item.modifiers.length > 0 && (
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {item.modifiers.join(", ")}
                      </p>
                    )}
                  </div>
                  <span className="text-sm font-mono text-gray-800 shrink-0">
                    {fmt(item.lineTotal)}
                  </span>
                </div>
              ))}
          </div>

          {/* Totals breakdown */}
          <div className="px-5 pt-3 pb-4 bg-gray-50 border-t border-gray-100 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span className="font-mono">{fmt(order.totals.subtotal)}</span>
            </div>
            {order.totals.modifierTotal > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Add-ons</span>
                <span className="font-mono">
                  {fmt(order.totals.modifierTotal)}
                </span>
              </div>
            )}
            {order.totals.discount > 0 && (
              <div className="flex justify-between text-sm text-[#086874]">
                <span>Discount</span>
                <span>−{fmt(order.totals.discount)}</span>
              </div>
            )}
            {order.totals.discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span>
                <span className="font-mono">−{fmt(order.totals.discount)}</span>
              </div>
            )}
            {order.totals.serviceCharge > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Service charge</span>
                <span className="font-mono">
                  {fmt(order.totals.serviceCharge)}
                </span>
              </div>
            )}
            {order.totals.taxBreakup.map((t) => (
              <div
                key={t.name}
                className="flex justify-between text-sm text-gray-500"
              >
                <span>
                  {t.name} ({t.rate}%)
                </span>
                <span className="font-mono">{fmt(t.amount)}</span>
              </div>
            ))}
            {order.totals.taxBreakup.length === 0 && order.totals.tax > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Tax</span>
                <span className="font-mono">{fmt(order.totals.tax)}</span>
              </div>
            )}
            {order.totals.roundOff !== 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>Round off</span>
                <span className="font-mono">{fmt(order.totals.roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-200 mt-1">
              <span>Total</span>
              <span className="font-mono">{fmt(order.totals.grand)}</span>
            </div>
          </div>
        </div>

        {/* Pay online (Stripe) */}
        {canPay && (
          <GuestStripeCheckout
            orderId={order.id}
            baseAmount={order.totals.grand}
            formatAmount={fmt}
            onPaid={() =>
              qc.invalidateQueries({ queryKey: ["guest-order", order.id] })
            }
          />
        )}

        {/* Quick requests */}
        {canRequest && !isWindow && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 text-sm mb-3">
              Need something?
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(GUEST_REQUEST_LABELS) as GuestRequestType[]).map(
                (t) => {
                  const Icon = REQUEST_ICONS[t];
                  return (
                    <button
                      key={t}
                      disabled={
                        sendRequest.isPending ||
                        order.guestRequests?.some(
                          (r) => r.type === t && !r.resolved,
                        )
                      }
                      onClick={() =>
                        t === "other"
                          ? setOtherOpen(true)
                          : sendRequest.mutate(
                              {
                                orderId: order.id,
                                type: t,
                              },
                              {
                                onSuccess: () =>
                                  qc.invalidateQueries({
                                    queryKey: ["guest-order", order.id],
                                  }),
                              },
                            )
                      }
                      className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:border-brand-400 hover:bg-brand-50 transition-colors disabled:opacity-50"
                    >
                      <Icon className="w-4 h-4 text-[var(--promise-berry)]" />
                      {GUEST_REQUEST_LABELS[t]}
                    </button>
                  );
                },
              )}
            </div>
            {otherOpen && (
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendRequest.mutate(
                    {
                      orderId: order.id,
                      type: "other",
                      message: requestNote.trim(),
                    },
                    {
                      onSuccess: () => {
                        setOtherOpen(false);
                        setRequestNote("");
                        qc.invalidateQueries({
                          queryKey: ["guest-order", order.id],
                        });
                      },
                    },
                  );
                }}
              >
                <label className="block text-sm font-semibold">
                  How can we help?
                  <textarea
                    className="w-full border rounded-xl p-3 mt-2"
                    required
                    maxLength={200}
                    value={requestNote}
                    onChange={(e) => setRequestNote(e.target.value)}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    className="ui-button ui-button-primary"
                    disabled={sendRequest.isPending}
                  >
                    Send request
                  </button>
                  <button
                    type="button"
                    className="ui-button"
                    onClick={() => setOtherOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {Boolean(order.guestRequests?.length) && (
              <ul
                className="text-sm text-gray-600 mt-4 space-y-2"
                aria-label="Your service requests"
              >
                {order.guestRequests?.map((r) => (
                  <li key={r.id}>
                    {GUEST_REQUEST_LABELS[r.type]} ·{" "}
                    {r.resolved ? "Handled" : "Sent to the team"}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Feedback */}
        {canFeedback && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            {order.feedbackSubmitted || submitFeedback.isSuccess ? (
              <p role="status" className="text-center text-[#086874] py-3">
                Thank you. Your feedback has been received.
              </p>
            ) : feedbackOpen ? (
              <FeedbackForm
                onSubmit={async (rating, text) => {
                  try {
                    await submitFeedback.mutateAsync({
                      orderId: order.id,
                      input: { rating, text: text || undefined },
                    });
                    setFeedbackOpen(false);
                    qc.invalidateQueries({
                      queryKey: ["guest-order", order.id],
                    });
                  } catch {
                    /* Keep the rating and text available for correction. */
                  }
                }}
                submitting={submitFeedback.isPending}
                onCancel={() => setFeedbackOpen(false)}
              />
            ) : (
              <button
                onClick={() => setFeedbackOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--promise-berry)] text-white rounded-xl font-medium text-sm"
              >
                <Star className="w-4 h-4 fill-current" />
                Rate your experience
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function FeedbackForm({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (rating: number, text: string) => Promise<void>;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">
        How was your experience?
      </p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
            aria-pressed={rating === n}
            onClick={() => setRating(n)}
            className="p-1"
          >
            <Star
              className={`w-9 h-9 transition-colors ${
                n <= rating ? "text-amber-400 fill-amber-400" : "text-gray-200"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        aria-label="Tell us more (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Tell us more (optional)"
        rows={3}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 border border-gray-200 rounded-xl text-sm"
        >
          Cancel
        </button>
        <button
          onClick={() => {
            if (rating === 0) {
              toast.error("Pick a rating");
              return;
            }
            onSubmit(rating, text);
          }}
          disabled={submitting}
          className="flex-1 py-2 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-bold disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
