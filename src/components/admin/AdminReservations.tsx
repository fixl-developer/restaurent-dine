import { useState, type FormEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useReservations, useUpdateReservation } from "@/hooks/useReservations";
import {
  RESERVATION_STATUS_LABELS,
  type ReservationStatus,
  type ReservationDto,
} from "@/lib/dto/reservations";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
const actions: Partial<
  Record<ReservationStatus, Array<[ReservationStatus, string]>>
> = {
  pending: [["cancelled", "Decline"]],
  confirmed: [
    ["checked_in", "Seat guests"],
    ["no_show", "No-show"],
    ["cancelled", "Cancel"],
  ],
  checked_in: [["completed", "Complete booking"]],
};
const field = "block w-full border rounded-lg p-2 mt-1 bg-white";
type AvailableTable = {
  _id: string;
  number: string;
  capacity: number;
  zone?: string;
};
function BookingCard({
  r,
  canUpdate,
}: {
  r: ReservationDto;
  canUpdate: boolean;
}) {
  const update = useUpdateReservation();
  const [duration, setDuration] = useState(r.durationMinutes ?? 90);
  const [checking, setChecking] = useState(false);
  const [selected, setSelected] = useState("");
  const waitlist = r.kind === "waitlist";
  const nowParts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(Date.now() + 60000))
      .map((p) => [p.type, p.value]),
  );
  const slots = useQuery({
    queryKey: [
      "reservation-tables",
      r._id,
      duration,
      waitlist ? null : r.date,
      waitlist ? null : r.time,
    ],
    enabled: checking,
    queryFn: () =>
      api.get<AvailableTable[]>("/reservations/availability", {
        query: {
          date: waitlist
            ? `${nowParts.year}-${nowParts.month}-${nowParts.day}`
            : r.date,
          time: waitlist ? `${nowParts.hour}:${nowParts.minute}` : r.time,
          partySize: r.partySize,
          durationMinutes: duration,
          excludeId: r._id,
        },
      }),
    staleTime: 0,
  });
  return (
    <article className="bg-white border rounded-2xl p-5 flex flex-wrap justify-between gap-5">
      <div>
        <p className="text-xs font-semibold text-[#086874]">
          {r.date} · {r.time} PT · {r.partySize} guests
        </p>
        <h2 className="font-bold text-lg mt-2">{r.name}</h2>
        <p className="text-sm text-gray-600">
          {r.email}
          {r.phone && ` · ${r.phone}`}
        </p>
        <p className="text-xs mt-2">
          Booking {r.reservationNumber} · {r.durationMinutes ?? 90} minutes
          {r.tableId && " · Table allocated"}
        </p>
        {r.notes && (
          <p className="text-sm mt-3 max-w-xl whitespace-pre-wrap">{r.notes}</p>
        )}
      </div>
      <div className="max-w-md">
        <span className="inline-block rounded-full bg-[#f9d6df] text-[var(--promise-berry)] px-3 py-1 text-xs font-semibold">
          {RESERVATION_STATUS_LABELS[r.status]}
        </span>
        {canUpdate && r.status === "pending" && (
          <div className="mt-3 space-y-2">
            <label className="text-xs">
              Table duration (minutes)
              <input
                className={field}
                type="number"
                min={15}
                max={360}
                step={15}
                value={duration}
                onChange={(e) => {
                  setDuration(Number(e.target.value));
                  setSelected("");
                }}
              />
            </label>
            <button
              className="border rounded-lg px-3 py-2 text-sm"
              onClick={() => {
                setChecking(true);
                if (checking) slots.refetch();
              }}
            >
              Check available tables
            </button>
            {slots.isFetching && <p role="status">Checking…</p>}
            {slots.isError && (
              <p role="alert" className="text-sm text-red-700">
                {slots.error.message}
              </p>
            )}
            {slots.data && (
              <>
                <label className="text-xs">
                  Assign table
                  <select
                    className={field}
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Choose a table</option>
                    {slots.data.map((t) => (
                      <option key={t._id} value={t._id}>
                        Table {t.number} · {t.capacity} seats
                        {t.zone ? ` · ${t.zone}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {!slots.data.length && (
                  <p className="text-sm">
                    No tables fit this booking. Ask the guest to choose another
                    time.
                  </p>
                )}
                <button
                  disabled={!selected || update.isPending}
                  className="bg-[var(--promise-berry)] text-white rounded-lg px-3 py-2 text-sm disabled:opacity-40"
                  onClick={() =>
                    update.mutate({
                      id: r._id,
                      patch: {
                        status: "confirmed",
                        tableId: selected,
                        durationMinutes: duration,
                      },
                    })
                  }
                >
                  Confirm table
                </button>
              </>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-4 flex-wrap">
          {canUpdate &&
            actions[r.status]?.map(([next, label]) => (
              <button
                key={next}
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({ id: r._id, patch: { status: next } })
                }
                className="border rounded-lg px-3 py-2 text-sm hover:bg-[#fff8ef] disabled:opacity-50"
              >
                {label}
              </button>
            ))}
        </div>
        {r.status === "checked_in" && (
          <p className="text-xs text-gray-600 mt-3">
            Closing the table visit in Table Operations releases the table for
            cleaning.
          </p>
        )}
      </div>
    </article>
  );
}
export default function AdminReservations() {
  const [tab, setTab] = useState<"reservations" | "waitlist">("reservations");
  const [status, setStatus] = useState<ReservationStatus | "">("pending");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const query = useReservations({
    status: status || undefined,
    page,
    limit: 25,
  });
  const qc = useQueryClient();
  const queue = useQuery({
    queryKey: ["reservations", "waitlist"],
    queryFn: () => api.get<ReservationDto[]>("/reservations/waitlist"),
    refetchInterval: 30000,
  });
  const canUpdate = useAuthStore((s) => s.hasPermission("reservation:update"));
  const canCreate = useAuthStore((s) => s.hasPermission("reservation:create"));
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.post(`/reservations${tab === "waitlist" ? "/waitlist" : ""}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setAdding(false);
      toast.success(
        tab === "waitlist"
          ? "Added to waitlist"
          : "Booking request created — assign a table to confirm",
      );
    },
    onError: (e) => toast.error(e.message),
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      create.mutate({
        guestName: String(data.get("name")).trim(),
        guestPhone: String(data.get("phone")).trim(),
        guestEmail: String(data.get("email")).trim() || undefined,
        partySize: Number(data.get("partySize")),
        notes: String(data.get("notes")).trim() || undefined,
        ...(tab === "reservations"
          ? {
              reservedAt: String(data.get("at")),
              durationMinutes: Number(data.get("duration")),
            }
          : {}),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid date");
    }
  }
  const records = tab === "waitlist" ? queue.data : query.data?.items;
  const loading = tab === "waitlist" ? queue.isLoading : query.isLoading;
  const error = tab === "waitlist" ? queue.error : query.error;
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-[#302a30]">
            Reservations & waitlist
          </h1>
          <p className="text-sm text-gray-600 mt-2">
            Table capacity and overlapping bookings are checked at confirmation.
            All times are Pacific.
          </p>
        </div>
        {canCreate && (
          <button
            className="bg-[var(--promise-berry)] text-white rounded-xl p-3"
            onClick={() => setAdding(!adding)}
          >
            {adding
              ? "Close form"
              : tab === "waitlist"
                ? "Add walk-in"
                : "New phone booking"}
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button
          className={`border rounded-full px-4 py-2 ${tab === "reservations" ? "bg-[#f9d6df]" : ""}`}
          onClick={() => {
            setTab("reservations");
            setAdding(false);
          }}
        >
          Reservations
        </button>
        <button
          className={`border rounded-full px-4 py-2 ${tab === "waitlist" ? "bg-[#f9d6df]" : ""}`}
          onClick={() => {
            setTab("waitlist");
            setAdding(false);
          }}
        >
          Waitlist · {queue.data?.length ?? 0}
        </button>
        {tab === "reservations" && (
          <label className="text-sm">
            Status
            <select
              className={field}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ReservationStatus | "");
                setPage(1);
              }}
            >
              <option value="">All</option>
              {Object.entries(RESERVATION_STATUS_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>
        )}
      </div>
      {adding && (
        <form
          onSubmit={submit}
          className="bg-white border rounded-2xl p-5 grid sm:grid-cols-2 gap-4"
        >
          <label>
            Name
            <input
              className={field}
              name="name"
              required
              minLength={2}
              maxLength={100}
            />
          </label>
          <label>
            Phone · country code
            <input
              className={field}
              name="phone"
              type="tel"
              required
              placeholder="+13105550123"
            />
          </label>
          <label>
            Email (optional)
            <input className={field} name="email" type="email" />
          </label>
          <label>
            Guests
            <input
              className={field}
              name="partySize"
              type="number"
              min={1}
              max={50}
              defaultValue={2}
              required
            />
          </label>
          {tab === "reservations" && (
            <>
              <label>
                Booking time · Pacific
                <input
                  className={field}
                  name="at"
                  type="datetime-local"
                  required
                />
              </label>
              <label>
                Duration · minutes
                <input
                  className={field}
                  name="duration"
                  type="number"
                  min={15}
                  max={360}
                  step={15}
                  defaultValue={90}
                  required
                />
              </label>
            </>
          )}
          <label className="sm:col-span-2">
            Notes
            <textarea className={field} name="notes" maxLength={1000} />
          </label>
          <button
            disabled={create.isPending}
            className="bg-[#086874] text-white rounded-lg p-3 disabled:opacity-50"
          >
            {create.isPending
              ? "Saving…"
              : tab === "waitlist"
                ? "Add to waitlist"
                : "Create booking request"}
          </button>
        </form>
      )}
      {loading && <p role="status">Loading…</p>}
      {error && (
        <p role="alert">
          {error.message}{" "}
          <button
            className="underline"
            onClick={() =>
              tab === "waitlist" ? queue.refetch() : query.refetch()
            }
          >
            Try again
          </button>
        </p>
      )}
      {records?.length === 0 && (
        <p className="bg-white rounded-xl border p-10 text-center text-gray-600">
          No{" "}
          {tab === "waitlist"
            ? "guests waiting"
            : "reservations match this view"}
          .
        </p>
      )}
      <div className="grid gap-4">
        {records?.map((r) => (
          <BookingCard key={r._id} r={r} canUpdate={canUpdate} />
        ))}
      </div>
      {tab === "reservations" && query.data && (
        <div className="flex justify-between items-center text-sm">
          <button
            disabled={page === 1}
            className="border rounded-lg p-2 disabled:opacity-40"
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {query.data.meta.totalPages}
          </span>
          <button
            disabled={page >= query.data.meta.totalPages}
            className="border rounded-lg p-2 disabled:opacity-40"
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
