# Waygen Refactoring Plan

Branch: `refactor/code-cleanup`
Based on: [CODE_QUALITY.md](./CODE_QUALITY.md) analysis

---

## Phase 1: Quick Wins (Low Risk)

### 1.1 Remove Debug Code
Remove console.log statements from production code.

**Files:**
- [ ] `src/components/Map/DrawToolbar.jsx:23`
- [ ] `src/components/Map/MapContainer.jsx:515, 656, 908`
- [ ] `src/components/Sidebar/SidebarMain.jsx:194, 199`

### 1.2 Remove Unused Import
- [ ] `src/logic/DirectSelectRectangleMode.js` - Remove unused `import * as turf`

### 1.3 Extract Magic Numbers
Create `src/utils/constants.js`:

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

**Update files:**
- [ ] `src/store/useMissionStore.js:37` - Use `DEFAULT_HFOV`
- [ ] `src/utils/dronePresets.js:50` - Use `DEFAULT_HFOV`
- [ ] `src/logic/pathGenerator.js:99, 110` - Use constants
- [ ] `src/components/Sidebar/SidebarMain.jsx:326, 453, 686` - Use constants
- [ ] `src/utils/geospatial.js:19, 104` - Use `ASPECT_RATIO_4_3`
- [ ] `src/utils/djiExporter.js:30, 194` - Use DJI constants
- [ ] `src/utils/kmlImporter.js:78` - Use `COORD_EPSILON`

---

## Phase 2: Extract Utility Functions (Medium Risk)

### 2.1 Geospatial Utilities
Add to `src/utils/geospatial.js`:

```js
/**
 * Get midpoint between two waypoints
 */
export function getMidpoint(wp1, wp2) {
  const p1 = turf.point([wp1.lng, wp1.lat]);
  const p2 = turf.point([wp2.lng, wp2.lat]);
  return turf.midpoint(p1, p2);
}

/**
 * Get bearing between two waypoints
 */
export function getBearing(wp1, wp2) {
  const p1 = turf.point([wp1.lng, wp1.lat]);
  const p2 = turf.point([wp2.lng, wp2.lat]);
  return turf.bearing(p1, p2);
}

/**
 * Calculate rectangle bounds from two corner points
 */
export function getRectangleBounds(point1, point2) {
  return {
    minX: Math.min(point1[0], point2[0]),
    maxX: Math.max(point1[0], point2[0]),
    minY: Math.min(point1[1], point2[1]),
    maxY: Math.max(point1[1], point2[1])
  };
}
```

**Update files:**
- [ ] `src/components/Sidebar/EditSelectedPanel.jsx:33-35`
- [ ] `src/components/Map/MapContainer.jsx:681-683, 825-830`
- [ ] `src/components/Sidebar/SidebarMain.jsx:299-300`
- [ ] `src/logic/DragRectangleMode.js:95-101`
- [ ] `src/logic/DirectSelectRectangleMode.js:97-103`

### 2.2 Standardize Turf Imports
Adopt consistent import pattern across all files:

```js
import * as turf from '@turf/turf';
```

**Files to update:**
- [ ] `src/store/useMissionStore.js:2` - Change selective to namespace import

---

## Phase 3: Replace Global State (Medium-High Risk)

### 3.1 Create MapboxDraw Context
Create `src/contexts/MapboxDrawContext.jsx`:

```jsx
import { createContext, useContext } from 'react';

export const MapboxDrawContext = createContext(null);

export function useMapboxDraw() {
  const draw = useContext(MapboxDrawContext);
  if (!draw) {
    console.warn('useMapboxDraw must be used within MapboxDrawProvider');
  }
  return draw;
}
```

### 3.2 Update App.jsx
Wrap components with provider:

```jsx
import { MapboxDrawContext } from './contexts/MapboxDrawContext';

function App() {
  const [drawRef, setDrawRef] = useState(null);

  return (
    <MapboxDrawContext.Provider value={drawRef}>
      <MapContainer onDrawReady={setDrawRef} ... />
      <SidebarMain ... />
    </MapboxDrawContext.Provider>
  );
}
```

