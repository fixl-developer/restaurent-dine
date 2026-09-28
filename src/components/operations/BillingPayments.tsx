import Dialog from "@/components/ui/Dialog";
import PageState from "@/components/ui/PageState";
import FlowSteps from "@/components/ui/FlowSteps";
import { Link, useSearchParams } from "react-router-dom";
import { Can } from "@/components/auth/Can";
import { useAuthStore } from "@/stores/auth.store";
import InvoiceControls from "@/components/billing/InvoiceControls";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet,
  Percent,
  Printer,
  CheckCircle2,
  X,
  Loader2,
  Download,
  LogOut,
  RefreshCw,
  Clock,
  Hash,
} from "lucide-react";
import { toast } from "sonner";
import { useLogout } from "@/hooks/useAuth";
import { useOrder, useOrders } from "@/hooks/useOrders";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import {
  useGenerateInvoice,
  useRecordPayment,
  downloadInvoicePdf,
  openInvoicePdf,
  useInvoice,
  useOrderInvoice,
  useCurrentCashSession,
  useOpenCashSession,
  useCloseCashSession,
} from "@/hooks/useBilling";
import { useSocket } from "@/hooks/useSocket";
import type { OrderDto } from "@/lib/dto/orders";
import { type PaymentMode, PAYMENT_MODE_LABELS } from "@/lib/dto/billing";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

const METHOD_CONFIG: Record<
  PaymentMode,
  { icon: React.ElementType; color: string }
