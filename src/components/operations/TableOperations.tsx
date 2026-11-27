import RunnerPass from "@/components/tableService/RunnerPass";
import { FloorInbox, ShiftCoverage, StaffVisit } from "@/components/tableService/StaffVisits";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users,
  RefreshCw,
  ArrowLeft,
  Plus,
  X,
  MoveRight,
  Merge,
  Scissors,
} from "lucide-react";
import { Can } from "@/components/auth/Can";
import Dialog from "@/components/ui/Dialog";
import PageState from "@/components/ui/PageState";
import FlowSteps from "@/components/ui/FlowSteps";
import AssistedOrderDialog from "./AssistedOrderDialog";
import FloorPlanView, {
  type TableOccupant,
} from "@/components/floorplan/FloorPlanView";
import {
  useTables,
  useTableStatus,
  useMergeTables,
  useSplitTable,
  useMoveTableSession,
  useOpenTableSessions,
  useOpenTableSession,
  useCloseTableSession,
} from "@/hooks/useTables";
import { useSocket } from "@/hooks/useSocket";
import { formatCurrency } from "@/lib/currencies";
import { TABLE_STATUS_LABELS } from "@/lib/dto/tables";

export default function TableOperations({ onExit }: { onExit: () => void }) {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("table");
  const select = (id: string | null) => {
    setParams(id ? { table: id } : {}, { replace: true });
    setAction(null);
    setError("");
  };
  const qc = useQueryClient();
  const tablesQuery = useTables({ includeInactive: false });
  const sessionsQuery = useOpenTableSessions();
  const tables = tablesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const visible = tables.filter((t) => !t.mergedIntoTableId);
  const selected = tables.find((t) => t._id === selectedId);
  const visit = sessions.find((s) => s.tableId === selectedId);
  const status = useTableStatus();
  const seat = useOpenTableSession();
  const close = useCloseTableSession();
  const merge = useMergeTables();
  const split = useSplitTable();
  const move = useMoveTableSession();
  const [orderBuilder, setOrderBuilder] = useState(false);
  const [guestCount, setGuestCount] = useState(2);
  const [action, setAction] = useState<
    "merge" | "move" | "split" | "close" | null
  >(null);
  const [targetId, setTargetId] = useState("");
  const [error, setError] = useState("");
  const busy =
    seat.isPending ||
    close.isPending ||
    status.isPending ||
    merge.isPending ||
    split.isPending ||
    move.isPending;
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tables"] });
    qc.invalidateQueries({ queryKey: ["table-sessions"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
  useSocket(
    "/staff",
    Object.fromEntries(
      [
        "table:updated",
        "table:service_changed",
        "table:status_changed",
        "table:merged",
        "table:split",
        "table:moved",
        "order:new",
        "order:settled",
      ].map((event) => [event, refresh]),
    ),
  );
  const occupants = useMemo<Record<string, TableOccupant>>(
    () =>
      Object.fromEntries(
        sessions.map((s) => [
          s.tableId,
          {
            guestCount: s.guestCount,
            serverName: s.waiterName,
            runningTotal: s.runningTotal,
            currency: s.currency,
            seatedMins: Math.floor(
              (Date.now() - new Date(s.openedAt).getTime()) / 60000,
            ),
          },
        ]),
      ),
    [sessions],
  );
  const targets = visible.filter(
    (t) =>
      t._id !== selectedId &&
      t.status === "vacant" &&
      !t.currentSessionId &&
      (action === "move"
        ? t.capacity >= (visit?.guestCount ?? 1)
        : !t.mergedWithTableIds.length),
  );
  async function perform(work: () => Promise<unknown>) {
    if (busy) return;
    setError("");
    try {
      await work();
      setAction(null);
      refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "This change could not be saved.",
      );
    }
  }
  function openAction(next: typeof action) {
    setError("");
    setTargetId("");
    setAction(next);
  }
  function confirm(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    void perform(async () => {
      if (action === "close" && visit) await close.mutateAsync(visit._id);
      if (action === "split") await split.mutateAsync(selected._id);
      if (action === "merge")
        await merge.mutateAsync({
          primaryId: selected._id,
          secondaryIds: [targetId],
        });
      if (action === "move") {
        await move.mutateAsync({
          fromTableId: selected._id,
          toTableId: targetId,
        });
        select(targetId);
      }
    });
  }
  if (
    (tablesQuery.isError && !tablesQuery.data) ||
    (sessionsQuery.isError && !sessionsQuery.data)
  )
    return (
      <PageState
        kind="error"
        title="Floor information unavailable"
        description="Refresh before seating guests or changing tables."
        action={
          <button className="ui-button" onClick={refresh}>
            Retry floor
          </button>
        }
      />
    );
  if (tablesQuery.isLoading || sessionsQuery.isLoading)
    return <PageState kind="loading" title="Opening the floor…" />;
  const title =
    action === "move"
      ? "Move this visit"
      : action === "merge"
        ? "Join vacant tables"
        : action === "split"
          ? "Separate table group"
          : "Close visit & start cleaning";
  return (
    <main className="service-page">
      <header className="service-heading">
        <div>
          <p className="ui-eyebrow">PINKY PROMISE · FLOOR SERVICE</p>
          <h1>Tables & service</h1>
          <p>Welcome guests, take their order and keep each visit moving.</p>
        </div>
        <div className="flex gap-2">
          <button className="ui-button" onClick={refresh}>
            <RefreshCw size={16} />
            Refresh floor
          </button>
          <button
            className="ui-icon-button"
            aria-label="Back to workspace"
            onClick={onExit}
          >
            <ArrowLeft size={17} />
          </button>
        </div>
      </header>
      <div className="service-metrics">
        {[
          [
            "Ready for guests",
            visible.filter((t) => t.status === "vacant").length,
          ],
          ["Open visits", sessions.length],
          [
            "Awaiting bill",
            visible.filter((t) => t.status === "awaiting_bill").length,
          ],
          ["Cleaning", visible.filter((t) => t.status === "cleaning").length],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <FloorInbox tables={tables} onSelect={(id,covers)=>{select(id);if(covers)setGuestCount(covers)}}/>
      <RunnerPass/>
      <Can perm="user:update"><ShiftCoverage/></Can>
      <div className="table-service-layout">
        <section className="service-floor">
          <div className="flex justify-between flex-wrap gap-3 mb-4">
            <h2 className="font-bold text-lg">Your floor</h2>
            <label className="text-sm">
              Choose a table
              <select
                className="ml-2 border rounded-lg p-2"
                value={selectedId ?? ""}
                onChange={(e) => select(e.target.value || null)}
              >
                <option value="">Select table</option>
                {visible.map((t) => (
                  <option key={t._id} value={t._id}>
                    Table {t.number} · {TABLE_STATUS_LABELS[t.status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {visible.length ? (
            <FloorPlanView
              tables={visible}
              occupants={occupants}
              selectedId={selectedId}
              onTableClick={(t) => select(t._id)}
            />
          ) : (
            <PageState
              title="Build your floor"
              description="Add your tables to start seating and service."
              action={
                <Can perm="table:create">
                  <Link
                    className="ui-button ui-button-primary"
                    to="/admin/tables"
                  >
                    Add tables
                  </Link>
                </Can>
              }
            />
          )}
        </section>
        <aside
          className={`service-table-panel ${selected ? "has-selection" : ""}`}
          aria-label="Selected table"
        >
          {selected ? (
            <>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="ui-eyebrow">{selected.zone ?? "CAFÉ FLOOR"}</p>
                  <h2 className="text-2xl font-bold mt-2">
                    Table {selected.number}
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {selected.capacity} seats ·{" "}
                    {TABLE_STATUS_LABELS[selected.status]}
                  </p>
                </div>
                <button
                  className="ui-icon-button"
                  aria-label="Close table details"
                  onClick={() => select(null)}
                >
                  <X size={17} />
                </button>
              </div>
              <FlowSteps
                label="Table service progress"
                steps={["Seat", "Order", "Bill", "Clean"]}
                current={
                  {
                    vacant: 0,
                    seated: 1,
                    ordered: 2,
                    awaiting_bill: 2,
                    cleaning: 3,
                  }[selected.status]
                }
              />
              {visit?.qrService && <StaffVisit key={visit._id} visit={visit}/>}
              {visit && (
                <div className="table-visit-summary">
                  <p>
                    <Users size={17} />
                    {visit.guestCount} guests seated
                  </p>
                  <p>
                    Visit total{" "}
                    <strong>
                      {formatCurrency(
                        visit.runningTotal,
                        visit.currency ?? "INR",
                      )}
                    </strong>
                  </p>
                </div>
              )}
              {selected.status === "vacant" && (
                <Can perm="table:update">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void perform(() =>
                        seat.mutateAsync({ tableId: selected._id, guestCount }),
                      );
                    }}
                    className="space-y-3"
                  >
                    <label className="block text-sm font-semibold">
                      Number of guests
                      <input
                        className="w-full border rounded-xl p-3 mt-2"
                        type="number"
                        min={1}
                        max={selected.capacity}
                        required
                        value={guestCount}
                        onChange={(e) => setGuestCount(Number(e.target.value))}
                      />
                    </label>
                    <button
                      className="ui-button ui-button-primary w-full"
                      disabled={busy}
                    >
                      Seat guests
                    </button>
                    <p className="text-xs text-gray-600">
                      Existing bookings and capacity are checked before seating.
                    </p>
                  </form>
                </Can>
              )}
              {visit && (
                <div className="space-y-2">
                  <Can perm="order:create">
                    <button
                      className="ui-button ui-button-primary w-full"
                      disabled={busy}
                      onClick={() => setOrderBuilder(true)}
                    >
                      <Plus size={17} />
                      {visit.orderIds.length
                        ? "Take another order"
                        : "Take order"}
                    </button>
                  </Can>
                  <Can perm="order:read">
                    <Link
                      className="ui-button w-full"
                      to={`/admin/orders?table=${selected._id}`}
                    >
                      View table orders
                    </Link>
                  </Can>
                  <Can perm="billing:read">
                    <Link
                      className="ui-button w-full"
                      to={`/billing-ops?table=${selected._id}`}
                    >
                      Open table bills
                    </Link>
                  </Can>
                  {selected.status !== "awaiting_bill" && (
                    <Can perm="table:update">
                      <button
                        className="ui-button w-full"
                        disabled={busy}
                        onClick={() =>
                          void perform(() =>
                            status.mutateAsync({
                              id: selected._id,
                              status: "awaiting_bill",
                            }),
                          )
                        }
                      >
                        Mark bill requested
                      </button>
                    </Can>
                  )}
                </div>
              )}
              {selected.status === "cleaning" && (
                <Can perm="table:update">
                  <p className="text-sm text-gray-600">
                    Finish clearing and sanitizing the table, then make it
                    available.
                  </p>
                  <button
                    className="ui-button ui-button-primary w-full"
                    disabled={busy}
                    onClick={() =>
                      void perform(() =>
                        status.mutateAsync({
                          id: selected._id,
                          status: "vacant",
                        }),
                      )
                    }
                  >
                    Table cleaned · make available
                  </button>
                </Can>
              )}
              <Can perm="table:update">
                <div className="table-secondary-actions">
                  {visit && (
                    <>
                      <button
                        className="ui-button"
                        disabled={busy}
                        onClick={() => openAction("move")}
                      >
                        <MoveRight size={16} />
                        Move visit
                      </button>
                      <button
                        className="ui-button"
                        disabled={busy}
                        onClick={() => openAction("close")}
                      >
                        Close visit & clean
                      </button>
                    </>
                  )}
                  {selected.status === "vacant" &&
                    !selected.currentSessionId &&
                    (selected.mergedWithTableIds.length ? (
                      <button
                        className="ui-button"
                        disabled={busy}
                        onClick={() => openAction("split")}
                      >
                        <Scissors size={16} />
                        Separate tables
                      </button>
                    ) : (
                      <button
                        className="ui-button"
                        disabled={busy}
                        onClick={() => openAction("merge")}
                      >
                        <Merge size={16} />
                        Join vacant tables
                      </button>
                    ))}
                </div>
              </Can>
              {error && !action && (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              )}
            </>
          ) : (
            <PageState
              title={selectedId ? "Table unavailable" : "Choose a table"}
              description="Select a table on the floor or from the list to seat guests and manage service."
            />
          )}
        </aside>
      </div>
      {orderBuilder && selected && (
        <AssistedOrderDialog
          table={{ id: selected._id, number: selected.number }}
          onClose={() => setOrderBuilder(false)}
          onCreated={refresh}
        />
      )}
      {action && selected && (
        <Dialog
          label={title}
          onClose={() => {
            if (!busy) setAction(null);
          }}
          closeOnEscape={!busy}
          className="fixed inset-0 z-50 bg-black/40 grid place-items-center p-4"
        >
          <form className="staff-surface reason-panel" onSubmit={confirm}>
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="text-sm leading-6 text-gray-600 my-4">
              {action === "close"
                ? "Settle or cancel every order before closing. The table will move to cleaning."
                : action === "merge"
                  ? "Only vacant, ungrouped tables can be joined. Assigned bookings are rechecked before saving."
                  : action === "move"
                    ? "The visit and its active orders move together. The destination must fit this party and have no overlapping booking."
                    : "Restore each table’s original capacity. The group must be vacant with no assigned booking."}
            </p>
            {(action === "move" || action === "merge") && (
              <label className="block text-sm font-semibold">
                Destination table
                <select
                  required
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full border rounded-xl p-3 mt-2"
                >
                  <option value="">Choose a vacant table</option>
                  {targets.map((t) => (
                    <option key={t._id} value={t._id}>
                      Table {t.number} · {t.capacity} seats
                    </option>
                  ))}
                </select>
                {!targets.length && (
                  <span className="block mt-2 text-gray-600 font-normal">
                    No suitable vacant tables. Refresh the floor after a table
                    is cleared.
                  </span>
                )}
              </label>
            )}
            {error && (
              <p role="alert" className="text-sm text-red-700 mt-3">
                {error}
              </p>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button
                type="button"
                className="ui-button"
                disabled={busy}
                onClick={() => setAction(null)}
              >
                Cancel
              </button>
              <button
                className="ui-button ui-button-primary"
                disabled={
                  busy ||
                  ((action === "move" || action === "merge") && !targetId)
                }
              >
                {busy ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
