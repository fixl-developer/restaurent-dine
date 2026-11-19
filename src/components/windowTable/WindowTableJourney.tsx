import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUpRight, Rotate3d } from "lucide-react";
import { Link } from "react-router-dom";
import CrepeViewer from "./CrepeViewer";
import type { createScene } from "./scene";
import "./journey.css";

const chapters = [
  {
    name: "The café",
    title: "A seat by the window.",
    description: "Afternoon light, a fresh cup of matcha, and something sweet.",
  },
  {
    name: "The table",
    title: "Stay a little longer.",
    description: "Pull up a chair for coffee and crêpes by the window.",
  },
  {
    name: "The plate",
    title: "At the table.",
    description: "Take a closer look at our matcha mille crêpe.",
  },
  {
    name: "The crêpe",
    title: "Layer by layer.",
    description: "Twenty delicate crêpes with matcha custard.",
  },
];
const stops = [0, 0.34, 0.67, 0.97];

export default function WindowTableJourney() {
  const track = useRef<HTMLElement>(null),
    stage = useRef<HTMLDivElement>(null),
    canvas = useRef<HTMLCanvasElement>(null);
  const [chapter, setChapter] = useState(0),
    [still, setStill] = useState(false),
    [inspect, setInspect] = useState(false);
  useEffect(() => {
    const section = track.current!,
      frame = stage.current!,
      element = canvas.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true,
      version = 0,
      raf = 0,
      last = -1;
    let renderer: ReturnType<typeof createScene> | undefined;
    function update() {
      raf = 0;
      if (!renderer) return;
      const progress = Math.max(
        0,
        Math.min(
          1,
          -section.getBoundingClientRect().top /
            Math.max(1, section.offsetHeight - frame.offsetHeight),
        ),
      );
      if (progress === last) return;
      last = progress;
      frame.style.setProperty("--travel", String(progress));
      renderer.move(progress);
      setChapter(
        progress < 0.22 ? 0 : progress < 0.53 ? 1 : progress < 0.82 ? 2 : 3,
      );
    }
    function schedule() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    function fallback() {
      setStill(true);
      setChapter(0);
      renderer?.dispose();
      renderer = undefined;
      frame.style.removeProperty("--travel");
    }
    async function configure() {
      const generation = ++version;
      if (reduced.matches) {
        fallback();
        return;
      }
      try {
        const { createScene } = await import("./scene");
        if (!active || generation !== version) return;
        renderer = createScene(element, "room", (x, y) => {
          frame.style.setProperty("--anchor-x", x + "%");
          frame.style.setProperty("--anchor-y", y + "%");
        });
        last = -1;
        setStill(false);
        schedule();
      } catch {
        if (active && generation === version) fallback();
      }
    }
    const lost = (event: Event) => {
      event.preventDefault();
      fallback();
    };
    element.addEventListener("webglcontextlost", lost);
    reduced.addEventListener("change", configure);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    configure();
    return () => {
      active = false;
      version++;
      cancelAnimationFrame(raf);
      renderer?.dispose();
      element.removeEventListener("webglcontextlost", lost);
      reduced.removeEventListener("change", configure);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, []);
  function selectChapter(index: number) {
    if (still) {
      setChapter(index);
      return;
    }
    const section = track.current!,
      frame = stage.current!;
    window.scrollTo({
      top:
        window.scrollY +
        section.getBoundingClientRect().top +
        stops[index] * (section.offsetHeight - frame.offsetHeight),
      behavior: "instant",
    });
  }
  const current = chapters[chapter];
  return (
    <section
      ref={track}
      className={"cafe-journey" + (still ? " cafe-still" : "")}
      aria-label="Explore the window table"
    >
      <div className="cafe-stage" ref={stage}>
        <img
          className="cafe-room"
          src="/window-table/cafe.webp"
          alt=""
          fetchPriority="high"
        />
        {still && chapter > 0 && (
          <img
            className="cafe-still-frame"
            src={"/window-table/stage-" + chapter + ".webp"}
            alt=""
          />
        )}
        <canvas ref={canvas} aria-hidden="true" hidden={still} />
        <div className="cafe-shade" />
        {!still && chapter === 1 && (
          <Link className="cafe-hotspot" to="/reserve">
            Window table <ArrowUpRight size={14} />
          </Link>
        )}
        {!still && chapter === 2 && (
          <button className="cafe-hotspot" onClick={() => setInspect(true)}>
            Matcha mille crêpe <Rotate3d size={15} />
          </button>
        )}
        <div className="cafe-story">
          <div className="cafe-chapter">{current.name}</div>
          <h1>{current.title}</h1>
          <p>{current.description}</p>
          <div className="cafe-actions">
            {chapter < 2 ? (
              <>
                <Link
                  className="cafe-primary"
                  to={chapter === 0 ? "/menu" : "/reserve"}
                >
                  {chapter === 0 ? "Explore the menu" : "Request a table"}{" "}
                  <ArrowUpRight size={16} />
                </Link>
                <Link to={chapter === 0 ? "/reserve" : "/menu"}>
                  {chapter === 0 ? "Request a table" : "Our menu"}
                </Link>
              </>
            ) : (
              <>
                <button
                  className="cafe-primary"
                  onClick={() => setInspect(true)}
                >
                  <Rotate3d size={17} /> Inspect dish
                </button>
                <Link to="/menu">
                  Our menu <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="cafe-controls">
          <nav aria-label="Café views">
            {chapters.map((c, i) => (
              <button
                key={c.name}
                aria-label={"Show " + c.name}
                aria-current={i === chapter ? "step" : undefined}
                onClick={() => selectChapter(i)}
              >
                {c.name}
              </button>
            ))}
          </nav>
          <a
            href="#cafe-menu"
            aria-label="Skip the café tour and browse categories"
          >
            <ArrowDown size={15} /> Browse categories
          </a>
        </div>
      </div>
      {inspect && <CrepeViewer onClose={() => setInspect(false)} />}
    </section>
  );
}
