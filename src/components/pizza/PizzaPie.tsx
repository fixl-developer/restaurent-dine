import { useState, type CSSProperties } from "react";
import { pizzaBase, pizzaIngredients, type PizzaArt } from "./ingredients";
import "./pizza.css";
const artSettings: Record<PizzaArt, [number, number, number]> = {
  mozzarella: [48, 8, 1],
  pepperoni: [10, 15, 2],
  mushroom: [11, 12, 3],
  olive: [18, 7, 4],
  basil: [9, 10, 5],
  pepper: [11, 12, 6],
  onion: [12, 12, 7],
  tomato: [9, 14, 8],
};

function ToppingLayer({ art, id }: { art: PizzaArt; id: string }) {
  const [count, width, offset] = artSettings[art];
  return (
    <div className="pizza-layer">
      {Array.from({ length: count }, (_, i) => {
        const seed = id.charCodeAt(id.length - 1) + offset;
        const jitter = Math.sin(i * 27.3 + seed);
        const angle = i * 2.39996 + seed * 0.86 + jitter * 0.16;
        const radius = 36 * Math.sqrt((i + 0.4) / count);
        return (
          <span
            key={i}
            style={
              {
                left: 50 + radius * Math.cos(angle) + "%",
                top: 50 + radius * Math.sin(angle) + "%",
                width: width * (1 + 0.18 * jitter) + "%",
                "--turn": i * 67 + offset * 19 + "deg",
                "--delay": i * 9 + "ms",
              } as CSSProperties
            }
          >
            <img alt="" src={"/pizza/" + art + ".webp"} draggable={false} />
          </span>
        );
      })}
    </div>
  );
}

export default function PizzaPie({
  choices,
  baseImageUrl,
  scale = 1,
}: {
  choices: { id: string; pizzaArt?: PizzaArt | null }[];
  baseImageUrl?: string;
  scale?: number;
}) {
  const layers = choices
    .filter((m) => m.pizzaArt && m.pizzaArt in pizzaIngredients)
    .sort((a, b) => artSettings[a.pizzaArt!][2] - artSettings[b.pizzaArt!][2]);
  const [failedUrl, setFailedUrl] = useState<string>();
  return (
    <div className="pizza-pie" style={{ "--size": scale } as CSSProperties}>
      <img
        className="pizza-base"
        src={(baseImageUrl !== failedUrl && baseImageUrl) || pizzaBase}
        onError={() => setFailedUrl(baseImageUrl)}
        alt=""
      />
      {layers.map((m) => (
        <ToppingLayer key={m.id} id={m.id} art={m.pizzaArt!} />
      ))}
    </div>
  );
}
