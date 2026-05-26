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
}

export interface GameState {
  discoveredIds: string[];               // List of unlocked ElementItem IDs
  canvasElements: ActiveCanvasElement[]; // Active elements currently dragged onto the canvas
}

export interface RecipeDictionary {
  [recipeKey: string]: string; // Key format: "elementIdA+elementIdB", value is resulting elementId
}
