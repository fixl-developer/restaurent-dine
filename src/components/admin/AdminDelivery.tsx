import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { useOrders } from "@/hooks/useOrders";
import { Link } from "react-router-dom";

type State =
  | "pending"
  | "assigned"
  | "dispatched"
  | "delivered"
  | "failed"
  | "cancelled";
interface Config {
  enabled: boolean;
  postalCodes: string[];
  minimumOrder: number;
  noAdditionalFee: boolean;
  instructions: string;
}
interface Delivery {
  _id: string;
  orderId: string;
  orderNumber: string;
  guestName: string;
  guestPhone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  instructions?: string;
  status: State;
  driverId?: string;
  driverName?: string;
  currency: string;
  total: number;
  events: { status: State; at: string; note?: string }[];
}
interface Driver {
  _id: string;
  name: string;
}
const field =
  "block w-full border border-gray-300 rounded-lg p-2.5 mt-1 bg-white";
const actionClass =
  "rounded-lg px-4 py-2.5 bg-[#086874] text-white disabled:opacity-40";
const labels: Record<State, string> = {
  pending: "Awaiting assignment",
  assigned: "Assigned",
  dispatched: "Out for delivery",
  delivered: "Delivered",
  failed: "Needs attention",
  cancelled: "Switched to pickup",
};

function DeliverySettings({ initial }: { initial: Config }) {
  const [config, setConfig] = useState(initial);
  const [zips, setZips] = useState(initial.postalCodes.join(", "));
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.patch<Config>("/deliveries/config", {
        ...config,
        postalCodes: zips.split(/[\s,]+/).filter(Boolean),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["delivery-config"] });
      qc.invalidateQueries({ queryKey: ["setup-checks"] });
    },
  });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="bg-white border rounded-2xl p-5 space-y-4"
    >
      <h2 className="font-bold text-lg">Service policy</h2>
      <p className="text-sm text-gray-600">
        This board arranges delivery for existing prepaid orders. No delivery
        fee is added. Enable it only if that policy fits your restaurant.
      </p>
      <label className="text-sm block">
        California ZIP codes
        <input
          required={config.enabled}
          className={field}
          placeholder="Enter approved ZIP codes, separated by commas"
          value={zips}
          onChange={(e) => setZips(e.target.value)}
        />
      </label>
      <label className="text-sm block">
        Minimum order total
        <input
          type="number"
          min="0"
          max="10000"
          step="0.01"
          required
          className={field}
          value={config.minimumOrder}
          onChange={(e) =>
            setConfig({ ...config, minimumOrder: Number(e.target.value) })
          }
        />
      </label>
      <label className="text-sm block">
        Staff delivery instructions
        <textarea
          maxLength={1000}
          className={field}
          value={config.instructions}
          onChange={(e) =>
            setConfig({ ...config, instructions: e.target.value })
          }
        />
      </label>
      <label className="flex gap-3 text-sm items-start">
        <input
          type="checkbox"
          className="mt-1"
          checked={config.noAdditionalFee}
          onChange={(e) =>
            setConfig({ ...config, noAdditionalFee: e.target.checked })
          }
        />
        We have approved delivery with no additional fee for orders arranged
        here.
      </label>
      <label className="flex gap-3 text-sm">
        <input
          type="checkbox"
          checked={config.enabled}
          onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        />
        Enable staff-arranged delivery
      </label>
      {save.error && (
        <p role="alert" className="text-red-700 text-sm">
          {save.error.message}
        </p>
      )}
      {save.isSuccess && (
        <p role="status" className="text-teal-800 text-sm">
          Delivery policy saved.
        </p>
      )}
      <button disabled={save.isPending} className={actionClass}>
        Save delivery policy
      </button>
    </form>
  );
}

