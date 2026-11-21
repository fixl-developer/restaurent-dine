import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Pause, Play, RotateCcw } from "lucide-react";
import { usePublicMenu } from "@/hooks/useGuest";
import { useCurrencyFormatter } from "@/hooks/useCurrencyFormatter";
import { caseSelection, startingPrice } from "./menuDisplay";
import "./counter.css";

// Film: Anna Pou, Pexels, video 8295304. Edited for a silent, single-play close-up.
// https://www.pexels.com/video/a-person-pouring-syrup-on-the-milk-8295304/
function MatchaBar() {
  const video = useRef<HTMLVideoElement>(null);
  const [playback, setPlayback] = useState<
    "paused" | "playing" | "ended" | "unavailable"
  >("paused");

  useEffect(() => {
    const film = video.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    let attempted = false;
    const motionChanged = () => {
      if (reduced.matches) film.pause();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          film.pause();
          return;
        }
        if (
          entry.intersectionRatio < 0.5 ||
          attempted ||
          reduced.matches ||
          connection?.saveData
        )
          return;
        attempted = true;
        void film.play().catch(() => {});
      },
      { threshold: [0, 0.5] },
    );
    observer.observe(film);
    reduced.addEventListener("change", motionChanged);
    return () => {
      observer.disconnect();
      reduced.removeEventListener("change", motionChanged);
      film.pause();
    };
  }, []);

  function toggleFilm() {
    const film = video.current!;
    if (!film.paused) {
      film.pause();
      return;
    }
    if (film.ended) film.currentTime = 0;
    void film.play().catch(() => setPlayback("unavailable"));
  }

  const label =
    playback === "playing"
      ? "Pause film"
      : playback === "ended"
        ? "Replay film"
        : "Play film";
  return (
    <section className="matcha-bar" aria-labelledby="matcha-heading">
      <div className="matcha-bar-inner">
        <div className="matcha-copy">
          <h2 id="matcha-heading">
            At the
            <br />
            <em>matcha bar.</em>
          </h2>
          <Link to="/menu?collection=drinks">
            Explore drinks <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="matcha-film">
          <video
            ref={video}
            muted
            playsInline
            preload="none"
            poster="/counter/pour-poster.webp"
            aria-label="A ceramic pitcher pours green matcha into a glass of milk"
            onPlay={() => setPlayback("playing")}
            onPause={(e) =>
              setPlayback(e.currentTarget.ended ? "ended" : "paused")
            }
            onEnded={() => setPlayback("ended")}
            onError={() => setPlayback("unavailable")}
          >
            <source src="/counter/matcha-pour.mp4" type="video/mp4" />
          </video>
          {playback !== "unavailable" && (
            <button type="button" onClick={toggleFilm} aria-label={label}>
              {playback === "playing" ? (
                <Pause size={14} />
              ) : playback === "ended" ? (
                <RotateCcw size={14} />
              ) : (
                <Play size={14} />
              )}{" "}
              {label}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default function CafeCounter() {
  const menu = usePublicMenu({ channel: "window" });
  const format = useCurrencyFormatter();
  const selected = caseSelection(menu.data?.categories ?? []);
  return (
    <>
      <section
        id="cafe-menu"
        className="pastry-case"
        aria-labelledby="case-heading"
      >
        <header className="case-heading">
          <h2 id="case-heading">
            From the <em>pastry case.</em>
          </h2>
          <Link to="/menu">
            Full menu <ArrowUpRight size={16} />
          </Link>
        </header>
        {selected.length ? (
          <div className="case-glass">
            <div
              className="case-shelf"
              style={{
                gridTemplateColumns: `repeat(${selected.length}, minmax(0, 1fr))`,
              }}
            >
              {selected.map(({ item, slot, useMenuPhoto }) => (
                <article
                  key={item.id}
                  className={
                    useMenuPhoto ? "case-plate case-menu-photo" : "case-plate"
                  }
                  style={{ backgroundPositionX: `${slot * 50}%` }}
                >
                  {useMenuPhoto && (
                    <img
                      src={item.imageUrl}
                      loading="lazy"
                      alt=""
                      onError={(e) => {
                        e.currentTarget.hidden = true;
                      }}
                    />
                  )}
                  <Link
                    className="case-ticket"
                    to={
                      "/menu?" +
                      new URLSearchParams({
                        item: item.id,
                        category: item.categoryId,
                      })
                    }
                  >
                    <span className="case-dish-name">{item.name}</span>
                    <span className="case-ticket-foot">
                      <span>
                        {item.variants.length ? "From " : ""}
                        {format(startingPrice(item))}
                      </span>
                      <span>
                        View dish <ArrowUpRight size={14} />
                      </span>
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="case-editorial">
            <img
              src="/counter/display.webp"
              width="1536"
              height="1024"
              loading="lazy"
              alt="A café display case with strawberry cake, a breakfast croissant, and matcha crêpe"
            />
            {menu.isError && (
              <button onClick={() => menu.refetch()}>
                Reload menu selections
              </button>
            )}
          </div>
        )}
      </section>
      <MatchaBar />
    </>
  );
}
