import { useEffect } from "react";
import { usePublicRestaurant } from "@/hooks/useRestaurant";

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l];
}
function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const to = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

// Lightness curve; shade 600 is anchored to the picked color so primary buttons match it.
const CURVE: Record<number, number> = {
  50: 0.97, 100: 0.93, 200: 0.85, 300: 0.74, 400: 0.62,
  500: 0.54, 600: 0.46, 700: 0.38, 800: 0.3, 900: 0.22, 950: 0.15,
};

function buildScale(hex: string): Record<number, string> | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [h, s, baseL] = rgbToHsl(...rgb);
  const offset = baseL - CURVE[600];
  const out: Record<number, string> = {};
  for (const shade of Object.keys(CURVE).map(Number)) {
    const l = Math.min(0.98, Math.max(0.05, CURVE[shade] + offset));
    // Ease saturation down for very light tints so they don't look neon.
    const sat = shade <= 100 ? s * 0.6 : shade <= 200 ? s * 0.8 : s;
    out[shade] = hslToHex(h, Math.min(1, sat), l);
  }
  return out;
}

/**
 * Applies the restaurant's configured Brand Color across the whole app: it derives a
 * full 50–950 shade scale and sets --brand-* (used by every bg/text/border-brand-*
 * class) plus --promise-berry (the solid accent) at runtime. Changing Brand Color in
 * settings reskins admin, guest and receipts. Falls back to the compiled pink defaults.
 */
export function useBrandTheme() {
  const { data } = usePublicRestaurant();
  const color = data?.brand?.brandColor;
  useEffect(() => {
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const scale = buildScale(color);
    if (!scale) return;
    const root = document.documentElement;
    for (const [shade, hex] of Object.entries(scale))
      root.style.setProperty(`--brand-${shade}`, hex);
    // Solid accent + hover shade used by the non-scale var(--promise-berry) usages.
    root.style.setProperty("--promise-berry", scale[600]);
    root.style.setProperty("--promise-berry-dark", scale[700]);
  }, [color]);
}
