# Waygen Code Quality Report

This document provides a comprehensive inventory of technical debt, code smells, and areas requiring refactoring in the Waygen codebase.

---

## Critical Issues

### God Components

Components with excessive responsibilities that violate the Single Responsibility Principle.

| File | Lines | Severity | Responsibilities |
|------|-------|----------|------------------|
| `src/components/Map/MapContainer.jsx` | 1,011 | CRITICAL | Map init, 20+ event listeners, 15 useEffect hooks, drag/drop, layer management, drawing modes, selection handling |
| `src/components/Sidebar/SidebarMain.jsx` | 816 | CRITICAL | File I/O, path generation, metrics calculation, dialog orchestration, settings form, flight warnings |
| `src/logic/pathGenerator.js` | 321 | HIGH | 35+ conditional branches, nested loops, mixed orbit/grid algorithms |

---

### Global State Coupling

**Anti-Pattern**: Components coupled via `window.mapboxDraw` global variable.

| Location | Usage |
|----------|-------|
| `MapContainer.jsx:222` | `window.mapboxDraw = draw.current` (assignment) |
| `SidebarMain.jsx:77` | `window.mapboxDraw.changeMode('simple_select')` |
| `SidebarMain.jsx:78` | `window.mapboxDraw.getSelected()` |
| `SidebarMain.jsx:85` | `window.mapboxDraw.get(currentPolygon.id)` |

**Impact**:
- Components cannot be tested in isolation
- Hidden dependencies between MapContainer and SidebarMain
- Breaks React's unidirectional data flow

**Recommended Fix**: Replace with React Context:
```jsx
const MapboxDrawContext = createContext(null);
```

---

### Store Access Anti-Pattern

**Anti-Pattern**: Direct `useMissionStore.getState()` calls bypass React's subscription mechanism.

**MapContainer.jsx occurrences:**
- Line 98, 399, 441, 651, 760, 777, 810

**SidebarMain.jsx occurrences:**
- Line 110, 162, 175, 199, 218

**Impact**:
- Components don't re-render when accessed state changes
- Inconsistent state access patterns (hook + direct access)
- Harder to trace data flow

---

## Code Quality Issues

### Magic Numbers

Hardcoded values that should be extracted to named constants.

| Value | Meaning | Locations |
|-------|---------|-----------|
| `82.1` | Default horizontal FOV (degrees) | `useMissionStore.js:37`, `dronePresets.js:50`, `pathGenerator.js:99`, `SidebarMain.jsx:453,686` |
| `111111` | Meters per degree latitude | `pathGenerator.js:110` |
| `3.28084` | Meters to feet conversion | `SidebarMain.jsx:326` (duplicates `METERS_TO_FEET` in `units.js`) |
| `4/3` | Camera aspect ratio | `geospatial.js:19,104` |
| `68` | DJI drone enum value | `djiExporter.js:30,194` |
| `0` | DJI drone sub-enum value | `djiExporter.js:30,194` |
| `0.0001` | Coordinate comparison epsilon | `kmlImporter.js:78` |

**Recommended Fix**: Create `src/utils/constants.js`:
```js
export const DEFAULT_HFOV = 82.1;
export const METERS_PER_DEGREE_LAT = 111111;
export const ASPECT_RATIO_4_3 = 4 / 3;
export const COORD_EPSILON = 0.0001;
```

---

### Duplicated Code

#### Turf Midpoint Calculation Pattern
Repeated in 4 locations:
```js
const p1 = turf.point([wp1.lng, wp1.lat]);
const p2 = turf.point([wp2.lng, wp2.lat]);
const midpoint = turf.midpoint(p1, p2);
```

| File | Lines |
|------|-------|
| `EditSelectedPanel.jsx` | 33-35 |
| `MapContainer.jsx` | 681-683 |
| `MapContainer.jsx` | 825-830 |
| `SidebarMain.jsx` | 299-300 |

**Recommended Fix**: Extract to `geospatial.js`:
```js
export function getMidpoint(wp1, wp2) {
  const p1 = turf.point([wp1.lng, wp1.lat]);
  const p2 = turf.point([wp2.lng, wp2.lat]);
  return turf.midpoint(p1, p2);
}
```