function ArrangeDelivery({ onDone }: { onDone: () => void }) {
  const orders = useOrders({ limit: 100 });
  const [orderId, setOrderId] = useState("");
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (body: unknown) => api.post("/deliveries", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      onDone();
    },
  });
  const eligible =
    orders.data?.items.filter(
      (o) =>
        !o.tableId &&
        !o.deliveryId &&
        !["served", "settled", "cancelled"].includes(o.status) &&
        o.paymentStatus === "paid",
    ) ?? [];
  const selected = eligible.find((o) => o._id === orderId);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const values = new FormData(e.currentTarget);
    save.mutate({
      orderId,
      guestName: values.get("name"),
      guestPhone: values.get("phone"),
      address: {
        line1: values.get("line1"),
        line2: values.get("line2") || undefined,
        city: values.get("city"),
        state: "CA",
        postalCode: values.get("zip"),
      },
      instructions: values.get("instructions") || undefined,
      addressConfirmed: values.has("confirmed"),
    });
  }
  return (
    <form
      onSubmit={submit}
      className="bg-white border rounded-2xl p-5 space-y-4"
    >
      <div className="flex justify-between">
        <h2 className="font-bold text-lg">Arrange a delivery</h2>
        <button type="button" onClick={onDone} className="underline text-sm">
          Close form
        </button>
      </div>
      <p className="text-sm text-gray-600">
        Confirm the full address with the guest. ZIP coverage is checked here;
        street-address verification is manual.
      </p>
      <label className="text-sm block">
        Prepaid order
        <select
          required
          className={field}
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
        >
          <option value="">Select an order</option>
          {eligible.map((o) => (
            <option key={o._id} value={o._id}>
              {o.orderNumber} · {o.guestName || "Guest"} · {o.status}
            </option>
          ))}
        </select>
      </label>
      {!eligible.length && !orders.isLoading && (
        <p className="text-sm">
          No eligible orders.{" "}
          <Link className="underline text-[var(--promise-berry)]" to="/admin/billing">
            Collect payment first.
          </Link>
        </p>
      )}
      <div key={orderId} className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          Guest name
          <input
            name="name"
            required
            maxLength={120}
            defaultValue={selected?.guestName}
            className={field}
          />
        </label>
        <label className="text-sm">
          Guest phone
          <input
            name="phone"
            type="tel"
            required
            pattern="\+?[1-9][0-9]{7,14}"
            defaultValue={selected?.guestPhone}
            className={field}
          />
        </label>
      </div>
      <label className="text-sm block">
        Street address
        <input
          name="line1"
          required
          minLength={3}
          maxLength={180}
          autoComplete="address-line1"
          className={field}
        />
      </label>
      <label className="text-sm block">
        Apartment / unit
        <input
          name="line2"
          maxLength={180}
          autoComplete="address-line2"
          className={field}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          City
          <input
            name="city"
            required
            minLength={2}
            maxLength={80}
            autoComplete="address-level2"
            className={field}
          />
        </label>
        <label className="text-sm">
          ZIP code · California
          <input
            name="zip"
            required
            pattern="[0-9]{5}"
            inputMode="numeric"
            autoComplete="postal-code"
            className={field}
          />
        </label>
      </div>
      <label className="text-sm block">
        Drop-off instructions
        <textarea name="instructions" maxLength={500} className={field} />
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="confirmed" required />I confirmed this
        address and contact number with the guest.
      </label>
      {(save.error || orders.error) && (
        <p role="alert" className="text-red-700 text-sm">
          {(save.error || orders.error)?.message}
        </p>
      )}
      <button disabled={save.isPending || !orderId} className={actionClass}>
        Create delivery
      </button>
    </form>
  );
}

