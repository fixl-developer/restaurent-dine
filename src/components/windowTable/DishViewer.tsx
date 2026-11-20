import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, RotateCcw, X } from "lucide-react";
import { Link } from "react-router-dom";
import type { PublicMenuItem } from "@/lib/dto/guest";
import { dishModelUrl } from "@/components/counter/menuDisplay";
import DishArtwork from "@/components/menuBook/DishArtwork";
import Dialog from "@/components/ui/Dialog";
import type { createScene } from "./scene";
import "./journey.css";

export default function DishViewer({
  dish,
  onClose,
  onAdd,
}: {
  dish?: PublicMenuItem;
  onClose: () => void;
  onAdd?: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ReturnType<typeof createScene> | null>(null);
  const pose = useRef({ angle: -0.8, elevation: 0.27 });
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null);
  const [ready, setReady] = useState(false);
  const modelUrl = dish && dishModelUrl(dish);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = canvas.current!;
    let active = true;
    setReady(false);
    setFailed(false);
    const lost = (e: Event) => {
      e.preventDefault();
      active = false;
      setReady(false);
      setFailed(true);
    };
    element.addEventListener("webglcontextlost", lost);
    import("./scene")
      .then(async ({ createScene }) => {
        if (active) {
          scene.current = createScene(element, modelUrl ? "model" : "dish");
          if (modelUrl) await scene.current.loadModel(modelUrl);
          if (active) setReady(true);
        }
      })
      .catch(() => {
        if (active) {
          scene.current?.dispose();
          scene.current = null;
          setFailed(true);
        }
      });
    return () => {
      active = false;
      element.removeEventListener("webglcontextlost", lost);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [modelUrl]);
  function orbit(angle: number, elevation: number) {
    pose.current = {
      angle,
      elevation: Math.max(0.1, Math.min(1.53, elevation)),
    };
    scene.current?.orbit(angle, pose.current.elevation);
  }
  return (
    <Dialog
      label={dish?.name ?? "Matcha mille crêpe"}
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
          {!ready && (dish ? <DishArtwork item={dish} interactive={failed} /> : (
            <img
              src="/window-table/dish.webp"
              alt="Layered matcha crêpe on a ceramic plate"
            />
          ))}
          <canvas style={{ visibility: ready ? "visible" : "hidden" }}
            ref={canvas}
            aria-label="Rotate the dish with arrow keys or drag"
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
          <h2>{dish?.name ?? "Matcha mille crêpe"}</h2>
          <p>
            {dish ? dish.description : "Twenty fine crêpes layered with matcha custard."}
          </p>
          {!ready && <p role="status">{failed ? "3D view unavailable." : "Loading 3D view…"}</p>}
          {ready && (
            <div className="crepe-controls">
              <button onClick={() => orbit(-0.8, 0.16)}>{modelUrl ? "Side view" : "See the layers"}</button>
              <button onClick={() => orbit(-0.8, 1.48)}>Top view</button>
              <button onClick={() => orbit(-0.8, 0.27)} aria-label="Reset view">
                <RotateCcw size={16} />
              </button>
            </div>
          )}
          {dish && onAdd ? (
            <button className="cafe-primary" onClick={onAdd}>
              {dish.variants.length || dish.modifierGroups.length ? "Customize" : "Add to bag"}
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
