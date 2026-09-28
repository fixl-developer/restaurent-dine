import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
interface Summary {
  date: string;
  currency: string;
  canClose: boolean;
  blockers: string[];
  orderCounts: {
    total: number;
    settled: number;
    cancelled: number;
    open: number;
  };
  sales: {
    gross: number;
    net: number;
    discounts: number;
    taxCollected: number;
    tips: number;
    serviceCharge: number;
    taxByType: Record<string, number>;
  };
  payments: {
    collected: number;
    refunds: number;
    total: number;
    byMode: Record<string, number>;
  };
  cashSessions: {
    openCount: number;
    openSessions: { id: string; cashierName?: string; expectedCash: number }[];
  };
}
interface CloseRecord {
  _id: string;
  businessDate: string;
  currency: string;
  createdAt: string;
  summary: Summary;
}
function yesterday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
export default function AdminDayClose() {
  const [date, setDate] = useState(yesterday);
  const qc = useQueryClient();
  const [selected, setSelected] = useState<CloseRecord | null>(null);
  const preview = useQuery({
    queryKey: ["day-close-preview", date],
    queryFn: () =>
      api.get<Summary>("/billing/day-close/preview", { query: { date } }),
    enabled: !!date,
  });
  const history = useQuery({
    queryKey: ["day-close-history"],
    queryFn: () => api.get<CloseRecord[]>("/billing/day-close/history"),
  });
  const close = useMutation({
    mutationFn: () => api.post<CloseRecord>("/billing/day-close", { date }),
    onSuccess: (r) => {
      setSelected(r);
      qc.invalidateQueries({ queryKey: ["day-close-history"] });
    },
  });
  const summary = selected?.summary ?? preview.data;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: summary?.currency ?? "USD",
    }).format(n);
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">End-of-day reconciliation</h1>
          <p className="text-sm text-gray-600 mt-2">
            Review a completed Pacific business day, resolve open balances, then
            save its close record.
          </p>
        </div>
        <label className="text-sm">
          Business date
          <input
            className="block border rounded-lg p-2 mt-1"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSelected(null);
              close.reset();
            }}
            max={yesterday()}
          />
        </label>
      </header>
      {selected && (
        <div className="rounded-xl bg-[#dcefe9] p-4">
          Saved close · {selected.businessDate} · {selected.currency}
          <button className="underline ml-3" onClick={() => setSelected(null)}>
            Show current preview
          </button>
        </div>
      )}
      {preview.isFetching && !selected && (
        <p role="status">Loading reconciliation…</p>
      )}
      {(preview.error || close.error) && (
        <p role="alert" className="text-red-700">
          {(close.error || preview.error)?.message}
        </p>
      )}
      {summary && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ["Invoiced total", summary.sales.gross],
              ["Tax billed", summary.sales.taxCollected],
              ["Tips billed", summary.sales.tips],
              ["Net collections", summary.payments.total],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="bg-white border rounded-2xl p-5"
              >
                <p className="text-sm text-gray-600">{label}</p>
                <p className="font-bold text-2xl mt-2">
                  {money(Number(value))}
                </p>
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <article className="bg-white border rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-3">
                Collection reconciliation
              </h2>
              <dl className="space-y-3">
                {Object.entries(summary.payments.byMode ?? {}).map(
                  ([mode, total]) => (
                    <div key={mode} className="flex justify-between">
                      <dt className="capitalize">{mode}</dt>
                      <dd>{money(total)}</dd>
                    </div>
                  ),
                )}
                <div className="flex justify-between border-t pt-3">
                  <dt>Collected</dt>
                  <dd>{money(summary.payments.collected)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Refunds issued this day</dt>
                  <dd>−{money(summary.payments.refunds)}</dd>
                </div>
                <div className="flex justify-between font-bold">
                  <dt>Net collections</dt>
                  <dd>{money(summary.payments.total)}</dd>
                </div>
              </dl>
            </article>
            <article className="bg-white border rounded-2xl p-5">
              <h2 className="font-bold text-lg mb-3">Close checklist</h2>
              <p className="text-sm mb-4">
                {summary.orderCounts.total} orders ·{" "}
                {summary.orderCounts.settled} settled ·{" "}
                {summary.orderCounts.cancelled} cancelled
              </p>
              {summary.blockers.length ? (
                <ul className="space-y-2 list-disc ml-5 text-sm text-amber-800">
                  {summary.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[#086874]">
                  All required balances and drawers are resolved.
                </p>
              )}
              {!selected && (
                <button
                  disabled={
                    !summary.canClose || close.isPending || preview.isFetching
                  }
                  className="bg-[var(--promise-berry)] text-white rounded-xl p-3 mt-5 disabled:opacity-40"
                  onClick={() => close.mutate()}
                >
                  {close.isPending ? "Saving close…" : "Save day-close record"}
                </button>
              )}
            </article>
          </div>
          <p className="text-xs text-gray-600">
            Invoice totals describe sales billed that day. Collections use
            payment dates; refunds use their processing dates. Saved close
            records retain the figures reviewed at closing.
          </p>
        </>
      )}
      <section>
        <h2 className="font-bold text-lg mb-3">Saved closes</h2>
        {history.error && <p role="alert">{history.error.message}</p>}
        <div className="bg-white border rounded-2xl divide-y">
          {history.data?.length === 0 && (
            <p className="p-5 text-gray-600">No completed closes yet.</p>
          )}
          {history.data?.map((r) => (
            <button
              key={r._id}
              className="w-full text-left p-4 hover:bg-[#fff8ef] flex justify-between"
              onClick={() => setSelected(r)}
            >
              <span>
                {r.businessDate} · {r.currency}
              </span>
              <span>View saved record →</span>
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
