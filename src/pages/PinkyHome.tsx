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
    <div className="pinky-site">
      <a href="#main" className="pinky-skip">
        Skip to content
      </a>
      <div className="pinky-announcement">
        A little sweetness. A little sunshine. A pinky promise.{" "}
        <Heart size={13} aria-hidden="true" />
      </div>
      <header className="pinky-nav">
        <Link to="/" className="pinky-wordmark" aria-label="Pinky Promise home">
          Pinky Promise<span>CAFÉ & RESTAURANT</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link to="/menu">Our menu</Link>
          <Link to="/reserve">Book a table</Link>
          <a href="#visit">Find us</a>
        </nav>
        <Link className="pinky-button" to="/window">
          Order pickup <ShoppingBag size={16} />
        </Link>
      </header>
      <main id="main">
        <section className="pinky-hero">
          <div className="pinky-hero-copy">
            <span className="pinky-eyebrow">YOUR EVERYDAY HAPPY PLACE</span>
            <h1>
              Good food.
              <br />
              Sweet moments.
              <br />
              <em>Pinky promise.</em>
            </h1>
            <p>
              Matcha mornings, colorful sips, and a breakfast worth slowing down
              for. Find your new favorite at Pinky Promise.
            </p>
            <div className="pinky-actions">
              <Link className="pinky-button" to="/menu">
                Find your favorite <ArrowUpRight size={19} />
              </Link>
              <Link className="pinky-text-link" to="/reserve">
                Stay a little longer →
              </Link>
            </div>
            <div className="pinky-hero-note">
              <Heart size={17} /> A café with a little extra heart.
            </div>
          </div>
          <div className="pinky-hero-art">
            <div className="pinky-orbit" />
            <img
              src="/brand/logo.png"
              alt="Pinky Promise Café & Restaurant — beach sunset and pinky-promise logo"
              width="748"
              height="599"
              fetchPriority="high"
            />
            <span className="pinky-sticker">
              Sip. Smile.
              <br />
              Repeat. ♡
            </span>
          </div>
        </section>
        <div className="pinky-ribbon" aria-label="Menu highlights">
          <span>ANYTIME BREAKFAST</span>
          <Heart size={19} />
          <span>MATCHA MOMENTS</span>
          <Heart size={19} />
          <span>COLORFUL SIPS</span>
          <Heart size={19} />
          <span>YOUR HAPPY PLACE</span>
        </div>
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
        <section className="pinky-section">
          <div className="pinky-section-heading">
            <div>
              <span className="pinky-eyebrow">
                A LITTLE SOMETHING FOR EVERY MOOD
              </span>
              <h2>What are you craving?</h2>
            </div>
            <Link className="pinky-text-link" to="/menu">
              Explore the menu <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="pinky-features">
            <Link to="/menu" className="pinky-feature pinky-matcha">
              <div>
                <span>01 / MATCHA MOMENTS</span>
                <h3>
                  Your daily
                  <br />
                  green daydream.
                </h3>
                <p>Cream-top matcha, made for a moment of your own.</p>
              </div>
              <img
                src="/brand/matcha-menu.png"
                alt="Double matcha, matcha einspanner and banana matcha menu"
                loading="lazy"
                width="449"
                height="599"
              />
              <span className="pinky-feature-link">
                Explore drinks <ArrowUpRight size={20} />
              </span>
            </Link>
            <Link to="/menu" className="pinky-feature pinky-mango">
              <div>
                <span>02 / COLORFUL SIPS</span>
                <h3>
                  A splash
                  <br />
                  of happy.
                </h3>
                <p>Strawberry, greens, and mango. Find your sunshine.</p>
              </div>
              <img
                src="/brand/smoothies.png"
                alt="Strawberry, kale and mango smoothie selection"
                loading="lazy"
                width="436"
                height="599"
              />
              <span className="pinky-feature-link">
                Explore smoothies <ArrowUpRight size={20} />
              </span>
            </Link>
            <Link to="/menu" className="pinky-feature pinky-blush">
              <div>
                <span>03 / ANYTIME BREAKFAST</span>
                <h3>
                  Make it
                  <br />a slow morning.
                </h3>
                <p>Bagels and sandwiches for your breakfast mood.</p>
              </div>
              <img
                src="/brand/breakfast.png"
                alt="Pinky Promise anytime breakfast menu and sandwiches"
                loading="lazy"
                width="365"
                height="599"
              />
              <span className="pinky-feature-link">
                Explore breakfast <ArrowUpRight size={20} />
              </span>
            </Link>
          </div>
        </section>
        <section className="pinky-section">
          <div className="pinky-section-heading">
            <div>
              <span className="pinky-eyebrow">THE ONES EVERYONE LOVES</span>
              <h2>Signature favorites</h2>
            </div>
            <Link className="pinky-text-link" to="/menu">
              Full menu <ArrowUpRight size={18} />
            </Link>
          </div>
          <div className="pinky-gallery">
            <figure>
              <img
                src="/brand/matcha-menu.png"
                alt="Cream-top matcha"
                loading="lazy"
                width="449"
                height="599"
              />
              <figcaption>Cream-top Matcha</figcaption>
            </figure>
            <figure>
              <img
                src="/brand/smoothies.png"
                alt="Fruit smoothies"
                loading="lazy"
                width="436"
                height="599"
              />
              <figcaption>Sunshine Smoothies</figcaption>
            </figure>
            <figure>
              <img
                src="/brand/breakfast.png"
                alt="Anytime breakfast"
                loading="lazy"
                width="365"
                height="599"
              />
              <figcaption>Anytime Breakfast</figcaption>
            </figure>
          </div>
        </section>
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
