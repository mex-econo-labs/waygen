# Waygen Architecture Documentation

This document provides a detailed overview of the Waygen codebase architecture, component relationships, and implementation details.

**Last Updated**: 2025-12-11

---

## System Architecture

Waygen follows a **React-based component architecture** with unidirectional data flow managed by Zustand. The application consists of five main layers:

```
┌─────────────────────────────────────────────────────────────────┐
│                       UI Layer (React)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ MapContainer │  │ SidebarMain  │  │  SearchBar   │          │
│  │   (1,011)    │  │    (628)     │  │     (24)     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                                     │
│         │          ┌──────┴───────────┐                        │
│         │          │ EditSelectedPanel│                        │
│         │          │      (244)       │                        │
│         │          └──────────────────┘                        │
│         │          ┌──────────────────┐ ┌──────────────────┐   │
│         │          │ MissionMetrics   │ │   Dialogs        │   │
│         │          │      (120)       │ │ Download (182)   │   │
│         │          └──────────────────┘ │ Warning (80)     │   │
│         │                               └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Hooks & Context Layer                        │
│  ┌──────────────────────┐  ┌──────────────────────────────┐    │
│  │ useMissionGeneration │  │    MapboxDrawContext         │    │
│  │        (152)         │  │          (15)                │    │
│  └──────────────────────┘  └──────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                    State Layer (Zustand)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  useMissionStore.js (317)                │  │
│  │  • waypoints[]    • selectedIds[]    • settings{}       │  │
│  │  • past[]         • future[]         • metrics          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│                  Logic & Utility Layer                          │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │pathGenerator.js│  │ djiExporter.js │  │ geospatial.js  │    │
│  │     (332)      │  │     (220)      │  │     (253)      │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ kmlImporter.js │  │DragRectangle.js│  │dronePresets.js │    │
│  │     (135)      │  │     (113)      │  │     (111)      │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │  constants.js  │  │    units.js    │  │    uuid.js     │    │
│  │      (16)      │  │      (23)      │  │      (18)      │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────────┐
│               External Libraries & Services                     │
│  • Mapbox GL JS  • Turf.js  • MapboxDraw  • JSZip              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── App.jsx                    # Application root with context provider
├── main.jsx                   # Entry point
├── index.css                  # Global styles
├── contexts/
│   └── MapboxDrawContext.jsx  # Mapbox Draw context (replaces window global)
├── hooks/
│   └── useMissionGeneration.js # Path generation logic hook
├── store/
│   └── useMissionStore.js     # Zustand state management
├── components/
│   ├── Map/
│   │   ├── MapContainer.jsx   # Main map component
│   │   └── DrawToolbar.jsx    # Drawing mode toolbar
│   ├── Sidebar/
│   │   ├── SidebarMain.jsx    # Main control panel
│   │   ├── EditSelectedPanel.jsx # Bulk waypoint editor
│   │   └── MissionMetrics.jsx # Stats display (2x2 grid)
│   ├── Dialogs/
│   │   ├── DownloadDialog.jsx # Export configuration
│   │   └── FlightWarningDialog.jsx # Duration warning
│   └── Common/
│       └── SearchBar.jsx      # Location geocoder
├── logic/
│   ├── pathGenerator.js       # Grid/Orbit path algorithms
│   ├── DragRectangleMode.js   # Custom Mapbox Draw mode
│   └── DirectSelectRectangleMode.js # Rectangle editing mode
└── utils/
    ├── constants.js           # Centralized magic numbers
    ├── djiExporter.js         # KMZ file generation
    ├── dronePresets.js        # Drone specifications
    ├── geospatial.js          # Mapping calculations
    ├── kmlImporter.js         # KML/KMZ parsing
    ├── units.js               # Unit conversions
    └── uuid.js                # UUID generation
```

---

## Data Flow

### Component Communication

```
                    App.jsx
                       │
        ┌──────────────┼──────────────┐
        │              │              │
        ▼              │              ▼
   MapContainer        │        SidebarMain
        │              │              │
        │    MapboxDrawContext        │
        │         (shared)            │
        │              │              │
        └──────────────┼──────────────┘
                       │
                       ▼
               useMissionStore
                  (Zustand)
```

### Context Pattern

**MapboxDrawContext** enables MapContainer to share its Mapbox Draw instance with SidebarMain without using window globals:

```jsx
// App.jsx
const [mapboxDraw, setMapboxDraw] = useState(null);

<MapboxDrawContext.Provider value={mapboxDraw}>
  <MapContainer onDrawReady={setMapboxDraw} />
  <SidebarMain />
</MapboxDrawContext.Provider>

// SidebarMain.jsx
const mapboxDraw = useMapboxDraw();
mapboxDraw.changeMode('simple_select');
```

---

## State Management

### Zustand Store Structure

**File**: `src/store/useMissionStore.js`

