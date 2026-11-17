import { BOROUGHS, type Dimension } from "@ny-dashboard/shared";

/**
 * Fixed color slot per entity: color follows the entity, never its rank, so filtering one out
 * does not repaint the others (dataviz rule). Apps first (largest volume), then the taxis —
 * the Uber, Lyft, Yellow, Green order of CLAUDE.md §7.
 */
const ORDER: Partial<Record<Dimension, readonly string[]>> = {
  service: ["fhvhv", "yellow", "green"],
  company: ["uber", "lyft", "yellow", "green", "other"],
  borough: BOROUGHS,
};

/** Color slot of a category key (unknown keys go after the known ones, in arrival order). */
export const categorySlot = (
  dimension: Dimension | undefined,
  key: string,
): number => {
  if (key === "total" || dimension === undefined) return 0;
  const order = ORDER[dimension];
  if (!order) return -1;
  return order.indexOf(key);
};

/** Keys sorted by their fixed slot (legend order = color order). */
export const sortByCategory = <T extends { key: string }>(
  dimension: Dimension | undefined,
  items: readonly T[],
): T[] => {
  const known = (item: T) => categorySlot(dimension, item.key) >= 0;
  return [
    ...items
      .filter(known)
      .sort(
        (a, b) =>
          categorySlot(dimension, a.key) - categorySlot(dimension, b.key),
      ),
    ...items.filter((item) => !known(item)),
  ];
};
