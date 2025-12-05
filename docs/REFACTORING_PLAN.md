# Waygen Refactoring Plan

Branch: `refactor/code-cleanup`
Based on: [CODE_QUALITY.md](./CODE_QUALITY.md) analysis

**Status: COMPLETE** - All phases merged to `dev` on 2025-12-05

---

## Phase 1: Quick Wins (Low Risk) ✅

### 1.1 Remove Debug Code
Remove console.log statements from production code.

**Files:**
- [x] `src/components/Map/DrawToolbar.jsx:23`
- [x] `src/components/Map/MapContainer.jsx:515, 656, 908`
- [x] `src/components/Sidebar/SidebarMain.jsx:194, 199`

### 1.2 Remove Unused Import
- [x] `src/logic/DirectSelectRectangleMode.js` - Remove unused `import * as turf`

### 1.3 Extract Magic Numbers
Created `src/utils/constants.js`:

```js
// Camera & Sensor
export const DEFAULT_HFOV = 82.1;
export const ASPECT_RATIO_4_3 = 4 / 3;

// Geospatial
export const METERS_PER_DEGREE_LAT = 111111;
export const COORD_EPSILON = 0.0001;

// DJI Export
export const DJI_DRONE_ENUM = 68;
export const DJI_DRONE_SUB_ENUM = 0;
```

**Updated files:**
- [x] `src/store/useMissionStore.js` - Use `DEFAULT_HFOV`
- [x] `src/utils/dronePresets.js` - Use `DEFAULT_HFOV`
- [x] `src/logic/pathGenerator.js` - Use constants
- [x] `src/components/Sidebar/SidebarMain.jsx` - Use constants
- [x] `src/utils/geospatial.js` - Use `ASPECT_RATIO_4_3`
- [x] `src/utils/djiExporter.js` - Use DJI constants
- [x] `src/utils/kmlImporter.js` - Use `COORD_EPSILON`

---

## Phase 2: Extract Utility Functions (Medium Risk) ✅

### 2.1 Geospatial Utilities
Added to `src/utils/geospatial.js`:

- [x] `getMidpoint(wp1, wp2)` - Get midpoint between two waypoints
- [x] `getBearing(wp1, wp2)` - Get bearing between two waypoints
- [x] `getRectangleBounds(point1, point2)` - Calculate rectangle bounds

**Updated files:**
- [x] `src/components/Sidebar/EditSelectedPanel.jsx`
- [x] `src/store/useMissionStore.js`
- [x] `src/logic/DragRectangleMode.js`
- [x] `src/logic/DirectSelectRectangleMode.js`

### 2.2 Standardize Turf Imports
- [x] Removed direct turf imports from components using new utilities

---

## Phase 3: Replace Global State (Medium-High Risk) ✅

### 3.1 Create MapboxDraw Context
Created `src/contexts/MapboxDrawContext.jsx`:

```jsx
import { createContext, useContext } from 'react';

export const MapboxDrawContext = createContext(null);

export function useMapboxDraw() {
  return useContext(MapboxDrawContext);
}
```

### 3.2 Update App.jsx
- [x] Wrapped components with `MapboxDrawContext.Provider`
- [x] Added `mapboxDraw` state and `onDrawReady` callback

### 3.3 Update MapContainer
- [x] Removed `window.mapboxDraw = draw.current`
- [x] Added `onDrawReady` prop callback

### 3.4 Update SidebarMain
- [x] Replaced all `window.mapboxDraw` with `useMapboxDraw()` hook

---

## Phase 4: Split God Components (High Risk) ✅

### 4.1 Extract MissionMetrics Component
Created `src/components/Sidebar/MissionMetrics.jsx`:

- [x] Compact 2x2 stats grid (Waypoints, Distance, Max Speed, Est. Mission Time)
- [x] Exported helper functions: `calculateMissionDistance`, `formatTime`, `formatDistance`

### 4.2 Extract Custom Hooks

#### useMissionGeneration Hook ✅
Created `src/hooks/useMissionGeneration.js`:

- [x] `handleGenerate()` - Core path generation logic
- [x] `handleGenerateWithWarning()` - Generate with warning check
- [x] `handleAutoGenerate()` - Auto-regenerate on settings change
- [x] Flight warning dialog state management

#### useWaypointDragDrop Hook (Deferred)
Deferred to future iteration - MapContainer still large but functional.

### 4.3 Split MapContainer (Future)
Long-term goal - not implemented in this iteration.

---

## Phase 5: Add Error Handling (Medium Risk) ✅

### 5.1 Path Generation
- [x] Wrapped `generatePhotogrammetryPath` in try-catch
- [x] Added polygon validation before processing
- [x] Returns empty array on failure

### 5.2 KML Import
- [x] Preserved original error context with `{ cause: e }`

### 5.3 Geospatial Calculations
- [x] Added NaN/Infinity checks to `calculateMaxSpeed`
- [x] All return values validated

---

## Results Summary

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| SidebarMain.jsx | 816 lines | ~620 lines | -24% |
| Global state usage | `window.mapboxDraw` | React Context | Eliminated |
| Magic numbers | 8 locations | 1 file | Centralized |
| Code duplication | 4 patterns | 0 | Eliminated |
| Debug console.log | 6 statements | 0 | Removed |
| Error handling | Minimal | Try-catch + validation | Improved |

### New Files Created
- `src/utils/constants.js`
- `src/contexts/MapboxDrawContext.jsx`
- `src/components/Sidebar/MissionMetrics.jsx`
- `src/hooks/useMissionGeneration.js`

---

## Future Work

Items deferred for future iterations:

1. **useWaypointDragDrop Hook** - Extract drag/drop logic from MapContainer
2. **Split MapContainer** - Break into MapCore, WaypointLayer, DrawingManager, FootprintLayer
3. **Additional store refactoring** - Reduce direct `getState()` calls

---

**Created**: 2025-12-05
**Completed**: 2025-12-05
