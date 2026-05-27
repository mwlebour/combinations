# Gemini Agent Guideline & Developer Reference

This document serves as a developer and AI agent reference for maintaining, building, and deploying the "Elemental Combinations" game.

---

## 🛠️ Command Reference

Run these commands from the project root:

* **Development Web Server**:
  ```bash
  npm run web
  ```
* **Run Tests**:
  ```bash
  npm run test
  ```
* **Verify Types**:
  ```bash
  npx tsc --noEmit
  ```
* **Production Static Build**:
  ```bash
  npm run build
  ```

---

## 📂 Project Architecture

* **UI & Core App Layout**: [App.tsx](file:///Users/mwl/mwl/combinations/App.tsx)
  * Implements the interactive playboard, SVG icon handling, neon green sidebar panel, sidebar list filter, drag-and-drop state, and language selection modal.
* **Game & Snapping Logic**: [gameLogic.ts](file:///Users/mwl/mwl/combinations/src/utils/gameLogic.ts)
  * Handles ingredient combination resolution, collision boundaries, and magnet attraction positioning.
* **Unit Tests**: [gameLogic.test.ts](file:///Users/mwl/mwl/combinations/src/utils/gameLogic.test.ts)
  * Exercises collision math, snap physics, and actual production combinations.
* **Configuration Files**:
  * [elements.json](file:///Users/mwl/mwl/combinations/src/config/elements.json): Database of all 45 game elements and their corresponding SVG icon mappings.
  * [recipes.json](file:///Users/mwl/mwl/combinations/src/config/recipes.json): Database of all 36 active combinations.
  * [translations.json](file:///Users/mwl/mwl/combinations/src/config/translations.json): Localization dictionaries for the application interface and element details.

---

## ⚡ Interaction & Snapping Physics Details

* **Magnetic Snap**: When an active canvas item is dragged within **70px** (center-to-center) of a compatible item, `calculateMagnetPosition` snaps the drag coordinates toward the target.
* **Connecting Vector**: A dashed glow line is rendered when compatible ingredients are positioned within **95px** of each other, providing visual feedback before combining.
* **User Text Selection**: Element bubbles explicitly use `userSelect: 'none'` to ensure dragging never triggers accidental browser text highlighting.

---

## 🌐 i18n Localization

* The game supports six languages: **English (en)**, **Hungarian (hu)**, **German (de)**, **Latin (la)**, **Italian (it)**, and **French (fr)**.
* Selected language is persisted across sessions using `AsyncStorage`.
* Dynamically translates UI elements, element names, search terms, and descriptions in real-time.

---

## 🚀 Static Web CI/CD Details

* **Pipeline**: Triggered on push to the `main` branch (see [.github/workflows/deploy.yml](file:///Users/mwl/mwl/combinations/.github/workflows/deploy.yml)).
* **Target Backend**: Google Cloud Storage bucket `gs://combinations.lebourgeo.is` fronted by Cloudflare proxy.
* **Authentication**: Uses `GCP_SA_KEY` repository secret.
* **Caching Strategy**:
  * Static compilation assets (`_expo/static/**`) are cached forever: `public, max-age=31536000, immutable`.
  * The entrypoint file (`index.html`) is never cached to ensure instant updates: `no-cache, no-store, must-revalidate`.
