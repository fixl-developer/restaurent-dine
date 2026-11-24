import type { PublicModifierGroup } from "@/lib/dto/guest";

export function recipeSelection(groups: PublicModifierGroup[], ids?: string[]) {
  const selected = new Set(ids);
  return Object.fromEntries(
    groups.map((group) => [
      group.id,
      group.modifiers
        .filter((m) => (ids === undefined ? m.isDefault : selected.has(m.id)))
        .slice(0, group.maxSelections || undefined)
        .map((m) => m.id),
    ]),
  );
}
