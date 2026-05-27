import { RecipeDictionary } from '../types/game';

/**
 * Checks if two elements can combine according to the recipe dictionary.
 * The check is order-independent.
 * 
 * @param idA First element ID
 * @param idB Second element ID
 * @param recipes Dictionary mapping "idA+idB" to resulting element ID
 * @returns The resulting element ID if successful, otherwise null
 */
export function combineElements(
  idA: string,
  idB: string,
  recipes: RecipeDictionary
): string | null {
  if (!idA || !idB || !recipes) return null;
  
  // Guarantee alphabetical order for lookup key consistency
  const sortedIds = [idA.toLowerCase(), idB.toLowerCase()].sort();
  const recipeKey = `${sortedIds[0]}+${sortedIds[1]}`;
  
  return recipes[recipeKey] || null;
}

/**
 * Checks if two coordinate positions are overlapping based on a distance threshold.
 * Uses Euclidean distance formula: d = sqrt((x2 - x1)^2 + (y2 - y1)^2)
 * 
 * @param x1 Center X of element 1
 * @param y1 Center Y of element 1
 * @param x2 Center X of element 2
 * @param y2 Center Y of element 2
 * @param threshold Maximum distance to qualify as collision/overlap
 * @returns True if elements collide, otherwise false
 */
export function checkCollision(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  threshold: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= threshold;
}

/**
 * Calculates the midpoint coordinates between two elements.
 * 
 * @param x1 Center X of element 1
 * @param y1 Center Y of element 1
 * @param x2 Center X of element 2
 * @param y2 Center Y of element 2
 * @returns Coordinate object containing the midpoint
 */
export function getMidpoint(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  return {
    x: Math.round((x1 + x2) / 2),
    y: Math.round((y1 + y2) / 2),
  };
}

/**
 * Computes a magnetically attracted coordinate vector for dragging elements.
 * If the distance between drag position and target position is below threshold,
 * the output position is linearly interpolated (snapped) toward the target.
 * 
 * @param dragX Current dragged element X
 * @param dragY Current dragged element Y
 * @param targetX Target static element X
 * @param targetY Target static element Y
 * @param threshold Distance at which attraction begins
 * @param snapForce Coefficient [0-1] determining attraction strength
 * @returns Object with output x, y coordinates and attraction status flag
 */
export function calculateMagnetPosition(
  dragX: number,
  dragY: number,
  targetX: number,
  targetY: number,
  threshold: number,
  snapForce: number = 0.4
): { x: number; y: number; magnetActive: boolean } {
  // Center coordinates (assuming elements are 80x80, offset by 40)
  const c1x = dragX + 40;
  const c1y = dragY + 40;
  const c2x = targetX + 40;
  const c2y = targetY + 40;

  const dx = c2x - c1x;
  const dy = c2y - c1y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= threshold && distance > 0) {
    // Linear interpolation: interpolate snapForce percentage of the way to the target position
    // (We snap top-left to top-left directly)
    const snapX = dragX + (targetX - dragX) * snapForce;
    const snapY = dragY + (targetY - dragY) * snapForce;
    return {
      x: Math.round(snapX),
      y: Math.round(snapY),
      magnetActive: true,
    };
  }

  return {
    x: dragX,
    y: dragY,
    magnetActive: false,
  };
}
