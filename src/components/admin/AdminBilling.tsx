import Dialog from "@/components/ui/Dialog";
import ReasonDialog from "@/components/ui/ReasonDialog";
import { Can } from "@/components/auth/Can";
import InvoiceControls from "@/components/billing/InvoiceControls";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Smartphone,
  Wallet,
  Banknote,
  Percent,
  Split,
  CheckCircle,
  Printer,
  Clock,
  Loader2,
  Receipt,
  Download,
  Users,
  Ban,
} from "lucide-react";
import { useOrders } from "@/hooks/useOrders";
import {
  useGenerateInvoice,
  useRecordPayment,
  useSplitInvoice,
  useVoidInvoice,
  useClearInvoicePromotions,
  downloadInvoicePdf,
  openInvoicePdf,
  usePayments,
  useInvoice,
  useCurrentCashSession,
  useOpenCashSession,
  useCloseCashSession,
} from "@/hooks/useBilling";
import { useSocket } from "@/hooks/useSocket";
import type { OrderDto } from "@/lib/dto/orders";
import {
  type InvoiceDto,
  type PaymentMode,
  PAYMENT_MODE_LABELS,
} from "@/lib/dto/billing";

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

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

export default function AdminBilling() {
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const fmt = useCurrencyFormatter();
  const qc = useQueryClient();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const [splitId, setSplitId] = useState("");

  // Orders ready to bill — anything past 'ready' that isn't settled / cancelled
  const { data: ordersPage } = useOrders({ limit: 100 });
  const billableOrders = (ordersPage?.items ?? []).filter(
    (o) => !["settled", "cancelled"].includes(o.status),
  );

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const { data: liveInvoice } = useInvoice(invoiceId);

  // Promotion / customer inputs
  const [discount, setDiscount] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [loyaltyPoints, setLoyaltyPoints] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Payment inputs
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [payAmount, setPayAmount] = useState<number>(0);
  const [cashTendered, setCashTendered] = useState<string>("");
  const [txnRef, setTxnRef] = useState("");

  // Split UI
  const [splitMode, setSplitMode] = useState<"none" | "equal">("none");
  const [splitCount, setSplitCount] = useState(2);

  const generateMutation = useGenerateInvoice();
  const recordMutation = useRecordPayment();

  const splitMutation = useSplitInvoice();
  const voidMutation = useVoidInvoice();
  const clearPromotions = useClearInvoicePromotions();

  // Payment history (today's payments globally)
  const { data: paymentsPage } = usePayments({ status: "success", limit: 50 });
  const payments = paymentsPage?.items ?? [];

  // Live updates
  useSocket("/staff", {
    "order:settled": () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
    },
  });

  const selectedOrder = useMemo(
    () => billableOrders.find((o) => o._id === selectedOrderId) ?? null,
    [billableOrders, selectedOrderId],
  );

  // Auto-select first billable order
  useEffect(() => {
    if (!selectedOrderId && billableOrders.length > 0) {
      setSelectedOrderId(billableOrders[0]._id);
    }
  }, [billableOrders, selectedOrderId]);

  // When invoice loads, default the pay amount to the due
  useEffect(() => {
    if (liveInvoice) setPayAmount(liveInvoice.amountDue);
  }, [liveInvoice]);

  // When the user picks a different order, clear the invoice
  useEffect(() => {
    setInvoiceId(null);
    setDiscount("");
    setCouponCode("");
    setLoyaltyPoints("");
    setCustomerName("");
    setCustomerPhone("");
    setSplitMode("none");
    setSplitId("");
  }, [selectedOrderId]);

  function handleGenerate() {
    if (!selectedOrder) return;
    const points = parseInt(loyaltyPoints, 10);
    const disc = parseFloat(discount);
    generateMutation.mutate(
      {
        orderId: selectedOrder._id,
        input: {
          discount: Number.isFinite(disc) && disc > 0 ? disc : undefined,
          couponCode: couponCode.trim() || undefined,
          loyaltyPoints:
            Number.isFinite(points) && points > 0 ? points : undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
        },
      },
      { onSuccess: (inv) => setInvoiceId(inv._id) },
    );
  }

  function handleRecord() {
    if (!liveInvoice || payAmount <= 0) return;
    recordMutation.mutate(
      {
        invoiceId: liveInvoice._id,
        input: {
          mode,
          splitId: splitId || undefined,
          amount: payAmount,
          cashTendered:
            mode === "cash" && cashTendered ? Number(cashTendered) : undefined,
          txnRef: txnRef.trim() || undefined,
        },
      },
      {
        onSuccess: () => {
          setCashTendered("");
          setTxnRef("");
        },
      },
    );
  }

  useEffect(() => {
    if (!liveInvoice) return;
    const next =
      liveInvoice.splits.find(
        (s) => s._id === splitId && s.status !== "paid",
      ) ?? liveInvoice.splits.find((s) => s.status !== "paid");
    setSplitId(next?._id ?? "");
    if (next)
      setPayAmount(Math.round((next.amount - next.paidAmount) * 100) / 100);
  }, [liveInvoice, splitId]);

  function handleSplit() {
    if (!liveInvoice) return;
    splitMutation.mutate({
      id: liveInvoice._id,
      mode: "equal",
      equalCount: splitCount,
    });
  }

  function handleVoid() {
    if (!liveInvoice) return;
    setVoidingId(liveInvoice._id);
  }

  return (
    <div className="space-y-6">
      {voidingId && (
        <ReasonDialog
          title="Void this invoice?"
          description="Enter the reason for the audit record. Invoices with payments must be resolved through the refund workflow first."
          confirmLabel="Void invoice"
          onClose={() => setVoidingId(null)}
          onConfirm={(reason) =>
            voidMutation.mutateAsync({ id: voidingId, reason })
          }
        />
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Billing & Payments
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate invoices, collect payments, and view history
          </p>
        </div>
        <CashSessionWidget />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ── Left: Order Selector ───────────────────────────── */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 text-sm">
              Orders Ready to Bill
            </h3>
            <p className="text-xs text-gray-500">
              {billableOrders.length} open
            </p>
          </div>
          <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
            {billableOrders.map((o) => (
              <OrderRow
                key={o._id}
                order={o}
                selected={selectedOrderId === o._id}
                onSelect={() => setSelectedOrderId(o._id)}
              />
            ))}
            {billableOrders.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500">No bills to collect</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Center: Invoice Preview ───────────────────────────── */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Invoice Preview</h3>
              {selectedOrder && (
                <p className="text-xs text-gray-500">
                  Order {selectedOrder.orderNumber} ·{" "}
                  {fmtTime(selectedOrder.createdAt)}
                </p>
              )}
            </div>
            {liveInvoice && (
              <div className="flex gap-2">
                <button
                  onClick={() => openInvoicePdf(liveInvoice._id)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Open PDF
                </button>
                <button
                  onClick={() =>
                    downloadInvoicePdf(
                      liveInvoice._id,
                      liveInvoice.invoiceNumber,
                    )
                  }
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              </div>
            )}
          </div>

          {!selectedOrder ? (
            <div className="flex-1 flex items-center justify-center text-center py-16">
              <div>
                <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  Pick an order to start billing
                </p>
              </div>
            </div>
          ) : !liveInvoice ? (
            <OrderPreview order={selectedOrder} />
          ) : (
            <InvoiceView invoice={liveInvoice} onVoid={handleVoid} />
          )}
        </div>

        {/* ── Right: Promo + Payment Panel ───────────────────────────── */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Promotions / customer info — only before invoice */}
          {selectedOrder && !liveInvoice && (
            <>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-gray-500" /> Promotions
                </h3>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Discount amount
                    </label>
                    <input
                      aria-label="0"
                      type="number"
                      disabled={!hasPermission("billing:discount")}
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0"
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Coupon Code
                    </label>
                    <input
                      aria-label="WELCOME100"
                      disabled={!hasPermission("discount:apply")}
                      value={couponCode}
                      onChange={(e) =>
                        setCouponCode(e.target.value.toUpperCase())
                      }
                      placeholder="WELCOME100"
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm uppercase focus:outline-none focus:border-brand-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Loyalty points
                    </label>
                    <input
                      aria-label="0"
                      type="number"
                      value={loyaltyPoints}
                      onChange={(e) => setLoyaltyPoints(e.target.value)}
                      placeholder="0"
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-500" /> Customer
                  (optional)
                </h3>
                <div className="space-y-2">
                  <input
                    aria-label="Customer name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                  <input
                    aria-label="+13105550123"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="+13105550123"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                </div>
              </div>
              <Can perm="billing:create">
                <button
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full py-4 bg-[var(--promise-berry)] text-white rounded-2xl text-base font-bold hover:bg-[var(--promise-berry-dark)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Receipt className="w-5 h-5" />
                  )}
                  Generate Invoice
                </button>
              </Can>
            </>
          )}

          {/* Split + Payment — only after invoice exists */}
          {liveInvoice && liveInvoice.paymentStatus !== "paid" && (
            <>
              <InvoiceControls key={liveInvoice._id} invoice={liveInvoice} />
              {(liveInvoice.promotions || liveInvoice.discount > 0) && (
                <Can perm="billing:discount">
                  <button
                    onClick={() => clearPromotions.mutate({ id: liveInvoice._id })}
                    disabled={clearPromotions.isPending}
                    className="w-full py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-brand-400 hover:bg-brand-50 disabled:opacity-50"
                  >
                    {clearPromotions.isPending
                      ? "Clearing…"
                      : "Change / clear promotion"}
                  </button>
                </Can>
              )}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Record Payment
                </h3>
                {liveInvoice.splits.length > 0 && (
                  <label className="text-xs block">
                    Guest split
                    <select
                      className="block w-full border rounded-lg p-2 mt-1"
                      value={splitId}
                      onChange={(e) => setSplitId(e.target.value)}
                    >
                      {liveInvoice.splits
                        .filter((s) => s.status !== "paid")
                        .map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.label} · {fmt(s.amount - s.paidAmount)} due
                          </option>
                        ))}
                    </select>
                  </label>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {(["cash", "card"] as PaymentMode[]).map((m) => {
                    const cfg = METHOD_CONFIG[m];
                    return (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl border-2 transition-all font-medium text-xs ${mode === m ? cfg.color + " border-current" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                      >
                        <cfg.icon className="w-4 h-4" />
                        {m === "card"
                          ? "External card terminal"
                          : PAYMENT_MODE_LABELS[m]}
                      </button>
                    );
                  })}
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                    Amount
                  </label>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                </div>
                {mode === "cash" && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Cash tendered
                    </label>
                    <input
                      aria-label={String(payAmount)}
                      type="number"
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      placeholder={String(payAmount)}
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                    {cashTendered && Number(cashTendered) >= payAmount && (
                      <p className="text-xs text-emerald-600 font-medium mt-1">
                        Change: {fmt(Number(cashTendered) - payAmount)}
                      </p>
                    )}
                  </div>
                )}
                {mode === "card" && (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      Successful terminal transaction reference
                    </label>
                    <input
                      aria-label="Successful terminal receipt reference"
                      value={txnRef}
                      maxLength={120}
                      onChange={(e) => setTxnRef(e.target.value)}
                      placeholder="Successful terminal receipt reference"
                      className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                    />
                  </div>
                )}
                <Can perm="payment:create">
                  <button
                    onClick={handleRecord}
                    disabled={
                      recordMutation.isPending ||
                      payAmount <= 0 ||
                      (mode === "card" && !txnRef.trim())
                    }
                    className="w-full py-3 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-bold hover:bg-[var(--promise-berry-dark)] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                  >
                    {recordMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {mode === "card"
                      ? "Record terminal payment"
                      : "Collect cash"}{" "}
                    · {fmt(payAmount)}
                  </button>
                </Can>
              </div>
            </>
          )}

          {liveInvoice && liveInvoice.paymentStatus === "paid" && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-6 text-center">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="text-base font-bold text-emerald-800">
                Invoice paid in full
              </p>
              <p className="text-xs text-emerald-700 mt-1">
                Order settled · cash drawer updated
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payment history */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Recent Payments</h3>
            <p className="text-xs text-gray-500">
              Latest successful transactions
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-4 h-4" />
            Total:{" "}
            {fmt(
              payments.reduce((s, p) => s + (p.amount - p.refundedAmount), 0),
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  "Payment",
                  "Order",
                  "Method",
                  "Amount",
                  "Cashier",
                  "Time",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map((p) => (
                <tr key={p._id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {p._id.slice(-8)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">
                    {p.orderId.slice(-8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-gray-50 text-gray-700 border-gray-200 capitalize">
                      {p.mode.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-gray-900">
                    {fmt(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs font-mono">
                    {p.cashierId?.slice(-6) ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {p.receivedAt ? fmtTime(p.receivedAt) : "—"}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-gray-500"
                  >
                    No payments yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  selected,
  onSelect,
}: {
  order: OrderDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const fmt = useCurrencyFormatter();
  return (
    <div
      onClick={onSelect}
      className={`px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${selected ? "bg-brand-50 border-r-2 border-brand-500" : ""}`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono font-bold text-gray-900 text-xs">
          {order.orderNumber}
        </span>
        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200 uppercase">
          {order.status}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1">
        <p className="text-xs text-gray-600">
          {order.windowToken ?? (order.tableId ? "Table" : "Counter")}
        </p>
        <p className="text-sm font-bold text-gray-900">
          {fmt(order.totals.grand)}
        </p>
      </div>
    </div>
  );
}

function OrderPreview({ order }: { order: OrderDto }) {
  const fmt = useCurrencyFormatter();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 text-center border-b border-dashed border-gray-100">
        <p className="font-semibold text-gray-900">Order {order.orderNumber}</p>
        <p className="text-xs text-gray-500">Awaiting invoice generation</p>
      </div>
      <div className="px-5 py-3 space-y-0.5">
        <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-right">Rate</span>
          <span className="col-span-2 text-right">Amt</span>
        </div>
        {order.items
          .filter((i) => i.status !== "cancelled")
          .map((item) => (
            <div
              key={item._id}
              className="grid grid-cols-12 text-sm py-1.5 border-b border-gray-50"
            >
              <span className="col-span-6 text-gray-800 font-medium">
                {item.name}
                {item.variantName && (
                  <span className="text-gray-500 font-normal">
                    {" "}
                    · {item.variantName}
                  </span>
                )}
              </span>
              <span className="col-span-2 text-center text-gray-500">
                {item.qty}
              </span>
              <span className="col-span-2 text-right text-gray-500">
                {fmt(item.basePrice)}
              </span>
              <span className="col-span-2 text-right text-gray-800 font-semibold">
                {fmt(item.lineTotal)}
              </span>
            </div>
          ))}
      </div>
      <div className="px-5 py-4 space-y-1.5 border-t border-dashed border-gray-200">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span>{fmt(order.totals.subtotal + order.totals.modifierTotal)}</span>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Tax</span>
          <span>{fmt(order.totals.tax)}</span>
        </div>
        <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
          <span>TOTAL</span>
          <span>{fmt(order.totals.grand)}</span>
        </div>
      </div>
    </div>
  );
}

function InvoiceView({
  invoice,
  onVoid,
}: {
  invoice: InvoiceDto;
  onVoid: () => void;
}) {
  const fmt = useCurrencyFormatter(invoice.currency ?? "INR");
  const r = invoice.restaurantSnapshot;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-5 py-4 text-center border-b border-dashed border-gray-100">
        <p className="font-bold text-gray-900">{r.name}</p>
        {r.address && <p className="text-xs text-gray-500">{r.address}</p>}
        {r.gstin && <p className="text-xs text-gray-500">GSTIN: {r.gstin}</p>}
        {r.fssai && <p className="text-xs text-gray-500">FSSAI: {r.fssai}</p>}
      </div>

      <div className="px-5 py-3 flex justify-between items-center text-xs">
        <div>
          <p className="font-bold font-mono text-gray-800">
            {invoice.invoiceNumber}
          </p>
          <p className="text-gray-500">Order {invoice.orderNumberSnapshot}</p>
          {invoice.tableNumber && (
            <p className="text-gray-500">Table {invoice.tableNumber}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-gray-500">
            {new Date(invoice.issueDate).toLocaleString("en-US", {
              timeZone: invoice.timeZone ?? "Asia/Kolkata",
            })}
          </p>
          <span
            className={`inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              invoice.paymentStatus === "paid"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : invoice.paymentStatus === "partial"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            {invoice.paymentStatus.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="px-5 py-3 space-y-0.5">
        <div className="grid grid-cols-12 text-[10px] font-semibold text-gray-500 uppercase tracking-wider pb-2 border-b border-gray-100">
          <span className="col-span-6">Item</span>
          <span className="col-span-2 text-center">Qty</span>
          <span className="col-span-2 text-right">Rate</span>
          <span className="col-span-2 text-right">Amt</span>
        </div>
        {invoice.lineItems.map((li, i) => (
          <div
            key={i}
            className="grid grid-cols-12 text-sm py-1.5 border-b border-gray-50"
          >
            <span className="col-span-6 text-gray-800 font-medium">
              {li.name}
              {li.variantName && (
                <span className="text-gray-500 font-normal">
                  {" "}
                  · {li.variantName}
                </span>
              )}
            </span>
            <span className="col-span-2 text-center text-gray-500">
              {li.qty}
            </span>
            <span className="col-span-2 text-right text-gray-500">
              {fmt(li.unitPrice)}
            </span>
            <span className="col-span-2 text-right text-gray-800 font-semibold">
              {fmt(li.lineTotal)}
            </span>
          </div>
        ))}
      </div>

      <div className="px-5 py-4 space-y-1.5 border-t border-dashed border-gray-200">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal</span>
          <span>{fmt(invoice.subtotal + invoice.modifierTotal)}</span>
        </div>
        {invoice.discount > 0 && (
          <div className="flex justify-between text-xs text-emerald-600 font-medium">
            <span>Discount</span>
            <span>−{fmt(invoice.discount)}</span>
          </div>
        )}
        {invoice.serviceCharge > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Service Charge</span>
            <span>{fmt(invoice.serviceCharge)}</span>
          </div>
        )}
        {invoice.taxBreakup.map((t, i) => (
          <div key={i} className="flex justify-between text-xs text-gray-500">
            <span>
              {t.name} @{t.rate}%
            </span>
            <span>{fmt(t.amount)}</span>
          </div>
        ))}
        {(invoice.tip ?? 0) > 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Tip</span>
            <span>{fmt(invoice.tip ?? 0)}</span>
          </div>
        )}
        {invoice.roundOff !== 0 && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Round-off</span>
            <span>{fmt(invoice.roundOff)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black text-gray-900 pt-2 border-t border-gray-200">
          <span>TOTAL</span>
          <span>{fmt(invoice.grand + (invoice.tip ?? 0))}</span>
        </div>
        <p className="text-[10px] italic text-gray-500 pt-1">
          {invoice.amountInWords}
        </p>
        <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span>Paid</span>
          <span>{fmt(invoice.amountPaid)}</span>
        </div>
        <div className="flex justify-between text-sm font-bold text-brand-700">
          <span>Due</span>
          <span>{fmt(invoice.amountDue)}</span>
        </div>
      </div>

      {invoice.promotions && (
        <div className="mx-5 mb-5 bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs space-y-1">
          {invoice.promotions.discount && (
            <p>
              Discount{" "}
              <span className="font-semibold">
                {invoice.promotions.discount.name}
              </span>{" "}
              — {fmt(invoice.promotions.discount.amount)}
            </p>
          )}
          {invoice.promotions.coupon && (
            <p>
              Coupon{" "}
              <span className="font-mono font-semibold">
                {invoice.promotions.coupon.code}
              </span>{" "}
              — {fmt(invoice.promotions.coupon.amount)}
            </p>
          )}
          {invoice.promotions.loyalty && (
            <p>
              Loyalty{" "}
              <span className="font-semibold">
                {invoice.promotions.loyalty.pointsRedeemed} pts
              </span>{" "}
              — {fmt(invoice.promotions.loyalty.amount)}
            </p>
          )}
        </div>
      )}

      {invoice.status === "final" && invoice.paymentStatus !== "paid" && (
        <div className="mx-5 mb-5">
          <Can perm="billing:settle">
            <button
              onClick={onVoid}
              className="w-full py-2 border border-red-200 text-red-600 rounded-xl text-xs font-medium hover:bg-red-50 transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Ban className="w-3.5 h-3.5" /> Void invoice
            </button>
          </Can>
        </div>
      )}
    </div>
  );
}

function CashSessionWidget() {
  const fmt = useCurrencyFormatter();
  const { data: session } = useCurrentCashSession();
  const openMutation = useOpenCashSession();
  const closeMutation = useCloseCashSession();
  const [openInput, setOpenInput] = useState("2000");
  const [closeInput, setCloseInput] = useState("");
  const [open, setOpen] = useState(false);

  if (!session) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            Cash session
          </p>
          <p className="text-xs font-semibold text-gray-700">Not open</p>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            value={openInput}
            onChange={(e) => setOpenInput(e.target.value)}
            className="w-20 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-brand-400"
          />
          <Can perm="payment:create">
            <button
              onClick={() =>
                openMutation.mutate({ openingFloat: Number(openInput) })
              }
              disabled={openMutation.isPending}
              className="px-3 py-1.5 bg-[var(--promise-berry)] text-white rounded-lg text-xs font-medium hover:bg-[var(--promise-berry-dark)] disabled:opacity-50"
            >
              {openMutation.isPending ? "…" : "Open"}
            </button>
          </Can>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-emerald-200 rounded-2xl px-4 py-3 flex items-center gap-4">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-emerald-600">
          Cash session open
        </p>
        <p className="text-xs text-gray-700">
          Float {fmt(session.openingFloat)} · Expected{" "}
          {fmt(session.expectedCash)}
        </p>
      </div>
      <Can perm="payment:create">
        <button
          onClick={() => setOpen(true)}
          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black"
        >
          Close session
        </button>
      </Can>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40"
            onClick={() => setOpen(false)}
          />
          <Dialog
            label="Billing details"
            onClose={() => setOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-[420px] max-w-[95vw] p-6">
              <h3 className="font-bold text-gray-900 mb-1">
                Close cash session
              </h3>
              <p className="text-xs text-gray-500 mb-4">
                Expected {fmt(session.expectedCash)} based on cash payments
                collected
              </p>
              <label className="text-xs font-semibold text-gray-600 block mb-1">
                Actual cash counted
              </label>
              <input
                aria-label={String(session.expectedCash)}
                type="number"
                autoFocus
                value={closeInput}
                onChange={(e) => setCloseInput(e.target.value)}
                placeholder={String(session.expectedCash)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
              />
              {closeInput && (
                <p
                  className={`mt-2 text-xs font-semibold ${
                    Number(closeInput) === session.expectedCash
                      ? "text-emerald-600"
                      : Number(closeInput) > session.expectedCash
                        ? "text-blue-600"
                        : "text-red-600"
                  }`}
                >
                  Variance: {fmt(Number(closeInput) - session.expectedCash)}
                </p>
              )}
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <Can perm="payment:create">
                  <button
                    onClick={() => {
                      if (!closeInput) return;
                      closeMutation.mutate(
                        { id: session._id, actualCash: Number(closeInput) },
                        {
                          onSuccess: () => {
                            setOpen(false);
                            setCloseInput("");
                          },
                        },
                      );
                    }}
                    disabled={closeMutation.isPending || !closeInput}
                    className="flex-1 py-2.5 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-medium hover:bg-[var(--promise-berry-dark)] disabled:opacity-50"
                  >
                    {closeMutation.isPending ? "Closing…" : "Close session"}
                  </button>
                </Can>
              </div>
            </div>
          </Dialog>
        </>
      )}
    </div>
  );
}
