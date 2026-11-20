import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Can } from "@/components/auth/Can";
import { useAuthStore } from "@/stores/auth.store";
import type { TableDto, TableSessionDto } from "@/lib/dto/tables";

const base = "/table-service";
interface Task {
  _id: string;
  visit: string;
  type: string;
  state: string;
  createdAt: string;
}
interface Arrival {
  _id: string;
  number: string;
  arrival: { covers: number; expiresAt: string };
}
interface Shift {
  _id: string;
  userId: { _id: string; name: string };
  serviceZone?: string;
  serviceOverflow?: boolean;
  maxServiceCovers?: number;
  maxServiceTables?: number;
  breaks: { endedAt?: string }[];
}
const labels: Record<string, string> = {
  water: "Water",
  help: "Waiter requested",
  bill: "Bill requested",
};
function useServiceAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () =>
      Promise.all(
        [["visit-service"], ["table-sessions"], ["tables"]].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
}
export function FloorInbox({
  tables,
  onSelect,
}: {
  tables: TableDto[];
  onSelect: (id: string, covers?: number) => void;
}) {
  const inbox = useQuery({
    queryKey: ["visit-service", "inbox"],
    queryFn: () =>
      api.get<{
        visits: TableSessionDto[];
        tasks: Task[];
        arrivals: Arrival[];
      }>(base + "/inbox"),
    refetchInterval: 10000,
  });
  if (!inbox.data)
    return inbox.isError ? (
      <button className="ui-button" onClick={() => inbox.refetch()}>
        Retry service inbox
      </button>
    ) : null;
  const { visits, tasks, arrivals } = inbox.data;
  const rows = visits.flatMap((v) => {
    const table = tables.find((t) => t._id === v.tableId);
    const work = tasks.filter((t) => t.visit === v._id);
    const overdue =
      !v.greetedAt &&
      Date.now() - Date.parse(v.assignedAt ?? v.openedAt) >= 90000;
    const detail = [
      v.needsCover
        ? "Needs cover"
        : overdue
          ? "Greeting overdue"
          : !v.greetedAt
            ? "Awaiting greeting"
            : "",
      v.offerName && Date.parse(v.offerExpiresAt ?? "") > Date.now()
        ? "Handover to " + v.offerName
        : "",
      ...work.map(
        (t) =>
          labels[t.type] +
          " · " +
          Math.floor((Date.now() - Date.parse(t.createdAt)) / 60000) +
          " min",
      ),
    ]
      .filter(Boolean)
      .join(" · ");
    return detail && table ? [{ table, detail }] : [];
  });
  if (!rows.length && !arrivals.length) return null;
  return (
    <section className="rounded-2xl border bg-white p-4 my-4">
      <h2 className="font-semibold mb-2">Floor inbox</h2>
      <div className="flex flex-wrap gap-2">
        {arrivals.map((a) => (
          <button
            key={a._id}
            className="ui-button"
            onClick={() => onSelect(a._id, a.arrival.covers)}
          >
            Table {a.number} · Seat party of {a.arrival.covers}
          </button>
        ))}
        {rows.map(({ table, detail }) => (
          <button
            className="ui-button"
            key={table._id}
            onClick={() => onSelect(table._id)}
          >
            Table {table.number} · {detail}
          </button>
        ))}
      </div>
    </section>
  );
}

