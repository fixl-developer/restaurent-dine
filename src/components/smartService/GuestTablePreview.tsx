import { useEffect, useState } from "react";
import { BellRing, ClipboardList, GlassWater } from "lucide-react";

const requests = [
  {
    label: "Water",
    icon: GlassWater,
    sent: "Water requested",
    acknowledged: "Mira is bringing water",
    done: "Water delivered",
  },
  {
    label: "Call waiter",
    icon: BellRing,
    sent: "Waiter requested",
    acknowledged: "Mira is on the way",
    done: "Mira visited your table",
  },
  {
    label: "Ask for bill",
    icon: ClipboardList,
    sent: "Bill requested",
    acknowledged: "Mira is preparing your bill",
    done: "Bill brought to your table",
  },
] as const;
const demoCode = "CAFE1200";

export default function GuestTablePreview({
  chapter,
  onSelect,
  onInteract,
}: {
  chapter: number;
  onSelect: (index: number) => void;
  onInteract: () => void;
}) {
  const [party, setParty] = useState(2);
  const [arrival, setArrival] = useState<
    "new" | "waiting" | "seated" | "joined"
  >("new");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Record<number, number>>({});
  const [orderedAt, setOrderedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const joined = arrival === "joined";
  const active =
    Object.values(activity).some((at) => now - at < 6500) ||
    (orderedAt !== null && now - orderedAt < 10500);

  useEffect(() => {
    if (arrival !== "waiting") return;
    const timer = window.setTimeout(() => setArrival("seated"), 1400);
    return () => window.clearTimeout(timer);
  }, [arrival]);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, [active]);

  function ask(index: number) {
    const at = Date.now();
    onInteract();
    setNow(at);
    setActivity((previous) => ({ ...previous, [index]: at }));
  }

  const dishUpdates = [
    "Order received",
    "Your noodles are cooking",
    "Ready at the kitchen",
    "On the way to your table",
    "Served at Table 12",
  ];
  const dishIndex =
    orderedAt === null
      ? 0
      : Math.min(4, Math.floor(Math.max(0, now - orderedAt) / 2500));
  return (
    <div className="sf-ticket" onFocus={onInteract}>
      <div className="sf-ticket-head">
        <span>Guest demo</span>
        <span>Table 12</span>
      </div>
      {chapter === 0 ? (
        <>
          {arrival === "new" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onInteract();
                setArrival("waiting");
              }}
            >
              <strong>Welcome to your table</strong>
              <p>How many people are dining?</p>
              <div className="sf-party">
                <button
                  type="button"
                  aria-label="One fewer guest"
                  disabled={party <= 1}
                  onClick={() => setParty(party - 1)}
                >
                  −
                </button>
                <output aria-live="polite">
                  {party} {party === 1 ? "guest" : "guests"}
                </output>
                <button
                  type="button"
                  aria-label="One more guest"
                  disabled={party >= 8}
                  onClick={() => setParty(party + 1)}
                >
                  +
                </button>
              </div>
              <button className="sf-action">
                Let the host know we’re here
              </button>
            </form>
          )}
          {arrival === "waiting" && (
            <div role="status">
              <strong>Your host has your request</strong>
              <p>Table 12 · Party of {party}</p>
            </div>
          )}
          {arrival === "seated" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (code.trim().toUpperCase() !== demoCode) {
                  setError("Enter the table code shown above.");
                  return;
                }
                setError("");
                setArrival("joined");
              }}
            >
              <strong>Your table is ready</strong>
              <p>
                Mira is your waiter. Try her demo code <b>{demoCode}</b>.
              </p>
              <label className="sf-code">
                Table code
                <input
                  maxLength={8}
                  required
                  value={code}
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setError("");
                  }}
                />
              </label>
              {error && <p role="alert">{error}</p>}
              <button className="sf-action">Join my table</button>
            </form>
          )}
          {joined && (
            <>
              <strong>You’re at Table 12</strong>
              <p>
                {party} {party === 1 ? "guest" : "guests"} · Your waiter is
                Mira.
              </p>
              <button className="sf-action" onClick={() => onSelect(1)}>
                See table service
              </button>
            </>
          )}
        </>
      ) : !joined ? (
        <>
          <strong>
            {chapter === 1
              ? "Need something at your table?"
              : "Follow your meal"}
          </strong>
          <p>
            Join the demo table to{" "}
            {chapter === 1 ? "try a request" : "try ordering a bowl"}.
          </p>
          <button className="sf-action" onClick={() => onSelect(0)}>
            Go to check-in
          </button>
        </>
      ) : chapter === 1 ? (
        <>
          <strong>What can we bring you?</strong>
          <p>Your waiter is Mira.</p>
          <div className="sf-requests">
            {requests.map(({ label, icon: Icon }, i) => (
              <button
                key={label}
                type="button"
                disabled={activity[i] !== undefined && now - activity[i] < 6500}
                onClick={() => ask(i)}
              >
                <Icon size={16} aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
          <ul className="sf-updates" aria-live="polite">
            {Object.entries(activity).map(([key, at]) => {
              const item = requests[Number(key)],
                age = now - at;
              return (
                <li key={key}>
                  {age < 2500
                    ? item.sent
                    : age < 6500
                      ? item.acknowledged
                      : item.done}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <strong>Sesame chili noodles</strong>
          <p>One bowl for your table.</p>
          {orderedAt === null ? (
            <button
              className="sf-action"
              onClick={() => {
                const at = Date.now();
                onInteract();
                setNow(at);
                setOrderedAt(at);
              }}
            >
              Try a demo order
            </button>
          ) : (
            <p role="status" className="sf-order-status">
              {dishUpdates[dishIndex]}
            </p>
          )}
        </>
      )}
    </div>
  );
}
