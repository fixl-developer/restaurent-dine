import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, CircleAlert, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";

type Status = "configured" | "needs_setup" | "needs_integration" | "unverified";
interface Setup {
  checkedAt: string;
  note: string;
  checks: {
    key: string;
    title: string;
    status: Status;
    detail: string;
    link?: string;
  }[];
}
const labels: Record<Status, string> = {
  configured: "Configured",
  needs_setup: "Needs setup",
  needs_integration: "Integration needed",
  unverified: "Needs verification",
};
export default function AdminSetup() {
  const query = useQuery({
    queryKey: ["setup-checks"],
    queryFn: () => api.get<Setup>("/setup"),
  });
  return (
    <section className="space-y-6">
      <header className="flex justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm font-semibold text-[#086874]">
            Pinky Promise · One outlet
          </p>
          <h1 className="text-2xl font-bold mt-2">Restaurant setup</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-2xl">
            Review what is configured, connect the remaining services, and
            verify the restaurant’s operating details before launch.
          </p>
        </div>
        <button
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          className="self-start flex gap-2 items-center border bg-white rounded-xl px-4 py-3 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Refresh checks
        </button>
      </header>
      {query.isLoading && <p role="status">Checking configuration…</p>}
      {query.error && (
        <p role="alert" className="text-red-700">
          {query.error.message}
        </p>
      )}
      {query.data && (
        <>
          <p className="text-sm bg-[#fff8ef] border border-amber-200 rounded-xl p-4">
            {query.data.note}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {query.data.checks.map((c) => (
              <article
                key={c.key}
                className="bg-white border rounded-2xl p-5 flex flex-col gap-3"
              >
                <div className="flex justify-between items-start gap-4">
                  <h2 className="font-semibold">{c.title}</h2>
                  <span
                    className={`text-xs rounded-full px-2.5 py-1 whitespace-nowrap flex items-center gap-1 ${c.status === "configured" ? "bg-teal-50 text-teal-800" : "bg-amber-50 text-amber-900"}`}
                  >
                    {c.status === "configured" ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <CircleAlert size={13} />
                    )}{" "}
                    {labels[c.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">
                  {c.detail}
                </p>
                {c.link && (
                  <Link
                    className="text-sm font-semibold text-[var(--promise-berry)] self-start"
                    to={c.link}
                  >
                    Review settings →
                  </Link>
                )}
              </article>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Last checked{" "}
            {new Date(query.data.checkedAt).toLocaleString("en-US", {
              timeZone: "America/Los_Angeles",
            })}{" "}
            PT. Refresh after making changes.
          </p>
        </>
      )}
    </section>
  );
}
