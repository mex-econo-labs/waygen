# Waygen Code Quality Report

This document provides a comprehensive inventory of technical debt, code quality status, and areas requiring attention in the Waygen codebase.

**Last Updated**: 2025-12-11

---

## Status Summary

| Category | Status | Notes |
|----------|--------|-------|
| Global State Coupling | ✅ FIXED | Replaced `window.mapboxDraw` with React Context |
| Magic Numbers | ✅ FIXED | Centralized in `constants.js` |
| Debug Console Logs | ✅ FIXED | All removed (only error handling remains) |
| Code Duplication | ✅ FIXED | Utilities extracted to `geospatial.js` |
| Unused Imports | ✅ FIXED | Removed `turf` from DirectSelectRectangleMode |
| Error Handling | ✅ FIXED | Added try-catch and validation |
| God Components | ⚠️ PARTIAL | SidebarMain reduced; MapContainer still large |

---

## Resolved Issues

### Global State Coupling ✅

**Previous Issue**: Components coupled via `window.mapboxDraw` global variable.

**Resolution**: Replaced with React Context pattern.

```jsx
// src/contexts/MapboxDrawContext.jsx
export const MapboxDrawContext = createContext(null);
export function useMapboxDraw() {
  return useContext(MapboxDrawContext);
}

// App.jsx
<MapboxDrawContext.Provider value={mapboxDraw}>
  <MapContainer onDrawReady={setMapboxDraw} />
  <SidebarMain />
</MapboxDrawContext.Provider>
```

---

### Magic Numbers ✅

**Previous Issue**: Hardcoded values scattered across 8+ files.

**Resolution**: Centralized in `src/utils/constants.js`:

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

Additional constants in `dronePresets.js`:
- `FLIGHT_WARNING_THRESHOLD = 0.85`
- `DEFAULT_PHOTO_INTERVAL = 5.5`
- `TAKEOFF_LANDING_OVERHEAD = 0`

---

### Code Duplication ✅

**Previous Issue**: Turf midpoint and rectangle bounds calculated in 4+ locations.

**Resolution**: Extracted to `src/utils/geospatial.js`:

```js
export const getMidpoint = (wp1, wp2) => { ... };
export const getBearing = (wp1, wp2) => { ... };
export const getRectangleBounds = (point1, point2) => { ... };
```

---

### Debug Console Logs ✅

**Previous Issue**: 6 debug `console.log` statements in production code.

**Resolution**: All removed. Remaining console usage is for error handling only:

| File | Type | Purpose |
|------|------|---------|
| pathGenerator.js:94 | console.error | Invalid polygon validation |
| pathGenerator.js:329 | console.error | Path generation failure |
| MapContainer.jsx:767 | console.warn | Mode switch failure |
| MapContainer.jsx:917 | console.warn | Bounds fitting error |
| MapContainer.jsx:996 | console.error | Geolocation error |
| SidebarMain.jsx:100 | console.warn | Missing session data |
| SidebarMain.jsx:122 | console.error | File import error |
| kmlImporter.js:120 | console.warn | Session parse error |
| kmlImporter.js:129 | console.error | KMZ parse error |

---

### Error Handling ✅

**Previous Issue**: Missing try-catch blocks and NaN validation.

**Resolution**:
- `generatePhotogrammetryPath` wrapped in try-catch, returns `[]` on failure
- `kmlImporter.js` preserves error context with `{ cause: e }`
- `calculateMaxSpeed` validates NaN/Infinity values

---

## Remaining Technical Debt

### God Components ⚠️

Components with excessive responsibilities:

| File | Lines | Severity | Notes |
|------|-------|----------|-------|
| `MapContainer.jsx` | 1,011 | HIGH | Map init, 20+ event listeners, drag/drop, layers |
| `SidebarMain.jsx` | 628 | MEDIUM | Reduced from 816; still handles settings + file I/O |
| `pathGenerator.js` | 332 | MEDIUM | Complex but focused on path generation |

