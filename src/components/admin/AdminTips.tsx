import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

type Method = "hours" | "equal";

interface Allocation {
  userId: string;
  name: string;
  workedMinutes: number;
  amount: number;
  amountCents: number;
}
interface Preview {
  businessDate: string;
  method: Method;
  currency: string;
  totalTip: number;
  totalTipCents: number;
  allocations: Allocation[];
  saved: boolean;
}
interface Payout {
  _id: string;
  businessDate: string;
  method: Method;
  currency: string;
  totalTip: number;
  allocations: Allocation[];
  generatedByName?: string;
  createdAt: string;
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
      .map((x) => [x.type, x.value]),
  );
  const d = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function formatMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function AdminTips() {
  const canManage = useAuthStore((s) => s.hasPermission("tips:manage"));
  const [date, setDate] = useState(yesterday);
  const [method, setMethod] = useState<Method>("hours");
  const qc = useQueryClient();

  const preview = useQuery({
    queryKey: ["tip-pool-preview", date, method],
    queryFn: () =>
      api.get<Preview>("/tips/pool/preview", {
        query: { businessDate: date, method },
      }),
    enabled: !!date,
  });
  const history = useQuery({
    queryKey: ["tip-payouts"],
    queryFn: () => api.get<Payout[]>("/tips/payouts"),
  });
  const save = useMutation({
    mutationFn: () =>
      api.post<Payout>("/tips/payouts", { businessDate: date, method }),
    onSuccess: () => {
      toast.success("Tip payout saved");
      qc.invalidateQueries({ queryKey: ["tip-payouts"] });
      qc.invalidateQueries({ queryKey: ["tip-pool-preview"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Could not save payout"),
  });

  const data = preview.data;
  const money = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: data?.currency ?? "USD",
    }).format(n);

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Tip pool & payouts</h1>
          <p className="text-sm text-gray-600 mt-2">
            Distribute a completed Pacific day's collected tips across the staff
            who worked it. This is a reviewed snapshot — it records the split and
            does not move money.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            Business date
            <input
              className="block border rounded-lg p-2 mt-1"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={yesterday()}
            />
          </label>
          <label className="text-sm">
            Method
            <select
              className="block border rounded-lg p-2 mt-1"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
            >
              <option value="hours">By hours worked</option>
              <option value="equal">Split equally</option>
            </select>
          </label>
        </div>
      </header>

      {preview.isFetching && <p role="status">Loading tip pool…</p>}
      {preview.error && (
        <p className="text-red-600" role="alert">
          {preview.error instanceof Error
            ? preview.error.message
            : "Failed to load the tip pool"}
        </p>
      )}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border p-4 bg-white">
              <p className="text-xs text-gray-500">Total tips collected</p>
              <p className="text-2xl font-bold mt-1">{money(data.totalTip)}</p>
            </div>
            <div className="rounded-xl border p-4 bg-white">
              <p className="text-xs text-gray-500">Staff sharing</p>
              <p className="text-2xl font-bold mt-1">
                {data.allocations.length}
              </p>
            </div>
            <div className="rounded-xl border p-4 bg-white">
              <p className="text-xs text-gray-500">Status</p>
              <p className="text-lg font-semibold mt-1">
                {data.saved ? (
                  <span className="text-[#086874]">Payout saved</span>
                ) : (
                  <span className="text-amber-600">Preview (unsaved)</span>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Staff</th>
                  <th className="text-right px-4 py-2 font-medium">
                    Time worked
                  </th>
                  <th className="text-right px-4 py-2 font-medium">Tip share</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.allocations.map((a) => (
                  <tr key={a.userId}>
                    <td className="px-4 py-2">{a.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">
                      {formatMinutes(a.workedMinutes)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {money(a.amount)}
                    </td>
                  </tr>
                ))}
                {data.allocations.length === 0 && (
                  <tr>
                    <td
                      className="px-4 py-6 text-center text-gray-500"
                      colSpan={3}
                    >
                      No staff shifts recorded for this day.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {canManage && !data.saved && data.totalTipCents > 0 && (
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending || data.allocations.length === 0}
              className="px-5 py-2.5 bg-[var(--promise-berry)] text-white rounded-xl font-medium text-sm disabled:opacity-50"
            >
              {save.isPending ? "Saving…" : "Save tip payout"}
            </button>
          )}
        </>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">Saved payouts</h2>
        <div className="rounded-xl border bg-white divide-y">
          {(history.data ?? []).map((p) => (
            <div
              key={p._id}
              className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm"
            >
              <span className="font-medium">{p.businessDate}</span>
              <span className="text-gray-500">
                {p.method === "hours" ? "By hours" : "Equal"} ·{" "}
                {p.allocations.length} staff
              </span>
              <span className="font-mono">
                {new Intl.NumberFormat("en-US", {
                  style: "currency",
                  currency: p.currency,
                }).format(p.totalTip)}
              </span>
            </div>
          ))}
          {history.data?.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-500">
              No tip payouts saved yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
