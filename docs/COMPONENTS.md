# Waygen Component Reference

This guide provides detailed documentation for each component in the Waygen application, including props, state, and key functionality.

---

## 🗺️ Map Components

### MapContainer

**File**: `src/components/Map/MapContainer.jsx`

**Purpose**: Core map component integrating Mapbox GL JS with mission planning functionality.

**Props:**
```typescript
{
  onPolygonDrawn: (polygon: GeoJSON.Feature | null) => void;
  polygon: GeoJSON.Feature | null;
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

1. **mission-path** (Source + Layer)
   - Type: LineString
   - Style: Blue line connecting waypoints

2. **footprints** (Source)
   - **footprints-fill** (Layer): Fill with low opacity (alpha stacking)
   - **footprints-outline** (Layer): Solid outline

3. **waypoints** (Source)
   - **waypoints-symbol** (Layer): Teardrop icons (Blue = Normal, Red = Selected)

**Key Features:**
- **Drag & Drop**: Hold `Alt` key to drag waypoints.
- **Box Selection**: Hold `Shift` key and drag to select multiple waypoints.
- **Add Waypoint**: Click map to add waypoint (when in 'add_waypoint' mode).
- **Custom Draw Modes**: Rectangle, Circle (with auto-resize if > 500m).

---

### DrawToolbar

**File**: `src/components/Map/DrawToolbar.jsx`

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
- **Select (Pointer)**: `simple_select`
- **Add Waypoint**: `add_waypoint` (Custom mode)
- **Draw Square**: `draw_rectangle`
- **Draw Polygon**: `draw_polygon`
- **Draw Circle**: `drag_circle`
- **Trash**: Delete selected shapes

---

## 📊 Sidebar Components

### SidebarMain

**File**: `src/components/Sidebar/SidebarMain.jsx`

**Purpose**: Main control panel for mission settings and path generation.

**Props:**
```typescript
{
  currentPolygon: GeoJSON.Feature | null;
  setCurrentPolygon: (polygon: GeoJSON.Feature | null) => void;
}
```

**Sub-Components:**
- `EditSelectedPanel`: Rendered when `selectedIds.length > 0`.
- `DownloadDialog`: Modal for exporting missions.
- `FlightWarningDialog`: Modal for flight duration warnings.

**Key Sections:**
1. **Header**: Mission name, Undo/Redo, Reset.
2. **Import**: KML/KMZ upload.
3. **Basics**: Altitude, Speed, Drone Model, Units.
4. **Coverage**: Path Type (Grid/Orbit), Overlap, Angle.
5. **Camera**: Gimbal Pitch, Action, Footprints.
6. **Footer**: Generate button, Mission Stats (Waypoints, Distance, Max Speed, Est. Time), Download button.

**Key Logic:**
- **Path Generation**: Calls `generatePhotogrammetryPath` or `generateOrbitPath`.
- **Metrics**: Calls `calculateMissionMetrics` after generation.
- **Flight Warning**: Triggers `FlightWarningDialog` if mission time exceeds drone limits.

---

### EditSelectedPanel

**File**: `src/components/Sidebar/EditSelectedPanel.jsx`

**Purpose**: Panel for bulk editing selected waypoints. Replaces the main sidebar content when waypoints are selected.

**Props:**
```typescript
{
  selectedWaypoints: Array<Waypoint>;
  selectedIds: Array<string>;
  settings: Settings;
  onUpdate: (updates: Partial<Waypoint>) => void;
  onDelete: () => void;
}
```

**Features:**
- **Mixed State Handling**: Displays "Mixed" placeholder if selected waypoints have different values.
- **Fields**:
  - Lat/Lng (Single selection only)
  - Altitude
  - Speed
  - Gimbal Pitch
  - Heading
  - Turn Mode (Straighten Legs)
  - Action (Photo/Record/None)
- **Update Logic**: Only updates fields that have been explicitly changed.

---

## 🧩 Dialog Components

### DownloadDialog

**File**: `src/components/Dialogs/DownloadDialog.jsx`

**Purpose**: Modal for configuring mission export.

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  onDownload: ({ filename, missionEndAction }) => void;
  defaultFilename: string;
  defaultMissionEndAction: 'goHome' | 'autoLand';
}
```

**Features:**
- Filename input with sanitization.
- Mission End Action selection (Return to Home / Hover).

---

### FlightWarningDialog

**File**: `src/components/Dialogs/FlightWarningDialog.jsx`

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

**Features:**
- **Warning Level**: Yellow (Warning) or Red (Critical) styling.
- **Context**: Shows estimated time vs max flight time.
- **Suggestions**: Tips to reduce mission time.

---

## 🔍 Common Components

### SearchBar

**File**: `src/components/Common/SearchBar.jsx`

**Purpose**: Geocoding search interface using Mapbox Geocoder.

**Props**:
```typescript
{
  map: mapboxgl.Map;
}
```

**Implementation**:
- Appends `MapboxGeocoder` control to the DOM.
- Positioned absolutely over the map.

---

**Last Updated**: 2025-11-25
