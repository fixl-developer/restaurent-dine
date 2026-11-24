import bundledMedia from "@/config/dishMedia.json";
import type { PublicCategory, PublicMenuItem } from "@/lib/dto/guest";

function key(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const displays = [
  ["strawberry icing velvet cake", "strawberry cake", "strawberry layer cake"],
  [
    "breakfast sandwich",
    "egg croissant",
    "egg croissant sandwich",
    "breakfast croissant",
  ],
  ["double matcha creme mille crepe", "matcha mille crepe"],
];

function displayIndex(item: PublicMenuItem) {
  return displays.findIndex(
    (names) => names.includes(key(item.name)) || names.includes(key(item.slug)),
  );
}

export const hasCrepeViewer = (item: PublicMenuItem) =>
  displayIndex(item) === 2;

const mediaByItem: Record<string, { cutoutUrl?: string; modelUrl?: string }> = bundledMedia;

function localMedia(item: PublicMenuItem) {
  return mediaByItem[item.id] ?? mediaByItem[item.slug] ??
    (isSesameNoodles(item) ? mediaByItem["sichuan-sesame-chili-noodles"] : undefined);
}

export function dishModelUrl(item: PublicMenuItem) {
  return item.modelUrl?.trim() || localMedia(item)?.modelUrl;
}

export const hasDishModel = (item: PublicMenuItem) =>
  Boolean(dishModelUrl(item)) || hasCrepeViewer(item);

export function isSesameNoodles(item: PublicMenuItem) {
  return [item.name, item.slug].some((value) =>
    /^sichuan sesame chill?i noodles$/.test(key(value))
  );
}

export function dishCutout(item: PublicMenuItem) {
  return item.cutoutUrl?.trim() || localMedia(item)?.cutoutUrl || (item.pizzaBuilder?.enabled ? item.pizzaBuilder.baseImageUrl || "/pizza/base.webp" : undefined);
}

export function caseSelection(categories: PublicCategory[]) {
  const items = categories.flatMap((category) => category.items);
  const selected = displays.flatMap((_, slot) => {
    const item = items.find((candidate) => displayIndex(candidate) === slot);
    return item ? [{ item, slot, useMenuPhoto: false }] : [];
  });
  const photographed = categories
    .filter((c) =>
      /\b(pastries|pastry|bakery|desserts?|sweets?|breakfast|sandwiches)\b/.test(
        key(c.name + " " + c.slug),
      ),
    )
    .flatMap((c) => c.items)
    .filter(
      (item) =>
        item.imageUrl && !selected.some((entry) => entry.item.id === item.id),
    );
  for (let slot = 0; slot < displays.length && photographed.length; slot++) {
    if (!selected.some((entry) => entry.slot === slot)) {
      selected.push({ item: photographed.shift()!, slot, useMenuPhoto: true });
    }
  }
  return selected.sort((a, b) => a.slot - b.slot);
}

export function drinksCategory(categories: PublicCategory[]) {
  return categories.find((c) =>
    /\b(drinks?|beverages?|matcha|lattes?|smoothies|coffee|tea)\b/.test(
      key(c.name + " " + c.slug),
    ),
  );
}

export function startingPrice(item: PublicMenuItem) {
  if (!item.variants.length) return item.basePrice;
  return Math.min(
    ...item.variants.map(
      (v) => v.absolutePrice ?? item.basePrice + v.priceDelta,
    ),
  );
}
