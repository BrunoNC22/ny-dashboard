import type { Shape } from "../widgets/map/sampleLayers";

const CELL = 64;

/**
 * White shape icons for deck.gl's IconLayer (`mask: true` tints them with each point's color):
 * the shape is the second channel next to color (CLAUDE.md §7). Drawn once on a canvas.
 */
export const createShapeAtlas = (
  shapes: readonly Shape[],
): {
  atlas: string;
  mapping: Record<
    string,
    { x: number; y: number; width: number; height: number; mask: boolean }
  >;
} | null => {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * shapes.length;
  canvas.height = CELL;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  const mapping: Record<
    string,
    { x: number; y: number; width: number; height: number; mask: boolean }
  > = {};
  shapes.forEach((shape, i) => {
    const x = i * CELL;
    const c = x + CELL / 2;
    const m = CELL / 2;
    ctx.beginPath();
    switch (shape) {
      case "circle":
        ctx.arc(c, m, 26, 0, Math.PI * 2);
        break;
      case "square":
        ctx.rect(x + 9, 9, CELL - 18, CELL - 18);
        break;
      case "triangle":
        ctx.moveTo(c, 4);
        ctx.lineTo(x + CELL - 4, CELL - 8);
        ctx.lineTo(x + 4, CELL - 8);
        ctx.closePath();
        break;
      case "diamond":
        ctx.moveTo(c, 2);
        ctx.lineTo(x + CELL - 2, m);
        ctx.lineTo(c, CELL - 2);
        ctx.lineTo(x + 2, m);
        ctx.closePath();
        break;
    }
    ctx.fill();
    mapping[shape] = { x, y: 0, width: CELL, height: CELL, mask: true };
  });
  return { atlas: canvas.toDataURL(), mapping };
};