#### Rectangle Bounds Calculation
Identical logic in 2 files:
```js
const minX = Math.min(lng, oppositePoint[0]);
const maxX = Math.max(lng, oppositePoint[0]);
const minY = Math.min(lat, oppositePoint[1]);
const maxY = Math.max(lat, oppositePoint[1]);
```

| File | Lines |
|------|-------|
| `DragRectangleMode.js` | 95-101 |
| `DirectSelectRectangleMode.js` | 97-103 |

---

### Debug Code in Production

Console statements that should be removed before release:

| File | Line | Statement |
|------|------|-----------|
| `DrawToolbar.jsx` | 23 | `console.log` |
| `MapContainer.jsx` | 515 | `console.log` |
| `MapContainer.jsx` | 656 | `console.log` |
| `MapContainer.jsx` | 908 | `console.log` |
| `SidebarMain.jsx` | 194 | `console.log` |
| `SidebarMain.jsx` | 199 | `console.log` |

---

### Unused Imports

| File | Import | Issue |
|------|--------|-------|
| `DirectSelectRectangleMode.js` | `import * as turf from '@turf/turf'` | Never used |

---

### Missing Error Handling

| File | Lines | Function | Issue |
|------|-------|----------|-------|
| `pathGenerator.js` | 90-321 | `generatePhotogrammetryPath()` | No try-catch for complex math operations |
| `kmlImporter.js` | 127-130 | Parse handler | Re-throws error losing original stack trace |
| `geospatial.js` | 140-169 | `calculateMaxSpeed()` | Doesn't handle NaN results |

---

### Inconsistent Patterns

#### Turf Import Style
Mixed import patterns across files:

| Pattern | Files |
|---------|-------|
| `import * as turf from '@turf/turf'` | `geospatial.js`, `pathGenerator.js` |
| `import { bearing } from '@turf/turf'` | `useMissionStore.js` |

#### Naming Conventions
| Issue | Location |
|-------|----------|
| `pt` vs `ptMeters` inconsistency | `pathGenerator.js:208-211` |
| `resolve*` vs `allSame*` helper naming | `EditSelectedPanel.jsx:61-72` |

---

## Complexity Metrics

### Cyclomatic Complexity (High)

| Function | File | Branches | Notes |
|----------|------|----------|-------|
| `generatePhotogrammetryPath` | `pathGenerator.js` | 15+ | Multiple nested conditionals |
| `handleGenerate` | `SidebarMain.jsx:75-148` | 8+ | Multi-step with polygon sync |
| `onPointDragMove` | `MapContainer.jsx:427-480` | 6+ | Event handler with store access |

### Nested Callbacks

**MapContainer.jsx** event handler nesting:
- Lines 296-317: Click handler with nested `queryRenderedFeatures`
- Lines 382-505: Drag handlers with 3 interconnected callbacks
- Lines 514-695: Layer init with deeply nested conditionals

---

## Recommended Refactoring

### Priority 1: Split God Components

**MapContainer.jsx** -> Extract:
- `<MapCore />` - Init and base rendering
- `<WaypointLayer />` - Waypoint rendering and selection
- `<DrawingManager />` - Mapbox Draw integration
- `useWaypointDragDrop()` - Custom hook for drag logic

**SidebarMain.jsx** -> Extract:
- `<MissionSettings />` - Settings form
- `<MissionMetrics />` - Stats display (the 2x2 grid)
- `useMissionGeneration()` - Custom hook for path generation

### Priority 2: Replace Global State

Replace `window.mapboxDraw` with `MapboxDrawContext`:
```jsx
// In App.jsx or MapContainer parent
<MapboxDrawContext.Provider value={drawRef}>
  <MapContainer />
  <SidebarMain />
</MapboxDrawContext.Provider>
```

### Priority 3: Extract Constants

Create centralized constants file for magic numbers.

### Priority 4: Create Utility Functions

Extract repeated patterns to utility functions in `geospatial.js`.

---

**Last Updated**: 2025-12-05
