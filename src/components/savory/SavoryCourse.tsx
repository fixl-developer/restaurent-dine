import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { isSesameNoodles } from "@/components/counter/menuDisplay";
import "./savory.css";

const moments = [
  { title: "In the bowl", detail: "Wheat noodles folded through roasted sesame oil." },
  { title: "The lift", detail: "Chili paste clings to the strands as the chopsticks rise." },
  { title: "The finish", detail: "A scattering of scallions and sesame over the warm bowl." },
];
const limit = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export default function SavoryCourse() {
  const section = useRef<HTMLElement>(null);
  const manual = useRef(false);
  const [lift, setLift] = useState(0);
  const { data } = usePublicMenu({ channel: "window" });
  const noodles = data?.categories.flatMap((category) => category.items).find(isSesameNoodles);
  const active = Math.round(lift / 50);
  const moment = moments[active];

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
      setLift(limit((window.innerHeight * .12 - rect.top) / travel * 100));
    }
    function schedule() {
      if (visible && !frame) frame = requestAnimationFrame(update);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) manual.current = false;
      schedule();
    });
    observer.observe(node);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    motion.addEventListener("change", schedule);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      motion.removeEventListener("change", schedule);
    };
  }, []);

  function inspect(value: number) {
    manual.current = true;
    setLift(limit(value));
  }

  return (
    <section ref={section} className="savory-course" id="savory-course" aria-labelledby="savory-title">
      <div className="savory-stage">
        <div className="savory-copy">
          <p className="savory-kicker">From the wok</p>
          <h2 id="savory-title">Sesame<br /><i>chili noodles.</i></h2>
          <div className="savory-tasting">
            <div className="savory-moments" role="group" aria-label="Noodle tasting views">
              {moments.map((entry, index) => <button type="button" key={entry.title}
                aria-pressed={active === index} onClick={() => inspect(index * 50)}>{entry.title}</button>)}
            </div>
            <p className="savory-description">{moment.detail}</p>
          </div>
          <Link className="savory-link" to={noodles
            ? "/menu?" + new URLSearchParams({ item: noodles.id, category: noodles.categoryId })
            : "/menu"}>{noodles ? "View this dish" : "Explore the menu"} <ArrowUpRight size={17} /></Link>
        </div>
        <div className="savory-plate" style={{ "--lift": lift / 100 } as CSSProperties}>
          <div className="savory-art" role="img" aria-label={'Sesame chili noodles, ' + moment.title.toLowerCase()}>
            <div className="savory-light" /><div className="savory-shadow" />
            <img className="savory-bowl" src="/savory/bowl.webp" alt="" loading="lazy" width="900" height="559" />
            <img className="savory-lift" src="/savory/lift.webp" alt="" loading="lazy" width="880" height="718" />
          </div>
          <label className="savory-scrub">
            <span>Lift the chopsticks</span>
            <input type="range" min="0" max="100" value={lift}
              aria-valuetext={lift + "% lifted, " + moment.title}
              onChange={(event) => inspect(Number(event.target.value))} />
          </label>
        </div>
      </div>
    </section>
  );
}
