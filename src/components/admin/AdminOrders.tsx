import AssistedOrderDialog from "@/components/operations/AssistedOrderDialog";
import ReasonDialog from "@/components/ui/ReasonDialog";
import FlowSteps from "@/components/ui/FlowSteps";
import PageState from "@/components/ui/PageState";
import { Link, useSearchParams } from "react-router-dom";
import { Can } from "@/components/auth/Can";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  X,
  Clock,
  User,
  Phone,
  FileText,
  CheckCircle,
  Circle,
  Loader2,
  Bell,
  ScanLine,
  Ban,
} from "lucide-react";
import {
  useOrders,
  useOrder,
  useAcceptOrder,
  useServeOrder,
  useCancelOrder,
  useVoidOrderItem,
  useWindowTokenScan,
  useResolveGuestRequest,
} from "@/hooks/useOrders";
import { useSocket } from "@/hooks/useSocket";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import {
  ORDER_CHANNEL_LABELS,
  ORDER_STATUS_LABELS,
  type OrderChannel,
  type OrderStatus,
} from "@/lib/dto/orders";

const STATUS_STYLES: Record<OrderStatus, string> = {
  placed: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-200",
  preparing: "bg-amber-50 text-amber-700 border-amber-200",
  ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
  served: "bg-gray-50 text-gray-600 border-gray-200",
  settled: "bg-violet-50 text-violet-700 border-violet-200",
  cancelled: "bg-red-50 text-red-600 border-red-200",
};

const CHANNEL_STYLES: Record<OrderChannel, string> = {
  dine_in: "bg-violet-50 text-violet-700",
  window: "bg-blue-50 text-blue-700",
  assisted: "bg-orange-50 text-orange-700",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
}

