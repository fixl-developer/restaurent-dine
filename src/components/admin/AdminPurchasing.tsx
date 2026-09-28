import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { financialRequest } from "@/lib/financialRequest";
import { useInventory } from "@/hooks/useInventory";
import { useAuthStore } from "@/stores/auth.store";
type Supplier = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  isActive: boolean;
};
type PO = {
  _id: string;
  number: string;
  supplierName: string;
  currency: string;
  status: string;
  notes?: string;
  cancellationReason?: string;
  items: {
    _id: string;
    name: string;
    unit: string;
    quantity: number;
    received: number;
    unitCost: number;
  }[];
};
const field = "block w-full border rounded-lg p-2 mt-1 bg-white";
const money = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
function PurchaseCard({ order, refresh }: { order: PO; refresh: () => void }) {
  const has = useAuthStore((s) => s.hasPermission);
  const [receiving, setReceiving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState(false);
  const receipts = useQuery({
    queryKey: ["purchase-receipts", order._id],
    queryFn: () =>
      api.get<
        {
          _id: string;
          createdAt: string;
          supplierInvoice?: string;
          items: { quantity: number }[];
        }[]
      >(`/purchasing/orders/${order._id}/receipts`),
    enabled: history,
  });
  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch(`/purchasing/orders/${order._id}`, body),
    onSuccess: () => {
      refresh();
      setCancelling(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const receive = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      financialRequest(`/purchasing/orders/${order._id}/receive`, body),
    onSuccess: () => {
      refresh();
      setReceiving(false);
      receipts.refetch();
      toast.success("Delivery received and stock updated");
    },
    onError: (e) => toast.error(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const items = order.items
      .map((l) => ({ lineId: l._id, quantity: Number(data.get(l._id)) }))
      .filter((l) => l.quantity > 0);
    if (!items.length) {
      toast.error("Enter at least one delivered quantity");
      return;
    }
    receive.mutate({
      items,
      supplierInvoice: String(data.get("reference")).trim() || undefined,
      notes: String(data.get("notes")).trim() || undefined,
    });
  }
  const total = order.items.reduce(
    (sum, l) => sum + l.quantity * l.unitCost,
    0,
  );
  const received = order.items.reduce(
    (sum, l) => sum + l.received * l.unitCost,
    0,
  );
  return (
    <article className="bg-white border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <p className="text-xs text-[#086874] font-bold">{order.number}</p>
          <h2 className="font-bold text-lg mt-1">{order.supplierName}</h2>
          <p className="text-sm mt-1">
            {money(total, order.currency)} ordered ·{" "}
            {money(received, order.currency)} received
          </p>
        </div>
        <span className="self-start rounded-full bg-[#f9d6df] text-[var(--promise-berry)] text-xs px-3 py-1 capitalize">
          {order.status}
        </span>
      </div>
      <div className="overflow-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Ingredient</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>Unit cost</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((l) => (
              <tr key={l._id} className="border-b">
                <td className="py-2 pr-3">{l.name}</td>
                <td className="pr-3">
                  {l.quantity} {l.unit}
                </td>
                <td className="pr-3">
                  {l.received} {l.unit}
                </td>
                <td>{money(l.unitCost, order.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {order.notes && <p className="text-sm text-gray-600">{order.notes}</p>}
      {order.cancellationReason && (
        <p className="text-sm">
          Remaining quantities cancelled: {order.cancellationReason}
        </p>
      )}
      <div className="flex flex-wrap gap-2 text-sm">
        {order.status === "draft" && has("inventory:update") && (
          <button
            disabled={update.isPending}
            className="border rounded-lg p-2"
            onClick={() => update.mutate({ status: "ordered" })}
          >
            Supplier contacted · mark ordered
          </button>
        )}
        {["ordered", "partial"].includes(order.status) &&
          has("inventory:stockin") && (
            <button
              className="bg-[#086874] text-white rounded-lg p-2"
              onClick={() => setReceiving(!receiving)}
            >
              Receive delivery
            </button>
          )}
        {["draft", "ordered", "partial"].includes(order.status) &&
          has("inventory:update") && (
            <button
              className="border rounded-lg p-2"
              onClick={() => setCancelling(!cancelling)}
            >
              Cancel remaining
            </button>
          )}
        <button className="underline px-2" onClick={() => setHistory(!history)}>
          Receipt history
        </button>
      </div>
      {cancelling && (
        <div className="border rounded-xl p-4">
          <label className="text-sm">
            Reason
            <input
              className={field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </label>
          <p className="text-xs mt-2">
            Already received stock stays in inventory.
          </p>
          <button
            className="border rounded-lg p-2 mt-3"
            disabled={!reason.trim() || update.isPending}
            onClick={() => update.mutate({ status: "cancelled", reason })}
          >
            Confirm cancellation
          </button>
        </div>
      )}
      {receiving && (
        <form
          onSubmit={submit}
          className="bg-[#fff8ef] rounded-xl p-4 space-y-3"
        >
          <h3 className="font-bold">Quantities delivered now</h3>
          {order.items
            .filter((l) => l.received < l.quantity)
            .map((l) => (
              <label key={l._id} className="block text-sm">
                {l.name} · {Math.round((l.quantity - l.received) * 1000) / 1000}{" "}
                {l.unit} remaining
                <input
                  className={field}
                  type="number"
                  name={l._id}
                  min={0}
                  max={Math.round((l.quantity - l.received) * 1000) / 1000}
                  step="0.001"
                  defaultValue={0}
                />
              </label>
            ))}
          <label className="block text-sm">
            Supplier invoice / delivery reference
            <input className={field} name="reference" maxLength={100} />
          </label>
          <label className="block text-sm">
            Delivery notes
            <textarea className={field} name="notes" maxLength={1000} />
          </label>
          <button
            className="bg-[var(--promise-berry)] text-white rounded-lg p-3 disabled:opacity-50"
            disabled={receive.isPending}
          >
            {receive.isPending ? "Receiving…" : "Receive and update stock"}
          </button>
        </form>
      )}
      {history && (
        <div className="text-sm space-y-2">
          {receipts.isLoading && <p>Loading receipts…</p>}
          {receipts.error && <p role="alert">{receipts.error.message}</p>}
          {receipts.data?.length === 0 && <p>No deliveries received.</p>}
          {receipts.data?.map((r) => (
            <p key={r._id}>
              {new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Los_Angeles",
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(r.createdAt))}{" "}
              PT · {r.supplierInvoice ?? "No supplier reference"} ·{" "}
              {r.items.length} line(s)
            </p>
          ))}
        </div>
      )}
    </article>
  );
}
export default function AdminPurchasing() {
  const has = useAuthStore((s) => s.hasPermission);
  const qc = useQueryClient();
  const [view, setView] = useState<"orders" | "suppliers">("orders");
  const [adding, setAdding] = useState(false);
  const [lines, setLines] = useState([{ itemId: "", quantity: 1, cost: 0 }]);
  const suppliers = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => api.get<Supplier[]>("/purchasing/suppliers"),
  });
  const orders = useQuery({
    queryKey: ["purchase-orders"],
    queryFn: () => api.get<PO[]>("/purchasing/orders"),
  });
  const inventory = useInventory({ isActive: true, limit: 200 });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["purchase-orders"] });
    qc.invalidateQueries({ queryKey: ["inventory"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
  };
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/purchasing/${view}`, body),
    onSuccess: () => {
      refresh();
      setAdding(false);
      setLines([{ itemId: "", quantity: 1, cost: 0 }]);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e.message),
  });
  const archive = useMutation({
    mutationFn: (s: Supplier) =>
      api.patch(`/purchasing/suppliers/${s._id}`, { isActive: !s.isActive }),
    onSuccess: refresh,
    onError: (e) => toast.error(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    if (view === "suppliers")
      create.mutate({
        name: String(data.get("name")),
        email: String(data.get("email")).trim() || undefined,
        phone: String(data.get("phone")).trim() || undefined,
        address: String(data.get("address")).trim() || undefined,
      });
    else
      create.mutate({
        supplierId: String(data.get("supplier")),
        notes: String(data.get("notes")).trim() || undefined,
        items: lines.map((l) => ({
          inventoryItemId: l.itemId,
          quantity: l.quantity,
          unitCost: l.cost,
        })),
      });
  }
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap gap-4 justify-between">
        <div>
          <h1 className="text-2xl font-bold">Purchasing & suppliers</h1>
          <p className="text-sm text-gray-600 mt-2">
            Record supplier orders, receive partial deliveries and keep
            ingredient stock current.
          </p>
        </div>
        {has("inventory:create") && (
          <button
            onClick={() => setAdding(!adding)}
            className="bg-[var(--promise-berry)] text-white rounded-xl p-3"
          >
            {adding
              ? "Close form"
              : view === "orders"
                ? "New purchase order"
                : "Add supplier"}
          </button>
        )}
      </header>
      <div className="flex gap-3">
        {(["orders", "suppliers"] as const).map((v) => (
          <button
            key={v}
            className={`border rounded-full px-4 py-2 capitalize ${view === v ? "bg-[#f9d6df]" : ""}`}
            onClick={() => {
              setView(v);
              setAdding(false);
            }}
          >
            {v}
          </button>
        ))}
      </div>
      {adding && (
        <form
          onSubmit={submit}
          className="bg-white border rounded-2xl p-5 space-y-4"
        >
          {view === "suppliers" ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <label>
                Supplier name
                <input
                  className={field}
                  name="name"
                  required
                  minLength={2}
                  maxLength={120}
                />
              </label>
              <label>
                Email
                <input className={field} name="email" type="email" />
              </label>
              <label>
                Phone
                <input className={field} name="phone" maxLength={40} />
              </label>
              <label>
                Address
                <input className={field} name="address" maxLength={500} />
              </label>
            </div>
          ) : (
            <>
              <label>
                Supplier
                <select className={field} name="supplier" required>
                  <option value="">Choose supplier</option>
                  {suppliers.data
                    ?.filter((s) => s.isActive)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-xs text-gray-600">
                Quantities and costs use each ingredient’s stock unit. This
                records the order; contact the supplier separately.
              </p>
              {lines.map((l, i) => (
                <div key={i} className="grid sm:grid-cols-4 gap-3">
                  <label>
                    Ingredient
                    <select
                      required
                      className={field}
                      value={l.itemId}
                      onChange={(e) =>
                        setLines(
                          lines.map((line, j) =>
                            j === i
                              ? { ...line, itemId: e.target.value }
                              : line,
                          ),
                        )
                      }
                    >
                      <option value="">Choose ingredient</option>
                      {inventory.data?.items.map((it) => (
                        <option key={it._id} value={it._id}>
                          {it.name} ({it.unit})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Quantity
                    <input
                      required
                      className={field}
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={l.quantity}
                      onChange={(e) =>
                        setLines(
                          lines.map((line, j) =>
                            j === i
                              ? { ...line, quantity: Number(e.target.value) }
                              : line,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Cost per stock unit
                    <input
                      required
                      className={field}
                      type="number"
                      min={0}
                      step="0.001"
                      value={l.cost}
                      onChange={(e) =>
                        setLines(
                          lines.map((line, j) =>
                            j === i
                              ? { ...line, cost: Number(e.target.value) }
                              : line,
                          ),
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={lines.length === 1}
                    className="self-end border rounded-lg p-2 disabled:opacity-30"
                    onClick={() => setLines(lines.filter((_, j) => i !== j))}
                  >
                    Remove line
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="underline"
                onClick={() =>
                  setLines([...lines, { itemId: "", quantity: 1, cost: 0 }])
                }
              >
                Add ingredient
              </button>
              <label className="block">
                Notes
                <textarea name="notes" className={field} maxLength={1000} />
              </label>
            </>
          )}
          <button
            disabled={create.isPending}
            className="bg-[#086874] text-white rounded-xl p-3 disabled:opacity-50"
          >
            {create.isPending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {(suppliers.error || orders.error || inventory.error) && (
        <p role="alert" className="text-red-700">
          {(suppliers.error || orders.error || inventory.error)?.message}
        </p>
      )}
      {(view === "orders" ? orders.isLoading : suppliers.isLoading) && (
        <p role="status">Loading…</p>
      )}
      {view === "orders" ? (
        <div className="space-y-4">
          {orders.data?.length === 0 && (
            <p className="bg-white border rounded-2xl p-8 text-gray-600">
              No purchase orders yet. Add a supplier, then record your first
              order.
            </p>
          )}
          {orders.data?.map((o) => (
            <PurchaseCard key={o._id} order={o} refresh={refresh} />
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {suppliers.data?.map((s) => (
            <article key={s._id} className="bg-white border rounded-2xl p-5">
              <h2 className="font-bold">
                {s.name}
                {!s.isActive && " · Archived"}
              </h2>
              <p className="text-sm text-gray-600 mt-2">
                {s.phone} {s.email}
              </p>
              {has("inventory:update") && (
                <button
                  disabled={archive.isPending}
                  className="underline mt-3 text-sm"
                  onClick={() => archive.mutate(s)}
                >
                  {s.isActive ? "Archive supplier" : "Reactivate supplier"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