### 3.3 Update MapContainer
- [ ] Remove `window.mapboxDraw = draw.current` (line 222)
- [ ] Call `onDrawReady(draw.current)` after initialization

### 3.4 Update SidebarMain
- [ ] Replace all `window.mapboxDraw` with `useMapboxDraw()` hook
- [ ] Lines 77, 78, 85, 95

---

## Phase 4: Split God Components (High Risk)

### 4.1 Extract MissionMetrics Component
Extract the 2x2 stats grid from SidebarMain.

**Create:** `src/components/Sidebar/MissionMetrics.jsx`

```jsx
export function MissionMetrics({ waypoints, settings, warningLevel }) {
  // Stats grid UI (lines 736-787 from SidebarMain)
}
```

### 4.2 Extract Custom Hooks

#### useMissionGeneration Hook
**Create:** `src/hooks/useMissionGeneration.js`

Extract from SidebarMain:
- `handleGenerate()` logic (lines 75-148)
- `handleGenerateWithWarning()` wrapper

```js
export function useMissionGeneration(currentPolygon, setCurrentPolygon) {
  const generate = useCallback(() => {
    // Path generation logic
  }, [currentPolygon]);

  return { generate, generateWithWarning };
}
```

#### useWaypointDragDrop Hook
**Create:** `src/hooks/useWaypointDragDrop.js`

Extract from MapContainer:
- `onPointMouseDown` (line 382)
- `onPointDragMove` (lines 427-480)
- `onPointDragUp` (lines 482-505)
- `draggedPoint` ref

```js
export function useWaypointDragDrop(map) {
  const draggedPoint = useRef(null);

  // Drag handlers

  return { setupDragHandlers, cleanupDragHandlers };
}
```

### 4.3 Split MapContainer (Future)

Long-term goal - split into:
- `<MapCore />` - Mapbox initialization, style, controls
- `<WaypointLayer />` - Waypoint rendering and selection
- `<DrawingManager />` - Mapbox Draw integration
- `<FootprintLayer />` - Footprint visualization

**Coordination strategy:** Use React Context for shared map instance.

---

## Phase 5: Add Error Handling (Medium Risk)

### 5.1 Path Generation
Wrap `generatePhotogrammetryPath` in try-catch:

```js
export function generatePhotogrammetryPath(polygon, settings) {
  try {
    // existing logic
  } catch (error) {
    console.error('Path generation failed:', error);
    return []; // Return empty array on failure
  }
}
```

### 5.2 KML Import
Preserve original error context:

```js
} catch (error) {
  throw new Error(`KML import failed: ${error.message}`, { cause: error });
}
```

### 5.3 Geospatial Calculations
Add NaN checks to `calculateMaxSpeed`:

```js
if (isNaN(maxSpeed) || !isFinite(maxSpeed)) {
  return { maxSpeed: 0, minDistance: Infinity };
}
```

---

## Implementation Order

| Phase | Risk | Effort | Priority |
|-------|------|--------|----------|
| 1.1 Remove Debug Code | Low | 10 min | 1 |
| 1.2 Remove Unused Import | Low | 2 min | 1 |
| 1.3 Extract Magic Numbers | Low | 30 min | 2 |
| 2.1 Geospatial Utilities | Medium | 45 min | 3 |
| 2.2 Standardize Imports | Low | 10 min | 3 |
| 3.x Replace Global State | Medium-High | 2 hr | 4 |
| 4.1 Extract MissionMetrics | Medium | 30 min | 5 |
| 4.2 Extract Hooks | High | 2 hr | 6 |
| 5.x Error Handling | Medium | 1 hr | 7 |

---

## Testing Strategy

After each phase:
1. Run `npm run build` - verify no compilation errors
2. Manual testing:
   - Draw polygon, generate path
   - Drag waypoints
   - Import/export KMZ
   - Check footprint toggle
3. Commit with descriptive message

---

## Rollback Plan

Each phase should be a separate commit. If issues arise:
```bash
git revert <commit-hash>
```

For major issues, reset to last known good state:
```bash
git reset --hard origin/dev
```

---

**Created**: 2025-12-05
