import { useState } from "react";
import { Utensils } from "lucide-react";
import { dishCutout, hasCrepeViewer } from "@/components/counter/menuDisplay";
import type { PublicMenuItem } from "@/lib/dto/guest";

export default function DishArtwork({ item, interactive = false }: {
  item: PublicMenuItem;
  interactive?: boolean;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const [lifted, setLifted] = useState(false);
  const cutout = dishCutout(item);
  const src = [item.pizzaBuilder?.enabled && item.imageUrl, cutout, item.imageUrl, hasCrepeViewer(item) && "/window-table/dish.webp"]
    .find((url): url is string => Boolean(url) && !failed.includes(String(url)));
  const canLift = Boolean(src && src === cutout && !item.pizzaBuilder?.enabled);

  return (
    <div className={canLift ? "mb-photo-page mb-cutout" : "mb-photo-page"} data-lifted={canLift && lifted}>
      {src ? (
        <img src={src} alt={item.name} draggable={false}
          onError={() => setFailed((previous) => [...previous, src])} />
      ) : (
        <div className="mb-photo-fallback" aria-label="Dish photo unavailable">
          <Utensils size={50} strokeWidth={1} />
          <span>Pinky Promise</span>
        </div>
      )}
      {canLift && interactive && (
        <button type="button" className="mb-lift-control" aria-pressed={lifted}
          onClick={() => setLifted((value) => !value)}>
          {lifted ? "Lower dish" : "Lift dish"}
        </button>
      )}
    </div>
  );
}
