import { clearVisitDraft } from "@/lib/checkoutDraft";
import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";

interface Member {
  grant: string;
  visitId: string;
}
interface Task {
  _id: string;
  type: string;
  state: string;
}
export interface VisitAccess {
  scope?: string;
  token?: string;
  allowed: boolean;
  panel?: ReactNode;
}
const base = "/table-service";
const labels: Record<string, string> = {
  water: "Water",
  help: "Waiter",
  bill: "Bill",
};
export default function GuestVisit({
  qr,
  children,
}: {
  qr: string;
  children: (access: VisitAccess) => ReactNode;
}) {
  const storage = "table-visit:" + qr;
  const [member, setMember] = useState<Member | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storage) || "null");
    } catch {
      return null;
    }
  });
  const [covers, setCovers] = useState(2);
  const arrival = useMutation({
    mutationFn: () =>
      api.post<{ expiresAt: string }>(
        base + "/arrivals",
        { qr, covers },
        { noAuth: true },
      ),
  });
  const [code, setCode] = useState("");
  const [keys] = useState(() => new Map<string, string>());
  const entry = useQuery({
    queryKey: ["qr-entry", qr],
    queryFn: () =>
      api.get<{ enrolled: boolean; table: string; seated: boolean }>(
        base + "/entry",
        { query: { qr }, noAuth: true },
      ),
    refetchInterval: 15000,
    retry: 1,
  });
  const options = {
    noAuth: true,
    headers: { "X-Visit-Token": member?.grant || "" },
  };
  const current = useQuery({
    queryKey: ["qr-current", qr, member?.grant],
    queryFn: () =>
      api.get<{ waiter?: string; tasks: Task[] }>(base + "/current", {
        ...options,
        query: { qr },
      }),
    enabled: !!member && !!entry.data?.enrolled,
    refetchInterval: 10000,
    retry: false,
  });
  useEffect(() => {
    if (
      member &&
      ((current.error instanceof ApiError && current.error.status === 403) ||
        (entry.data && !entry.data.enrolled))
    ) {
      try {
        sessionStorage.removeItem(storage);
      } catch {}
      if (member) clearVisitDraft(member.visitId);
      setMember(null);
    }
  }, [current.error, entry.data, storage, member]);
  const join = useMutation({
    mutationFn: () =>
      api.post<Member>(base + "/join", { qr, code }, { noAuth: true }),
    onSuccess: (m) => {
      setMember(m);
      setCode("");
      try {
        sessionStorage.setItem(storage, JSON.stringify(m));
      } catch {}
    },
  });
  const request = useMutation({
    mutationFn: async (type: string) => {
      const k = member!.visitId + type;
      if (!keys.has(k)) keys.set(k, crypto.randomUUID());
      await api.post(
        base + "/requests",
        { qr, type, key: keys.get(k) },
        options,
      );
      keys.delete(k);
    },
    onSuccess: () => current.refetch(),
  });
  if (entry.data && !entry.data.enrolled) return children({ allowed: true });
  const verified = !!member && !!current.data && !current.isError;
  const panel = (
    <section className="mx-auto max-w-3xl px-4 py-5" aria-label="Table service">
      <div className="rounded-2xl border border-[#e0cfba] bg-[#fffdf8] p-5 space-y-3">
        <h2 className="text-xl font-semibold">
          {entry.data ? "Table " + entry.data.table : "Table service"}
        </h2>
        {entry.isError ? (
          <button className="ui-button" onClick={() => entry.refetch()}>
            Retry table connection
          </button>
        ) : !entry.data ? (
          <p>Checking your table…</p>
        ) : verified ? (
          <>
            <p>
              {current.data?.waiter
                ? "Your waiter is " + current.data.waiter + "."
                : "The floor team is looking after your table."}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(labels).map(([type, label]) => (
                <button
                  key={type}
                  className="ui-button"
                  disabled={
                    request.isPending ||
                    current.data?.tasks.some(
                      (t) => t.type === type && t.state !== "completed",
                    )
                  }
                  onClick={() => request.mutate(type)}
                >
                  {label === "Waiter"
                    ? "Call waiter"
                    : "Request " + label.toLowerCase()}
                </button>
              ))}
            </div>
            <ul aria-live="polite" className="text-sm space-y-1">
              {current.data?.tasks.slice(0, 5).map((t) => (
                <li key={t._id}>
                  {labels[t.type]} · {t.state}
                </li>
              ))}
            </ul>
          </>
        ) : member ? (
          <button className="ui-button" onClick={() => current.refetch()}>
            Verify this visit
          </button>
        ) : entry.data.seated ? (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              join.mutate();
            }}
          >
            <label className="text-sm">
              Code from your waiter
              <input
                className="block border rounded-lg px-3 py-2 mt-1 uppercase"
                maxLength={8}
                minLength={8}
                required
                autoComplete="off"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </label>
            <button
              className="ui-button ui-button-primary"
              disabled={join.isPending}
            >
              Join table
            </button>
          </form>
        ) : (
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              arrival.mutate();
            }}
          >
            <label className="text-sm">
              Guests in your party
              <input
                type="number"
                className="block border rounded-lg px-3 py-2 w-20"
                min={1}
                max={50}
                value={covers}
                onChange={(e) => setCovers(Number(e.target.value))}
                required
              />
            </label>
            <button
              className="ui-button"
              disabled={
                arrival.isPending ||
                (arrival.data &&
                  Date.parse(arrival.data.expiresAt) > Date.now())
              }
            >
              Let the host know we’re here
            </button>
            {arrival.data &&
              Date.parse(arrival.data.expiresAt) > Date.now() && (
                <p role="status">
                  Your host has the request. Browse the menu while you wait.
                </p>
              )}
            {arrival.isError && <p role="alert">{arrival.error.message}</p>}
          </form>
        )}
        {(join.isError || request.isError) && (
          <p role="alert">{(request.error || join.error)?.message}</p>
        )}
      </div>
    </section>
  );
  return children({
    scope: verified ? "visit:" + member!.visitId : "browse:" + qr,
    token: verified ? member!.grant : undefined,
    allowed: verified,
    panel,
  });
}
