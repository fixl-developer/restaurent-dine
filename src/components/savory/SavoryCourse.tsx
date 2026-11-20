import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { isSesameNoodles } from "@/components/counter/menuDisplay";
import { chapters, duration, poseAt } from "./liftSequence";
import "./savory.css";

const clock = (seconds: number) => "0:" + String(Math.floor(seconds)).padStart(2, "0");

export default function SavoryCourse() {
  const section = useRef<HTMLElement>(null);
  const manual = useRef(false);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const playFrom = useRef(0);
  const { data } = usePublicMenu({ channel: "window" });
  const noodles = data?.categories.flatMap((category) => category.items).find(isSesameNoodles);
  const active = chapters.reduce((index, chapter, i) => time >= chapter.at ? i : index, 0);
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
      const travel = Math.max(rect.height - window.innerHeight, window.innerHeight * .6);
      setTime(Math.max(0, Math.min(1, -rect.top / travel)) * duration);
    }
    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(update);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) setPlaying(false);
      schedule();
    });
    const pauseWhenHidden = () => { if (document.hidden) setPlaying(false); };
    const motionChanged = () => { if (motion.matches) setPlaying(false); schedule(); };
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

  function togglePlayback() {
    if (playing) { setPlaying(false); return; }
    const start = manual.current && time < duration ? time : 0;
    manual.current = true;
    playFrom.current = start;
    setTime(start);
    setPlaying(true);
  }

  return (
    <section ref={section} className="savory-course" id="savory-course" aria-labelledby="savory-title">
      <div className="savory-stage">
        <div className="savory-copy">
          <p className="savory-kicker">From the wok</p>
          <h2 id="savory-title">Sesame<br /><i>chili noodles.</i></h2>
          <div className="savory-tasting">
            <div className="savory-moments" role="group" aria-label="Noodle tasting views">
              {chapters.map((entry, index) => <button type="button" key={entry.title}
                aria-pressed={active === index} onClick={() => inspect(entry.preview)}>{entry.title}</button>)}
            </div>
            <p className="savory-description">{moment.detail}</p>
          </div>
          <Link className="savory-link" to={noodles
            ? "/menu?" + new URLSearchParams({ item: noodles.id, category: noodles.categoryId })
            : "/menu"}>{noodles ? "View this dish" : "Explore the menu"} <ArrowUpRight size={17} /></Link>
        </div>
        <div className="savory-plate" style={{
          "--lift": 1 - (pose.y + 7) / 46, "--camera": pose.zoom,
          "--stick-y": pose.y + "%", "--tilt": pose.tilt + "deg", "--length": pose.length,
        } as CSSProperties}>
          <div className="savory-art" role="img" aria-label={'Sesame chili noodles, ' + moment.title.toLowerCase()}>
            <div className="savory-camera">
            <div className="savory-light" /><div className="savory-shadow" />
            <img className="savory-bowl" src="/savory/bowl.webp" alt="" loading="lazy" width="900" height="559" />
            <div className="savory-lift">
              <img className="savory-grip" src="/savory/lift.webp" alt="" loading="lazy" width="880" height="718" />
              <img className="savory-strands" src="/savory/lift.webp" alt="" loading="lazy" width="880" height="718" />
            </div>
            </div>
          </div>
          <div className="savory-transport">
            <button type="button" className="savory-play" onClick={togglePlayback}>
              {playing ? <Pause size={16} /> : time >= duration ? <RotateCcw size={16} /> : <Play size={16} />}
              {playing ? "Pause" : time >= duration ? "Replay lift" : manual.current && time > 0 ? "Resume lift" : "Play full lift"}
            </button>
            <label className="savory-scrub">
              <span className="sr-only">Lift the chopsticks</span>
              <input type="range" min="0" max={duration} step=".1" value={time}
                aria-valuetext={Math.floor(time) + " seconds, " + moment.title}
                onChange={(event) => inspect(Number(event.target.value))} />
            </label>
            <span className="savory-time" aria-hidden="true">{clock(time)} / {clock(duration)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
