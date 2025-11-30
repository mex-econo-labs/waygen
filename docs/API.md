# Waygen API Reference

This document provides detailed API documentation for the key modules and functions in the Waygen codebase.

---

## 📦 Store API

### useMissionStore

**Location**: `src/store/useMissionStore.js`

Zustand store for managing mission state, waypoints, and settings.

#### State Properties

##### `waypoints: Array<Waypoint>`
Array of waypoint objects representing the flight path.

**Waypoint Object Structure:**
```typescript
{
  id: string;           // Unique identifier (UUID)
  lat: number;          // Latitude in decimal degrees
  lng: number;          // Longitude in decimal degrees
  altitude: number;     // Altitude in meters
  speed: number;        // Flight speed in m/s
  gimbalPitch: number;  // Gimbal pitch in degrees (-90 to 0)
  heading: number;      // Flight heading in degrees (0-360)
}
```

##### `selectedIds: Array<string>`
Array of selected waypoint IDs.

##### `past: Array<Array<Waypoint>>`
Undo stack containing previous waypoint states.

##### `future: Array<Array<Waypoint>>`
Redo stack containing future waypoint states.

##### `settings: Object`
Global mission settings.

**Settings Object Structure:**
```typescript
{
  altitude: number;           // Default waypoint altitude (meters)
  speed: number;              // Default flight speed (m/s)
  gimbalPitch: number;        // Default gimbal pitch (degrees)
  customFOV: number;          // Custom camera FOV (degrees)
  showFootprints: boolean;    // Display footprint overlay
  footprintColor: string;     // Color of the footprint overlay (hex)
  sideOverlap: number;        // Side overlap percentage (0-90)
  frontOverlap: number;       // Front overlap percentage (0-90)
  pathType: 'grid' | 'orbit'; // Path generation type
  angle: number;              // Grid angle (0-360 degrees)
  autoDirection: boolean;     // Auto-calculate grid direction
  generateEveryPoint: boolean;// Insert waypoints at every intersection
  reversePath: boolean;       // Reverse waypoint order
  waypointAction: 'none' | 'photo' | 'hover'; // Action at waypoint
  photoInterval: number;      // Photo interval in seconds
  selectedDrone: string;      // Drone model identifier
  straightenLegs: boolean;    // Remove interior waypoints on flight lines
  units: 'metric' | 'imperial'; // Display units
  orbitRadius: number;        // Radius for orbit path (meters)
  missionEndAction: 'goHome' | 'autoLand'; // Action at end of mission
}
```

##### `resetTrigger: number`
Counter incremented on mission reset for triggering map cleanup.

##### `currentMissionFilename: string | null`
Name of the currently loaded mission file.

##### `calculatedMaxSpeed: number`
Calculated maximum safe speed based on photo interval.

##### `minSegmentDistance: number`
Minimum distance between waypoints in the current path.

---

#### Actions

##### `setWaypoints(waypoints: Array<Waypoint>): void`
Replace all waypoints and update history.

##### `addWaypoint(waypoint: Partial<Waypoint>): void`
Append a single waypoint to the end of the list. Auto-calculates heading from previous point.

##### `updateWaypoint(id: string, updates: Partial<Waypoint>): void`
Update a single waypoint by ID.

##### `updateSelectedWaypoints(updates: Partial<Waypoint>): void`
Bulk update all selected waypoints.

##### `deleteSelectedWaypoints(): void`
Remove all selected waypoints from the mission.

##### `selectWaypoint(id: string, multi: boolean): void`
Select or deselect a waypoint.

##### `setSelectedIds(ids: Array<string>): void`
Directly set the selected waypoint IDs.

##### `clearSelection(): void`
Deselect all waypoints.

##### `updateSettings(newSettings: Partial<Settings>): void`
Merge new settings into the existing settings object.

##### `undo(): void`
Revert to the previous waypoint state.

##### `redo(): void`
Restore the next waypoint state.

##### `resetMission(): void`
Clear all waypoints, selection, history, and metrics. Increments `resetTrigger`.

##### `setMapRef(mapRef: MapboxMap): void`
Store reference to the Mapbox map instance.

##### `fitMapToWaypoints(): void`
Fit the map view to the bounding box of all waypoints.

##### `setMissionFilename(filename: string): void`
Set the current mission filename.

##### `clearMissionFilename(): void`
Clear the current mission filename.

##### `calculateMissionMetrics(): void`
Calculate `calculatedMaxSpeed` and `minSegmentDistance` based on current waypoints and settings.

##### `getTotalDistance(): number`
Calculate total mission distance in meters.

##### `getMissionTime(): number`
Calculate estimated mission time in seconds.

##### `getFlightWarningLevel(): 'safe' | 'warning' | 'critical'`
Determine flight warning level based on estimated mission time and drone battery limits.

---

## 🛰️ Path Generation API

### pathGenerator.js

