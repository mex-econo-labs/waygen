# Waygen Component Reference

This guide provides detailed documentation for each component in the Waygen application, including props, state, and key functionality.

**Last Updated**: 2025-12-11

---

## Component Overview

| Component | File | Lines | Purpose |
|-----------|------|-------|---------|
| MapContainer | Map/MapContainer.jsx | 1,011 | Map rendering & interactions |
| SidebarMain | Sidebar/SidebarMain.jsx | 628 | Mission control panel |
| EditSelectedPanel | Sidebar/EditSelectedPanel.jsx | 244 | Bulk waypoint editing |
| MissionMetrics | Sidebar/MissionMetrics.jsx | 120 | Mission statistics display |
| DownloadDialog | Dialogs/DownloadDialog.jsx | 182 | Export configuration |
| FlightWarningDialog | Dialogs/FlightWarningDialog.jsx | 80 | Flight duration warnings |
| DrawToolbar | Map/DrawToolbar.jsx | 46 | Drawing mode selector |
| SearchBar | Common/SearchBar.jsx | 24 | Location search |

---

## Map Components

### MapContainer

**File**: `src/components/Map/MapContainer.jsx`
**Lines**: 1,011

**Purpose**: Core map component integrating Mapbox GL JS with mission planning functionality.

**Props:**
```typescript
{
  onPolygonDrawn: (polygon: GeoJSON.Feature | null) => void;
  polygon: GeoJSON.Feature | null;
  onDrawReady: (draw: MapboxDraw) => void;  // New: Context callback
}
```

**Key State:**
```javascript
const [currentMode, setCurrentMode] = useState('simple_select');
const [selectionBox, setSelectionBox] = useState(null);
const [canDelete, setCanDelete] = useState(false);
const map = useRef(null);
const draw = useRef(null);
const draggedPoint = useRef(null);
```

**Store Subscriptions:**
```javascript
const waypoints = useMissionStore(state => state.waypoints);
const selectedIds = useMissionStore(state => state.selectedIds);
const settings = useMissionStore(state => state.settings);
const resetTrigger = useMissionStore(state => state.resetTrigger);
```

**Mapbox Layers:**

| Layer ID | Type | Purpose |
|----------|------|---------|
| `mission-path` | LineString | Blue line connecting waypoints |
| `footprints-fill` | Polygon | Camera coverage (alpha stacked) |
| `footprints-outline` | Polygon | Coverage boundary outline |
| `waypoints-symbol` | Symbol | Teardrop icons (Blue/Red) |

**Key Features:**
- **Drag & Drop**: Hold `Alt` key to drag waypoints
- **Box Selection**: Hold `Shift` key and drag to select multiple
- **Add Waypoint**: Click map in 'add_waypoint' mode
- **Custom Draw Modes**: Rectangle, Circle (auto-resize if > 500m)

---

### DrawToolbar

**File**: `src/components/Map/DrawToolbar.jsx`
**Lines**: 46

**Purpose**: Toolbar for selecting drawing and selection modes.

**Props:**
```typescript
{
  currentMode: string;
  onModeChange: (mode: string) => void;
  onDelete: () => void;
  canDelete: boolean;
}
```

**Tools:**
| Icon | Mode | Description |
|------|------|-------------|
| Pointer | `simple_select` | Select shapes |
| Plus | `add_waypoint` | Add waypoint on click |
| Square | `draw_rectangle` | Draw rectangle |
| Pentagon | `draw_polygon` | Draw polygon |
| Circle | `drag_circle` | Draw circle |
| Trash | - | Delete selected |

---

## Sidebar Components

### SidebarMain

**File**: `src/components/Sidebar/SidebarMain.jsx`
**Lines**: 628 (reduced from 816)

**Purpose**: Main control panel for mission settings and path generation.

**Props:**
```typescript
{
  currentPolygon: GeoJSON.Feature | null;
  setCurrentPolygon: (polygon: GeoJSON.Feature | null) => void;
}
```

**Hooks Used:**
```javascript
const mapboxDraw = useMapboxDraw();  // Context hook
const {
  handleGenerateWithWarning,
  handleAutoGenerate,
  showFlightWarning,
  setShowFlightWarning,
  warningLevel
} = useMissionGeneration({ currentPolygon, setCurrentPolygon, mapboxDraw });
```

**Sub-Components:**
- `EditSelectedPanel`: Rendered when `selectedIds.length > 0`
- `MissionMetrics`: 2x2 stats grid in footer
- `DownloadDialog`: Modal for exporting missions
- `FlightWarningDialog`: Modal for flight duration warnings

**Sections:**
1. **Header**: Mission name, Undo/Redo, Reset
2. **Import**: KML/KMZ drag & drop upload
3. **Basics**: Units, Altitude, Drone Model, Photo Interval
4. **Coverage**: Path Type (Grid/Orbit), Overlap, Angle
5. **Camera**: Gimbal Pitch, Action, Footprints
6. **Footer**: Generate button, MissionMetrics, Download button

