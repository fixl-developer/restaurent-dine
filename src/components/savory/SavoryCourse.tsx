import { Link } from "react-router-dom";
import { usePublicMenu } from "@/hooks/useGuest";
import "./savory.css";

export default function SavoryCourse() {
  const { data } = usePublicMenu({ channel: "window" });
  const noodles = data?.categories
    .flatMap((category) => category.items)
    .find((item) => [item.name, item.slug].some((value) =>
      /^sichuan[ -]sesame[ -]chill?i[ -]noodles$/i.test(value)
    ));

  return (
    <section className="savory-course" id="savory-course" aria-labelledby="savory-title">
      <div className="savory-stage">
        <div className="savory-copy">
          <p className="savory-kicker">From the wok</p>
          <h2 id="savory-title">Sesame<br /><i>chili noodles.</i></h2>
          <p className="savory-description">
            Wheat noodles tossed in roasted sesame oil and chili paste,
            finished with minced scallions.
          </p>
          <Link className="savory-link" to={noodles
            ? "/menu?" + new URLSearchParams({ item: noodles.id, category: noodles.categoryId })
            : "/menu"}>
            {noodles ? "View this dish" : "Explore the menu"}
          </Link>
        </div>
        <div className="savory-art" role="img" aria-label="Chopsticks lift glossy chili noodles above a ceramic bowl topped with scallions and sesame.">
          <div className="savory-paper" />
          <div className="savory-shadow" />
          <img className="savory-lift" src="/savory/lift.webp" alt="" loading="lazy" width="880" height="718" />
          <img className="savory-bowl" src="/savory/bowl.webp" alt="" loading="lazy" width="900" height="559" />
          <span className="savory-note savory-sesame">Roasted sesame</span>
          <span className="savory-note savory-chili">Chili paste</span>
        </div>
      </div>
    </section>
  );
}
