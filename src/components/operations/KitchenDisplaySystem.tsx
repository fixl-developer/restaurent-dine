import Dialog from "@/components/ui/Dialog";
import PageState from "@/components/ui/PageState";
import { Can } from "@/components/auth/Can";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  Clock,
  Bell,
  CheckCheck,
  AlertTriangle,
  Utensils,
  Package,
  ArrowLeft,
  Timer,
  X,
  ArrowRight,
  Volume2,
  VolumeX,
  Loader2,
  LogOut,
  RotateCcw,
} from "lucide-react";
import {
  useKdsQueue,
  useUpdateKdsItemStatus,
  useKdsRecall,
} from "@/hooks/useKds";
import { useLogout } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";
import type { KdsOrderDto, OrderItemStatus } from "@/lib/dto/orders";

// ── Audio chime via Web Audio (no external file) ─────────────────────────────
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);
  return () => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext
        )();
      }
      const ctx = ctxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // audio disabled / autoplay blocked — silent
    }
  };
}

// ── Visual helpers ───────────────────────────────────────────────────────────
// Order age color thresholds (in minutes)
const COLOR_THRESHOLDS = {
  RED: 10, // >= 10 min: red (urgent)
  AMBER: 5, // >= 5 min & < 10 min: amber (caution)
  GREEN: 0, // < 5 min: green (on track)
};

function ageMinutes(seconds: number): number {
  return Math.floor(seconds / 60);
}