---

### MissionMetrics

**File**: `src/components/Sidebar/MissionMetrics.jsx`
**Lines**: 120

**Purpose**: Compact 2x2 grid displaying mission statistics with warning indicators.

**Props:**
```typescript
{
  waypoints: Array<Waypoint>;
  settings: Settings;
  warningLevel: 'safe' | 'warning' | 'critical';
  calculatedMaxSpeed: number;
  calculatedOverlapDistance: number;
}
```

**Display Grid:**
```
┌─────────────┬─────────────┐
│  Waypoints  │  Distance   │
├─────────────┼─────────────┤
│  Max Speed  │ Est. Time   │
└─────────────┴─────────────┘
```

**Warning Styling:**
- `safe`: Default gray border
- `warning`: Yellow border, yellow background on time cell
- `critical`: Red border, red background on time cell

**Exported Helpers:**
```javascript
export { calculateMissionDistance, formatTime, formatDistance };
```

---

### EditSelectedPanel

**File**: `src/components/Sidebar/EditSelectedPanel.jsx`
**Lines**: 244

**Purpose**: Panel for bulk editing selected waypoints. Replaces sidebar content when waypoints are selected.

**Props:**
```typescript
{
  selectedWaypoints: Array<Waypoint>;
  selectedIds: Array<string>;
  waypoints: Array<Waypoint>;
  settings: Settings;
  onUpdate: (updates: Partial<Waypoint>) => void;
  onDelete: () => void;
  onInsert: (afterId: string, newWaypoint: Waypoint) => void;
}
```

**Features:**
- **Mixed State Handling**: Shows "Mixed" when selected waypoints have different values
- **Insert Waypoint**: Adds waypoint between selected pair (2 waypoints only)
- **Fields**: Lat/Lng (single only), Altitude, Speed, Gimbal, Heading, Turn Mode, Action

---

## Dialog Components

### DownloadDialog

**File**: `src/components/Dialogs/DownloadDialog.jsx`
**Lines**: 182

**Purpose**: Modal for configuring mission export settings.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  onDownload: ({ filename, missionEndAction, rcLostAction, globalTransitionalSpeed }) => void;
  defaultFilename: string;
  defaultMissionEndAction: 'goHome' | 'hover';
  units: 'metric' | 'imperial';
}
```

**Configuration Options:**
- Filename input with sanitization
- Mission End Action (Return to Home / Hover)
- RC Lost Action (Continue / Return Home / Hover / Land)
- Global Transit Speed

---

### FlightWarningDialog

**File**: `src/components/Dialogs/FlightWarningDialog.jsx`
**Lines**: 80

**Purpose**: Warning modal for excessive flight duration.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  warningLevel: 'warning' | 'critical';
  missionTime: string;
  droneName: string;
  maxFlightTime: number;
}
```

**Display:**
- Warning Level badge (Yellow/Red)
- Estimated vs Maximum flight time comparison
- Tips to reduce mission time

---

## Common Components

### SearchBar

**File**: `src/components/Common/SearchBar.jsx`
**Lines**: 24

**Purpose**: Geocoding search interface using Mapbox Geocoder.

**Props:**
```typescript
{
  map: mapboxgl.Map;
}
```

**Implementation**: Appends `MapboxGeocoder` control to DOM, positioned absolutely over map.

---

## Custom Hooks

### useMissionGeneration

**File**: `src/hooks/useMissionGeneration.js`
**Lines**: 152

**Purpose**: Encapsulates path generation logic extracted from SidebarMain.

**Parameters:**
```typescript
{
  currentPolygon: GeoJSON.Feature | null;
  setCurrentPolygon: (polygon: GeoJSON.Feature | null) => void;
  mapboxDraw: MapboxDraw | null;
}
```

**Returns:**
```typescript
{
  handleGenerate: () => void;           // Core generation
  handleGenerateWithWarning: () => void; // With warning check
  handleAutoGenerate: () => void;        // Auto-regen on settings change
  showFlightWarning: boolean;
  setShowFlightWarning: (show: boolean) => void;
  warningLevel: 'safe' | 'warning' | 'critical';
}
```

---

## Context Providers

### MapboxDrawContext

**File**: `src/contexts/MapboxDrawContext.jsx`
**Lines**: 15

**Purpose**: Provides Mapbox Draw instance to child components without global state.

**Usage:**
```jsx
// Provider (App.jsx)
<MapboxDrawContext.Provider value={mapboxDraw}>
  ...
</MapboxDrawContext.Provider>

// Consumer
const draw = useMapboxDraw();
```

**Replaces**: Previous `window.mapboxDraw` global pattern.
