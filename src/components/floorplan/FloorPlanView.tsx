import RoomPreview from "@/components/serviceRoom/RoomPreview";
import { TABLE_STATUS_LABELS } from "@/lib/dto/tables";
import { formatCurrency } from "@/lib/currencies";
import { useEffect, useMemo, useRef, useState } from "react";
import type { TableDto, TableShape, TableStatus } from "@/lib/dto/tables";

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export interface TableOccupant {
  currency?: string;
  /** Customer / guest display name (shown as initial in chair). */
  name?: string;
  /** Server who owns the table — used to color-code the small dot. */
  serverName?: string;
  /** Minutes since seated. */
  seatedMins?: number;
  /** Running bill total. */
  runningTotal?: number;
  /** Item count in active order. */
  itemCount?: number;
  /** Number of guests at the table. Defaults to capacity if undefined. */
  guestCount?: number;
}

export interface FloorPlanViewProps {
  tables: TableDto[];
  /** Optional per-table occupants — keyed by table _id. */
  occupants?: Record<string, TableOccupant>;
  /** When true the user can drag tables; saves via onPositionChange. */
  editable?: boolean;
  /** Called when a table is dropped at a new position. */
  onPositionChange?: (
    tableId: string,
    position: { x: number; y: number },
  ) => void;
  /** Called when a table is clicked (always, regardless of edit mode). */
  onTableClick?: (table: TableDto) => void;
  /** Currently selected table id — highlights it. */
  selectedId?: string | null;
  /** Tables marked as "action target" during merge/move mode get a dashed ring. */
  highlightedIds?: Set<string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Visual constants
// ─────────────────────────────────────────────────────────────────────────────

const CANVAS_WIDTH = 1400;
const CANVAS_HEIGHT = 900;

const STATUS_COLORS: Record<
  TableStatus,
  { fill: string; stroke: string; chair: string; text: string }
> = {
  vacant: {
    fill: "#ecfdf5",
    stroke: "#10b981",
    chair: "#a7f3d0",
    text: "#047857",
  },
  seated: {
    fill: "#eff6ff",
    stroke: "#3b82f6",
    chair: "#bfdbfe",
    text: "#1d4ed8",
  },
  ordered: {
    fill: "#fffbeb",
    stroke: "#f59e0b",
    chair: "#fde68a",
    text: "#b45309",
  },
  awaiting_bill: {
    fill: "#fff1f2",
    stroke: "#f43f5e",
    chair: "#fecdd3",
    text: "#be123c",
  },
  cleaning: {
    fill: "#f5f5f4",
    stroke: "#a8a29e",
    chair: "#e7e5e4",
    text: "#57534e",
  },
};

const SERVER_COLORS = [
  "#ec4899", // pink
  "#8b5cf6", // violet
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#06b6d4", // cyan
  "#a855f7", // purple
];

const ZONE_STYLES: Record<
  string,
  { bg: string; border: string; emoji: string; label: string }
> = {
  Window: {
    bg: "url(#zoneSky)",
    border: "#bfdbfe",
    emoji: "☀",
    label: "Window",
  },
  "Main Floor": {
    bg: "#fafaf9",
    border: "#e7e5e4",
    emoji: "🍽",
    label: "Main Floor",
  },
  "Bar Counter": {
    bg: "#fef3c7",
    border: "#fcd34d",
    emoji: "🍸",
    label: "Bar Counter",
  },
  "Patio Garden": {
    bg: "url(#zonePatio)",
    border: "#bbf7d0",
    emoji: "🌿",
    label: "Patio Garden",
  },
};

const DEFAULT_ZONE_STYLE = {
  bg: "#fafafa",
  border: "#e5e7eb",
  emoji: "📍",
  label: "Floor",
};

// Default zone layout when no zones are explicit — full canvas
const ZONE_LAYOUT: Record<
  string,
  { x: number; y: number; w: number; h: number }
> = {
  Window: { x: 40, y: 40, w: 1320, h: 200 },
  "Main Floor": { x: 40, y: 260, w: 880, h: 440 },
  "Bar Counter": { x: 40, y: 720, w: 880, h: 140 },
  "Patio Garden": { x: 940, y: 260, w: 420, h: 600 },
};

// Auto-position grid within a zone (used when table has no saved position)
function autoLayout(
  table: TableDto,
  zoneTables: TableDto[],
): { x: number; y: number } {
  const zone = table.zone ?? "Main Floor";
  const box = ZONE_LAYOUT[zone] ?? { x: 40, y: 260, w: 880, h: 440 };
  const idx = zoneTables.findIndex((t) => t._id === table._id);
  const cols = Math.max(1, Math.floor((box.w - 100) / 180));
  const col = idx % cols;
  const row = Math.floor(idx / cols);
  return {
    x: box.x + 90 + col * 180,
    y: box.y + 100 + row * 160,
  };
}

function serverColor(name?: string): string {
  if (!name) return "#9ca3af";
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return SERVER_COLORS[Math.abs(h) % SERVER_COLORS.length];
}

function shapeFor(table: TableDto): TableShape {
  if (table.shape) return table.shape;
  if (table.capacity <= 2) return "round";
  if (table.capacity >= 5) return "rect";
  return "square";
}

function tableDims(
  shape: TableShape,
  capacity: number,
): { w: number; h: number } {
  if (shape === "round") {
    const r = Math.max(38, 30 + capacity * 4);
    return { w: r * 2, h: r * 2 };
  }
  if (shape === "rect") {
    return { w: 130 + Math.min(capacity, 8) * 6, h: 76 };
  }
  return { w: 90, h: 90 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function FloorPlanView({
  tables,
  occupants = {},
  editable = false,
  onPositionChange,
  onTableClick,
  selectedId,
  highlightedIds,
}: FloorPlanViewProps) {
  const [roomView, setRoomView] = useState(true);
  const showRoom = roomView && !editable;
  const dropped = useRef<{x:number; y:number} | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [pendingPositions, setPendingPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [hoverId, setHoverId] = useState<string | null>(null);

  // Group tables by zone and compute resolved positions
  const { tablesWithPos, zones } = useMemo(() => {
    const zoneMap = new Map<string, TableDto[]>();
    for (const t of tables) {
      const z = t.zone ?? "Main Floor";
      if (!zoneMap.has(z)) zoneMap.set(z, []);
      zoneMap.get(z)!.push(t);
    }
    const occupied = tables.flatMap(t => {
      const pos = pendingPositions[t._id] ?? t.position;
      return pos ? [pos] : [];
    });
    const resolved = tables.map((t) => {
      const saved = pendingPositions[t._id] ?? t.position;
      if (saved) return { ...t, _pos: saved };
      const zoneTables = zoneMap.get(t.zone ?? "Main Floor") ?? [];
      const preferred = autoLayout(t, zoneTables);
      let pos = preferred;
      // Custom zones have no reserved rectangle. Keep their unsaved tables distinct.
      if (occupied.some(p => Math.abs(p.x-pos.x)<130 && Math.abs(p.y-pos.y)<115)) {
        for (let i=0; i<40; i++) {
          const slot = {x:100+(i%8)*168,y:105+Math.floor(i/8)*155};
          if (!occupied.some(p => Math.abs(p.x-slot.x)<130 && Math.abs(p.y-slot.y)<115)) { pos=slot; break; }
        }
      }
      occupied.push(pos);
      return { ...t, _pos: pos };
    });
    return { tablesWithPos: resolved, zones: Array.from(zoneMap.keys()) };
  }, [tables, pendingPositions]);

  // Convert client coords → SVG canvas coords
  function clientToSvg(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
  }

  function onPointerDown(
    e: React.PointerEvent,
    table: (typeof tablesWithPos)[number],
  ) {
    if (!editable) {
      onTableClick?.(table);
      return;
    }
    if (highlightedIds && highlightedIds.has(table._id)) {
      // In an action mode — treat as click
      onTableClick?.(table);
      return;
    }
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const pt = clientToSvg(e.clientX, e.clientY);
    dropped.current = null;
    setDragId(table._id);
    setDragOffset({ x: pt.x - table._pos.x, y: pt.y - table._pos.y });
  }

  useEffect(() => {
    if (!dragId) return;
    const move = (e: PointerEvent) => {
      const pt = clientToSvg(e.clientX, e.clientY);
      const nx = Math.max(60, Math.min(CANVAS_WIDTH - 60, pt.x - dragOffset.x));
      const ny = Math.max(
        60,
        Math.min(CANVAS_HEIGHT - 60, pt.y - dragOffset.y),
      );
      // Snap to 10px grid for cleanliness
      const sx = Math.round(nx / 10) * 10;
      const sy = Math.round(ny / 10) * 10;
      dropped.current = { x: sx, y: sy };
      setPendingPositions((prev) => ({ ...prev, [dragId]: { x: sx, y: sy } }));
    };
    const up = () => {
      const finalPos = dropped.current;
      if (finalPos) onPositionChange?.(dragId, finalPos);
      setPendingPositions(previous => {
        const next = { ...previous };
        delete next[dragId];
        return next;
      });
      setDragId(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, dragOffset]);

  return (
    <div>
      {!editable && <div className="mb-3 inline-flex rounded-xl border bg-white p-1" role="group" aria-label="Floor perspective">
        {[{room:true,label:"3D dining room"},{room:false,label:"Overhead plan"}].map(option =>
          <button type="button" key={option.label} aria-pressed={roomView === option.room}
            className="min-h-10 rounded-lg px-3 text-sm aria-pressed:bg-stone-800 aria-pressed:text-white"
            onClick={()=>setRoomView(option.room)}>{option.label}</button>)}
      </div>}
      {showRoom ? <RoomPreview selected={selectedId} onSelect={id=>{
        const table=tables.find(t=>t._id===id);
        if (table) onTableClick?.(table);
      }} objects={tablesWithPos.map(table=>({
        id:table._id, label:"Table " + table.number, detail: [TABLE_STATUS_LABELS[table.status],
          table.capacity + " seats", table.zone, occupants[table._id]?.guestCount != null ? occupants[table._id].guestCount + " guests" : undefined].filter(Boolean).join(" · "),
        x:table._pos.x/70,z:table._pos.y/70,kind:shapeFor(table),capacity:table.capacity,
        status:table.status,highlighted:highlightedIds?.has(table._id),
      }))}/> : <div className="relative w-full bg-gradient-to-br from-stone-50 via-amber-50/30 to-rose-50/30 rounded-2xl border border-stone-200 overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="w-full h-auto block touch-none select-none"
        style={{ maxHeight: "78vh" }}
      >
        <defs>
          {/* Window zone — sky gradient with subtle rays */}
          <linearGradient id="zoneSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dbeafe" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#eff6ff" stopOpacity="0.4" />
          </linearGradient>
          {/* Patio zone — grass gradient */}
          <linearGradient id="zonePatio" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d1fae5" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ecfdf5" stopOpacity="0.4" />
          </linearGradient>
          {/* Subtle grid for visual depth */}
          <pattern
            id="grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke="rgba(0,0,0,0.03)"
              strokeWidth="1"
            />
          </pattern>
          {/* Pulse animation for awaiting_bill */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background grid */}
        <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#grid)" />

        {/* Kitchen / entrance landmarks */}
        <KitchenBlock />
        <EntranceBlock />

        {/* Zones */}
        {zones.map((zoneName) => (
          <ZoneCard key={zoneName} name={zoneName} />
        ))}

        {/* Tables */}
        {tablesWithPos.map((table) => {
          const occ = occupants[table._id];
          const isSelected = selectedId === table._id;
          const isHighlighted = highlightedIds?.has(table._id) ?? false;
          const isHovered = hoverId === table._id;
          const isDragging = dragId === table._id;
          return (
            <TableNode
              key={table._id}
              table={table}
              occupant={occ}
              isSelected={isSelected}
              isHighlighted={isHighlighted}
              isHovered={isHovered}
              isDragging={isDragging}
              editable={editable}
              onPointerDown={(e) => onPointerDown(e, table)}
              onPointerEnter={() => setHoverId(table._id)}
              onPointerLeave={() => setHoverId(null)}
            />
          );
        })}

        {/* Tooltip overlay (rendered last so it's on top) */}
        {hoverId &&
          (() => {
            const t = tablesWithPos.find((x) => x._id === hoverId);
            if (!t) return null;
            const occ = occupants[t._id];
            return <Tooltip table={t} occupant={occ} />;
          })()}
      </svg>

      {/* Edit-mode hint */}
      {editable && (
        <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg border border-brand-200 text-xs text-brand-700 font-semibold flex items-center gap-2 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-brand-500 animate-pulse" />
          Edit mode · drag tables to reposition
        </div>
      )}

      {/* Status legend */}
      <Legend />
    </div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Zone cards
// ─────────────────────────────────────────────────────────────────────────────

function ZoneCard({ name }: { name: string }) {
  const layout = ZONE_LAYOUT[name];
  const style = ZONE_STYLES[name] ?? DEFAULT_ZONE_STYLE;
  if (!layout) return null;
  return (
    <g>
      <rect
        x={layout.x}
        y={layout.y}
        width={layout.w}
        height={layout.h}
        rx={20}
        fill={style.bg}
        stroke={style.border}
        strokeWidth={1.5}
        strokeDasharray="6 6"
      />
      <text
        x={layout.x + 20}
        y={layout.y + 28}
        fontSize={13}
        fontWeight={700}
        letterSpacing={2}
        fill="rgba(0,0,0,0.45)"
      >
        {style.emoji} {style.label.toUpperCase()}
      </text>
    </g>
  );
}

function KitchenBlock() {
  return (
    <g>
      <rect
        x={CANVAS_WIDTH - 200}
        y={20}
        width={180}
        height={70}
        rx={8}
        fill="#fafaf9"
        stroke="#d6d3d1"
        strokeWidth={1.5}
      />
      <text
        x={CANVAS_WIDTH - 110}
        y={55}
        fontSize={13}
        fontWeight={700}
        textAnchor="middle"
        fill="#78716c"
      >
        👨‍🍳 KITCHEN
      </text>
      <text
        x={CANVAS_WIDTH - 110}
        y={72}
        fontSize={9}
        textAnchor="middle"
        fill="#a8a29e"
      >
        pass • expo
      </text>
    </g>
  );
}

function EntranceBlock() {
  return (
    <g>
      <rect
        x={20}
        y={20}
        width={120}
        height={50}
        rx={6}
        fill="#fef3c7"
        stroke="#fcd34d"
        strokeWidth={1.5}
      />
      <text
        x={80}
        y={50}
        fontSize={11}
        fontWeight={700}
        textAnchor="middle"
        fill="#92400e"
      >
        🚪 ENTRANCE
      </text>
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table node — handles shape + chairs + avatars + animations
// ─────────────────────────────────────────────────────────────────────────────

interface TableNodeProps {
  table: TableDto & { _pos: { x: number; y: number } };
  occupant?: TableOccupant;
  isSelected: boolean;
  isHighlighted: boolean;
  isHovered: boolean;
  isDragging: boolean;
  editable: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}

function TableNode({
  table,
  occupant,
  isSelected,
  isHighlighted,
  isHovered,
  isDragging,
  editable,
  onPointerDown,
  onPointerEnter,
  onPointerLeave,
}: TableNodeProps) {
  const shape = shapeFor(table);
  const { w, h } = tableDims(shape, table.capacity);
  const status = table.status;
  const colors = STATUS_COLORS[status];
  const cx = table._pos.x;
  const cy = table._pos.y;
  const isOccupied = status !== "vacant" && status !== "cleaning";
  const guestCount = occupant?.guestCount ?? (isOccupied ? table.capacity : 0);

  // Chairs around the table
  const chairs = useMemo(
    () => placeChairs(shape, w, h, table.capacity),
    [shape, w, h, table.capacity],
  );

  return (
    <g
      transform={`translate(${cx}, ${cy})`}
      onPointerDown={onPointerDown}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        cursor: editable ? (isDragging ? "grabbing" : "grab") : "pointer",
        transition: isDragging ? "none" : "transform 0.15s ease",
      }}
    >
      {/* Selection / highlight ring */}
      {isSelected && (
        <ShapeOutline
          shape={shape}
          w={w + 22}
          h={h + 22}
          stroke="#ec4899"
          strokeWidth={3}
          dash=""
        />
      )}
      {isHighlighted && !isSelected && (
        <ShapeOutline
          shape={shape}
          w={w + 22}
          h={h + 22}
          stroke="#3b82f6"
          strokeWidth={2.5}
          dash="6 4"
        />
      )}

      {/* Pulsing ring for awaiting_bill */}
      {status === "awaiting_bill" && (
        <ShapeOutline
          shape={shape}
          w={w + 28}
          h={h + 28}
          stroke="#f43f5e"
          strokeWidth={2}
          dash="3 3"
          className="animate-pulse"
        />
      )}

      {/* Chairs (drawn BEHIND the table) */}
      {chairs.map((chair, i) => {
        const occupiedThisChair = i < guestCount;
        const guestInitial =
          occupiedThisChair && occupant?.name
            ? occupant.name.trim().charAt(0).toUpperCase()
            : "";
        return (
          <Chair
            key={i}
            x={chair.x}
            y={chair.y}
            rotation={chair.rotation}
            occupied={occupiedThisChair}
            color={colors.chair}
            border={colors.stroke}
            initial={i === 0 ? guestInitial : ""}
          />
        );
      })}

      {/* Table body */}
      <TableBody
        shape={shape}
        w={w}
        h={h}
        fill={colors.fill}
        stroke={colors.stroke}
      />

      {/* Cleaning overlay */}
      {status === "cleaning" && (
        <g opacity={0.85}>
          <ShapeOutline
            shape={shape}
            w={w}
            h={h}
            stroke="none"
            pattern="cleanPattern"
          />
          <text x={0} y={4} fontSize={14} textAnchor="middle" fill="#78716c">
            🧹
          </text>
        </g>
      )}

      {/* Table label */}
      <text
        x={0}
        y={-2}
        fontSize={shape === "round" && w < 100 ? 13 : 16}
        fontWeight={800}
        textAnchor="middle"
        fill={colors.text}
        pointerEvents="none"
      >
        {table.number}
      </text>

      {/* Capacity / running info */}
      {isOccupied && occupant ? (
        <>
          <text
            x={0}
            y={14}
            fontSize={8.5}
            textAnchor="middle"
            fill={colors.text}
            opacity={0.85}
            pointerEvents="none"
          >
            {occupant.seatedMins != null ? `${occupant.seatedMins} min` : ""}
          </text>
          {occupant.runningTotal != null && (
            <text
              x={0}
              y={24}
              fontSize={9.5}
              fontWeight={700}
              textAnchor="middle"
              fill={colors.text}
              pointerEvents="none"
            >
              {formatCurrency(
                occupant.runningTotal,
                occupant.currency ?? "INR",
              )}
            </text>
          )}
        </>
      ) : (
        <text
          x={0}
          y={14}
          fontSize={9}
          textAnchor="middle"
          fill={colors.text}
          opacity={0.6}
          pointerEvents="none"
        >
          {table.capacity}-seat
        </text>
      )}

      {/* Server color dot */}
      {occupant?.serverName && (
        <g>
          <circle
            cx={w / 2 - 8}
            cy={-h / 2 + 8}
            r={5}
            fill={serverColor(occupant.serverName)}
            stroke="white"
            strokeWidth={1.5}
          />
        </g>
      )}

      {/* Steam emoji for active orders (animated bobbing) */}
      {status === "ordered" && (
        <text
          x={0}
          y={-h / 2 - 8}
          fontSize={14}
          textAnchor="middle"
          opacity={isHovered ? 1 : 0.6}
          pointerEvents="none"
        >
          <animate
            attributeName="y"
            values={`${-h / 2 - 8};${-h / 2 - 14};${-h / 2 - 8}`}
            dur="2s"
            repeatCount="indefinite"
          />
          ♨
        </text>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — shapes and chairs
// ─────────────────────────────────────────────────────────────────────────────

function TableBody({
  shape,
  w,
  h,
  fill,
  stroke,
}: {
  shape: TableShape;
  w: number;
  h: number;
  fill: string;
  stroke: string;
}) {
  if (shape === "round") {
    return (
      <circle
        cx={0}
        cy={0}
        r={w / 2}
        fill={fill}
        stroke={stroke}
        strokeWidth={2.5}
      />
    );
  }
  const rx = shape === "rect" ? 14 : 10;
  return (
    <rect
      x={-w / 2}
      y={-h / 2}
      width={w}
      height={h}
      rx={rx}
      fill={fill}
      stroke={stroke}
      strokeWidth={2.5}
    />
  );
}

function ShapeOutline({
  shape,
  w,
  h,
  stroke,
  strokeWidth,
  dash,
  className,
  pattern,
}: {
  shape: TableShape;
  w: number;
  h: number;
  stroke: string;
  strokeWidth?: number;
  dash?: string;
  className?: string;
  pattern?: string;
}) {
  const props = {
    fill: pattern ? `url(#${pattern})` : "none",
    stroke,
    strokeWidth,
    strokeDasharray: dash,
    className,
  };
  if (shape === "round") {
    return <circle cx={0} cy={0} r={w / 2} {...props} />;
  }
  return <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={14} {...props} />;
}

interface ChairPos {
  x: number;
  y: number;
  rotation: number;
}

function placeChairs(
  shape: TableShape,
  w: number,
  h: number,
  capacity: number,
): ChairPos[] {
  const chairs: ChairPos[] = [];
  const cap = Math.max(1, Math.min(capacity, 12));

  if (shape === "round") {
    const r = w / 2 + 14;
    for (let i = 0; i < cap; i++) {
      const angle = (i / cap) * Math.PI * 2 - Math.PI / 2;
      chairs.push({
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        rotation: (angle * 180) / Math.PI + 90,
      });
    }
  } else if (shape === "square") {
    // Distribute chairs evenly across sides (top, bottom, left, right) so small
    // tables sit on opposite sides instead of bunching on two adjacent corners.
    const gap = 16;
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < cap; i++) counts[i % 4]++;
    const along = (len: number, i: number, count: number) => {
      if (count === 1) return 0;
      const inset = 18;
      const usable = len - inset * 2;
      return -len / 2 + inset + usable * (i / (count - 1));
    };
    const [top, bottom, left, right] = counts;
    for (let i = 0; i < top; i++)
      chairs.push({ x: along(w, i, top), y: -h / 2 - gap, rotation: 0 });
    for (let i = 0; i < bottom; i++)
      chairs.push({ x: along(w, i, bottom), y: h / 2 + gap, rotation: 180 });
    for (let i = 0; i < left; i++)
      chairs.push({ x: -w / 2 - gap, y: along(h, i, left), rotation: 270 });
    for (let i = 0; i < right; i++)
      chairs.push({ x: w / 2 + gap, y: along(h, i, right), rotation: 90 });
  } else {
    // rect — chairs on long top + bottom + short ends
    const longSideCap = Math.max(2, Math.floor(cap * 0.4));
    const endsCap = Math.max(0, cap - longSideCap * 2);
    for (let i = 0; i < longSideCap; i++) {
      const t = longSideCap === 1 ? 0.5 : i / (longSideCap - 1);
      chairs.push({
        x: -w / 2 + 16 + (w - 32) * t,
        y: -h / 2 - 14,
        rotation: 0,
      });
    }
    for (let i = 0; i < longSideCap; i++) {
      const t = longSideCap === 1 ? 0.5 : i / (longSideCap - 1);
      chairs.push({
        x: -w / 2 + 16 + (w - 32) * t,
        y: h / 2 + 14,
        rotation: 180,
      });
    }
    if (endsCap > 0) {
      chairs.push({ x: -w / 2 - 14, y: 0, rotation: 270 });
      if (endsCap > 1) chairs.push({ x: w / 2 + 14, y: 0, rotation: 90 });
    }
  }
  return chairs.slice(0, cap);
}

function Chair({
  x,
  y,
  rotation,
  occupied,
  color,
  border,
  initial,
}: {
  x: number;
  y: number;
  rotation: number;
  occupied: boolean;
  color: string;
  border: string;
  initial?: string;
}) {
  const seatFill = occupied ? color : "white";
  const backFill = occupied ? border : "#cbd5e1";
  return (
    <g
      transform={`translate(${x}, ${y}) rotate(${rotation})`}
      opacity={occupied ? 1 : 0.85}
    >
      {/* Backrest bar (outer edge, away from the table) */}
      <rect
        x={-11}
        y={-14}
        width={22}
        height={5.5}
        rx={2.75}
        fill={backFill}
      />
      {/* Seat — rounded square, reads as a top-down chair */}
      <rect
        x={-11}
        y={-9}
        width={22}
        height={19}
        rx={6}
        fill={seatFill}
        stroke={border}
        strokeWidth={1.75}
      />
      {occupied && initial && (
        <text
          x={0}
          y={4}
          fontSize={11}
          fontWeight={800}
          textAnchor="middle"
          fill="white"
          transform={`rotate(${-rotation})`}
        >
          {initial}
        </text>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip — appears next to hovered table
// ─────────────────────────────────────────────────────────────────────────────

function Tooltip({
  table,
  occupant,
}: {
  table: TableDto & { _pos: { x: number; y: number } };
  occupant?: TableOccupant;
}) {
  const w = 380;
  const h = occupant?.name ? 156 : 96;
  const tx = Math.min(table._pos.x + 60, CANVAS_WIDTH - w - 20);
  const ty = Math.max(40, table._pos.y - h - 20);
  return (
    <g transform={`translate(${tx}, ${ty})`} pointerEvents="none">
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={18}
        fill="rgba(17, 24, 39, 0.96)"
      />
      <text x={26} y={46} fontSize={28} fontWeight={700} fill="white">
        Table {table.number}
      </text>
      <text x={26} y={74} fontSize={19} fill="#c9cdd6">
        {table.zone ?? "Floor"} · {table.capacity}-seat ·{" "}
        {table.status.replace("_", " ")}
      </text>
      {occupant?.name && (
        <>
          <text x={26} y={112} fontSize={21} fontWeight={600} fill="#fbcfe8">
            {occupant.name}
          </text>
          <text x={26} y={138} fontSize={17} fill="#c9cdd6">
            {occupant.seatedMins != null ? `${occupant.seatedMins} min` : ""}
            {occupant.runningTotal != null
              ? `  ·  ${formatCurrency(occupant.runningTotal, occupant.currency ?? "INR")}`
              : ""}
            {occupant.itemCount != null
              ? `  ·  ${occupant.itemCount} items`
              : ""}
          </text>
        </>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

function Legend() {
  return (
    <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-3 py-2 rounded-lg border border-stone-200 flex items-center gap-3 shadow-sm">
      {(
        Object.entries(STATUS_COLORS) as [
          TableStatus,
          (typeof STATUS_COLORS)[TableStatus],
        ][]
      ).map(([key, c]) => (
        <div key={key} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full border"
            style={{ backgroundColor: c.fill, borderColor: c.stroke }}
          />
          <span className="text-[10px] uppercase tracking-wider text-gray-600 font-semibold">
            {key.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}