function DeliveryCard({
  delivery: d,
  manage,
  drivers,
}: {
  delivery: Delivery;
  manage: boolean;
  drivers: Driver[];
}) {
  const qc = useQueryClient();
  const [driverId, setDriverId] = useState(d.driverId || "");
  const [note, setNote] = useState("");
  const [returned, setReturned] = useState(false);
  const change = useMutation({
    mutationFn: (status: State) =>
      api.patch(`/deliveries/${d._id}`, {
        status,
        expectedStatus: d.status,
        driverId: status === "assigned" ? driverId : undefined,
        note: note || undefined,
        returnedToRestaurant: returned,
      }),
    onSuccess: () => {
      setNote("");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
  const terminal = ["delivered", "cancelled"].includes(d.status);
  return (
    <article className="bg-white border rounded-2xl p-5 space-y-4">
      <header className="flex justify-between flex-wrap gap-2">
        <div>
          <h2 className="font-bold">{d.orderNumber}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {d.guestName} ·{" "}
            {new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: d.currency,
            }).format(d.total)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs self-start ${d.status === "failed" ? "bg-amber-100 text-amber-900" : "bg-teal-50 text-teal-900"}`}
        >
          {labels[d.status]}
        </span>
      </header>
      <address className="not-italic text-sm leading-relaxed">
        {d.address.line1}
        {d.address.line2 && `, ${d.address.line2}`}
        <br />
        {d.address.city}, {d.address.state} {d.address.postalCode}
        <br />
        <a href={`tel:${d.guestPhone}`} className="text-[#086874] underline">
          {d.guestPhone}
        </a>
      </address>
      {d.instructions && (
        <p className="text-sm bg-[#fff8ef] rounded-lg p-3">{d.instructions}</p>
      )}
      <p className="text-sm text-gray-600">
        Delivery staff: {d.driverName || "Not assigned"}
      </p>
      {!terminal && (
        <>
          {manage && ["pending", "assigned", "failed"].includes(d.status) && (
            <label className="block text-sm">
              Assign delivery staff
              <select
                className={field}
                value={driverId}
                onChange={(e) => setDriverId(e.target.value)}
              >
                <option value="">Select staff member</option>
                {drivers.map((driver) => (
                  <option key={driver._id} value={driver._id}>
                    {driver.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm block">
            Handoff note or issue
            <textarea
              className={field}
              value={note}
              maxLength={500}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Required for a failed delivery or switch to pickup"
            />
          </label>
          {d.status === "failed" && manage && (
            <label className="text-sm flex gap-2">
              <input
                type="checkbox"
                checked={returned}
                onChange={(e) => setReturned(e.target.checked)}
              />
              The order has returned to the restaurant.
            </label>
          )}
          <div className="flex gap-2 flex-wrap">
            {manage && ["pending", "assigned", "failed"].includes(d.status) && (
              <button
                disabled={
                  change.isPending ||
                  !driverId ||
                  (d.status === "failed" && !returned)
                }
                onClick={() => change.mutate("assigned")}
                className={actionClass}
              >
                Assign staff
              </button>
            )}
            {d.status === "assigned" && (
              <button
                disabled={change.isPending}
                onClick={() => change.mutate("dispatched")}
                className={actionClass}
              >
                Dispatch ready order
              </button>
            )}
            {d.status === "dispatched" && (
              <>
                <button
                  disabled={change.isPending}
                  onClick={() => change.mutate("delivered")}
                  className={actionClass}
                >
                  Confirm delivered
                </button>
                <button
                  disabled={change.isPending || !note.trim()}
                  onClick={() => change.mutate("failed")}
                  className="border border-amber-300 rounded-lg p-2.5 text-amber-900 disabled:opacity-40"
                >
                  Report delivery issue
                </button>
              </>
            )}
            {manage && ["pending", "assigned", "failed"].includes(d.status) && (
              <button
                disabled={
                  change.isPending ||
                  !note.trim() ||
                  (d.status === "failed" && !returned)
                }
                onClick={() => change.mutate("cancelled")}
                className="border rounded-lg p-2.5 disabled:opacity-40"
              >
                Switch to pickup
              </button>
            )}
          </div>
        </>
      )}
      {change.error && (
        <p role="alert" className="text-sm text-red-700">
          {change.error.message}
        </p>
      )}
      <details className="text-xs text-gray-600">
        <summary className="cursor-pointer">Delivery history</summary>
        <ol className="space-y-2 mt-3">
          {d.events.map((event, i) => (
            <li key={i}>
              {new Date(event.at).toLocaleString("en-US", {
                timeZone: "America/Los_Angeles",
              })}{" "}
              PT · {labels[event.status]}
              {event.note && ` · ${event.note}`}
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}

export default function AdminDelivery() {
  const has = useAuthStore((s) => s.hasPermission);
  const manage = has("delivery:manage");
  const [arrange, setArrange] = useState(false);
  const [settings, setSettings] = useState(false);
  const [history, setHistory] = useState(false);
  const [page, setPage] = useState(1);
  const config = useQuery({
    queryKey: ["delivery-config"],
    queryFn: () => api.get<Config>("/deliveries/config"),
  });
  const deliveries = useQuery({
    queryKey: ["deliveries", history, page],
    queryFn: () =>
      api.get<{
        items: Delivery[];
        meta: { totalPages: number; total: number };
      }>("/deliveries", {
        query: { view: history ? "history" : "active", page },
      }),
    refetchInterval: 15000,
  });
  const drivers = useQuery({
    queryKey: ["delivery-drivers"],
    queryFn: () => api.get<Driver[]>("/deliveries/drivers"),
    enabled: manage,
  });
  const rows = deliveries.data?.items ?? [];
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {manage ? "Staff delivery board" : "My deliveries"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Confirmed addresses. Prepaid orders. A recorded handoff at every
            step.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start">
          {has("restaurant:update") && (
            <button
              className="border rounded-xl px-4 py-2 bg-white"
              onClick={() => setSettings(!settings)}
            >
              Service policy
            </button>
          )}
          {manage && (
            <button
              disabled={!config.data?.enabled}
              className="bg-[var(--promise-berry)] text-white rounded-xl px-4 py-2 disabled:opacity-40"
              onClick={() => setArrange(!arrange)}
            >
              Arrange delivery
            </button>
          )}
        </div>
      </header>
      {!config.data?.enabled && !config.isLoading && (
        <p className="text-sm rounded-xl border border-amber-200 bg-amber-50 p-4">
          New deliveries are disabled. A manager must confirm service ZIP codes
          and the no-additional-fee policy. Existing deliveries can still be
          completed.
        </p>
      )}
      {config.data?.instructions && (
        <p className="text-sm rounded-xl bg-[#fff8ef] border p-4">
          {config.data.instructions}
        </p>
      )}
      {(settings || arrange) && (
        <div className="grid xl:grid-cols-2 gap-5">
          {settings && config.data && (
            <DeliverySettings initial={config.data} />
          )}{" "}
          {arrange && manage && (
            <ArrangeDelivery onDone={() => setArrange(false)} />
          )}
        </div>
      )}
      {(deliveries.error || config.error || drivers.error) && (
        <p role="alert" className="text-red-700">
          {(deliveries.error || config.error || drivers.error)?.message}
        </p>
      )}
      <div className="flex gap-3">
        <button
          aria-pressed={!history}
          className={`rounded-full px-4 py-2 text-sm ${!history ? "bg-[#086874] text-white" : "border bg-white"}`}
          onClick={() => {
            setHistory(false);
            setPage(1);
          }}
        >
          Active deliveries
        </button>
        <button
          aria-pressed={history}
          className={`rounded-full px-4 py-2 text-sm ${history ? "bg-[#086874] text-white" : "border bg-white"}`}
          onClick={() => {
            setHistory(true);
            setPage(1);
          }}
        >
          Completed & pickup
        </button>
      </div>
      {deliveries.isLoading ? (
        <p role="status">Loading deliveries…</p>
      ) : (
        !rows.length && (
          <p className="bg-white border rounded-2xl p-8 text-gray-600">
            {history ? "No completed deliveries." : "No active deliveries."}
          </p>
        )
      )}
      <div className="grid lg:grid-cols-2 gap-5">
        {rows.map((d) => (
          <DeliveryCard
            key={d._id}
            delivery={d}
            manage={manage}
            drivers={drivers.data ?? []}
          />
        ))}
      </div>
      {deliveries.data && (
        <div className="flex justify-between items-center gap-2 text-sm">
          <button
            className="border rounded-lg p-2 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            {deliveries.data.meta.total} deliveries · Page {page}
          </span>
          <button
            className="border rounded-lg p-2 disabled:opacity-40"
            disabled={page >= deliveries.data.meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
      <p className="text-xs text-gray-500">
        A delivery issue does not issue a refund. Managers resolve payments
        separately from Billing & Payments.
      </p>
    </section>
  );
}