function timerColor(secs: number) {
  const m = ageMinutes(secs);
  if (m >= COLOR_THRESHOLDS.RED) return "text-red-600";
  if (m >= COLOR_THRESHOLDS.AMBER) return "text-amber-600";
  return "text-emerald-600";
}
function timerBg(secs: number) {
  const m = ageMinutes(secs);
  if (m >= COLOR_THRESHOLDS.RED) return "bg-red-50 border-red-200";
  if (m >= COLOR_THRESHOLDS.AMBER) return "bg-amber-50 border-amber-200";
  return "bg-emerald-50 border-emerald-200";
}
function cardBorder(secs: number) {
  const m = ageMinutes(secs);
  if (m >= COLOR_THRESHOLDS.RED) return "border-red-300";
  if (m >= COLOR_THRESHOLDS.AMBER) return "border-amber-300";
  return "border-neutral-200";
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Offline queue caching ────────────────────────────────────────────────────
interface OfflineAction {
  id: string;
  orderId: string;
  itemId: string;
  status: OrderItemStatus;
  station?: string;
  timestamp: number;
}

async function saveQueueCache(orders: KdsOrderDto[]): Promise<void> {
  try {
    localStorage.setItem("kds_queue_cache", JSON.stringify(orders));
  } catch {
    // LocalStorage unavailable — continue
  }
}

function loadQueueCache(): KdsOrderDto[] {
  try {
    const cached = localStorage.getItem("kds_queue_cache");
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

async function queueOfflineAction(
  action: Omit<OfflineAction, "id" | "timestamp">,
): Promise<void> {
  try {
    const actions = localStorage.getItem("kds_offline_actions")
      ? JSON.parse(localStorage.getItem("kds_offline_actions")!)
      : [];
    actions.push({
      ...action,
      timestamp: Date.now(),
      id: `${Date.now()}_${Math.random()}`,
    });
    localStorage.setItem("kds_offline_actions", JSON.stringify(actions));
  } catch {
    throw new Error(
      "Could not save this action on the device. Please retry when connected.",
    );
  }
}

async function getOfflineActions(): Promise<OfflineAction[]> {
  try {
    return localStorage.getItem("kds_offline_actions")
      ? JSON.parse(localStorage.getItem("kds_offline_actions")!)
      : [];
  } catch {
    return [];
  }
}

async function removeOfflineAction(id: string): Promise<void> {
  const actions = await getOfflineActions();
  localStorage.setItem(
    "kds_offline_actions",
    JSON.stringify(actions.filter((action) => action.id !== id)),
  );
}
let syncingOffline = false;

interface PendingConfirm {
  orderId: string;
  itemId?: string;
  orderLabel: string;
  fromLabel: string;
  toLabel: string;
  status: OrderItemStatus;
  bulk: boolean; // if true, transition every item on the order at once
  btnLabel: string;
  btnClass: string;
}

function OrderCard({
  order,
  onAdvance,
  onComplete,
}: {
  order: KdsOrderDto;
  onAdvance: () => void;
  onComplete: () => void;
}) {
  const allReady = order.items.every((i) => i.status === "ready");
  const anyPreparing = order.items.some((i) => i.status === "preparing");
  const anyPending = order.items.some(
    (i) => i.status === "pending" || i.status === "accepted",
  );

  const label =
    anyPending && !anyPreparing && !allReady
      ? "Start Preparing"
      : !allReady
        ? "Mark Ready"
        : "Mark Served";

  const Icon =
    anyPending && !anyPreparing && !allReady
      ? ChefHat
      : !allReady
        ? Bell
        : CheckCheck;

  const btnClass = !allReady
    ? anyPreparing
      ? "bg-amber-700 hover:bg-amber-800 text-white"
      : "bg-[#1a1a1a] hover:bg-[#1a1a1a]/80 text-white"
    : "bg-[#086874] hover:bg-[#064e57] text-white";

  const onClick = allReady ? onComplete : onAdvance;

  return (
    <article
      aria-label={`Kitchen order ${order.orderNumber}`}
      className={`rounded-[18px] border-2 bg-white flex flex-col overflow-hidden shadow-sm hover:shadow-md transition-all ${cardBorder(order.ageSeconds)}`}
    >
      {/* Header */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-mono font-bold text-[#1a1a1a]">
              {order.orderNumber}
            </span>
            {order.channel === "window" && (
              <span className="text-[11px] font-mono bg-[#E8447A]/20 text-[#1a1a1a] border border-[#E8447A]/40 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Window
              </span>
            )}
            {order.channel === "assisted" && (
              <span className="text-[11px] font-mono bg-orange-100 text-orange-800 border border-orange-200 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                Assisted
              </span>
            )}
          </div>
          <p className="text-[11px] text-[#1a1a1a]/60 mt-0.5 font-medium truncate">
            {order.windowToken ?? (order.tableId ? `Table` : "Counter")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${timerBg(order.ageSeconds)}`}
          >
            <Timer className={`w-2.5 h-2.5 ${timerColor(order.ageSeconds)}`} />
            <span
              className={`text-[10px] font-mono font-bold ${timerColor(order.ageSeconds)}`}
            >
              {ageMinutes(order.ageSeconds)}m
            </span>
          </div>
          <p className="text-[11px] text-[#1a1a1a]/65 mt-1 font-mono">
            {fmtTime(order.createdAt)}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="border-t border-[rgba(26,26,26,0.08)] px-3.5 py-2.5 space-y-1.5">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-[11px] font-mono text-[#E8447A] w-5 text-right shrink-0 pt-px">
              {item.qty}×
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[#1a1a1a] leading-snug">
                {item.name}
                {item.variantName && (
                  <span className="text-[#1a1a1a]/65">
                    {" "}
                    · {item.variantName}
                  </span>
                )}
              </p>
              {item.modifiers.length > 0 && (
                <p className="text-[10px] text-[#1a1a1a]/50 leading-snug">
                  {item.modifiers.join(", ")}
                </p>
              )}
              {item.notes && (
                <p className="text-[10px] text-amber-700 italic mt-0.5">
                  ↳ {item.notes}
                </p>
              )}
            </div>
            <span className="text-[11px] uppercase font-bold tracking-wider text-[#1a1a1a]/65">
              {item.status}
            </span>
          </div>
        ))}
      </div>

      {/* Action */}
      <div className="px-3.5 pb-3.5">
        <Can perm="kds:update">
          <button
            onClick={onClick}
            className={`w-full py-2.5 rounded-[100px] active:scale-[0.98] text-[10px] font-mono uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${btnClass}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        </Can>
      </div>
    </article>
  );
}

function KDSColumn({
  title,
  statusColor,
  dotClass,
  headerBg,
  borderClass,
  orders,
  emptyIcon: EmptyIcon,
  onAdvance,
  onComplete,
}: {
  title: string;
  statusColor: string;
  dotClass: string;
  headerBg: string;
  borderClass: string;
  orders: KdsOrderDto[];
  emptyIcon: React.ElementType;
  onAdvance: (o: KdsOrderDto) => void;
  onComplete: (o: KdsOrderDto) => void;
}) {
  return (
    <div
      className={`flex flex-col border-r ${borderClass} last:border-r-0 min-h-0 overflow-hidden`}
    >
      <div
        className={`px-4 py-3 border-b ${borderClass} flex items-center justify-between ${headerBg} shrink-0`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span
            className={`text-[11px] font-mono uppercase tracking-widest font-bold ${statusColor}`}
          >
            {title}
          </span>
        </div>
        <span className={`text-[14px] font-mono font-bold ${statusColor}`}>
          {orders.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 bg-[#FFFFFF]/60">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <EmptyIcon className="w-8 h-8 text-[#1a1a1a]/20 mb-3" />
            <p className="text-[10px] font-mono uppercase tracking-widest text-[#1a1a1a]/65">
              No orders
            </p>
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onAdvance={() => onAdvance(order)}
              onComplete={() => onComplete(order)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function KitchenDisplaySystem({
  onExit,
}: {
  onExit: () => void;
}) {
  const logoutMutation = useLogout();
  const qc = useQueryClient();
  const [params] =
    typeof window !== "undefined"
      ? [new URLSearchParams(window.location.search)]
      : [new URLSearchParams()];
  const initialStation = params.get("station") ?? undefined;
  const [station, setStation] = useState<string | undefined>(initialStation);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [pendingConfirm, setPending] = useState<PendingConfirm | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [recalledOrderId, setRecalledOrderId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  const queue = useKdsQueue(station);
  const { data: orders = [], isLoading } = queue;
  const updateStatus = useUpdateKdsItemStatus();
  const chime = useChime();
  const { data: recalledOrder } = useKdsRecall(recalledOrderId);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cache queue on successful fetch
  useEffect(() => {
    if (orders.length > 0 && isOnline) {
      saveQueueCache(orders);
    }
  }, [orders, isOnline]);

  // Use cached queue if offline
  const displayOrders = isOnline
    ? orders
    : orders.length > 0
      ? orders
      : loadQueueCache();

  // Detect all stations present (for the selector)
  const stations = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders)
      for (const i of o.items) if (i.station) set.add(i.station);
    return Array.from(set).sort();
  }, [orders]);

  // Real-time updates + audio alert on new order
  const seenIdsRef = useRef<Set<string>>(new Set(orders.map((o) => o.id)));
  useEffect(() => {
    const seen = seenIdsRef.current;
    for (const o of orders) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        if (audioEnabled && seen.size > 1) chime(); // skip chime on initial load
      }
    }
  }, [orders, audioEnabled, chime]);

  useSocket("/kds", {
    "order:new": () => {
      qc.invalidateQueries({ queryKey: ["kds"] });
    },
    "order:updated": () => qc.invalidateQueries({ queryKey: ["kds"] }),
    "order:item_status_changed": () =>
      qc.invalidateQueries({ queryKey: ["kds"] }),
    "order:cancelled": () => qc.invalidateQueries({ queryKey: ["kds"] }),
  });

  const newOrders = displayOrders.filter(
    (o) =>
      o.items.every((i) => i.status === "pending" || i.status === "accepted") &&
      o.items.some((i) => i.status !== "preparing" && i.status !== "ready"),
  );
  const preparingOrders = displayOrders.filter(
    (o) =>
      o.items.some((i) => i.status === "preparing" || i.status === "ready") &&
      o.items.some((i) => ["pending", "accepted", "preparing"].includes(i.status)) &&
      !o.items.every((i) => i.status === "ready" || i.status === "cancelled"),
  );
  const readyOrders = displayOrders.filter(
    (o) =>
      o.items.length > 0 &&
      o.items.every((i) => i.status === "ready" || i.status === "cancelled") &&
      o.items.some((i) => i.status === "ready"),
  );

  const totalItems = displayOrders.reduce((s, o) => s + o.items.length, 0);

  function requestAdvance(o: KdsOrderDto) {
    const anyPending = o.items.some(
      (i) => i.status === "pending" || i.status === "accepted",
    );
    const next: OrderItemStatus = anyPending ? "preparing" : "ready";
    setPending({
      orderId: o.id,
      orderLabel: `${o.orderNumber} · ${o.windowToken ?? (o.tableId ? "Table" : "Counter")}`,
      fromLabel: anyPending ? "New" : "Preparing",
      toLabel: anyPending ? "Preparing" : "Ready",
      status: next,
      bulk: true,
      btnLabel: anyPending ? "Move to Preparing" : "Mark as Ready",
      btnClass: anyPending
        ? "bg-blue-600 hover:bg-blue-500"
        : "bg-amber-500 hover:bg-amber-400",
    });
  }

  function requestComplete(o: KdsOrderDto) {
    setPending({
      orderId: o.id,
      orderLabel: `${o.orderNumber} · ${o.windowToken ?? (o.tableId ? "Table" : "Counter")}`,
      fromLabel: "Ready",
      toLabel: "Served",
      status: "served",
      bulk: true,
      btnLabel: "Mark as Served",
      btnClass: "bg-emerald-600 hover:bg-emerald-500",
    });
  }

  async function confirmAction() {
    if (!pendingConfirm || confirming) return;
    const o = displayOrders.find((x) => x.id === pendingConfirm.orderId);
    if (!o) return;

    const applicable = pendingConfirm.bulk
      ? o.items.filter((item) => {
          if (pendingConfirm.status === "preparing")
            return ["pending", "accepted"].includes(item.status);
          if (pendingConfirm.status === "ready")
            return ["pending", "accepted", "preparing"].includes(item.status);
          return pendingConfirm.status === "served" && item.status === "ready";
        })
      : o.items.filter((item) => item.id === pendingConfirm.itemId);
    setConfirming(true);
    try {
      // Queue concrete item IDs, never an empty ID representing a whole order.
      for (const item of applicable) {
        const action = {
          orderId: o.id,
          itemId: item.id,
          status: pendingConfirm.status,
          station: item.station,
        };
        if (!navigator.onLine) await queueOfflineAction(action);
        else await updateStatus.mutateAsync(action);
      }
      setPending(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Action could not be saved",
      );
    } finally {
      setConfirming(false);
    }
  }

  useEffect(() => {
    if (!isOnline) return;

    const syncOfflineActions = async () => {
      if (syncingOffline) return;
      syncingOffline = true;
      try {
        const actions = await getOfflineActions();
        if (actions.length === 0) return;

        for (const action of actions) {
          try {
            await updateStatus.mutateAsync({
              orderId: action.orderId,
              itemId: action.itemId,
              status: action.status,
              station: action.station,
            });
            await removeOfflineAction(action.id);
          } catch {
            // Retry on next sync
            break;
          }
        }
      } finally {
        syncingOffline = false;
      }
      qc.invalidateQueries({ queryKey: ["kds"] });
    };

    syncOfflineActions();
  }, [isOnline]);

  return (
    <div className="min-h-[calc(100dvh-68px)] md:h-[calc(100dvh-68px)] bg-[#FFFFFF] text-[#1a1a1a] flex flex-col font-sans overflow-hidden">
      {/* Top Bar */}
      <div className="operations-bar border-b border-[rgba(26,26,26,0.12)] px-4 md:px-6 py-3 flex items-center justify-between bg-[#1a1a1a] shrink-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#E8447A] flex items-center justify-center shrink-0">
            <ChefHat className="w-4 h-4 text-[#1a1a1a]" />
          </div>
          <div>
            <h1 className="text-[13px] font-black uppercase tracking-[0.15em] text-[#FFFFFF]">
              Kitchen Display
            </h1>
            <p className="text-[11px] text-[#FFFFFF]/75 uppercase tracking-widest">
              PINKY PROMISE · KITCHEN
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Station picker - hidden if URL specifies station */}
          {!initialStation && (
            <select
              aria-label="Kitchen station"
              value={station ?? ""}
              onChange={(e) => setStation(e.target.value || undefined)}
              className="bg-[rgba(255,255,255,0.05)] border border-[rgba(240,234,210,0.15)] text-[#FFFFFF]/80 rounded-lg text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 hover:border-[#FFFFFF]/40 transition-colors focus:outline-none"
            >
              <option value="">ALL STATIONS</option>
              {stations.map((s) => (
                <option key={s} value={s}>
                  {s.toUpperCase()}
                </option>
              ))}
            </select>
          )}

          {/* Station display when loaded via URL */}
          {initialStation && (
            <div className="flex items-center gap-1.5 text-[10px] text-[#1BC8C8] border border-[#1BC8C8]/40 bg-[#1BC8C8]/15 px-3 py-1.5 rounded">
              <div className="w-1.5 h-1.5 rounded-full bg-[#1BC8C8]" />
              Station: {initialStation.toUpperCase()}
            </div>
          )}

          {/* Stats pills */}
          <div className="hidden sm:flex items-center gap-1.5">
            {[
              {
                label: "New",
                count: newOrders.length,
                color: "text-[#E8447A]",
                bg: "bg-[#E8447A]/15 border-[#E8447A]/40",
              },
              {
                label: "Prep",
                count: preparingOrders.length,
                color: "text-amber-400",
                bg: "bg-amber-900/30 border-amber-700/40",
              },
              {
                label: "Ready",
                count: readyOrders.length,
                color: "text-[#1BC8C8]",
                bg: "bg-[#1BC8C8]/15 border-[#1BC8C8]/40",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${s.bg}`}
              >
                <span className={`text-[12px] font-mono font-bold ${s.color}`}>
                  {s.count}
                </span>
                <span className="text-[11px] text-[#FFFFFF]/80 uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[10px] text-[#FFFFFF]/80 border border-[rgba(240,234,210,0.15)] px-2 py-1 rounded">
            <Utensils className="w-3 h-3" />
            <span>{totalItems} items active</span>
          </div>

          <button
            onClick={() => setAudioEnabled((v) => !v)}
            title={audioEnabled ? "Mute alerts" : "Unmute alerts"}
            className="flex items-center gap-1.5 text-[10px] text-[#FFFFFF]/80 border border-[rgba(240,234,210,0.15)] px-2 py-1 rounded hover:border-[#FFFFFF]/40 hover:text-[#FFFFFF] transition-all"
          >
            {audioEnabled ? (
              <Volume2 className="w-3 h-3" />
            ) : (
              <VolumeX className="w-3 h-3" />
            )}
          </button>

          <div className="flex items-center gap-1.5 text-[10px] text-[#1BC8C8] border border-[#1BC8C8]/40 bg-[#1BC8C8]/15 px-2.5 py-1 rounded">
            <div className="w-1.5 h-1.5 rounded-full bg-[#1BC8C8] animate-pulse" />
            {isOnline ? "Updating" : "Offline"}
          </div>

          <Can perm="kds:update">
            <button
              onClick={() => setRecalledOrderId(readyOrders[0]?.id ?? null)}
              disabled={readyOrders.length === 0}
              title={
                readyOrders.length > 0
                  ? "Recall last completed order"
                  : "No orders to recall"
              }
              className="flex items-center gap-1.5 text-[10px] text-[#1BC8C8]/70 border border-[#1BC8C8]/20 px-2 py-1 rounded hover:border-[#1BC8C8]/60 hover:text-[#1BC8C8] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3 h-3" />
              Recall
            </button>
          </Can>

          <button
            onClick={onExit}
            className="flex items-center gap-1.5 text-[10px] font-mono text-[#FFFFFF]/80 border border-[rgba(240,234,210,0.15)] px-2.5 py-1.5 rounded hover:border-[#FFFFFF]/40 hover:text-[#FFFFFF] transition-all uppercase tracking-widest cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            Exit
          </button>
          <button
            onClick={() => logoutMutation.mutate()}
            className="flex items-center gap-1.5 text-[10px] font-mono text-[#E8447A]/70 border border-[#E8447A]/20 px-2.5 py-1.5 rounded hover:border-[#E8447A]/60 hover:text-[#E8447A] transition-all uppercase tracking-widest cursor-pointer"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 md:px-6 py-2 flex items-center gap-2 text-[11px] text-amber-700 font-mono">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          OFFLINE MODE — Changes will sync when connectivity returns
        </div>
      )}

      {/* Timer Legend */}
      <div className="border-b border-[rgba(26,26,26,0.10)] px-4 md:px-6 py-2 flex flex-wrap items-center gap-3 md:gap-6 bg-[#FFFFFF] shrink-0">
        <span className="text-[11px] font-mono text-[#1a1a1a]/65 uppercase tracking-widest">
          Timer:
        </span>
        {[
          {
            label: `< ${COLOR_THRESHOLDS.AMBER} min — On track`,
            color: "text-emerald-600",
            dot: "bg-emerald-500",
          },
          {
            label: `${COLOR_THRESHOLDS.AMBER}–${COLOR_THRESHOLDS.RED} min — Watch`,
            color: "text-amber-600",
            dot: "bg-amber-500",
          },
          {
            label: `> ${COLOR_THRESHOLDS.RED} min — Urgent`,
            color: "text-red-600",
            dot: "bg-red-500",
          },
        ].map((t) => (
          <div key={t.label} className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
            <span className={`text-[11px] font-mono ${t.color}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>

      {/* Three Columns */}
      {queue.isError && !queue.data ? (
        <PageState
          kind="error"
          title="Kitchen queue unavailable"
          description="Retry before treating the queue as clear."
          action={
            <button className="ui-button" onClick={() => queue.refetch()}>
              Retry kitchen queue
            </button>
          }
        />
      ) : isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[#1a1a1a]/65 text-sm inline-flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading kitchen queue…
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 overflow-auto md:overflow-hidden min-h-0">
          <KDSColumn
            title="New Orders"
            statusColor="text-[#E8447A]"
            dotClass="bg-[#E8447A] animate-pulse"
            headerBg="bg-[#E8447A]/15"
            borderClass="border-[#E8447A]/30"
            orders={newOrders}
            emptyIcon={Clock}
            onAdvance={requestAdvance}
            onComplete={requestComplete}
          />
          <KDSColumn
            title="Preparing"
            statusColor="text-amber-600"
            dotClass="bg-amber-500"
            headerBg="bg-amber-50"
            borderClass="border-amber-200"
            orders={preparingOrders}
            emptyIcon={ChefHat}
            onAdvance={requestAdvance}
            onComplete={requestComplete}
          />
          <KDSColumn
            title="Ready to Serve"
            statusColor="text-[#1BC8C8]"
            dotClass="bg-[#1BC8C8]"
            headerBg="bg-[#1BC8C8]/10"
            borderClass="border-[#1BC8C8]/25"
            orders={readyOrders}
            emptyIcon={Package}
            onAdvance={requestAdvance}
            onComplete={requestComplete}
          />
        </div>
      )}

      {/* Confirmation Modal */}
      {pendingConfirm && (
        <Dialog
          label="Kitchen Display System details"
          onClose={() => setPending(null)}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setPending(null)}
        >
          <div className="bg-[#FFFFFF] rounded-[22px] border border-[rgba(26,26,26,0.18)] shadow-2xl p-6 max-w-sm w-full animate-[fadeIn_0.2s_ease-out] relative">
            <button
              onClick={() => setPending(null)}
              className="absolute top-4 right-4 text-[#1a1a1a]/65 hover:text-[#1a1a1a] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-[#E8447A]/20 border border-[#E8447A]/40 flex items-center justify-center mb-4">
              {pendingConfirm.status === "served" ? (
                <CheckCheck className="w-5 h-5 text-[#1a1a1a]" />
              ) : (
                <ArrowRight className="w-5 h-5 text-[#1a1a1a]" />
              )}
            </div>

            <h3 className="text-[15px] font-black uppercase text-[#1a1a1a] mb-1">
              {pendingConfirm.status === "served"
                ? "Mark as Served?"
                : "Move Order?"}
            </h3>

            <div className="flex items-center gap-2 my-3">
              <span className="text-[12px] font-mono font-semibold text-[#1a1a1a] bg-[rgba(26,26,26,0.08)] px-2.5 py-1 rounded-lg">
                {pendingConfirm.fromLabel}
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-[#1a1a1a]/65 shrink-0" />
              <span className="text-[12px] font-mono font-semibold text-[#1a1a1a] bg-[rgba(26,26,26,0.08)] px-2.5 py-1 rounded-lg">
                {pendingConfirm.toLabel}
              </span>
            </div>

            <p className="text-[12px] text-[#1a1a1a]/50 mb-1">
              <span className="font-medium text-[#1a1a1a]">
                {pendingConfirm.orderLabel}
              </span>
            </p>

            <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 mt-3 text-[10px] text-amber-700">
              <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
              This transitions every applicable item on the order.
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setPending(null)}
                className="flex-1 py-2.5 rounded-xl border border-[rgba(26,26,26,0.18)] text-[12px] font-medium text-[#1a1a1a]/60 hover:bg-[rgba(26,26,26,0.05)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <Can perm="kds:update">
                <button
                  onClick={confirmAction}
                  disabled={confirming || updateStatus.isPending}
                  className={`flex-1 py-2.5 rounded-[100px] text-white text-[12px] font-semibold transition-colors cursor-pointer shadow-sm inline-flex items-center justify-center gap-2 ${pendingConfirm.btnClass} disabled:opacity-50`}
                >
                  {updateStatus.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  {pendingConfirm.btnLabel}
                </button>
              </Can>
            </div>
          </div>
        </Dialog>
      )}

      {/* Recalled Order Modal */}
      {recalledOrder && (
        <Dialog
          label="Kitchen Display System details"
          onClose={() => setRecalledOrderId(null)}
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        >
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[rgba(26,26,26,0.10)] px-6 py-4 flex items-center justify-between">
              <h2 className="text-[16px] font-barlow font-black uppercase text-[#1a1a1a]">
                Last Completed Order
              </h2>
              <button
                onClick={() => setRecalledOrderId(null)}
                className="text-[#1a1a1a]/65 hover:text-[#1a1a1a] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#1a1a1a]/50 uppercase tracking-wider">
                    Order Number
                  </p>
                  <p className="text-[18px] font-black font-mono text-[#1a1a1a]">
                    {recalledOrder.orderNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-[#1a1a1a]/50 uppercase tracking-wider">
                    Status
                  </p>
                  <p className="text-[14px] font-black text-emerald-600 uppercase">
                    {recalledOrder.status}
                  </p>
                </div>
              </div>

              <div className="border-t border-[rgba(26,26,26,0.08)] pt-4">
                <p className="text-[11px] font-barlow font-black uppercase text-[#1a1a1a] mb-3">
                  Items
                </p>
                <div className="space-y-2">
                  {recalledOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-[12px]"
                    >
                      <span className="text-[#1a1a1a]/70">
                        {item.qty}× {item.name}
                      </span>
                      <span className="font-mono text-[#1a1a1a]/50">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-[rgba(26,26,26,0.08)] pt-4">
                <p className="text-[12px] text-[#1a1a1a]/50">
                  Completed ticket details
                </p>
              </div>

              <button
                onClick={() => setRecalledOrderId(null)}
                className="w-full py-3 bg-[#1a1a1a] text-white rounded-xl text-[13px] font-barlow font-black uppercase hover:bg-[#1a1a1a]/80 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
