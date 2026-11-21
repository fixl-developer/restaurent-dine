import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Utensils, GlassWater, Pause, Play, ScanLine } from "lucide-react";
import GuestTablePreview from "./GuestTablePreview";
import "./serviceFilm.css";

const assets = "/table-service/";
const duration = 12;
const sceneLength = 4;
const lastFrame = duration - 1 / 24;
const scenes = [
  { label: "My table", title: "Take your seat.", icon: ScanLine, still: "arrive",
    alt: "A diner holds a phone beside the Table 12 card.",
    description: "At the café, scan the QR on your table. Your waiter will share a code once your party is seated." },
  { label: "Table requests", title: "A little water?", icon: GlassWater, still: "water",
    alt: "A glass of water is poured at the table.",
    description: "Ask for water, call your waiter or request the bill from your seat. You can see when your waiter picks up your request." },
  { label: "My order", title: "Your bowl is on its way.", icon: Utensils, still: "kitchen",
    alt: "Sesame noodles leave the café kitchen for your table.",
    description: "Follow a bowl of sesame chili noodles from the kitchen to your table." },
] as const;

type Mode = "scroll" | "manual" | "playing";
const clamp = (n: number, max = 1) => Math.max(0, Math.min(max, n));

export default function ServiceFilm() {
  const track = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const film = useRef<HTMLVideoElement>(null);
  const clock = useRef(0);
  const chapter = useRef(0);
  const mode = useRef<Mode>("scroll");
  const [index, setIndex] = useState(0);
  const [preferences, setPreferences] = useState({ reduced: true, compact: true, save: true });
  const [near, setNear] = useState(false);
  const [requested, setRequested] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [frameReady, setFrameReady] = useState(false);
  const scene = scenes[index];
  const pinned = !preferences.compact && !preferences.reduced && !preferences.save;
  const loadFilm = !mediaFailed && (requested || (near && !preferences.save && !preferences.reduced));

  const display = useCallback((time: number) => {
    clock.current = clamp(time, lastFrame);
    const next = Math.floor(clock.current / sceneLength);
    if (chapter.current !== next) {
      chapter.current = next;
      setIndex(next);
    }
  }, []);

  const seek = useCallback((time: number) => {
    display(time);
    const el = film.current;
    if (el && el.readyState >= 1 && !el.seeking && Math.abs(el.currentTime - clock.current) > 1 / 30) {
      el.currentTime = clock.current;
    }
  }, [display]);

  const stop = useCallback(() => {
    mode.current = "manual";
    film.current?.pause();
    setPlaying(false);
    setBuffering(false);
  }, []);

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const compact = matchMedia("(max-width: 800px), (max-height: 680px)");
    const connection = (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection;
    const sync = () => {
      stop();
      mode.current = "scroll";
      setPreferences({ reduced: motion.matches, compact: compact.matches, save: !!connection?.saveData });
    };
    sync();
    motion.addEventListener("change", sync);
    compact.addEventListener("change", sync);
    connection?.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      compact.removeEventListener("change", sync);
      connection?.removeEventListener("change", sync);
    };
  }, [stop]);

  useEffect(() => {
    if (!stage.current) return;
    if (!("IntersectionObserver" in window)) { setNear(true); return; }
    const loader = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setNear(true); loader.disconnect(); }
    }, { rootMargin: "300px" });
    const visibility = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting && mode.current === "playing") stop();
    });
    loader.observe(stage.current);
    visibility.observe(stage.current);
    const hide = () => { if (document.hidden && mode.current === "playing") stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { loader.disconnect(); visibility.disconnect(); document.removeEventListener("visibilitychange", hide); };
  }, [stop]);

  useEffect(() => {
    if (!pinned || !near || !track.current || !stage.current) return;
    let frame = 0;
    const resume = () => { if (mode.current === "manual") mode.current = "scroll"; };
    const resumeKey = (event: KeyboardEvent) => {
      if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(event.key)) resume();
    };
    const update = () => {
      frame = 0;
      const rail = track.current!, panel = stage.current!;
      const distance = rail.offsetHeight - panel.offsetHeight;
      const top = rail.getBoundingClientRect().top;
      const progress = clamp((16 - top) / Math.max(1, distance));
      panel.style.setProperty("--film-offset", ((progress - .5) * 12).toFixed(2) + "px");
      if (mode.current === "scroll") seek(progress * lastFrame);
    };
    const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    window.addEventListener("wheel", resume, {passive:true});
    window.addEventListener("touchmove", resume, {passive:true});
    window.addEventListener("keydown", resumeKey);
    return () => {
      window.removeEventListener("scroll", queue); window.removeEventListener("resize", queue);
      window.removeEventListener("wheel", resume); window.removeEventListener("touchmove", resume);
      window.removeEventListener("keydown", resumeKey);
      cancelAnimationFrame(frame);
    };
  }, [pinned, near, seek]);

  function select(next: number) {
    stop();
    const time = next * sceneLength;
    seek(time);
    if (pinned && track.current && stage.current) {
      const rail = track.current;
      // Keep the scroll position aligned with the chosen chapter on direct navigation.
      const y = window.scrollY + rail.getBoundingClientRect().top - 16 +
        ((time + .2) / lastFrame) * (rail.offsetHeight - stage.current.offsetHeight);
      window.scrollTo({ top: y, behavior: "instant" });
    }
  }

  function togglePlayback() {
    if (mode.current === "playing") { stop(); return; }
    mode.current = "playing";
    if (clock.current >= lastFrame - .15) display(0);
    setRequested(true);
    setPlaying(true);
    setBuffering(true);
  }

  useEffect(() => {
    const el = film.current;
    if (!playing || !loadFilm || !el) return;
    let cancelled = false;
    const start = () => {
      if (cancelled || mode.current !== "playing") return;
      el.currentTime = clock.current;
      void el.play().catch(() => { if (!cancelled) stop(); });
    };
    if (el.readyState >= 1) start();
    else el.addEventListener("loadedmetadata", start, { once: true });
    return () => { cancelled = true; el.removeEventListener("loadedmetadata", start); };
  }, [playing, loadFilm, stop]);

  return (
    <section id="table-service" className="service-film" aria-labelledby="service-film-title">
      <header className="sf-intro">
        <div><p className="sf-kicker">Smart table service</p><h2 id="service-film-title">A seat at <em>Table 12.</em></h2></div>
        <p>Try a visit as a guest. Check in with your party, ask for water and follow your order in this table-side demo.</p>
      </header>
      <div className="sf-track" data-pinned={pinned} ref={track}>
        <div className="sf-stage" ref={stage}>
          <div className="sf-layout">
            <div className="sf-screen">
              <div className="sf-picture">
                <img width="1024" height="504" src={assets + scene.still + ".webp"} alt={scene.alt} loading="lazy" />
                {loadFilm && <video ref={film} muted playsInline preload="auto" aria-hidden="true"
                  className={frameReady ? "sf-ready" : ""} src={assets + "table-12.mp4"}
                  onLoadedMetadata={() => { if (mode.current !== "playing") seek(clock.current); }}
                  onLoadedData={() => { setFrameReady(true); if (mode.current !== "playing") seek(clock.current); }}
                  onSeeked={() => { if (mode.current !== "playing") seek(clock.current); }}
                  onTimeUpdate={e => { if (mode.current === "playing") display(e.currentTarget.currentTime); }}
                  onWaiting={() => { if (mode.current === "playing") setBuffering(true); }}
                  onPlaying={() => setBuffering(false)} onEnded={() => { display(lastFrame); stop(); }}
                  onError={() => { stop(); setMediaFailed(true); setFrameReady(false); }} />}
              </div>
              <div className="sf-film-controls">
                {mediaFailed ? <span>Photo sequence</span> :
                  <button type="button" onClick={togglePlayback} aria-label={playing ? "Pause service film" : "Play service film"}>
                    {playing ? <Pause size={16}/> : <Play size={16}/>}
                    {playing ? buffering ? "Loading film…" : "Pause" : "Play film"}
                  </button>}
              </div>
            </div>
            <div className="sf-panel">
              <h3>{scene.title}</h3><p className="sf-copy">{scene.description}</p>
              <GuestTablePreview chapter={index} onSelect={select} onInteract={stop} />
            </div>
          </div>
          <div className="sf-chapters" role="group" aria-label="Table service chapters">
            {scenes.map(({label, icon:Icon}, i) =>
              <button key={label} type="button" aria-pressed={i === index} onClick={() => select(i)}><Icon size={18}/>{label}</button>)}
          </div>
        </div>
      </div>
      <div className="sf-footer"><p>Dining with us? Look for the QR card on your table.</p><Link to="/reserve">Book a table</Link></div>
    </section>
  );
}
