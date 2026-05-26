# Elemental Combinations Mobile Game

A premium casual puzzle game built with React Native (Expo) and TypeScript. Players combine base elements on a canvas to discover new elements, progressing through multi-tier recipe paths (up to 4 combinations deep) to reach "final-state" items.

## Tech Stack
* **Framework**: React Native (Expo SDK 56)
* **Language**: TypeScript (strict mode enabled)
* **Styling**: Vanilla React Native StyleSheet
* **Graphics**: Lightweight custom inline vector icons via `react-native-svg`
* **Physics & Gestures**: `react-native-reanimated` and `react-native-gesture-handler` (to be implemented for smooth drag animations)

---

## Project Structure
```
├── App.tsx                    # Root component (holds layout state and containers)
├── app.json                   # Expo project configuration
├── package.json               # Dependencies and script shortcuts
├── tsconfig.json              # TypeScript compilation setup
└── src/
    ├── config/
    │   ├── elements.json      # Registry of all 34 elements (names, descriptions, SVG paths, colors)
    │   └── recipes.json       # Lookup dictionary of all 25 element combinations
    └── types/
        └── game.ts            # TypeScript interfaces for game models
```

---

## Layout Specifications

* **Right-hand Inventory Sidebar**: A scrollable catalog containing all elements discovered by the player. Includes:
  * A search input to filter discovered elements.
  * Categories and clear indicators showing which elements have reached their "Final State."
* **Workspace Canvas**: A central dropzone occupying the left/center screen where items can be spawned, positioned, and dropped onto one another to trigger combinations.

---

## Running the App

Run the development server locally using npm:

```bash
# Start the Expo Dev Server (with interactive console)
npm run start

# Run specifically on iOS simulator (requires macOS and Xcode)
npm run ios

# Run specifically on Android emulator (requires Android Studio)
npm run android

# Run in the web browser
npm run web
```
