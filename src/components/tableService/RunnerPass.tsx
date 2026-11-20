import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";
import { Can } from "@/components/auth/Can";
interface Line {
  orderId: string;
  itemId: string;
  table: string;
  name: string;
  qty: number;
  runnerId?: string;
  readyAt: string;
}
export default function RunnerPass() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const queue = useQuery({
    queryKey: ["runner-pass"],
    queryFn: () => api.get<Line[]>("/table-service/pass"),
    refetchInterval: 10000,
  });
  const action = useMutation({
    mutationFn: (line: Line) =>
      api.post("/table-service/pass/" + line.orderId + "/" + line.itemId, {
        action: line.runnerId ? "serve" : "pickup",
      }),
    onSettled: () =>
      Promise.all(
        [["kds"], ["runner-pass"]].map((queryKey) =>
          qc.invalidateQueries({ queryKey }),
        ),
      ),
  });
  if (queue.isError)
    return (
      <button className="ui-button" onClick={() => queue.refetch()}>
        Retry runner queue
      </button>
    );
  if (!queue.data?.length) return null;
  return (
    <section className="my-4 rounded-2xl bg-white border p-4">
      <h2 className="font-semibold">Runner pickup</h2>
      {queue.data.map((l) => (
        <div
          key={l.itemId}
          className="flex items-center justify-between gap-3 border-t mt-2 pt-2"
        >
          <div>
            <strong>Table {l.table}</strong>
            <p>
              {l.qty} × {l.name}
            </p>
          </div>
          <Can perm={["table:update", "kds:update"]} match="any">
            <button
              className="ui-button"
              disabled={
                action.isPending || (!!l.runnerId && l.runnerId !== user?.id)
              }
              onClick={() => action.mutate(l)}
            >
              {l.runnerId
                ? l.runnerId === user?.id
                  ? "Confirm served"
                  : "With runner"
                : "Pick up"}
            </button>
          </Can>
        </div>
      ))}
      {action.isError && <p role="alert">{action.error.message}</p>}
    </section>
  );
}