**Location**: `src/logic/pathGenerator.js`

#### `generatePhotogrammetryPath(polygonFeature, settings): Array<Waypoint>`

Generate a grid-based photogrammetry flight path.

**Parameters:**
- `polygonFeature` (GeoJSON Feature) - Boundary polygon
- `settings` (Object) - Mission settings from store

**Returns:**
- Array of waypoint objects

**Algorithm:**
1. Calculate drone FOV and ground image dimensions
2. Compute line spacing from side overlap
3. Compute waypoint spacing from front overlap
4. Generate parallel flight lines across boundary (rotated by `angle`)
5. Insert waypoints along each line
6. Apply post-processing (reverse, straighten, etc.)

---

#### `generateOrbitPath(polygonFeature, settings): Array<Waypoint>`

Generate a circular orbit path around a point.

**Parameters:**
- `polygonFeature` (GeoJSON Feature) - Boundary (centroid used as orbit center)
- `settings` (Object) - Mission settings from store (requires `spacing` property for point density)

**Returns:**
- Array of waypoint objects orbiting the center

**Algorithm:**
1. Calculate polygon centroid
2. Calculate radius (average distance to vertices)
3. Generate waypoints along circumference at `spacing` intervals
4. Set headings pointing toward center
5. Set gimbal pitch to maintain center view

---

## 📤 Export API

### djiExporter.js

**Location**: `src/utils/djiExporter.js`

#### `downloadKMZ(waypoints, settings, filename): void`

Export waypoints as a DJI-compatible KMZ file.

**Parameters:**
- `waypoints` (Array<Waypoint>) - Waypoints to export
- `settings` (Object) - Mission settings (used for metadata and global actions)
- `filename` (string, optional) - Output filename (default: 'MiniMission')

**Features:**
- Generates `template.kml` and `waylines.wpml`
- Supports `missionEndAction` (Go Home / Auto Land)
- Configures drone info and speed
- Generates waypoint actions (Gimbal Rotate, Take Photo, Start/Stop Record)

---

## 📥 Import API

### kmlImporter.js

**Location**: `src/utils/kmlImporter.js`

#### `parseImport(file): Promise<ImportResult>`

Parse a KML or KMZ file and extract waypoints.

**Parameters:**
- `file` (File) - File object from input element

**Returns:**
- Promise resolving to `ImportResult` object containing GeoJSON features.

---

## 🌍 Geospatial API

### geospatial.js

**Location**: `src/utils/geospatial.js`

#### `calculateFootprint(center, altitude, heading, hfov): GeoJSON.Feature`
Calculate camera ground coverage footprint polygon.

#### `calculateDistance(wp1, wp2): number`
Calculate distance between two waypoints in meters.

#### `calculateMaxSpeed(waypoints, photoInterval): Object`
Calculate maximum safe speed to satisfy photo interval requirements.
**Returns**: `{ maxSpeed, minDistance }`

#### `calculateMissionTime(totalDistance, speed): number`
Calculate estimated mission time including transit and takeoff/landing overhead.

#### `getFlightWarningLevel(missionTimeSeconds, maxFlightTimeMinutes): string`
Determine flight warning level ('safe', 'warning', 'critical').

---

## 🎨 Custom Draw Modes

### DragRectangleMode

**Location**: `src/logic/DragRectangleMode.js`

Custom MapboxDraw mode for click-drag-release rectangle drawing.

---

### dronePresets.js

**Location**: `src/utils/dronePresets.js`

#### `getDronePreset(droneId): Object | null`
Get drone configuration by ID.

**Parameters:**
- `droneId` (string) - Drone identifier (e.g., 'mini-4-pro')

**Returns:**
- Preset object: `{ name, hfov, photoInterval, maxFlightTime }`

#### `mapLegacyDroneId(legacyId): string`
Map legacy drone IDs (e.g., 'dji_mini_4_pro') to new preset IDs.

#### `getDroneIds(): Array<string>`
Get all drone preset IDs.

#### Constants
- `FLIGHT_WARNING_THRESHOLD`: 0.85
- `DEFAULT_PHOTO_INTERVAL`: 5.5
- `TAKEOFF_LANDING_OVERHEAD`: 120

---

### units.js

**Location**: `src/utils/units.js`

#### `toDisplay(meters, units): number`
Convert meters to target unit (metric/imperial).

#### `toMetric(displayValue, units): number`
Convert display value back to meters.

#### Constants
- `METERS_TO_FEET`: 3.28084

---

### uuid.js

**Location**: `src/utils/uuid.js`

#### `generateUUID(): string`
Generate a UUID v4 string with fallback for non-secure contexts.

**Returns:**
- UUID string

**Implementation:**
- Uses native `crypto.randomUUID()` if available (HTTPS/localhost)
- Falls back to math-based generator for HTTP contexts

---

**Last Updated**: 2025-11-26
