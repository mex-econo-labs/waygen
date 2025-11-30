import { create } from 'zustand';
import { bearing } from '@turf/turf';

import { getDronePreset, DRONE_PRESETS, DEFAULT_PHOTO_INTERVAL, mapLegacyDroneId, getDefaultDroneId } from '../utils/dronePresets';
import { calculateMaxSpeed, calculateMissionTime, getFlightWarningLevel, calculateDistance } from '../utils/geospatial';
import { generateUUID } from '../utils/uuid';

export const useMissionStore = create((set, get) => ({
  waypoints: [],
  selectedIds: [],

  // Map Reference
  mapRef: null,

  // Mission metadata
  currentMissionFilename: null,

  // Calculated mission metrics
  calculatedMaxSpeed: 0,
  minSegmentDistance: 0,

  // History Stack
  past: [],
  future: [],

  // Global Settings
  settings: (() => {
    const defaultDroneId = getDefaultDroneId();
    const mappedDroneId = mapLegacyDroneId(defaultDroneId);
    const defaultPreset = DRONE_PRESETS[mappedDroneId];

    return {
      altitude: 60,
      speed: 10,
      gimbalPitch: -90,
      customFOV: defaultPreset?.hfov || 82.1,
      showFootprints: false,
      footprintColor: '#22c55e',
      sideOverlap: 80,
      frontOverlap: 80,
      pathType: 'grid',
      angle: 0,
      autoDirection: false,
      generateEveryPoint: false,
      eliminateExtraYaw: false,
      reversePath: false,
      waypointAction: 'none',
      photoInterval: defaultPreset?.photoInterval || DEFAULT_PHOTO_INTERVAL,
      selectedDrone: defaultDroneId, // Keep legacy ID for initial compatibility
      straightenLegs: false,
      units: 'metric',
      orbitRadius: 50,
      startAngle: 0, // 0-359 degrees, 0 is East, increasing counter-clockwise
      direction: 'counter-clockwise', // 'clockwise' | 'counter-clockwise'
      numberOfOrbits: 1.0, // Positive float, e.g., 0.5, 1.0, 2.3
      missionEndAction: 'goHome', // 'goHome' | 'autoLand'
    };
  })(),

  // Actions
  setWaypoints: (waypoints) => set((state) => ({
    waypoints,
    past: [...state.past, state.waypoints],
    future: []
  })),

  addWaypoint: (waypoint) => set((state) => {
    // Inherit speed and heading from last waypoint if available
    let speed = state.settings.speed;
    let heading = 0;

    if (state.waypoints.length > 0) {
      const lastWp = state.waypoints[state.waypoints.length - 1];
      speed = Math.round((lastWp.speed || state.settings.speed) * 10) / 10;
      heading = lastWp.heading || 0;
    }

    const newWp = {
      id: generateUUID(),
      ...waypoint,
      altitude: state.settings.altitude,
      speed: speed,
      gimbalPitch: state.settings.gimbalPitch,
      heading: heading
    };

    const updatedWaypoints = [...state.waypoints];
    if (updatedWaypoints.length > 0) {
      const lastIndex = updatedWaypoints.length - 1;
      const lastWp = updatedWaypoints[lastIndex];
      // Calculate bearing from last waypoint to new waypoint
      const newHeading = Math.round(bearing(
        [lastWp.lng, lastWp.lat],
        [newWp.lng, newWp.lat]
      ));
      updatedWaypoints[lastIndex] = { ...lastWp, heading: newHeading };
      newWp.heading = newHeading;
    }

    return {
      waypoints: [...updatedWaypoints, newWp],
      past: [...state.past, state.waypoints],
      future: []
    };
  }),

  updateSettings: (newSettings) => set((state) => ({
    settings: { ...state.settings, ...newSettings }
  })),

  // Selection Logic
  selectWaypoint: (id, multi) => set((state) => ({
    selectedIds: multi
      ? (state.selectedIds.includes(id) ? state.selectedIds.filter(i => i !== id) : [...state.selectedIds, id])
      : [id]
  })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [] }),

  // Bulk Edit Logic
  updateSelectedWaypoints: (updates) => {
    const { waypoints, selectedIds, past } = get();
    const newWaypoints = waypoints.map(wp =>
      selectedIds.includes(wp.id) ? { ...wp, ...updates } : wp
    );
    set({
      waypoints: newWaypoints,
      past: [...past, waypoints],
      future: []
    });
  },

  updateWaypoint: (id, updates) => {
    const { waypoints, past } = get();
    const newWaypoints = waypoints.map(wp =>
      wp.id === id ? { ...wp, ...updates } : wp
    );
    set({
      waypoints: newWaypoints,
      past: [...past, waypoints],
      future: []
    });
  },

  deleteSelectedWaypoints: () => {
    const { waypoints, selectedIds, past } = get();
    const newWaypoints = waypoints.filter(wp => !selectedIds.includes(wp.id));
    set({
      waypoints: newWaypoints,
      selectedIds: [],
      past: [...past, waypoints],
      future: []
    });
  },

  moveWaypoints: (ids, deltaLng, deltaLat) => {
    const { waypoints, past } = get();
    const newWaypoints = waypoints.map(wp => {
      if (ids.includes(wp.id)) {
        return {
          ...wp,
          lng: wp.lng + deltaLng,
          lat: wp.lat + deltaLat
        };
      }
      return wp;
    });

    set({
      waypoints: newWaypoints,
      past: [...past, waypoints],
      future: []
    });
  },

  insertWaypoint: (index, waypoint) => set((state) => {
    const newWp = {
      id: generateUUID(),
      ...waypoint
    };
    const newWaypoints = [...state.waypoints];
    newWaypoints.splice(index, 0, newWp);

    return {
      waypoints: newWaypoints,
      past: [...state.past, state.waypoints],
      future: [],
      selectedIds: [newWp.id]
    };
  }),

  // Undo/Redo
  undo: () => {
    const { past, future, waypoints } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);
    set({
      waypoints: previous,
      past: newPast,
      future: [waypoints, ...future]
    });
  },

  redo: () => {
    const { past, future, waypoints } = get();
    if (future.length === 0) return;
    const next = future[0];
    const newFuture = future.slice(1);
    set({
      waypoints: next,
      past: [...past, waypoints],
      future: newFuture
    });
  },

  // Map Reference Actions
  setMapRef: (mapRef) => set({ mapRef }),

  fitMapToWaypoints: () => {
    const { mapRef, waypoints } = get();
    if (!mapRef || !waypoints || waypoints.length === 0) return;

    // Calculate bounds for all waypoints
    let minLng = waypoints[0].lng;
    let maxLng = waypoints[0].lng;
    let minLat = waypoints[0].lat;
    let maxLat = waypoints[0].lat;

    waypoints.forEach(wp => {
      if (wp.lng < minLng) minLng = wp.lng;
      if (wp.lng > maxLng) maxLng = wp.lng;
      if (wp.lat < minLat) minLat = wp.lat;
      if (wp.lat > maxLat) maxLat = wp.lat;
    });

    const bounds = [[minLng, minLat], [maxLng, maxLat]];

    // Fit map to bounds with padding
    mapRef.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 200, right: 350 }, // Shifted right - more left padding, less right padding
      maxZoom: 16,
      duration: 3000 // 3-second smooth animation
    });
  },

  // Mission Filename Actions
  setMissionFilename: (filename) => set({ currentMissionFilename: filename }),
  clearMissionFilename: () => set({ currentMissionFilename: null }),

  // Mission Metrics Calculation
  calculateMissionMetrics: () => {
    const { waypoints, settings } = get();
    const photoInterval = settings.photoInterval;

    const { maxSpeed, minDistance } = calculateMaxSpeed(waypoints, photoInterval);

    set({
      calculatedMaxSpeed: maxSpeed,
      minSegmentDistance: minDistance
    });
  },

  // Computed getters
  getTotalDistance: () => {
    const { waypoints } = get();
    if (waypoints.length < 2) return 0;

    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
    }
    return totalDistance;
  },

  getMissionTime: () => {
    const { calculatedMaxSpeed } = get();
    const totalDistance = get().getTotalDistance();
    return calculateMissionTime(totalDistance, calculatedMaxSpeed);
  },

  getFlightWarningLevel: () => {
    const { settings } = get();
    const missionTime = get().getMissionTime();
    const dronePreset = getDronePreset(settings.selectedDrone);
    const maxFlightTime = dronePreset?.maxFlightTime || null;

    return getFlightWarningLevel(missionTime, maxFlightTime);
  },

  // Reset Logic
  resetTrigger: 0,
  resetMission: () => set((state) => ({
    waypoints: [],
    selectedIds: [],
    past: [],
    future: [],
    currentMissionFilename: null,
    calculatedMaxSpeed: 0,
    minSegmentDistance: 0,
    resetTrigger: state.resetTrigger + 1
  }))
}));