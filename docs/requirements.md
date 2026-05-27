# Requirements Document: Elemental Combinations Game

This document outlines the requirements and specifications for the mobile application **"Elemental Combinations"** (working title), an iPhone game where players combine elements to discover new items and build up to final-state creations.

---

## 1. Game Overview
"Elemental Combinations" is a discovery-based puzzle game. The player starts with a set of basic elements. By dragging these elements onto a workspace canvas and combining them (e.g., dropping element A onto element B), they create new elements. The game continues as the player unlocks increasingly complex elements, aiming to discover all possible items, including specialized "final-state" items that cannot be combined further.

---

## 2. Core Gameplay Mechanics

### 2.1 Starting Elements
The player starts with **9 base elements** unlocked and available in their inventory:
1. **Earth**
2. **Air**
3. **Fire**
4. **Water**
5. **Sand**
6. **Lightning**
7. **Ice**
8. **Metal**
9. **Wood**

### 2.2 Combination Mechanics
* **Canvas Drag-and-Drop**: 
  * The screen is divided into a **Workspace Canvas** (left/center) and a **Right-hand Inventory Sidebar** (containing discovered elements).
  * Players drag elements from the inventory sidebar onto the canvas.
  * Players can drag elements around the canvas.
  * Dragging one element and dropping it directly on top of another element triggers a combination check.
* **Combination Logic**:
  * If a recipe exists for the two elements (e.g., `Fire + Sand`), both elements are consumed, and the resulting element (`Glass`) is created at the intersection point.
  * If no recipe exists, the dropped element simply sits next to or on top of the other without combining (or bounces off slightly).
  * Combination is order-independent (e.g., `Fire + Sand` is the same as `Sand + Fire`).
* **Final State Items**:
  * Certain items are marked as **Final State** (e.g., `Binoculars`).
  * Once an item reaches a final state, it can no longer be used as an ingredient in any recipe.
  * Visually, final state items will be clearly marked in the inventory and on the canvas to indicate completion (e.g., gold glow, no combination trigger).

### 2.3 Discovery & Progression
* **No Hint System**: Progression is driven purely by player discovery and experimentation.
* **Discovered Inventory**: Once an element is created for the first time, it is permanently added to the inventory sidebar on the right.
* **Canvas Management**:
  * **Clear Canvas**: A button to instantly clear all elements currently on the canvas.
  * **Trash Area / Drop-off**: Dragging an element to a trash icon or off the canvas boundaries deletes that instance from the workspace.

---

## 3. User Interface & Visual Design

### 3.1 Theme: Dark Neo-Glassmorphism
The UI will have a premium, modern aesthetic utilizing a dark color palette, glowing borders, and frosted-glass effects.
* **Color Palette**:
  * **Background**: Deep space/midnight blues and grays (`#0B0E14`, `#121620`).
  * **Surfaces**: Frosted glass (`rgba(255, 255, 255, 0.05)`) with thin, semi-transparent borders.
  * **Accents**: Neon glows (cyan, purple, and gold) to indicate interactions, active states, and final-state items.
* **Typography**: Modern sans-serif (e.g., System font / Inter-like sizing) with clear hierarchy and premium weight contrast.
* **Visual FX & Animations**:
  * Smooth entry animations when an element is created.
  * Subtle glow/pulsing effect when elements are compatible and close to combining.
  * Haptic feedback (if native APIs permit) on successful combinations.

### 3.2 Workspace Layout
* **Main Canvas (Left / Center)**: A large, clear area where elements can be dragged, repositioned, and combined.
* **Right-hand Inventory Sidebar**:
  * A scrollable vertical grid/list displaying all discovered elements.
  * Search bar at the top to filter items by name.
  * Quick-filtering tabs (e.g., "All", "Basic", "Final States").
* **Header Controls**:
  * Game Title/Logo.
  * Stats display: `Discovered Items Count / Total Items Count` (e.g., `9 / 34`).
  * Trash / Clear Canvas buttons.

### 3.3 Elements Representation
* **Icons**: Each element is represented by a unique, sleek, custom SVG icon.
* **Visual Badges**:
  * **Final State** items get a special gold or holographic border/glow.
  * **New** items in the inventory display a subtle badge until clicked.

---

## 4. Technical Stack

* **Framework**: **React Native (Expo)**
  * React Native ensures cross-platform capability (iOS native feel) while allowing quick iteration using JavaScript/TypeScript.
  * Expo simplifies native builds, layout, and drag-and-drop animations.
* **Drag-and-Drop Library**: `react-native-reanimated` and `react-native-gesture-handler` for smooth, native-thread 60 FPS gestures.
* **Icons**: Custom React SVG components (`react-native-svg`) to ensure rendering is crisp at any screen density.
* **State Management**: React Context or Zustand for game state (inventory list, active canvas elements, recipe dictionary).
* **Storage**: `AsyncStorage` to persist:
  * Discovered elements inventory.
  * Elements currently placed on the canvas (positions and types).

---

## 5. Element & Combination List

Here is the complete registry of the **34 elements** and **25 recipes**. 

### 5.1 Starting Elements (9)
These are available to the player from the start of the game:
1. **Earth**: Representative of land, stability, soil.
2. **Air**: Representative of atmosphere, wind, movement.
3. **Fire**: Representative of heat, energy, light.
4. **Water**: Representative of ocean, rain, fluid.
5. **Sand**: Representative of desert, granular matter, silica.
6. **Lightning**: Representative of electricity, storm energy, sparks.
7. **Ice**: Representative of frost, cold, crystals.
8. **Metal**: Representative of iron, refinement, conductibility.
9. **Wood**: Representative of forest, organic construction, nature.