export function StaffVisit({ visit }: { visit: TableSessionDto }) {
  const [waiter, setWaiter] = useState("");
  const [reason, setReason] = useState("");
  const detail = useQuery({
    queryKey: ["visit-service", "detail", visit._id],
    queryFn: () =>
      api.get<{ code: string; tasks: Task[] }>(base + "/visits/" + visit._id),
    refetchInterval: 10000,
  });
  const roster = useQuery({
    queryKey: ["visit-service", "roster"],
    queryFn: () => api.get<Shift[]>(base + "/roster"),
    refetchInterval: 30000,
  });
  const action = useServiceAction();
  const user = useAuthStore((s) => s.user);
  const send = (path: string, body: unknown) =>
    action.mutate(() => api.post(base + path, body));
  return (
    <section className="rounded-xl border bg-[#fbf7ef] p-4 space-y-3">
      <div>
        <h3 className="font-semibold">
          {visit.waiterName ?? "Needs waiter coverage"}
        </h3>
        <p className="text-sm">
          {visit.greetedAt ? "Guests greeted" : "Awaiting greeting"}
        </p>
      </div>
      {detail.data && (
        <p className="text-sm">
          Guest join code{" "}
          <strong className="font-mono tracking-widest">
            {detail.data.code}
          </strong>
        </p>
      )}
      {detail.isError && (
        <button className="ui-button" onClick={() => detail.refetch()}>
          Reload guest code
        </button>
      )}
      <Can perm="table:update">
        {!visit.greetedAt && visit.waiterId === user?.id && (
          <button
            className="ui-button"
            disabled={action.isPending}
            onClick={() => send("/visits/" + visit._id + "/greet", {})}
          >
            Confirm greeting
          </button>
        )}
        {visit.offerName &&
          Date.parse(visit.offerExpiresAt ?? "") > Date.now() && (
            <div className="text-sm">
              Handover offered to {visit.offerName}
              {user && visit.offerTo === user.id && (
                <button
                  className="ui-button"
                  disabled={action.isPending}
                  onClick={() =>
                    send("/visits/" + visit._id + "/assign", {
                      previous: visit.waiterId,
                      version: visit.assignmentVersion,
                      waiterId: user.id,
                    })
                  }
                >
                  Accept handover
                </button>
              )}
            </div>
          )}
        <div className="flex flex-wrap gap-2">
          <select
            className="border rounded-lg p-2 text-sm"
            aria-label="Assign waiter"
            value={waiter}
            onChange={(e) => setWaiter(e.target.value)}
          >
            <option value="">
              {visit.waiterId ? "Choose waiter" : "Automatic assignment"}
            </option>
            {roster.data
              ?.filter(
                (s) =>
                  s.userId._id !== visit.waiterId &&
                  !s.breaks.some((b) => !b.endedAt),
              )
              .map((s) => (
                <option key={s._id} value={s.userId._id}>
                  {s.userId.name}
                </option>
              ))}
          </select>
          <button
            className="ui-button"
            disabled={action.isPending || (!!visit.waiterId && !waiter)}
            onClick={() =>
              send("/visits/" + visit._id + "/assign", {
                previous: visit.waiterId || null,
                version: visit.assignmentVersion ?? 0,
                waiterId: waiter || undefined,
                overrideReason: reason.trim() || undefined,
              })
            }
          >
            {visit.waiterId
              ? reason.trim()
                ? "Transfer now"
                : "Offer handover"
              : "Assign"}
          </button>
        </div>
        {visit.waiterId && (
          <Can perm="user:update">
            <details>
              <summary className="text-sm">Manager override</summary>
              <label className="text-sm">
                Reason for immediate transfer
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="block border p-2 rounded"
                  maxLength={200}
                />
              </label>
            </details>
          </Can>
        )}
        {detail.data?.tasks
          .filter((t) => t.state !== "completed")
          .map((t) => (
            <div
              key={t._id}
              className="flex items-center justify-between gap-2"
            >
              <span>{labels[t.type]}</span>
              <button
                className="ui-button"
                disabled={action.isPending}
                onClick={() =>
                  send("/tasks/" + t._id, {
                    state:
                      t.state === "requested" ? "acknowledged" : "completed",
                  })
                }
              >
                {t.state === "requested" ? "Acknowledge" : "Complete"}
              </button>
            </div>
          ))}
      </Can>
      {action.isError && <p role="alert">{action.error.message}</p>}
    </section>
  );
}

export function ShiftCoverage() {
  const [open, setOpen] = useState(false);
  const roster = useQuery({
    queryKey: ["visit-service", "roster"],
    enabled: open,
    queryFn: () => api.get<Shift[]>(base + "/roster"),
  });
  return (
    <details className="my-4" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="cursor-pointer font-semibold">
        Waiter shift coverage
      </summary>
      {roster.isError && (
        <button className="ui-button" onClick={() => roster.refetch()}>
          Retry roster
        </button>
      )}
      {roster.data?.length === 0 && (
        <p className="text-sm my-2">Waiters appear here when they clock in.</p>
      )}
      {roster.data?.map((s) => (
        <CoverageRow key={s._id} shift={s} />
      ))}
    </details>
  );
}
function CoverageRow({ shift: s }: { shift: Shift }) {
  const action = useServiceAction();
  return (
    <form
      className="flex items-end flex-wrap gap-3 border-t py-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        action.mutate(() =>
          api.put(base + "/roster/" + s._id, {
            serviceZone: f.get("zone"),
            serviceOverflow: f.has("overflow"),
            maxServiceTables: Number(f.get("tables")),
            maxServiceCovers: Number(f.get("covers")),
          }),
        );
      }}
    >
      <strong>{s.userId.name}</strong>
      <label>
        Section
        <input
          className="block border rounded p-2"
          name="zone"
          placeholder="All sections"
          defaultValue={s.serviceZone}
        />
      </label>
      <label>
        Table limit
        <input
          className="block border rounded p-2 w-16"
          type="number"
          required
          min={1}
          max={100}
          name="tables"
          defaultValue={s.maxServiceTables ?? 5}
        />
      </label>
      <label>
        Cover limit
        <input
          className="block border rounded p-2 w-16"
          type="number"
          required
          min={1}
          max={500}
          name="covers"
          defaultValue={s.maxServiceCovers ?? 16}
        />
      </label>
      <label>
        <input
          type="checkbox"
          name="overflow"
          defaultChecked={s.serviceOverflow}
        />{" "}
        Cover other sections
      </label>
      <button className="ui-button" disabled={action.isPending}>
        Save
      </button>
      <span role="status">
        {action.isError
          ? action.error.message
          : action.isSuccess
            ? "Saved"
            : ""}
      </span>
    </form>
  );
}
