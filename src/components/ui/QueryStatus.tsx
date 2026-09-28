import { useSyncExternalStore } from "react";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { CircleAlert, Loader2 } from "lucide-react";

/** Surface failed reads instead of letting missing data look like an empty restaurant. */
export default function QueryStatus() {
  const client = useQueryClient();
  const cache = client.getQueryCache();
  const errors = useSyncExternalStore(
    (listener) => cache.subscribe(listener),
    () =>
      cache
        .getAll()
        .filter((q) => q.getObserversCount() > 0 && q.state.status === "error")
        .map((q) => q.queryHash)
        .join("|"),
  );
  const fetching = useIsFetching();
  if (!errors)
    return fetching ? (
      <span className="sr-only" role="status">
        Updating information…
      </span>
    ) : null;
  return (
    <div role="alert" className="query-status">
      <CircleAlert size={18} />
      <p>
        Some information couldn’t load. Retry before relying on the values on
        this screen.
      </p>
      <button
        className="ui-button"
        disabled={fetching > 0}
        onClick={() =>
          client.refetchQueries({
            type: "active",
            predicate: (q) => q.state.status === "error",
          })
        }
      >
        {fetching > 0 && <Loader2 size={14} className="animate-spin" />}Retry
      </button>
    </div>
  );
}
