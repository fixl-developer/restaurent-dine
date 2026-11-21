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
  let start = 6,
    end = 15;
  for (let i = 0; i < 12; i++) {
    const middle = (start + end) / 2;
    if (poseAt(middle).y > targetY) start = middle;
    else end = middle;
  }
  return (start + end) / 2;
}

export default function SavoryCourse() {
  const section = useRef<HTMLElement>(null);
  const manual = useRef(false);
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

  useEffect(() => {
    if (!playing) return;
    const started = performance.now();
    let frame = 0;
    function tick(now: number) {
      const elapsed = playFrom.current + (now - started) / 1000;
      setTime(Math.min(duration, elapsed));
      if (elapsed >= duration) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  useEffect(() => {
    const node = section.current;
    if (!node) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let frame = 0;
    function update() {
      frame = 0;
      if (!node || manual.current || motion.matches || !visible) return;
      const rect = node.getBoundingClientRect();
      const travel = Math.max(
        rect.height - window.innerHeight,
        window.innerHeight * 0.6,
      );
      setTime(Math.max(0, Math.min(1, -rect.top / travel)) * duration);
    }
    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(update);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) {
        setPlaying(false);
        manual.current = false;
      }
      schedule();
    });
    const pauseWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    const motionChanged = () => {
      if (motion.matches) setPlaying(false);
      schedule();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", motionChanged);
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", motionChanged);
    };
  }, []);

  function inspect(value: number) {
    manual.current = true;
    setPlaying(false);
    setTime(value);
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
    manual.current = true;
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
      inspect(pose.y > 10 ? 15 : 6);
    drag.current = null;
    setDragging(false);
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    const start = manual.current && time < duration ? time : 0;
    manual.current = true;
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
      <div className="savory-stage" data-dragging={dragging}>
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
                className="savory-strands"
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
              if (e.detail === 0) inspect(pose.y > 10 ? 15 : 6);
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
