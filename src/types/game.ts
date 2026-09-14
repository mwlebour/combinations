export interface ElementItem {
  id: string;
  name: string;
  description: string;
  isFinal: boolean;
  category: string;
  svgPath: string;
  color: string;
}

export interface ActiveCanvasElement {
  instanceId: string; // Unique ID for each specific instance of an element on the canvas
  elementId: string;  // Matches the ID in elements.json
  x: number;          // X position in pixels on the workspace canvas
  y: number;          // Y position in pixels on the workspace canvas
  isNew?: boolean;    // Flag indicating newly combined or spawned element for entry bounce animation
}

export interface GameState {
  discoveredIds: string[];               // List of unlocked ElementItem IDs
  canvasElements: ActiveCanvasElement[]; // Active elements currently dragged onto the canvas
}

export interface RecipeDictionary {
  [recipeKey: string]: string; // Key format: "elementIdA+elementIdB", value is resulting elementId
}

export interface ParticleConfig {
  id: number;
  angle: number;       // In radians
  distance: number;    // Distance in pixels
  size: number;        // Diameter/width in pixels
  color: string;
  shape: 'circle' | 'sparkle' | 'ember' | 'diamond';
  duration: number;    // Animation duration in ms
  delay: number;       // Stagger delay in ms
  driftY: number;      // Upward or downward drift offset in pixels
  rotation: number;    // Initial rotation in degrees
}

export interface ActiveCombinationAnimation {
  id: string;
  startX1: number;
  startY1: number;
  startX2: number;
  startY2: number;
  targetX: number;
  targetY: number;
  elementA: ElementItem;
  elementB: ElementItem;
  product: ElementItem;
  productName: string;
}