```javascript
{
  // Primary State
  waypoints: Array<Waypoint>,
  selectedIds: Array<string>,

  // History (Undo/Redo)
  past: Array<Array<Waypoint>>,
  future: Array<Array<Waypoint>>,

  // Mission Settings
  settings: {
    altitude: 60,
    speed: 10,
    gimbalPitch: -90,
    customFOV: 82.1,
    showFootprints: false,
    footprintColor: '#22c55e',
    sideOverlap: 70,
    frontOverlap: 80,
    pathType: 'grid',
    angle: 0,
    autoDirection: false,
    generateEveryPoint: false,
    reversePath: false,
    waypointAction: 'none',
    photoInterval: 2,
    selectedDrone: 'dji_mini_5_pro',
    straightenLegs: false,
    units: 'metric',
    missionEndAction: 'goHome',
    eliminateExtraYaw: false
  },

  // Calculated Metrics
  calculatedMaxSpeed: number,
  minSegmentDistance: number,
  calculatedOverlapDistance: number,

  // Metadata
  currentMissionFilename: string | null,
  resetTrigger: number
}
```

### Store Actions

| Category | Actions |
|----------|---------|
| Waypoints | `setWaypoints`, `addWaypoint`, `updateWaypoint`, `updateSelectedWaypoints`, `deleteSelectedWaypoints`, `insertWaypoint` |
| Selection | `selectWaypoint`, `setSelectedIds`, `clearSelection` |
| History | `undo`, `redo` |
| Settings | `updateSettings` |
| Metrics | `calculateMissionMetrics`, `getMissionTime`, `getFlightWarningLevel`, `getTotalDistance` |
| Mission | `resetMission`, `setMissionFilename`, `fitMapToWaypoints` |

---

## Logic Modules

### pathGenerator.js

**Exports**: `generatePhotogrammetryPath`

**Grid Mode**:
- Generates serpentine (boustrophedon) path
- Calculates line spacing from FOV and overlap
- Clips lines to polygon boundary
- Filters short corner clips
- Interpolates points if `generateEveryPoint` enabled

**Orbit Mode**:
- Generates circular path around polygon centroid
- Calculates radius from average vertex distance
- Supports fractional orbits and start angle

### geospatial.js

**Key Exports**:

| Function | Purpose |
|----------|---------|
| `calculateFootprint` | Camera coverage polygon |
| `calculateMaxSpeed` | Safe speed from photo interval |
| `calculateMissionTime` | Total flight duration |
| `getFlightWarningLevel` | Battery warning status |
| `getMidpoint` | Midpoint between waypoints |
| `getBearing` | Bearing between waypoints |
| `getRectangleBounds` | Bounds from corner points |
| `calculateDistance` | Distance in meters |

### djiExporter.js

**Export**: `downloadKMZ`

Generates DJI-compatible KMZ containing:
- `template.kml` - Mission metadata
- `waylines.wpml` - Waypoint data with actions

### constants.js

Centralized magic numbers:

```javascript
export const DEFAULT_HFOV = 82.1;
export const ASPECT_RATIO_4_3 = 4 / 3;
export const METERS_PER_DEGREE_LAT = 111111;
export const COORD_EPSILON = 0.0001;
export const DJI_DRONE_ENUM = 68;
export const DJI_DRONE_SUB_ENUM = 0;
```

---

## Rendering Pipeline

### Mapbox Layers

| Layer ID | Source | Type | Purpose |
|----------|--------|------|---------|
| `mission-path` | `mission-path` | line | Blue line connecting waypoints |
| `footprints-fill` | `footprints` | fill | Camera coverage (alpha stacked) |
| `footprints-outline` | `footprints` | line | Coverage boundary |
| `waypoints-symbol` | `waypoints` | symbol | Teardrop icons |

### Waypoint Styling

Data-driven styling switches icon based on selection state:

```javascript
'icon-image': [
  'case',
  ['get', 'selected'], 'teardrop-selected',  // Red
  'teardrop'                                   // Blue
]
```

---

## Error Handling

### Path Generation

```javascript
export function generatePhotogrammetryPath(polygonFeature, settings) {
  try {
    if (!polygonFeature || !polygonFeature.geometry) {
      console.error('Path generation failed: Invalid polygon feature');
      return [];
    }
    // ... generation logic
  } catch (error) {
    console.error('Path generation failed:', error);
    return [];
  }
}
```

### Import/Export

- `kmlImporter.js` preserves error context with `{ cause: e }`
- `geospatial.js` validates NaN/Infinity in calculations

---

## Technical Debt Summary

See [CODE_QUALITY.md](./CODE_QUALITY.md) for detailed analysis.

### Remaining Issues

| Issue | Severity | Location |
|-------|----------|----------|
| MapContainer size (1,011 lines) | HIGH | Map/MapContainer.jsx |
| Direct `getState()` calls | MEDIUM | Multiple files |
| `window.dispatchEvent` usage | LOW | SidebarMain.jsx:98 |
| Unused exports | LOW | MissionMetrics.jsx |

### Resolved Issues

| Issue | Resolution |
|-------|------------|
| `window.mapboxDraw` global | Replaced with MapboxDrawContext |
| Magic numbers scattered | Centralized in constants.js |
| Debug console.log statements | Removed (only error handling remains) |
| Code duplication | Extracted to geospatial.js utilities |
| Missing error handling | Added try-catch and validation |

---

## Future Improvements

1. **Extract useWaypointDragDrop hook** from MapContainer
2. **Split MapContainer** into MapCore, WaypointLayer, DrawingManager
3. **Replace window.dispatchEvent** with context-based polygon restoration
4. **Refactor getState() calls** to use hook subscriptions
