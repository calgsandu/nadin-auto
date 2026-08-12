export type AnchorRect = { top: number; bottom: number; left: number; width: number };
export type DropdownBox = { left: number; width: number; top: number; maxHeight: number };

/** Înălțimea maximă dorită a listei de rezultate. */
export const DROPDOWN_HEIGHT = 288;
const GAP = 8;
const MIN_HEIGHT = 120;

/**
 * Poziția listei de rezultate în coordonate de ecran (portal pe body).
 * Implicit deasupra câmpului — ca să nu acopere rândurile deja introduse — și
 * dedesubt doar când sus nu încape. Nu iese niciodată din ecran.
 */
export function placeDropdown(rect: AnchorRect, viewportHeight: number): DropdownBox {
  const spaceAbove = rect.top - GAP;
  const spaceBelow = viewportHeight - rect.bottom - GAP;
  const above = spaceAbove >= Math.min(DROPDOWN_HEIGHT, spaceBelow) || spaceAbove > spaceBelow;
  const maxHeight = Math.max(Math.min(DROPDOWN_HEIGHT, above ? spaceAbove : spaceBelow), MIN_HEIGHT);

  return {
    left: rect.left,
    width: rect.width,
    top: above ? Math.max(rect.top - GAP - maxHeight, GAP) : rect.bottom + GAP,
    maxHeight,
  };
}
