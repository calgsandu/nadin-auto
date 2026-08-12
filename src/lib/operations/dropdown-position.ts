export type AnchorRect = { top: number; bottom: number; left: number; width: number };
/** Poziție în coordonate de ecran; `bottom` = listă ancorată DEASUPRA câmpului. */
export type DropdownBox = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

/** Înălțimea maximă dorită a listei de rezultate. */
export const DROPDOWN_HEIGHT = 288;
const GAP = 8;
const MIN_HEIGHT = 140;

/**
 * Poziția listei de rezultate (portal pe body). Lista stă lipită de câmp:
 * deasupra o ancorăm pe `bottom`, altfel o listă scurtă ar fi rămas agățată
 * de tavan, la sute de pixeli de câmpul în care scrii. Dacă sus nu încape
 * rezonabil, coboară; înălțimea se strânge la spațiul disponibil.
 */
export function placeDropdown(rect: AnchorRect, viewportHeight: number): DropdownBox {
  const spaceAbove = rect.top - GAP;
  const spaceBelow = viewportHeight - rect.bottom - GAP;
  // Sus doar dacă încape lista întreagă sau dacă e clar mai mult loc decât jos.
  const above = spaceAbove >= DROPDOWN_HEIGHT || spaceAbove > spaceBelow;
  const available = above ? spaceAbove : spaceBelow;
  const maxHeight = Math.max(Math.min(DROPDOWN_HEIGHT, available), MIN_HEIGHT);

  return above
    ? {
        left: rect.left,
        width: rect.width,
        bottom: viewportHeight - rect.top + GAP,
        maxHeight,
      }
    : {
        left: rect.left,
        width: rect.width,
        top: rect.bottom + GAP,
        maxHeight,
      };
}
