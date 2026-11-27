import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { Link } from "react-router-dom";
import { MoveVertical, Pause, Play, RotateCcw } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { isSesameNoodles } from "@/components/counter/menuDisplay";
import { chapters, duration, poseAt } from "./liftSequence";
import "./savory.css";

function liftTime(height: number) {
  const targetY = 39 - 46 * Math.max(0, Math.min(1, height));
  // Match the drag distance to the rendered chopstick position on the rising part of the film.
  let start = 8,
    end = 26;
  for (let i = 0; i < 12; i++) {
    const middle = (start + end) / 2;
    if (poseAt(middle).y > targetY) start = middle;
    else end = middle;
  }
  return (start + end) / 2;
}

export default function SavoryCourse() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playFrom = useRef(0);
  const drag = useRef<{
    id: number;
    y: number;
    from: number;
    distance: number;
    moved: boolean;
  } | null>(null);
  const targetT = useRef(0);
  const displayT = useRef(0);
  const lerpId = useRef(0);
  const [dragging, setDragging] = useState(false);
  const { data } = usePublicMenu({ channel: "window" });
  const noodles = data?.categories
    .flatMap((category) => category.items)
    .find(isSesameNoodles);
  const active = chapters.reduce(
    (index, chapter, i) => (time >= chapter.at ? i : index),
    0,
  );
  const moment = chapters[active];
  const pose = poseAt(time);

  function seek(value: number) {
    // Cancel any in-progress lerp so seek lands immediately
    cancelAnimationFrame(lerpId.current);
    lerpId.current = 0;
    targetT.current = value;
    displayT.current = value;
    const track = section.current;
    const frame = stage.current;
    if (track && frame && getComputedStyle(frame).position === "sticky") {
      const travel = track.offsetHeight - frame.offsetHeight;
      window.scrollTo({
        top:
          window.scrollY +
          track.getBoundingClientRect().top +
          (travel * value) / duration,
        behavior: "instant",
      });
    }
    setTime(value);
  }

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    let frame = 0;
    const stop = () => setPlaying(false);
    function tick(now: number) {
      const elapsed = Math.min(
        duration,
        playFrom.current + (now - started) / 1000,
      );
      seek(elapsed);
      if (elapsed >= duration) stop();
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    document.addEventListener("visibilitychange", stop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
      document.removeEventListener("visibilitychange", stop);
    };
  }, [playing]);

  useEffect(() => {
    const node = section.current,
      frame = stage.current;
    if (!node || !frame) return;
    let visible = false,
      scheduled = 0;
    function update() {
      scheduled = 0;
      if (!frame || !node || getComputedStyle(frame).position !== "sticky")
        return;
      const travel = node.offsetHeight - frame.offsetHeight;
      if (travel > 0)
        targetT.current =
          duration *
          Math.max(0, Math.min(1, -node.getBoundingClientRect().top / travel));
    }
    function smoothStep() {
      lerpId.current = 0;
      const diff = targetT.current - displayT.current;
      if (Math.abs(diff) < 0.005) {
        displayT.current = targetT.current;
        setTime(targetT.current);
        return;
      }
      displayT.current += diff * 0.14;
      setTime(displayT.current);
      lerpId.current = requestAnimationFrame(smoothStep);
    }
    function schedule() {
      if (visible && !scheduled) scheduled = requestAnimationFrame(update);
      if (visible && !lerpId.current)
        lerpId.current = requestAnimationFrame(smoothStep);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) setPlaying(false);
      schedule();
    });
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => {
      setPlaying(false);
      schedule();
    };
    observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", changed);
    return () => {
      cancelAnimationFrame(scheduled);
      cancelAnimationFrame(lerpId.current);
      observer.disconnect();
      motion.removeEventListener("change", changed);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule);
    };
  }, []);

  function inspect(value: number) {
    setPlaying(false);
    seek(value);
  }

  function startLift(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return;
    const height =
      event.currentTarget.parentElement!.getBoundingClientRect().height;
    drag.current = {
      id: event.pointerId,
      y: event.clientY,
      from: (39 - pose.y) / 46,
      distance: Math.max(90, height * 0.47),
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPlaying(false);
    setDragging(true);
  }

  function moveLift(event: PointerEvent<HTMLButtonElement>) {
    const gesture = drag.current;
    if (!gesture || gesture.id !== event.pointerId) return;
    const dy = gesture.y - event.clientY;
    if (Math.abs(dy) > 3) gesture.moved = true;
    if (gesture.moved) inspect(liftTime(gesture.from + dy / gesture.distance));
  }

  function endLift(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.id !== event.pointerId) return;
    if (event.type === "pointerup" && !drag.current.moved)
      inspect(pose.y > 10 ? 26 : 8);
    drag.current = null;
    setDragging(false);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const start = time < duration - 0.05 ? time : 0;
    playFrom.current = start;
    setTime(start);
    setPlaying(true);
  }

  return (
    <section
      ref={section}
      className="savory-course"
      id="savory-course"
      aria-labelledby="savory-title"
    >
      <div ref={stage} className="savory-stage" data-dragging={dragging}>
        <div className="savory-copy">
          <p className="savory-kicker">From the wok</p>
          <h2 id="savory-title">
            Sesame
            <br />
            <i>chili noodles.</i>
          </h2>
          <p className="savory-description">{moment.detail}</p>
          <Link
            className="savory-link"
            to={
              noodles
                ? "/menu?" +
                  new URLSearchParams({
                    item: noodles.id,
                    category: noodles.categoryId,
                  })
                : "/menu"
            }
          >
            {noodles ? "View this dish" : "Explore the menu"}
          </Link>
        </div>
        <div
          className="savory-art"
          style={
            {
              "--lift": (39 - pose.y) / 46,
              "--camera": pose.zoom,
              "--sway":
                Math.sin(time * 0.53) * Math.max(0, (38 - pose.y) / 46) * 5 +
                "deg",
              "--steam-phase": (time % 5) / 5,
              "--steam-late": ((time + 2.1) % 5) / 5,
              "--stick-y": pose.y + "%",
              "--tilt": pose.tilt + "deg",
              "--length": pose.length,
            } as CSSProperties
          }
        >
          <div
            className="savory-camera"
            role="img"
            aria-label={"Sesame chili noodles, " + moment.title.toLowerCase()}
          >
            <div className="savory-shadow" />
            <img
              className="savory-bowl"
              src="/savory/bowl.webp"
              alt=""
              loading="lazy"
              width="900"
              height="559"
            />
            <div className="savory-steam" aria-hidden="true">
              <i />
              <i />
            </div>
            <div className="savory-lift">
              <img
                className="savory-grip"
                src="/savory/lift.webp"
                alt=""
                loading="lazy"
                width="880"
                height="718"
              />
              <img
                className="savory-strands savory-strands-near"
                src="/savory/lift.webp"
                alt=""
                loading="lazy"
                width="880"
                height="718"
              />
              <img
                className="savory-strands savory-strands-far"
                src="/savory/lift.webp"
                alt=""
                loading="lazy"
                width="880"
                height="718"
              />
            </div>
          </div>
          <button
            className="savory-handle"
            type="button"
            aria-label="Lift or lower the chopsticks"
            aria-describedby="savory-gesture savory-keys"
            onPointerDown={startLift}
            onPointerMove={moveLift}
            onPointerUp={endLift}
            onPointerCancel={endLift}
            onLostPointerCapture={endLift}
            onClick={(e) => {
              if (e.detail === 0) inspect(pose.y > 10 ? 26 : 8);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                inspect(
                  liftTime(
                    (39 - pose.y) / 46 + (e.key === "ArrowUp" ? 0.16 : -0.16),
                  ),
                );
              }
            }}
          >
            <MoveVertical size={19} aria-hidden="true" />
            <span id="savory-gesture">Drag to lift</span>
          </button>
          <span className="sr-only" id="savory-keys">
            Use the up and down arrow keys to adjust the height, or press Enter
            to raise or lower the chopsticks.
          </span>
        </div>
        <div className="savory-controls">
          <span className="savory-scroll-hint">
            Scroll to lift <span aria-hidden="true">↓</span>
          </span>
          <div
            className="savory-moments"
            role="group"
            aria-label="Noodle tasting views"
          >
            {chapters.map((entry, index) => (
              <button
                type="button"
                key={entry.title}
                aria-pressed={active === index}
                onClick={() => inspect(entry.preview)}
              >
                {entry.title}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="savory-play"
            onClick={togglePlayback}
          >
            {playing ? (
              <Pause size={16} />
            ) : time >= duration ? (
              <RotateCcw size={16} />
            ) : (
              <Play size={16} />
            )}
            {playing
              ? "Pause lift"
              : time >= duration
                ? "Replay lift"
                : "Watch the lift"}
          </button>
        </div>
      </div>
    </section>
  );
}
