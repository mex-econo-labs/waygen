# Waygen Architecture Documentation

This document provides a detailed overview of the Waygen codebase architecture, component relationships, and implementation details.

---

## 🏛️ System Architecture

Waygen follows a **React-based component architecture** with unidirectional data flow managed by Zustand. The application consists of three main layers:

```
┌─────────────────────────────────────────────────────────────┐
│                      UI Layer (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ MapContainer │  │ SidebarMain  │  │  SearchBar   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                 │                                 │
│         │          ┌──────┴───────────┐                     │
│         │          │ EditSelectedPanel│                     │
│         │          └──────────────────┘                     │
│         │          ┌──────────────────┐ ┌─────────────────┐ │
│         │          │  DownloadDialog  │ │FlightWarningDial│ │
│         │          └──────────────────┘ └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                   State Layer (Zustand)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              useMissionStore.js                      │   │
│  │  • waypoints[]    • selectedIds[]                   │   │
│  │  • settings{}     • past[]  • future[]              │   │
│  │  • metrics (maxSpeed, minDistance)                   │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│              Logic & Utility Layer                           │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ pathGenerator.js│  │djiExporter.js│  │geospatial.js │   │
│  └─────────────────┘  └──────────────┘  └──────────────┘   │
│  ┌─────────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ kmlImporter.js  │  │DragRectangle │  │dronePresets  │   │
│  └─────────────────┘  └──────────────┘  └──────────────┘   │
│  ┌─────────────────┐                                        │
│  │ units.js        │  │ uuid.js       │                             │
│  └─────────────────┘  └───────────────┘                             │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│             External Libraries & Services                    │
│  • Mapbox GL JS  • Turf.js  • MapboxDraw  • JSZip          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Component Breakdown

### Core Components

#### **App.jsx** - Application Root
**Responsibility**: Top-level layout and component orchestration.

#### **MapContainer.jsx** - Map Engine
**Responsibility**: Mapbox integration, rendering, and user interactions. Receives `polygon` prop for synchronization.

**Key Features:**
- **Layers**:
  - `mission-path`: LineString connecting waypoints.
  - `footprints-fill`: Polygon fill for camera coverage (alpha stacked).
  - `footprints-outline`: Polygon outline for camera coverage.
  - `waypoints-symbol`: Teardrop icons (Blue/Red).
- **Interactions**:
  - Drag & Drop (Alt + Drag).
  - Box Selection (Shift + Drag).
  - Custom Draw Modes (Rectangle, Circle).

#### **SidebarMain.jsx** - Mission Control Panel
**Responsibility**: User interface for mission configuration.

**Sub-Components**:
- **EditSelectedPanel**: Replaces sidebar content when waypoints are selected. Allows bulk editing.
- **DownloadDialog**: Configures export settings (Filename, End Action).
- **FlightWarningDialog**: Alerts user if mission exceeds drone capabilities.

**Key Features**:
- Path Generation (Grid/Orbit).
- Mission Metrics Display (Distance, Time, Max Speed).
- Real-time Flight Warning System.

#### **SearchBar.jsx** - Geocoding Interface
**Responsibility**: Location search and navigation using Mapbox Geocoder.

#### **DrawToolbar.jsx** - Drawing Tool Selector
**Responsibility**: UI for selecting drawing modes (`simple_select`, `add_waypoint`, `draw_rectangle`, `draw_polygon`, `drag_circle`).

---

## 🧠 State Management

### Zustand Store Structure

**File**: `src/store/useMissionStore.js`

```javascript
{
  // Primary State
  waypoints: Array<Waypoint>,
  selectedIds: Array<string>,
  
  // History
  past: Array<Array<Waypoint>>,
  future: Array<Array<Waypoint>>,
  
  // Global Settings
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
    orbitRadius: 50,
    missionEndAction: 'goHome'
  },
  
  // Metrics
  calculatedMaxSpeed: number,
  minSegmentDistance: number,
  
  // Metadata
  currentMissionFilename: string | null,
  resetTrigger: number
}
```

### Store Actions

#### Waypoint Management
- `setWaypoints`, `addWaypoint`, `updateWaypoint`, `updateSelectedWaypoints`, `deleteSelectedWaypoints`.

#### Selection
- `selectWaypoint`, `setSelectedIds`, `clearSelection`.

#### History
- `undo`, `redo`.

#### Settings
- `updateSettings`.

#### Metrics
- `calculateMissionMetrics`: Updates `calculatedMaxSpeed` and `minSegmentDistance`.
- `getMissionTime`: Returns estimated seconds.
- `getFlightWarningLevel`: Returns 'safe', 'warning', or 'critical'.

---

## ⚙️ Logic Modules

### pathGenerator.js
**Exports**: `generatePhotogrammetryPath`, `generateOrbitPath`.
- **Grid**: Generates serpentine path based on overlap and FOV.
- **Orbit**: Generates circular path around centroid.

### djiExporter.js
**Export**: `downloadKMZ`.
- Generates DJI-compatible KMZ with `template.kml` and `waylines.wpml`.
- Handles `missionEndAction` and waypoint actions (Gimbal, Photo, Record).

### geospatial.js
**Exports**:
- `calculateFootprint`: Generates camera coverage polygon.
- `calculateMaxSpeed`: Determines safe speed based on photo interval.
- `calculateMissionTime`: Estimates total flight time.
- `getFlightWarningLevel`: Compares mission time to drone battery limit.

### dronePresets.js
**Exports**: `getDronePreset`.
- Database of drone specs (FOV, Battery Life, Photo Interval).

### units.js
**Exports**: `toDisplay`, `toMetric`.
- Handles unit conversion between metric (internal) and imperial (display).
197: 
198: ### uuid.js
199: **Exports**: `generateUUID`.
200: - Generates UUID v4 strings.
201: - Polyfills `crypto.randomUUID` for non-secure contexts (HTTP).

---

## 🔄 Rendering Pipeline

### Waypoint Rendering
**MapContainer.jsx** uses Mapbox GL JS's data-driven styling.
- **Source**: `waypoints` (GeoJSON FeatureCollection).
- **Layer**: `waypoints-symbol`.
- **Styling**: Icon image switches between `teardrop` and `teardrop-selected` based on `selected` property.

### Footprint Rendering
- **Source**: `footprints` (GeoJSON FeatureCollection).
- **Layers**:
  - `footprints-fill`: Low opacity fill for visualizing overlap density.
  - `footprints-outline`: Solid outline for boundary definition.
- **Color**: Controlled by `settings.footprintColor`.

### Mission Path Rendering
- **Source**: `mission-path` (GeoJSON LineString).
- **Layer**: `mission-path-line`.
- **Styling**: Blue line connecting all waypoints in order.

---

**Last Updated**: 2025-11-25