---

### 5.2 Combined & Final-State Elements (25)

Below are the elements created by combining other items, grouped by their progression paths. Each path culminates in a **Final State** item (marked in **bold gold**).

#### Path A: Optics & Vision
1. **Glass** (Created from: `Fire + Sand`)
   * *Description*: Transparent silica structure.
2. **Glasses** (Created from: `Glass + Glass`)
   * *Description*: Two lenses connected together to assist vision.
3. **Binoculars** [FINAL STATE] (Created from: `Glasses + Glasses`)
   * *Description*: High-magnification optical instrument.

#### Path B: Organic & Life
4. **Mud** (Created from: `Water + Earth`)
   * *Description*: Wet, gooey soil.
5. **Swamp** (Created from: `Mud + Wood`)
   * *Description*: Wet, saturated forest area.
6. **Life** (Created from: `Swamp + Lightning`)
   * *Description*: Sparks of biology and energy coalescing.
7. **Ent** [FINAL STATE] (Created from: `Life + Wood`)
   * *Description*: A sentient, walking tree creature.

#### Path C: Electronics & Technology
8. **Electricity** (Created from: `Lightning + Metal`)
   * *Description*: Flow of charge through conductive material.
9. **Silicon** (Created from: `Electricity + Sand`)
   * *Description*: Purified semiconductor base.
10. **Microchip** (Created from: `Silicon + Metal`)
    * *Description*: Complex integrated circuit.
11. **Smartphone** [FINAL STATE] (Created from: `Microchip + Glass`)
    * *Description*: Advanced portable computer with a glass screen.

#### Path D: Weather & Discharge
12. **Steam** (Created from: `Fire + Water`)
    * *Description*: Heated vapor rising.
13. **Cloud** (Created from: `Steam + Air`)
    * *Description*: Condensed water droplets in the sky.
14. **Storm** (Created from: `Cloud + Lightning`)
    * *Description*: Heavy tempest of clouds, rain, and thunder.
15. **Lightning Rod** [FINAL STATE] (Created from: `Storm + Metal`)
    * *Description*: Metal conductor mounted to attract and ground lightning.

#### Path E: Frost & Cold
16. **Snow** (Created from: `Ice + Air`)
    * *Description*: Flurry of frozen water crystals.
17. **Snowman** [FINAL STATE] (Created from: `Snow + Earth`)
    * *Description*: Frozen humanoid figure built from packed snow and soil.

#### Path F: Construction & Transit
18. **Axe** (Created from: `Wood + Metal`)
    * *Description*: Cutting tool with metal head and wooden handle.
19. **Plank** (Created from: `Axe + Wood`)
    * *Description*: Wood cut into a flat, usable construction board.
20. **Bridge** (Created from: `Plank + Plank`)
    * *Description*: Elevated pathway spanning a gap.
21. **Train Track** [FINAL STATE] (Created from: `Bridge + Metal`)
    * *Description*: Steel rails laid over wooden supports.

#### Path G: Metallurgy & Weaponry
22. **Coal** (Created from: `Wood + Fire`)
    * *Description*: Carbonised wood fuel block.
23. **Steel** (Created from: `Coal + Metal`)
    * *Description*: Carbon-reinforced metal alloy.
24. **Sword** (Created from: `Steel + Fire`)
    * *Description*: Forged blade weapon.
25. **Energy Blade** [FINAL STATE] (Created from: `Sword + Lightning`)
    * *Description*: High-tech sword infused with electrical currents.

---

### 5.3 Complete Recipe Dictionary (JSON Structure)
This is the lookup table that will be stored in the app config to check combinations. Keys are formatted alphabetically (`elementA+elementB`) to ensure order-independence.

```json
{
  "fire+sand": "glass",
  "glass+glass": "glasses",
  "glasses+glasses": "binoculars",
  "earth+water": "mud",
  "mud+wood": "swamp",
  "lightning+swamp": "life",
  "life+wood": "ent",
  "lightning+metal": "electricity",
  "electricity+sand": "silicon",
  "metal+silicon": "microchip",
  "glass+microchip": "smartphone",
  "fire+water": "steam",
  "air+steam": "cloud",
  "cloud+lightning": "storm",
  "metal+storm": "lightning_rod",
  "air+ice": "snow",
  "earth+snow": "snowman",
  "metal+wood": "axe",
  "axe+wood": "plank",
  "plank+plank": "bridge",
  "bridge+metal": "train_track",
  "fire+wood": "coal",
  "coal+metal": "steel",
  "fire+steel": "sword",
  "lightning+sword": "energy_blade"
}
```

---

## 6. Verification & Quality Assurance

* **Functional Testing**:
  * Verify that dragging an element from the right sidebar creates a new instance on the canvas.
  * Verify that combining elements matches the recipe and replaces the parents with the product.
  * Verify that final-state items cannot combine.
  * Verify that clearing the canvas removes all active items.
  * Verify that closing and reopening the app preserves the inventory and canvas state.
* **Performance Testing**:
  * Verify that 20+ items on the canvas do not cause layout stuttering (maintain 60fps).
  * Ensure touch targeting for dragging is accurate on different iPhone screen sizes.