**Recommendation**: Future work to extract `useWaypointDragDrop` hook from MapContainer.

---

### Store Access Pattern ⚠️

**Issue**: Direct `useMissionStore.getState()` calls bypass React subscriptions.

**Locations**:
- MapContainer.jsx: ~7 occurrences
- SidebarMain.jsx: ~5 occurrences
- useMissionGeneration.js: ~4 occurrences

**Impact**: Components may not re-render when accessed state changes.

**Recommendation**: Refactor to use hook subscriptions where possible.

---

### Minor Magic Numbers ⚠️

UI-related numbers that could be extracted:

| File | Value | Context |
|------|-------|---------|
| MapContainer.jsx:185-186 | -98, 39 | Default map center (US) |
| MapContainer.jsx:186 | 4 | Default zoom level |
| MapContainer.jsx:257 | 500 | Circle size threshold |
| MapContainer.jsx:150 | 64 | Circle generation steps |

**Recommendation**: Extract to constants if map defaults need to be configurable.

---

### Unused Exports ⚠️

| File | Export | Status |
|------|--------|--------|
| MissionMetrics.jsx | `calculateMissionDistance` | Exported but never imported |
| MissionMetrics.jsx | `formatDistance` | Exported but never imported |

**Recommendation**: Remove if not needed for future features.

---

### Event System Legacy ⚠️

**Issue**: `window.dispatchEvent` used for polygon restoration in SidebarMain.jsx:98.

```js
window.dispatchEvent(new CustomEvent('waygen:restore-polygon', { detail: sessionData.polygon }));
```

**Recommendation**: Replace with callback or context-based approach.

---

## Code Quality Metrics

### File Line Counts

| Category | File | Lines |
|----------|------|-------|
| **Components** | | |
| | MapContainer.jsx | 1,011 |
| | SidebarMain.jsx | 628 |
| | EditSelectedPanel.jsx | 244 |
| | DownloadDialog.jsx | 182 |
| | MissionMetrics.jsx | 120 |
| | DrawToolbar.jsx | 46 |
| | SearchBar.jsx | 24 |
| **Hooks** | | |
| | useMissionGeneration.js | 152 |
| **Store** | | |
| | useMissionStore.js | 317 |
| **Logic** | | |
| | pathGenerator.js | 332 |
| | DragRectangleMode.js | 113 |
| | DirectSelectRectangleMode.js | 142 |
| **Utilities** | | |
| | geospatial.js | 253 |
| | djiExporter.js | 220 |
| | kmlImporter.js | 135 |
| | dronePresets.js | 111 |
| | units.js | 23 |
| | constants.js | 16 |
| | uuid.js | 18 |
| **Context** | | |
| | MapboxDrawContext.jsx | 15 |

**Total**: ~4,245 lines

---

## Quality Score

**Overall: 8.5/10**

| Aspect | Score | Notes |
|--------|-------|-------|
| Architecture | 8/10 | Clean separation, proper patterns |
| Code Organization | 9/10 | Well-organized folders |
| Constants Management | 9/10 | Centralized |
| Global State | 10/10 | No window globals |
| Duplication | 9/10 | Minimal, utilities extracted |
| Error Handling | 8/10 | Good coverage |
| Documentation | 7/10 | Good JSDoc, some gaps |

---

## Refactoring History

| Date | Phase | Changes |
|------|-------|---------|
| 2025-12-05 | Phase 1 | Removed debug logs, unused imports, extracted constants |
| 2025-12-05 | Phase 2 | Extracted geospatial utilities |
| 2025-12-05 | Phase 3 | Replaced window.mapboxDraw with Context |
| 2025-12-05 | Phase 4 | Extracted MissionMetrics, useMissionGeneration |
| 2025-12-05 | Phase 5 | Added error handling and validation |

See [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) for complete details.
