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

/**
 * Generates an array of dynamic particle configurations tailored to the
 * combining elements and the resulting product.
 *
 * @param count Number of particles to generate
 * @param elementA First ingredient with id and color
 * @param elementB Second ingredient with id and color
 * @param product Resulting product with id and color
 * @param randomFn Optional random number generator (defaults to Math.random for testing)
 * @returns Array of ParticleConfig
 */
export function generateParticleConfigs(
  count: number,
  elementA: { id: string; color: string },
  elementB: { id: string; color: string },
  product: { id: string; color: string; category?: string },
  randomFn: () => number = Math.random
): import('../types/game').ParticleConfig[] {
  const hasFire = elementA.id === 'fire' || elementB.id === 'fire' || elementA.id === 'lava' || elementB.id === 'lava';
  const hasSand = elementA.id === 'sand' || elementB.id === 'sand';
  const isGlassOrCrystal = product.id === 'glass' || product.id === 'glasses' || product.category === 'optics';

  // Base palette containing ingredients, product, and highlight sparks
  const palette = [
    elementA.color,
    elementB.color,
    product.color,
    '#FFFFFF',
  ];

  if (hasFire) {
    palette.push('#FF5722', '#FF9800', '#FF3D00', '#FFEB3B');
  }
  if (hasSand) {
    palette.push('#FFD54F', '#FFE082', '#FFCA28');
  }
  if (isGlassOrCrystal) {
    palette.push('#E0F7FA', '#80DEEA', '#FFFFFF', '#B2EBF2');
  }

  const particles: import('../types/game').ParticleConfig[] = [];
  const baseAngleStep = (Math.PI * 2) / Math.max(1, count);

  for (let i = 0; i < count; i++) {
    // Angular spread with gentle jitter
    const angle = i * baseAngleStep + (randomFn() - 0.5) * (baseAngleStep * 0.8);
    const distance = 40 + randomFn() * 65; // 40px to 105px radius
    const size = 5 + randomFn() * 8;       // 5px to 13px size
    const color = palette[Math.floor(randomFn() * palette.length)];

    let shape: 'circle' | 'sparkle' | 'ember' | 'diamond' = 'circle';
    let driftY = 0;

    const shapeRoll = randomFn();
    if (hasFire && shapeRoll < 0.4) {
      shape = 'ember';
      driftY = -(15 + randomFn() * 25); // Rising upward embers
    } else if (isGlassOrCrystal && shapeRoll > 0.45) {
      shape = shapeRoll > 0.75 ? 'diamond' : 'sparkle';
    } else if (shapeRoll > 0.7) {
      shape = 'sparkle';
    }

    particles.push({
      id: i,
      angle,
      distance: Math.round(distance),
      size: Math.round(size),
      color,
      shape,
      duration: Math.round(450 + randomFn() * 350), // 450ms - 800ms
      delay: Math.round(randomFn() * 70),          // 0ms - 70ms stagger
      driftY: Math.round(driftY),
      rotation: Math.round(randomFn() * 360),
    });
  }

  return particles;
}
