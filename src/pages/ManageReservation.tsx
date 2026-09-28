import { type FormEvent, useState } from "react";
import GuestHeader from "@/components/ui/GuestHeader";
import { Link, useLocation, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  RESERVATION_STATUS_LABELS,
  type ReservationDto,
} from "@/lib/dto/reservations";
import "./pinky.css";
export default function ManageReservation() {
  const { id } = useParams();
  const location = useLocation();
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const qc = useQueryClient();
  const token = location.hash.slice(1);
  const options = { noAuth: true, headers: { "X-Reservation-Token": token } };
  const booking = useQuery({
    queryKey: ["guest-booking", id, token],
    queryFn: () =>
      api.get<ReservationDto>(`/guest/reservations/${id}`, options),
    enabled: !!id && !!token,
    retry: false,
  });
  const change = useMutation({
    mutationFn: (input: Record<string, unknown>) =>
      api.patch<ReservationDto>(`/guest/reservations/${id}`, input, options),
    onSuccess: () => {
      setCancelPrompt(false);
      qc.invalidateQueries({ queryKey: ["guest-booking", id] });
    },
  });
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    change.mutate({
      date: String(data.get("date")),
      time: String(data.get("time")),
      partySize: Number(data.get("partySize")),
    });
  }
  const r = booking.data;
  const editable = r && ["pending", "confirmed"].includes(r.status);
  return (
    <div className="pinky-site" style={{ minHeight: "100vh" }}>
      <GuestHeader />
      <main className="pinky-booking">
        <Link className="pinky-text-link" to="/">
          Back to Pinky Promise
        </Link>
        <h1 style={{ fontSize: 36, marginTop: 32, fontWeight: 700 }}>
          Your little time together.
        </h1>
        <p style={{ marginTop: 12 }}>
          Keep this link private. It gives access to your booking.
        </p>
        {!token && (
          <p role="alert">
            Open the complete private link you received when making your
            request, or contact the restaurant.
          </p>
        )}
        {booking.isLoading && <p role="status">Loading booking…</p>}
        {booking.isError && (
          <div role="alert" className="pinky-form-error">
            {booking.error.message}
            <button
              className="ui-button ml-3"
              onClick={() => booking.refetch()}
            >
              Retry booking
            </button>
          </div>
        )}
        {r && (
          <>
            <div className="pinky-success">
              <h2>
                {r.name} · {RESERVATION_STATUS_LABELS[r.status]}
              </h2>
              <p>
                {r.date} at {r.time} Pacific · {r.partySize} guests
              </p>
              <small>Booking {r.reservationNumber}</small>
              {r.status === "pending" && (
                <p>Your table is awaiting confirmation from our team.</p>
              )}
            </div>
            {change.isSuccess && (
              <p role="status">
                {r.status === "cancelled"
                  ? "Your booking has been cancelled."
                  : "Booking updated. Changes to date, time or party size require a new confirmation."}
              </p>
            )}
            {editable && (
              <>
                <form
                  key={`${r.date}-${r.time}-${r.partySize}`}
                  onSubmit={submit}
                >
                  <label>
                    Date
                    <input
                      name="date"
                      type="date"
                      defaultValue={r.date}
                      required
                    />
                  </label>
                  <label>
                    Time · Pacific
                    <input
                      name="time"
                      type="time"
                      defaultValue={r.time}
                      required
                    />
                  </label>
                  <label>
                    Guests
                    <input
                      name="partySize"
                      type="number"
                      min={1}
                      max={50}
                      defaultValue={r.partySize}
                      required
                    />
                  </label>
                  <p className="pinky-full">
                    Changing these details returns your booking to pending until
                    our team confirms availability.
                  </p>
                  <button
                    className="pinky-button pinky-full"
                    disabled={change.isPending}
                  >
                    Request booking change
                  </button>
                </form>
                <div style={{ marginTop: 24 }}>
                  {cancelPrompt ? (
                    <>
                      <p>Cancel this booking and release its table?</p>
                      <button
                        className="pinky-button"
                        disabled={change.isPending}
                        onClick={() => change.mutate({ cancel: true })}
                      >
                        Yes, cancel booking
                      </button>
                      <button
                        className="pinky-text-link"
                        style={{ marginLeft: 16 }}
                        onClick={() => setCancelPrompt(false)}
                      >
                        Keep booking
                      </button>
                    </>
                  ) : (
                    <button
                      className="pinky-text-link"
                      onClick={() => setCancelPrompt(true)}
                    >
                      Cancel booking
                    </button>
                  )}
                </div>
              </>
            )}
            {!editable && (
              <Link className="pinky-button" to="/menu">
                Explore the menu
              </Link>
            )}
          </>
        )}
        {change.isError && (
          <p role="alert" className="pinky-form-error">
            {change.error.message}
          </p>
        )}
      </main>
    </div>
  );
}
