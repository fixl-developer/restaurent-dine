import GuestHeader from "@/components/ui/GuestHeader";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Heart } from "lucide-react";
import { useCreateGuestReservation } from "@/hooks/useReservations";
import "./pinky.css";

export default function PinkyReservation() {
  const booking = useCreateGuestReservation();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (booking.isPending) return;
    const data = new FormData(event.currentTarget);
    try {
      await booking.mutateAsync({
        name: String(data.get("name")).trim(),
        email: String(data.get("email")).trim(),
        phone: String(data.get("phone")).trim() || undefined,
        date,
        time,
        partySize: Number(data.get("partySize")),
        notes: String(data.get("notes")).trim() || undefined,
      });
    } catch {
      /* Mutation preserves form and displays the server error. */
    }
  }
  return (
    <div className="pinky-site" style={{ minHeight: "100vh" }}>
      <GuestHeader />
      <div className="pinky-booking">
        <Link className="pinky-text-link" to="/">
          <ArrowLeft size={16} /> Back to Pinky Promise
        </Link>
        <div style={{ marginTop: 35 }}>
          <span className="pinky-eyebrow">A LITTLE TIME TOGETHER</span>
          <h1
            style={{
              fontSize: "clamp(32px,6vw,44px)",
              fontWeight: 700,
              letterSpacing: -1.5,
            }}
          >
            Save a little space
            <br />
            <em>for something sweet.</em>
          </h1>
          <p style={{ marginTop: 16, lineHeight: 1.8 }}>
            Request a table. Our team will review availability before confirming
            your reservation. All times are Pacific time.
          </p>
        </div>
        {booking.isSuccess ? (
          <div className="pinky-success" role="status">
            <Heart />
            <h2>Request received.</h2>
            <p>
              We’ve received your request for {date} at {time} Pacific time.
              Your table is not confirmed yet—check its status using your
              private booking link.
            </p>
            {booking.data.managementToken && (
              <p style={{ margin: "16px 0" }}>
                <Link
                  className="pinky-text-link"
                  to={`/reserve/manage/${booking.data._id}#${booking.data.managementToken}`}
                >
                  View, change or cancel your booking
                </Link>
                <small style={{ display: "block", marginTop: 8 }}>
                  Save this private link. Anyone with it can manage your
                  booking.
                </small>
              </p>
            )}
            <button className="pinky-button" onClick={() => booking.reset()}>
              Make another request
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              Your name
              <input name="name" autoComplete="name" required maxLength={120} />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={200}
              />
            </label>
            <label>
              Phone (optional)
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                maxLength={40}
              />
            </label>
            <label>
              Guests
              <input
                name="partySize"
                type="number"
                min={1}
                max={50}
                defaultValue={2}
                required
              />
            </label>
            <label>
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              Time · Pacific
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </label>
            <label className="pinky-full">
              Anything we should know?
              <textarea
                name="notes"
                rows={3}
                maxLength={1000}
                placeholder="Seating preferences or anything to discuss with our team"
              />
            </label>
            {booking.isError && (
              <p role="alert" className="pinky-full pinky-form-error">
                {booking.error instanceof Error
                  ? booking.error.message
                  : "Unable to send your request. Please try again."}
              </p>
            )}
            <button
              className="pinky-button pinky-full"
              disabled={booking.isPending}
            >
              {booking.isPending ? "Sending your request…" : "Request a table"}
            </button>
            <p className="pinky-full" style={{ fontSize: 12, lineHeight: 1.7 }}>
              Submitting a request does not reserve a table. We use these
              details to handle your booking.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