> = {
  cash: {
    icon: Banknote,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  upi: { icon: Smartphone, color: "text-brand-600 bg-brand-50 border-brand-200" },
  card: { icon: CreditCard, color: "text-blue-600 bg-blue-50 border-blue-200" },
  wallet: {
    icon: Wallet,
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  online_prepay: {
    icon: Smartphone,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
};

export default function BillingPayments({ onExit }: { onExit: () => void }) {
  const [params, setParams] = useSearchParams();
  const tableId = params.get("table") ?? undefined;
  const selectedOrderId = params.get("order");
  const setSelectedOrderId = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set("order", id);
        else next.delete("order");
        return next;
      },
      { replace: true },
    );
  const orderQuery = useOrder(selectedOrderId);
  const savedInvoice = useOrderInvoice(selectedOrderId);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const qc = useQueryClient();
  const fmt = useCurrencyFormatter();
  const logoutMutation = useLogout();

  // Load all active orders (not settled/cancelled) — staff picks which to bill
  const ordersQuery = useOrders({ limit: 100, tableId });
  const { data: cashSession } = useCurrentCashSession();
  const openCashSession = useOpenCashSession();
  const closeCashSession = useCloseCashSession();
  const generateInvoice = useGenerateInvoice();
  const recordPayment = useRecordPayment();

  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMode>("cash");
  const [discountCode, setDiscountCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [cashTendered, setCashTendered] = useState("");
  const [openingFloat, setOpeningFloat] = useState("");
  const [showCashOpen, setShowCashOpen] = useState(false);
  const [showCashClose, setShowCashClose] = useState(false);
  const [actualCash, setActualCash] = useState("");
  const [txnRef, setTxnRef] = useState("");
  const [splitId, setSplitId] = useState("");
  const [step, setStep] = useState<"select" | "bill" | "pay" | "done">(
    selectedOrderId ? "bill" : "select",
  );

  const invoiceQuery = useInvoice(invoiceId);
  const invoice = invoiceQuery.data;
  useEffect(() => {
    setInvoiceId(null);
    setStep(selectedOrderId ? "bill" : "select");
    setCashTendered("");
    setTxnRef("");
    setSplitId("");
    setDiscountCode("");
    setDiscountAmount(0);
  }, [selectedOrderId]);
  useEffect(() => {
    if (savedInvoice.data && step === "bill") {
      setInvoiceId(savedInvoice.data._id);
      setStep(savedInvoice.data.amountDue <= 0 ? "done" : "pay");
    }
  }, [savedInvoice.data, step]);
  const selectedSplit =
    invoice?.splits.find((s) => s._id === splitId && s.status !== "paid") ??
    invoice?.splits.find((s) => s.status !== "paid");
  const collectionAmount = selectedSplit
    ? Math.round((selectedSplit.amount - selectedSplit.paidAmount) * 100) / 100
    : (invoice?.amountDue ?? 0);

  const orders = (ordersQuery.data?.items ?? []).filter(
    (o) => o.status !== "settled" && o.status !== "cancelled",
  );

  // Real-time updates
  useSocket("/staff", {
    "order:updated": () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
    },
    "invoice:updated": () => qc.invalidateQueries({ queryKey: ["invoices"] }),
    "payment:recorded": () => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  async function handleGenerateInvoice() {
    if (!selectedOrderId) return;
    try {
      const result = await generateInvoice.mutateAsync({
        orderId: selectedOrderId,
        input: {
          couponCode: discountCode || undefined,
          discount: discountAmount > 0 ? discountAmount : undefined,
        },
      });
      setInvoiceId(result._id);
      setStep("pay");
    } catch {
      /* The mutation displays the server failure; keep the check open. */
    }
  }

  async function handleRecordPayment() {
    if (!invoiceId || !invoice) return;
    const amount = collectionAmount;
    const tendered =
      paymentMethod === "cash" ? parseFloat(cashTendered) || amount : undefined;

    if (paymentMethod === "card" && !txnRef.trim()) {
      toast.error("Enter the successful terminal transaction reference");
      return;
    }

    try {
      await recordPayment.mutateAsync({
        invoiceId,
        input: {
          mode: paymentMethod,
          splitId: selectedSplit?._id,
          amount,
          cashTendered: tendered,
          txnRef: paymentMethod === "card" ? txnRef.trim() : undefined,
        },
      });
      setCashTendered("");
      setTxnRef("");
      if (amount >= invoice.amountDue) setStep("done");
      else {
        setSplitId("");
        await invoiceQuery.refetch();
      }
    } catch {
      /* Keep entered tender details available for review/recovery. */
    }
  }

  function resetFlow() {
    setSelectedOrderId(null);
    setInvoiceId(null);
    setStep("select");
    setSplitId("");
    setDiscountCode("");
    setDiscountAmount(0);
    setCashTendered("");
    setTxnRef("");
  }

  const selectedOrder =
    orderQuery.data ?? orders.find((o) => o._id === selectedOrderId);

  return (
    <div className="min-h-screen bg-[#FFFFFF] font-sans text-[#1a1a1a] flex flex-col">
      {/* Top Bar */}
      <div className="operations-bar sticky top-0 z-30 bg-[#1a1a1a] px-4 md:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E8447A] flex items-center justify-center">
            <Receipt className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-[13px] font-black uppercase tracking-[0.15em] text-white">
              Billing & Payments
            </h1>
            <p className="text-[11px] text-white/75 uppercase tracking-widest">
              {cashSession?.status === "open"
                ? `Cash Session Open · Float ${fmt(cashSession.openingFloat)}`
                : "No Cash Session"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {cashSession?.status !== "open" && (
            <Can perm="payment:create">
              <button
                onClick={() => setShowCashOpen(true)}
                className="text-[10px] font-mono text-emerald-400 border border-emerald-400/30 px-2.5 py-1.5 rounded-lg hover:border-emerald-400 transition-all uppercase tracking-widest"
              >
                Open Cash
              </button>
            </Can>
          )}
          {cashSession?.status === "open" && (
            <Can perm="payment:create">
              <button
                onClick={() => setShowCashClose(true)}
                className="text-[10px] font-mono text-amber-400 border border-amber-400/30 px-2.5 py-1.5 rounded-lg hover:border-amber-400 transition-all uppercase tracking-widest"
              >
                Close Cash
              </button>
            </Can>
          )}
          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-[10px] font-mono text-white/80 border border-white/15 px-2.5 py-1.5 rounded-lg hover:text-white transition-all uppercase tracking-widest"
          >
            <ArrowLeft className="w-3 h-3" /> Exit
          </button>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1.5 text-[10px] font-mono text-[#E8447A]/70 border border-[#E8447A]/20 px-2.5 py-1.5 rounded-lg hover:text-[#E8447A] transition-all uppercase tracking-widest"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </div>

      <div className="billing-layout">
        {/* Left: Order list */}
        <div className="billing-orders">
          {tableId && (
            <div className="p-3 bg-[#edf6f3] text-sm">
              <Link className="underline" to={`/table-ops?table=${tableId}`}>
                Back to this table
              </Link>
            </div>
          )}
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">
              Active Orders
            </p>
            <button
              aria-label="Refresh"
              onClick={() => ordersQuery.refetch()}
              className="text-gray-500 hover:text-gray-700"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          {ordersQuery.isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
            </div>
          )}

          {ordersQuery.isError && (
            <PageState
              kind="error"
              title="Order list unavailable"
              action={
                <button
                  className="ui-button"
                  onClick={() => ordersQuery.refetch()}
                >
                  Retry orders
                </button>
              }
            />
          )}
          {orders.length === 0 &&
            !ordersQuery.isLoading &&
            !ordersQuery.isError && (
              <p className="text-center text-xs text-gray-500 py-12">
                No active orders
              </p>
            )}

          <div className="divide-y divide-gray-100">
            {orders.map((order) => (
              <button
                key={order._id}
                onClick={() => {
                  setSelectedOrderId(order._id);
                  setStep("bill");
                  setInvoiceId(null);
                  setTxnRef("");
                }}
                className={`w-full text-left px-3 py-3 hover:bg-white transition-colors ${
                  selectedOrderId === order._id
                    ? "bg-white border-l-2 border-[#E8447A]"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-gray-900">
                    #{order.orderNumber}
                  </span>
                  <span
                    className={`text-[11px] px-1.5 py-0.5 rounded font-mono uppercase ${
                      order.status === "served"
                        ? "bg-green-100 text-green-700"
                        : order.status === "ready"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-gray-500">
                  <span className="flex items-center gap-1">
                    <Hash className="w-3 h-3" />
                    {order.channel.replace("_", "-")}
                  </span>
                  <span className="font-mono font-bold text-gray-700">
                    {fmt(order.totals.grand)}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-gray-500">
                  <Clock className="w-3 h-3" />
                  {fmtTime(order.createdAt)}
                  <span className="ml-1">{order.items.length} items</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Billing panel */}
        <div className="billing-detail overflow-y-auto p-4 md:p-6">
          <FlowSteps
            label="Billing progress"
            steps={[
              "Choose order",
              "Review bill",
              "Collect payment",
              "Receipt",
            ]}
            current={{ select: 0, bill: 1, pay: 2, done: 3 }[step]}
          />
          {selectedOrder && (
            <div className="flex flex-wrap gap-2 mb-4">
              <Can perm="order:read">
                <Link
                  className="ui-button"
                  to={`/admin/orders?order=${selectedOrder._id}`}
                >
                  Back to order
                </Link>
              </Can>
              {selectedOrder.tableId && (
                <Can perm="table:read">
                  <Link
                    className="ui-button"
                    to={`/table-ops?table=${selectedOrder.tableId}`}
                  >
                    Return to table
                  </Link>
                </Can>
              )}
            </div>
          )}
          {selectedOrderId &&
            (orderQuery.isLoading || savedInvoice.isLoading) && (
              <PageState kind="loading" title="Opening this check…" />
            )}
          {orderQuery.isError && (
            <PageState
              kind="error"
              title="Order unavailable"
              action={
                <button
                  className="ui-button"
                  onClick={() => orderQuery.refetch()}
                >
                  Retry this order
                </button>
              }
            />
          )}
          {savedInvoice.isError && (
            <PageState
              kind="error"
              title="Couldn’t check the saved invoice"
              description="Retry before creating or collecting a bill."
              action={
                <button
                  className="ui-button"
                  onClick={() => savedInvoice.refetch()}
                >
                  Retry invoice lookup
                </button>
              }
            />
          )}
          {!selectedOrderId && (
            <div className="h-full flex items-center justify-center text-center">
              <div>
                <Receipt className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">
                  Select an order to bill
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Choose from the active orders to review the check and collect
                  payment.
                </p>
              </div>
            </div>
          )}

          {selectedOrder &&
            step === "bill" &&
            !savedInvoice.isLoading &&
            !savedInvoice.isError &&
            !savedInvoice.data && (
              <div className="max-w-lg mx-auto space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-900">
                    Order #{selectedOrder.orderNumber}
                  </h2>
                  <button
                    aria-label="Close selected check"
                    onClick={resetFlow}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Line items */}
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-700">Items</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {selectedOrder.items
                      .filter((i) => i.status !== "cancelled")
                      .map((item) => (
                        <div
                          key={item._id}
                          className="px-4 py-2.5 flex justify-between items-start gap-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900">
                              {item.qty}× {item.name}
                            </p>
                            {item.variantName && (
                              <p className="text-[10px] text-gray-500">
                                {item.variantName}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-mono text-gray-700">
                            {fmt(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 space-y-1.5">
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Subtotal</span>
                      <span className="font-mono">
                        {fmt(
                          selectedOrder.totals.subtotal +
                            selectedOrder.totals.modifierTotal,
                        )}
                      </span>
                    </div>
                    {selectedOrder.totals.discount > 0 && (
                      <div className="flex justify-between text-xs text-green-600">
                        <span>Discount</span>
                        <span className="font-mono">
                          −{fmt(selectedOrder.totals.discount)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.totals.tax > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Tax</span>
                        <span className="font-mono">
                          {fmt(selectedOrder.totals.tax)}
                        </span>
                      </div>
                    )}
                    {selectedOrder.totals.serviceCharge > 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Service charge</span>
                        <span>{fmt(selectedOrder.totals.serviceCharge)}</span>
                      </div>
                    )}
                    {selectedOrder.totals.roundOff !== 0 && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Rounding</span>
                        <span>{fmt(selectedOrder.totals.roundOff)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                      <span>Total</span>
                      <span className="font-mono">
                        {fmt(selectedOrder.totals.grand)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Discount */}
                <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-[var(--promise-berry)]" /> Discount
                    / Coupon
                  </p>
                  <div className="flex gap-2">
                    <input
                      aria-label="Coupon code (optional)"
                      disabled={!hasPermission("discount:apply")}
                      value={discountCode}
                      onChange={(e) =>
                        setDiscountCode(e.target.value.toUpperCase())
                      }
                      placeholder="Coupon code (optional)"
                      className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <input
                    aria-label="Manual discount amount · manager permission required"
                    type="number"
                    disabled={!hasPermission("billing:discount")}
                    value={discountAmount || ""}
                    onChange={(e) =>
                      setDiscountAmount(parseFloat(e.target.value) || 0)
                    }
                    placeholder="Manual discount amount · manager permission required"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-400"
                  />
                </div>

                {selectedOrder.status === "cancelled" ? (
                  <PageState
                    title="This order was cancelled"
                    description="Choose an active order to create a bill."
                  />
                ) : (
                  <Can perm="billing:create">
                    <button
                      onClick={handleGenerateInvoice}
                      disabled={generateInvoice.isPending}
                      className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {generateInvoice.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Receipt className="w-4 h-4" />
                      )}
                      Generate Invoice
                    </button>
                  </Can>
                )}
              </div>
            )}

          {step === "pay" && invoiceQuery.isLoading && (
            <PageState kind="loading" title="Loading invoice…" />
          )}
          {step === "pay" && invoiceQuery.isError && (
            <PageState
              kind="error"
              title="Invoice unavailable"
              action={
                <button
                  className="ui-button"
                  onClick={() => invoiceQuery.refetch()}
                >
                  Retry invoice
                </button>
              }
            />
          )}
          {step === "pay" && invoice && (
            <div className="max-w-lg mx-auto space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">
                  Invoice #{invoice.invoiceNumber}
                </h2>
                <button
                  onClick={resetFlow}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Invoice summary */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span className="font-mono">
                    {fmt(invoice.subtotal + invoice.modifierTotal)}
                  </span>
                </div>
                {invoice.discount > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Discount</span>
                    <span className="font-mono">−{fmt(invoice.discount)}</span>
                  </div>
                )}
                {invoice.tax > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tax</span>
                    <span className="font-mono">{fmt(invoice.tax)}</span>
                  </div>
                )}
                {invoice.serviceCharge > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Service charge</span>
                    <span>{fmt(invoice.serviceCharge)}</span>
                  </div>
                )}
                {(invoice.tip ?? 0) > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Tip</span>
                    <span>{fmt(invoice.tip ?? 0)}</span>
                  </div>
                )}
                {invoice.roundOff !== 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Rounding</span>
                    <span>{fmt(invoice.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-gray-900 pt-1 border-t border-gray-200">
                  <span>Grand Total</span>
                  <span className="font-mono">
                    {fmt(invoice.grand + (invoice.tip ?? 0))}
                  </span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#E8447A] pt-1">
                  <span>Amount Due</span>
                  <span className="font-mono">{fmt(invoice.amountDue)}</span>
                </div>
              </div>

              <InvoiceControls key={invoice._id} invoice={invoice} />
              {invoice.splits.length > 0 && (
                <label className="text-sm block bg-white border rounded-xl p-4">
                  Guest split
                  <select
                    className="block w-full border rounded-lg p-2 mt-2"
                    value={
                      splitId ||
                      invoice.splits.find((s) => s.status !== "paid")?._id ||
                      ""
                    }
                    onChange={(e) => setSplitId(e.target.value)}
                  >
                    {invoice.splits
                      .filter((s) => s.status !== "paid")
                      .map((s) => (
                        <option key={s._id} value={s._id}>
                          {s.label} · {fmt(s.amount - s.paidAmount)} due
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {/* Payment method */}
              <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-semibold text-gray-700">
                  Payment Method
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card"] as PaymentMode[]).map((mode) => {
                    const { icon: Icon, color } = METHOD_CONFIG[mode];
                    return (
                      <button
                        key={mode}
                        onClick={() => setPaymentMethod(mode)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                          paymentMethod === mode
                            ? `${color} border-current`
                            : "border-gray-200 text-gray-500 hover:border-gray-300"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {mode === "card"
                          ? "External card terminal"
                          : PAYMENT_MODE_LABELS[mode]}
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === "cash" && (
                  <div>
                    <p className="text-[10px] text-gray-500 mb-1.5">
                      Cash Tendered
                    </p>
                    <input
                      aria-label={fmt(collectionAmount)}
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={fmt(collectionAmount)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-400"
                    />
                    {cashTendered &&
                      parseFloat(cashTendered) > collectionAmount && (
                        <p className="text-xs text-emerald-600 mt-1 font-medium">
                          Change:{" "}
                          {fmt(parseFloat(cashTendered) - collectionAmount)}
                        </p>
                      )}
                  </div>
                )}
              </div>

              {paymentMethod === "card" && (
                <label className="block text-sm font-medium">
                  Successful terminal reference
                  <input
                    value={txnRef}
                    onChange={(event) => setTxnRef(event.target.value)}
                    maxLength={120}
                    className="mt-2 w-full border rounded-xl p-3"
                  />
                  <span className="block mt-2 text-xs text-gray-500">
                    Charge the card on your terminal first. This records the
                    receipt; it does not charge a card.
                  </span>
                </label>
              )}

              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await openInvoicePdf(invoice._id);
                  }}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 flex items-center justify-center gap-1.5 hover:border-gray-300"
                >
                  <Printer className="w-3.5 h-3.5" /> Print
                </button>
                <button
                  onClick={() =>
                    downloadInvoicePdf(invoice._id, invoice.invoiceNumber)
                  }
                  className="py-2.5 px-4 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 flex items-center gap-1.5 hover:border-gray-300"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <Can perm="payment:create">
                  <button
                    onClick={handleRecordPayment}
                    disabled={
                      recordPayment.isPending ||
                      collectionAmount <= 0 ||
                      invoiceQuery.isError
                    }
                    className="flex-1 py-2.5 bg-[#E8447A] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {recordPayment.isPending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    Collect {fmt(collectionAmount)}
                  </button>
                </Can>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="max-w-lg mx-auto flex flex-col items-center justify-center h-full text-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {recordPayment.isSuccess
                    ? "Payment Collected!"
                    : "This invoice has no balance due"}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Payment recorded. Food preparation and handoff continue until
                  fulfilled.
                </p>
              </div>
              <div className="flex gap-3">
                {selectedOrder?.tableId && (
                  <Can perm="table:read">
                    <Link
                      className="ui-button"
                      to={`/table-ops?table=${selectedOrder.tableId}`}
                    >
                      Continue table service
                    </Link>
                  </Can>
                )}
                {invoiceId && (
                  <button
                    onClick={() =>
                      downloadInvoicePdf(
                        invoiceId,
                        invoice?.invoiceNumber ?? "INV",
                      )
                    }
                    className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm flex items-center gap-1.5 text-gray-600 hover:border-gray-300"
                  >
                    <Download className="w-4 h-4" /> Receipt
                  </button>
                )}
                <button
                  onClick={resetFlow}
                  className="px-6 py-2.5 bg-[#1a1a1a] text-white rounded-xl text-sm font-bold"
                >
                  Next Order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cash Session Open Modal */}
      {showCashOpen && (
        <Dialog
          label="Billing Payments details"
          onClose={() => setShowCashOpen(false)}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-4">Open Cash Session</h3>
            <input
              aria-label="Opening cash float"
              type="number"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              placeholder="Opening cash float"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCashOpen(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600"
              >
                Cancel
              </button>
              <Can perm="payment:create">
                <button
                  onClick={() =>
                    openCashSession
                      .mutateAsync({
                        openingFloat: parseFloat(openingFloat) || 0,
                      })
                      .then(() => setShowCashOpen(false))
                  }
                  disabled={openCashSession.isPending}
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  Open
                </button>
              </Can>
            </div>
          </div>
        </Dialog>
      )}

      {/* Cash Session Close Modal */}
      {showCashClose && cashSession && (
        <Dialog
          label="Billing Payments details"
          onClose={() => setShowCashClose(false)}
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-1">Close Cash Session</h3>
            <p className="text-xs text-gray-500 mb-4">
              Expected cash: {fmt(cashSession.expectedCash ?? 0)}
            </p>
            <input
              aria-label="Actual cash counted"
              type="number"
              value={actualCash}
              onChange={(e) => setActualCash(e.target.value)}
              placeholder="Actual cash counted"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowCashClose(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600"
              >
                Cancel
              </button>
              <Can perm="payment:create">
                <button
                  onClick={() =>
                    closeCashSession
                      .mutateAsync({
                        id: cashSession._id,
                        actualCash: parseFloat(actualCash) || 0,
                      })
                      .then(() => setShowCashClose(false))
                  }
                  disabled={closeCashSession.isPending}
                  className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold disabled:opacity-50"
                >
                  Close Session
                </button>
              </Can>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
