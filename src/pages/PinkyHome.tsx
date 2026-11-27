import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ArrowUpRight,
  Heart,
  Coffee,
  ShoppingBag,
  MapPin,
  Clock,
  Star,
  Instagram,
  Send,
} from "lucide-react";
import { usePublicRestaurant } from "@/hooks/useRestaurant";
import "./pinky.css";
import TableMenu from "@/components/tableMenu/TableMenu";
import SavoryCourse from "@/components/savory/SavoryCourse";
import PizzaWorkshop from "@/components/pizza/PizzaWorkshop";
import CafeCounter from "@/components/counter/CafeCounter";
import ServiceFilm from "@/components/smartService/ServiceFilm";
import WindowTableJourney from "@/components/windowTable/WindowTableJourney";

const REVIEWS = [
  {
    quote:
      "The cream-top matcha is my whole personality now. Cozy corner, kind people, zero notes.",
    name: "Amara R.",
  },
  {
    quote:
      "Best breakfast bagel on this side of town. I came for coffee and stayed for an hour.",
    name: "Diego M.",
  },
  {
    quote:
      "Every smoothie tastes like sunshine. My kids ask to come back every single weekend.",
    name: "Priya & family",
  },
];

export default function PinkyHome() {
  const { data } = usePublicRestaurant();
  const brand = data?.brand;
  const [joined, setJoined] = useState(false);
  return (
    <div className="pinky-site pinky-home">
      <a href="#main" className="pinky-skip">
        Skip to content
      </a>
      <header className="pinky-nav">
        <Link to="/" className="pinky-wordmark" aria-label="Pinky Promise home">
          Pinky Promise<span>CAFÉ & RESTAURANT</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/menu">Our menu</Link>
          <a href="#table-service">Table service</a>
          <Link to="/reserve">Book a table</Link>
          <a href="#visit">Find us</a>
        </nav>
        <Link className="pinky-button" to="/window">
          Order pickup <ShoppingBag size={16} />
        </Link>
      </header>
      <main id="main">
        <WindowTableJourney />
        <ServiceFilm />
        <CafeCounter />
        <PizzaWorkshop />
        <SavoryCourse />
        <section className="pinky-section pinky-about">
          <div className="pinky-about-art">
            <img
              src="/brand/logo.png"
              alt="Pinky Promise Café & Restaurant"
              loading="lazy"
              width="520"
              height="416"
            />
          </div>
          <div>
            <span className="pinky-eyebrow">OUR LITTLE STORY</span>
            <h2>
              Made with heart,
              <br />
              <em>served with a smile.</em>
            </h2>
            <p>
              Pinky Promise started with a simple idea — a cozy corner where good
              coffee, fresh food, and friendly faces come together. Every matcha
              whisked, every bagel toasted, every smoothie blended, we make it
              like we mean it.
            </p>
            <p>
              Because the little moments deserve a little extra love. That’s our
              pinky promise to you.
            </p>
            <Link className="pinky-text-link" to="/menu">
              See what we make <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <TableMenu />
        <section className="pinky-section pinky-reviews">
          <div className="pinky-section-heading">
            <div>
              <span className="pinky-eyebrow">LOVE NOTES</span>
              <h2>What our guests say</h2>
            </div>
          </div>
          <div className="pinky-review-grid">
            {REVIEWS.map((r) => (
              <blockquote key={r.name} className="pinky-review">
                <div className="pinky-stars" aria-label="5 out of 5 stars">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Star key={i} size={16} fill="currentColor" />
                  ))}
                </div>
                <p>“{r.quote}”</p>
                <cite>— {r.name}</cite>
              </blockquote>
            ))}
          </div>
        </section>
        <section className="pinky-promise">
          <Coffee size={35} />
          <span className="pinky-eyebrow">
            A TABLE. A TREAT. A LITTLE TIME TOGETHER.
          </span>
          <h2>
            Some days just need
            <br />
            <em>a little Pinky Promise.</em>
          </h2>
          <p>
            Come for a sip, stay for a bite. Bring your favorite people—or enjoy
            a moment all to yourself.
          </p>
          <Link to="/reserve" className="pinky-button">
            Request a table <ArrowUpRight size={18} />
          </Link>
        </section>
        <section className="pinky-follow">
          <span className="pinky-eyebrow">STAY IN THE LOOP</span>
          <h2>
            Sweet updates, <em>no spam.</em>
          </h2>
          <p>
            New drinks, little events, and the occasional treat — straight to
            your inbox.
          </p>
          {joined ? (
            <p className="pinky-follow-thanks" role="status">
              <Heart size={16} /> You’re on the list. Talk soon!
            </p>
          ) : (
            <form
              className="pinky-follow-form"
              onSubmit={(e) => {
                e.preventDefault();
                setJoined(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@email.com"
                aria-label="Email address"
              />
              <button className="pinky-button" type="submit">
                Join the club <Send size={16} />
              </button>
            </form>
          )}
          <div className="pinky-socials">
            <a href="https://instagram.com" target="_blank" rel="noreferrer">
              <Instagram size={18} /> @pinkypromise
            </a>
          </div>
        </section>
        <section id="visit" className="pinky-section pinky-visit">
          <div>
            <span className="pinky-eyebrow">LET’S MAKE A DATE</span>
            <h2>
              See you at
              <br />
              Pinky Promise.
            </h2>
            <p>
              <MapPin size={18} />
              {brand?.address || "Ask our team for location details."}
            </p>
            {brand?.contactPhone && (
              <a href={`tel:${brand.contactPhone}`}>{brand.contactPhone}</a>
            )}
          </div>
          <div className="pinky-hours">
            <h3>
              <Clock size={19} /> Opening hours
            </h3>
            {brand?.openingHours?.length ? (
              <dl>
                {brand.openingHours.map((day) => (
                  <div key={day.dayOfWeek}>
                    <dt>
                      {
                        [
                          "Sunday",
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                        ][day.dayOfWeek]
                      }
                    </dt>
                    <dd>
                      {day.isClosed ? "Closed" : `${day.open} – ${day.close}`}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Hours will appear here once confirmed by the restaurant.</p>
            )}
            <p className="pinky-small">
              Dining in? Scan your table’s QR code to order.
            </p>
          </div>
        </section>
      </main>
      <footer className="pinky-footer">
        <Link to="/" className="pinky-wordmark">
          Pinky Promise<span>CAFÉ & RESTAURANT</span>
        </Link>
        <p>A little extra heart, in every visit.</p>
        <Link to="/staff">Staff sign in</Link>
      </footer>
    </div>
  );
}
