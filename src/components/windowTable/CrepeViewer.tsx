import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RotateCcw, X } from "lucide-react";
import { Link } from "react-router-dom";
import Dialog from "@/components/ui/Dialog";
import type { createScene } from "./scene";
import "./journey.css";

export default function CrepeViewer({
  onClose,
  item,
}: {
  onClose: () => void;
  item?: {
    name: string;
    description?: string;
    actionLabel: string;
    onAdd: () => void;
  };
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const pose = useRef({ angle: -0.8, elevation: 0.27 });
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const element = canvas.current!;
    let active = true;
    const lost = (e: Event) => {
      e.preventDefault();
      setReady(false);
    };
    element.addEventListener("webglcontextlost", lost);
    import("./scene")
      .then(({ createScene }) => {
        if (active) {
          scene.current = createScene(element, "dish");
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(false);
      });
    return () => {
      active = false;
      element.removeEventListener("webglcontextlost", lost);
      scene.current?.dispose();
      scene.current = null;
    };
  }, []);
  function orbit(angle: number, elevation: number) {
    pose.current = {
      angle,
      elevation: Math.max(0.1, Math.min(1.53, elevation)),
    };
    scene.current?.orbit(angle, pose.current.elevation);
  }
  return (
    <Dialog
      label={item?.name ?? "Matcha mille crêpe"}
      onClose={onClose}
      className="crepe-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="crepe-sheet">
        <button
          className="crepe-close"
          onClick={onClose}
          aria-label="Close dish view"
        >
          <X size={20} />
        </button>
        <div className="crepe-stage">
          {!ready && (
            <img
              src="/window-table/dish.webp"
              alt="Layered matcha crêpe on a ceramic plate"
            />
          )}
          <canvas
            ref={canvas}
            aria-label="Rotate the plated crêpe with arrow keys or drag"
            tabIndex={ready ? 0 : -1}
            onKeyDown={(e) => {
              if (
                !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                  e.key,
                )
              )
                return;
              e.preventDefault();
              orbit(
                pose.current.angle +
                  (e.key === "ArrowRight"
                    ? 0.16
                    : e.key === "ArrowLeft"
                      ? -0.16
                      : 0),
                pose.current.elevation +
                  (e.key === "ArrowUp"
                    ? 0.12
                    : e.key === "ArrowDown"
                      ? -0.12
                      : 0),
              );
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              pointer.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            }}
            onLostPointerCapture={() => {
              pointer.current = null;
            }}
            onPointerMove={(e) => {
              const p = pointer.current;
              if (!p || p.id !== e.pointerId) return;
              orbit(
                pose.current.angle - (e.clientX - p.x) * 0.012,
                pose.current.elevation + (e.clientY - p.y) * 0.009,
              );
              p.x = e.clientX;
              p.y = e.clientY;
            }}
          />
        </div>
        <div className="crepe-info">
          <h2>{item?.name ?? "Matcha mille crêpe"}</h2>
          <p>
            {item?.description ??
              "Twenty fine crêpes layered with matcha custard."}
          </p>
          {ready && (
            <div className="crepe-controls">
              <button onClick={() => orbit(-0.8, 0.16)}>See the layers</button>
              <button onClick={() => orbit(-0.8, 1.48)}>Top view</button>
              <button onClick={() => orbit(-0.8, 0.27)} aria-label="Reset view">
                <RotateCcw size={16} />
              </button>
            </div>
          )}
          {item ? (
            <button className="cafe-primary" onClick={item.onAdd}>
              {item.actionLabel}
            </button>
          ) : (
            <Link className="cafe-primary" to="/menu">
              Explore the menu <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </div>
    </Dialog>
  );
}
