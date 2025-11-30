# Waygen - Waypoint Generation Tool

**Waygen** is a professional drone mission planning application for photogrammetry and aerial survey missions. It provides an intuitive map-based interface for designing flight paths, configuring camera settings, and exporting mission files compatible with DJI drones.

![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-green)

## 🌐 Live Demo

**[Launch Waygen →](https://waygen.pages.dev/)**

---

## 📚 Documentation

For detailed technical documentation, please refer to:

- **[API Reference](docs/API.md)**: Comprehensive guide to the `useMissionStore` state, actions, and utility functions.
- **[Component Reference](docs/COMPONENTS.md)**: Detailed documentation of React components, props, and UI logic.
- **[Architecture Guide](docs/ARCHITECTURE.md)**: System overview, data flow, and rendering pipeline.
- **[File Tree](docs/FILE_TREE.md)**: Complete project directory structure.

---

## 🎯 Overview

Waygen simplifies the process of creating precise waypoint missions for drone photogrammetry. Users can draw survey boundaries, configure flight parameters, and automatically generate optimized flight paths with proper image overlap for successful 3D reconstruction.

### Key Capabilities

- **Interactive Map Interface**: Draw survey boundaries using rectangle, polygon, or circle tools.
- **Automated Path Generation**: Generate grid or orbit flight patterns with configurable spacing.
- **Camera Footprint Visualization**: Preview image coverage areas with drone-specific FOV calculations.
- **Professional Photogrammetry Settings**: Separate front and side overlap controls.
- **Mission Export**: Export missions as KMZ files compatible with DJI drones.
- **Mission Import**: Import existing KML/KMZ files for editing.
- **Flight Safety**: Automatic warnings for missions exceeding drone battery limits.

---

## ✨ Features

### Path Generation
- **Grid Pattern**: Automated lawnmower pattern with configurable angle.
- **Orbit Pattern**: Circular path around a point of interest.
- **Auto Direction**: Automatically align grid direction to longest boundary axis.
- **Path Optimization**: Straighten flight legs, reverse path direction.

### Camera & Imaging
- **Drone Presets**: Built-in profiles for DJI Mini 4 Pro, Mini 5 Pro, and Mavic 4 Pro.
- **Custom FOV**: Support for custom camera specifications.
- **Overlap Control**: Precise control over Side Overlap (flight line spacing) and Front Overlap (photo interval).
- **Waypoint Actions**: Configure shutter trigger, hovering, or continuous flight.

### Waypoint Management
- **Manual Waypoint Addition**: Click-to-add individual waypoints.
- **Drag & Drop**: Reposition waypoints by dragging (Hold Alt).
- **Bulk Editing**: Select multiple waypoints and edit properties simultaneously.
- **Undo/Redo**: Full history stack for mission editing.

### Visualization
- **Camera Footprint Overlay**: Display image coverage rectangles with rotation.
- **Color-Coded Footprints**: Visual differentiation using 4-color rotation.
- **Selection Highlighting**: Clearly identify selected waypoints.

---

## 🛠️ Technology Stack

- **React 18.2** - UI framework
- **Vite 5.0** - Build tool
- **Zustand 4.4** - State management
- **Mapbox GL JS 2.15** - Interactive mapping
- **Turf.js 6.5** - Geospatial calculations
- **Mapbox Draw** - Drawing tools
- **JSZip** - KMZ file generation

---

## 📁 Project Structure

```
waygen/
├── docs/                       # Detailed documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── COMPONENTS.md
│   └── FILE_TREE.md
├── src/
│   ├── components/
│   │   ├── Map/               # Map container and tools
│   │   ├── Sidebar/           # Mission settings and panels
│   │   ├── Dialogs/           # Modals (Download, Warnings)
│   │   └── Common/            # Shared UI components
│   ├── logic/                 # Path generation algorithms
│   ├── store/                 # Zustand state management
│   ├── utils/                 # Exporters, importers, math
│   ├── App.jsx                # Root component
│   └── main.jsx               # Entry point
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 16.x or higher
- **Mapbox Access Token**

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd waygen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Mapbox Token**
   Open `src/components/Map/MapContainer.jsx` and set your token:
   ```javascript
   mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

---

## 📖 Usage Guide

### Creating a Mission

1. **Draw Boundary**: Use the toolbar to draw a polygon or rectangle.
2. **Configure Settings**: Set altitude, speed, overlap, and camera angle in the sidebar.
3. **Generate Path**: Click **"Generate Path"** to create waypoints.
4. **Review**: Check the estimated flight time and warnings.
5. **Export**: Click **"Download KMZ"** to save the mission for your drone.

### Keyboard Shortcuts

- **Alt + Drag**: Move a waypoint
- **Shift + Drag**: Box select multiple waypoints
- **Ctrl+Z / Cmd+Z**: Undo
- **Ctrl+Shift+Z / Cmd+Shift+Z**: Redo
- **Delete**: Remove selected waypoints or shapes

---

## 🧮 Photogrammetry Math

**Side Overlap** (Line Spacing):
```
Line Spacing = Image Width × (1 - Side Overlap%)
```

**Front Overlap** (Photo Interval):
```
Waypoint Interval = Image Height × (1 - Front Overlap%)
```

**Ground Coverage**:
Calculated based on Altitude and Horizontal Field of View (HFOV).

---

## 📝 KMZ Export Specifications

The exporter adjusts WPML (Waypoint Markup Language) parameters based on the **"Straighten Legs"** setting to control drone flight behavior.

### Curved Paths (Default)
Optimized for continuous motion and smooth video.
- **Line Mode**: `<wpml:useStraightLine>0</wpml:useStraightLine>`
- **Heading**: `<wpml:waypointHeadingMode>smoothTransition</wpml:waypointHeadingMode>` (Always smooth transition, regardless of curve/straight)
- **Turn Mode**: 
  - Start/End: `toPointAndStopWithContinuityCurvature`
  - Intermediate: `toPointAndPassWithContinuityCurvature`
- **Behavior**: Drone flies through waypoints without stopping, blending headings for smooth cinematic movement.

### Straight Paths (Straighten Legs)
Optimized for precise photogrammetry and grid surveys.
- **Line Mode**: `<wpml:useStraightLine>1</wpml:useStraightLine>`
- **Heading**: `<wpml:waypointHeadingMode>smoothTransition</wpml:waypointHeadingMode>` (Always smooth transition, regardless of curve/straight)
- **Turn Mode**: `toPointAndStopWithDiscontinuityCurvature` (All points)
- **Behavior**: Drone stops at each waypoint, aligns heading with the next path segment, and flies a strictly straight line.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

**Built with ❤️ for drone pilots and photogrammetry professionals**