export default function AdminOrders() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("order");
  const tableId = params.get("table") ?? undefined;
  const setSelectedId = (id: string | null) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set("order", id);
        else next.delete("order");
        return next;
      },
      { replace: true },
    );
  const [reasonAction, setReasonAction] = useState<{
    orderId: string;
    itemId?: string;
    label: string;
  } | null>(null);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();
  const fmt = useCurrencyFormatter();

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [channelFilter, setChannelFilter] = useState<OrderChannel | "All">(
    "All",
  );
  const [search, setSearch] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  useEffect(
    () => setPageNumber(1),
    [search, statusFilter, channelFilter, tableId],
  );
  const [tokenInput, setTokenInput] = useState("");

  const ordersQuery = useOrders({
    status: statusFilter === "All" ? undefined : statusFilter,
    channel: channelFilter === "All" ? undefined : channelFilter,
    limit: 25,
    page: pageNumber,
    q: search.trim() || undefined,
    tableId,
  });
  const { data: page, isLoading } = ordersQuery;
  const orders = page?.items ?? [];

  // Detail view — re-fetched for full freshness when clicked
  const selectedQuery = useOrder(selectedId);
  const selected = selectedQuery.data;

  const accept = useAcceptOrder();
  const serve = useServeOrder();
  const cancel = useCancelOrder();
  const voidItem = useVoidOrderItem();
  const tokenScan = useWindowTokenScan();
  const resolveRequest = useResolveGuestRequest();

  // Auto-select first order once loaded
  useEffect(() => {
    if (!selectedId && orders.length > 0) {
      setSelectedId(orders[0]._id);
    }
  }, [orders, selectedId]);

  // Real-time refresh
  useSocket("/staff", {
    "order:new": () => qc.invalidateQueries({ queryKey: ["orders"] }),
    "order:updated": () => qc.invalidateQueries({ queryKey: ["orders"] }),
    "order:status_changed": () =>
      qc.invalidateQueries({ queryKey: ["orders"] }),
    "order:item_status_changed": () =>
      qc.invalidateQueries({ queryKey: ["orders"] }),
    "order:guest_request": () => qc.invalidateQueries({ queryKey: ["orders"] }),
    "order:settled": () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  // Client-side search filter (since backend doesn't search order#)
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        (o.guestName ?? "").toLowerCase().includes(q) ||
        (o.guestPhone ?? "").toLowerCase().includes(q) ||
        (o.windowToken ?? "").toLowerCase().includes(q),
    );
  }, [orders, search]);

  function handleNextStep() {
    if (!selected) return;
    if (selected.status === "placed") accept.mutate(selected._id);
    else if (selected.status === "ready") {
      if (selected.channel === "window" && selected.windowToken)
        tokenScan.mutate(selected.windowToken);
      else serve.mutate(selected._id);
    }
    // 'accepted' → 'preparing' → 'ready' happens via KDS item transitions
  }

  function handleCancel() {
    if (!selected) return;
    setReasonAction({ orderId: selected._id, label: selected.orderNumber });
  }

  function handleVoid(itemId: string) {
    if (!selected) return;
    setReasonAction({
      orderId: selected._id,
      itemId,
      label: selected.items.find((item) => item._id === itemId)?.name ?? "item",
    });
  }

  function handleTokenScan() {
    if (!tokenInput.trim()) return;
    tokenScan.mutate(tokenInput.trim().toUpperCase(), {
      onSuccess: () => setTokenInput(""),
    });
  }

  if (ordersQuery.isError && !page)
    return (
      <PageState
        kind="error"
        title="Orders couldn’t load"
        description="Your order list is unavailable. Retry to see the current service queue."
        action={
          <button className="ui-button" onClick={() => ordersQuery.refetch()}>
            Retry orders
          </button>
        }
      />
    );
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading orders…
      </div>
    );
  }

  return (
    <div className="module-layout module-orders">
      {reasonAction && (
        <ReasonDialog
          title={
            reasonAction.itemId
              ? `Void ${reasonAction.label}?`
              : `Cancel ${reasonAction.label}?`
          }
          description="The reason will be recorded in the order history. Billed or paid orders may require financial resolution first."
          confirmLabel={reasonAction.itemId ? "Void item" : "Cancel order"}
          onClose={() => setReasonAction(null)}
          onConfirm={(reason) =>
            reasonAction.itemId
              ? voidItem.mutateAsync({
                  orderId: reasonAction.orderId,
                  itemId: reasonAction.itemId,
                  reason,
                })
              : cancel.mutateAsync({ id: reasonAction.orderId, reason })
          }
        />
      )}
      {/* ── Order List ─────────────────────────────────────────────────── */}
      <div className="w-[380px] shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {tableId && (
          <div className="p-3 bg-[#edf6f3] text-sm flex flex-wrap gap-3">
            <Link to={`/table-ops?table=${tableId}`} className="underline">
              Back to this table
            </Link>
            <button className="underline" onClick={() => setParams({})}>
              Show all tables
            </button>
          </div>
        )}
        <div className="px-4 py-2.5 border-b border-gray-100 space-y-2">
          <div className="flex items-center gap-2">
            <Can perm="order:create">
              <button
                className="ui-button ui-button-primary shrink-0"
                onClick={() => setCreating(true)}
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </Can>
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
              <input
                aria-label="Search order #, phone, token…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order #, phone, token…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-brand-400 bg-gray-50"
              />
            </div>
          </div>

          {/* Filters — dropdowns + inline token scan keep the panel compact */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as OrderStatus | "All")
              }
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:border-brand-400 cursor-pointer"
            >
              <option value="All">All statuses</option>
              {(
                [
                  "placed",
                  "accepted",
                  "preparing",
                  "ready",
                  "served",
                  "settled",
                  "cancelled",
                ] as const
              ).map((s) => (
                <option key={s} value={s}>
                  {ORDER_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by channel"
              value={channelFilter}
              onChange={(e) =>
                setChannelFilter(e.target.value as OrderChannel | "All")
              }
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-gray-50 text-gray-700 focus:outline-none focus:border-brand-400 cursor-pointer"
            >
              <option value="All">All channels</option>
              {(["dine_in", "window", "assisted"] as const).map((c) => (
                <option key={c} value={c}>
                  {ORDER_CHANNEL_LABELS[c]}
                </option>
              ))}
            </select>
            {/* Window token scan — compact, inline */}
            <div className="relative flex-1 min-w-[130px]">
              <ScanLine className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2" />
              <input
                aria-label="Window token (T-001)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleTokenScan()}
                placeholder="Scan token…"
                className="w-full text-xs border border-gray-200 rounded-lg pl-7 pr-12 py-1.5 focus:outline-none focus:border-brand-400 uppercase"
              />
              <Can perm="order:accept">
                <button
                  onClick={handleTokenScan}
                  disabled={tokenScan.isPending || !tokenInput.trim()}
                  className="absolute right-1 top-1 text-[11px] px-2 py-1 bg-[var(--promise-berry)] text-white rounded-md hover:bg-[var(--promise-berry-dark)] disabled:bg-brand-200 transition-colors"
                >
                  Scan
                </button>
              </Can>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {filtered.map((order) => (
            <div
              key={order._id}
              onClick={() => setSelectedId(order._id)}
              className={`px-4 py-3.5 cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === order._id ? "bg-brand-50 border-r-2 border-brand-500" : ""}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-900 text-xs font-mono">
                    {order.orderNumber}
                  </span>
                  <span
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${CHANNEL_STYLES[order.channel]}`}
                  >
                    {ORDER_CHANNEL_LABELS[order.channel]}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLES[order.status]}`}
                >
                  {ORDER_STATUS_LABELS[order.status]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-700 font-medium">
                    {order.windowToken ?? (order.tableId ? `Table` : "Counter")}
                  </p>
                  {order.guestName && (
                    <p className="text-[10px] text-gray-500">
                      {order.guestName}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">
                    {fmt(order.totals.grand)}
                  </p>
                  <p className="text-[10px] text-gray-500 flex items-center gap-0.5 justify-end">
                    <Clock className="w-3 h-3" />
                    {fmtTime(order.createdAt)}
                  </p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-1 truncate">
                {order.items
                  .filter((i) => i.status !== "cancelled")
                  .map((i) => `${i.qty}× ${i.name}`)
                  .join(", ")}
              </p>
              {order.guestRequests.filter((r) => !r.resolved).length > 0 && (
                <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  {order.guestRequests.filter((r) => !r.resolved).length} guest
                  request(s)
                </p>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <FileText className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No orders found</p>
            </div>
          )}
        </div>
        {page && (
          <nav
            aria-label="Order pages"
            className="flex gap-3 items-center justify-between p-3 border-t text-xs"
          >
            <button
              className="ui-button"
              disabled={pageNumber <= 1}
              onClick={() => setPageNumber((n) => n - 1)}
            >
              Previous
            </button>
            <span>
              {page.meta.total} results · {pageNumber} / {page.meta.totalPages}
            </span>
            <button
              className="ui-button"
              disabled={pageNumber >= page.meta.totalPages}
              onClick={() => setPageNumber((n) => n + 1)}
            >
              Next
            </button>
          </nav>
        )}
      </div>

      {creating && (
        <AssistedOrderDialog
          onClose={() => setCreating(false)}
          onCreated={(order) => setSelectedId(order._id)}
        />
      )}
      {/* ── Order Detail ──────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 min-w-0 overflow-y-auto bg-gray-50">
          <div className="max-w-2xl mx-auto p-6 space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-5">
              {selected.status !== "cancelled" && (
                <FlowSteps
                  label="Order progress"
                  steps={[
                    "Placed",
                    "Preparing",
                    "Ready",
                    "Handed off",
                    "Settled",
                  ]}
                  current={
                    {
                      placed: 0,
                      accepted: 1,
                      preparing: 1,
                      ready: 2,
                      served: 3,
                      settled: 4,
                    }[selected.status]
                  }
                />
              )}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h2 className="text-lg font-bold text-gray-900 font-mono">
                      {selected.orderNumber}
                    </h2>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_STYLES[selected.status]}`}
                    >
                      {ORDER_STATUS_LABELS[selected.status]}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${CHANNEL_STYLES[selected.channel]}`}
                    >
                      {ORDER_CHANNEL_LABELS[selected.channel]}
                    </span>
                    {selected.windowToken && (
                      <span className="text-xs font-mono font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {selected.windowToken}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    {fmtTime(selected.createdAt)} · {ago(selected.createdAt)} ·
                    est. {selected.estimatedPrepMinutes}m prep
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                {selected.status !== "cancelled" && (
                  <Can perm="billing:read">
                    <Link
                      className="ui-button"
                      to={`/billing-ops?order=${selected._id}`}
                    >
                      Open bill & payments
                    </Link>
                  </Can>
                )}
                <Can perm="kds:read">
                  <Link className="ui-button" to="/kds">
                    Open kitchen
                  </Link>
                </Can>
                {selected.tableId && (
                  <Can perm="table:read">
                    <Link
                      className="ui-button"
                      to={`/table-ops?table=${selected.tableId}`}
                    >
                      Return to table
                    </Link>
                  </Can>
                )}
              </div>
              {!["served", "settled", "cancelled"].includes(
                selected.status,
              ) && (
                <div className="flex gap-3">
                  {selected.status === "placed" && (
                    <Can perm="order:accept">
                      <button
                        onClick={handleNextStep}
                        disabled={accept.isPending}
                        className="flex-1 py-2.5 bg-[var(--promise-berry)] text-white rounded-xl text-sm font-medium hover:bg-[var(--promise-berry-dark)] disabled:bg-brand-200 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {accept.isPending && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        → Accept Order
                      </button>
                    </Can>
                  )}
                  {selected.status === "ready" && !selected.deliveryId && (
                    <Can perm="order:accept">
                      <button
                        onClick={handleNextStep}
                        disabled={serve.isPending || tokenScan.isPending}
                        className="flex-1 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium hover:bg-emerald-600 disabled:bg-emerald-300 transition-colors inline-flex items-center justify-center gap-2"
                      >
                        {serve.isPending && (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        )}
                        {selected.channel === "window"
                          ? "Confirm pickup"
                          : "Mark served"}
                      </button>
                    </Can>
                  )}
                  {selected.deliveryId && (
                    <Can perm="delivery:read">
                      <Link className="ui-button" to="/admin/delivery">
                        Manage delivery handoff
                      </Link>
                    </Can>
                  )}
                  {(selected.status === "accepted" ||
                    selected.status === "preparing") && (
                    <div className="flex-1 text-center py-2.5 text-xs text-gray-500 border border-dashed border-gray-200 rounded-xl">
                      Kitchen transitions items via KDS
                    </div>
                  )}
                  <Can perm="order:cancel">
                    <button
                      onClick={handleCancel}
                      disabled={cancel.isPending}
                      className="px-4 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                      <Ban className="w-4 h-4 inline mr-1" />
                      Cancel
                    </button>
                  </Can>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Order Items
                </h3>
                <span className="text-xs text-gray-500">
                  {selected.items
                    .filter((i) => i.status !== "cancelled")
                    .reduce((s, i) => s + i.qty, 0)}{" "}
                  items
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {selected.items.map((item) => (
                  <div
                    key={item._id}
                    className={`flex items-center justify-between px-5 py-3 ${item.status === "cancelled" ? "opacity-40" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium text-gray-800 ${item.status === "cancelled" ? "line-through" : ""}`}
                      >
                        {item.name}
                        {item.variantName && (
                          <span className="text-gray-500 font-normal">
                            {" "}
                            · {item.variantName}
                          </span>
                        )}
                      </p>
                      {item.modifiers.length > 0 && (
                        <p className="text-xs text-gray-500">
                          {item.modifiers.map((m) => m.modifierName).join(", ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-xs text-amber-700 italic mt-0.5">
                          ↳ {item.notes}
                        </p>
                      )}
                      {item.voidReason && (
                        <p className="text-xs text-red-500 italic mt-0.5">
                          Voided: {item.voidReason}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                        {item.status}
                      </span>
                      <span className="text-xs text-gray-500">
                        × {item.qty}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {fmt(item.lineTotal)}
                      </span>
                      {!["served", "cancelled"].includes(item.status) &&
                        !["served", "settled", "cancelled"].includes(
                          selected.status,
                        ) && (
                          <Can perm="order:void">
                            <button
                              onClick={() => handleVoid(item._id)}
                              title="Void this item"
                              className="text-gray-300 hover:text-red-500"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </Can>
                        )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Subtotal</span>
                  <span>{fmt(selected.totals.subtotal)}</span>
                </div>
                {selected.totals.modifierTotal > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Modifiers</span>
                    <span>{fmt(selected.totals.modifierTotal)}</span>
                  </div>
                )}
                {selected.totals.discount > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Discount</span>
                    <span>− {fmt(selected.totals.discount)}</span>
                  </div>
                )}
                {selected.totals.serviceCharge > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Service Charge</span>
                    <span>{fmt(selected.totals.serviceCharge)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tax</span>
                  <span>{fmt(selected.totals.tax)}</span>
                </div>
                {selected.totals.roundOff !== 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Round-off</span>
                    <span>{fmt(selected.totals.roundOff)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>Total</span>
                  <span>{fmt(selected.totals.grand)}</span>
                </div>
              </div>
            </div>

            {/* Guest Requests */}
            {selected.guestRequests.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <h3 className="font-semibold text-gray-900 text-sm mb-3">
                  Guest Requests
                </h3>
                <div className="space-y-2">
                  {selected.guestRequests.map((r) => (
                    <div
                      key={r._id}
                      className={`flex items-start justify-between gap-3 p-3 rounded-xl ${r.resolved ? "bg-gray-50 opacity-60" : "bg-amber-50 border border-amber-200"}`}
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800 capitalize">
                          {r.type.replace("_", " ")}
                        </p>
                        {r.message && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {r.message}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {fmtTime(r.at)}
                        </p>
                      </div>
                      {!r.resolved ? (
                        <Can perm="order:accept">
                          <button
                            onClick={() =>
                              resolveRequest.mutate({
                                orderId: selected._id,
                                requestId: r._id,
                              })
                            }
                            className="text-xs px-3 py-1.5 bg-[var(--promise-berry)] text-white rounded-lg hover:bg-[var(--promise-berry-dark)]"
                          >
                            Resolve
                          </button>
                        </Can>
                      ) : (
                        <span className="text-xs text-emerald-600 font-medium">
                          ✓ Resolved
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Timeline */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-5">
              <h3 className="font-semibold text-gray-900 text-sm mb-4">
                Order Timeline
              </h3>
              <div className="space-y-3">
                {selected.timeline.map((t) => (
                  <div key={t._id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 bg-emerald-50 border-emerald-500">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-gray-900 capitalize">
                        {t.status.replace("_", " ")}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fmtTime(t.at)}
                        {t.byName && ` · ${t.byName}`}
                        {t.note && ` — ${t.note}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer + Payment */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  Customer
                </h3>
                {selected.guestName || selected.guestPhone ? (
                  <div className="space-y-2 text-sm text-gray-600">
                    {selected.guestName && (
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        {selected.guestName}
                      </div>
                    )}
                    {selected.guestPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        {selected.guestPhone}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Walk-in / anonymous</p>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 space-y-3">
                <h3 className="font-semibold text-gray-900 text-sm">Payment</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Status</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selected.paymentStatus === "paid"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : selected.paymentStatus === "partial"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                      }`}
                    >
                      {selected.paymentStatus.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                    <span className="text-xs text-gray-500">Grand Total</span>
                    <span className="text-sm font-bold text-gray-900">
                      {fmt(selected.totals.grand)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {selected.guestNotes && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
                <h3 className="font-semibold text-amber-800 text-sm mb-1">
                  Guest Notes
                </h3>
                <p className="text-sm text-amber-700">{selected.guestNotes}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-center">
          <PageState
            kind={
              selectedQuery.isError
                ? "error"
                : selectedId && selectedQuery.isLoading
                  ? "loading"
                  : "empty"
            }
            title={
              selectedQuery.isError
                ? "Order details unavailable"
                : selectedId && selectedQuery.isLoading
                  ? "Opening order…"
                  : "Choose an order"
            }
            description={
              selectedQuery.isError
                ? "Retry or choose another order from the list."
                : "Order items, guest requests and next actions appear here."
            }
            action={
              selectedQuery.isError ? (
                <button
                  className="ui-button"
                  onClick={() => selectedQuery.refetch()}
                >
                  Retry details
                </button>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
