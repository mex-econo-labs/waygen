import { useState, useEffect, useCallback } from 'react';
import { useMissionStore } from '../store/useMissionStore';
import { generatePhotogrammetryPath } from '../logic/pathGenerator';
import { getDronePreset } from '../utils/dronePresets';
import { calculateMaxSpeed } from '../utils/geospatial';

/**
 * Custom hook for mission path generation logic.
 * Extracts generation-related functionality from SidebarMain.
 *
 * @param {Object} params
 * @param {Object|null} params.currentPolygon - Current polygon feature
 * @param {Function} params.setCurrentPolygon - Setter for polygon state
 * @param {Object|null} params.mapboxDraw - Mapbox Draw instance
 * @returns {Object} Generation functions and state
 */
export function useMissionGeneration({ currentPolygon, setCurrentPolygon, mapboxDraw }) {
  const { waypoints, settings, setWaypoints } = useMissionStore();

  // Warning dialog state
  const [showFlightWarning, setShowFlightWarning] = useState(false);
  const [pendingWarningCheck, setPendingWarningCheck] = useState(false);

  // Get warning level from store
  const getWarningLevel = useCallback(() => {
    const { calculatedMaxSpeed, getFlightWarningLevel } = useMissionStore.getState();
    if (waypoints.length >= 2 && calculatedMaxSpeed > 0) {
      return getFlightWarningLevel();
    }
    return 'safe';
  }, [waypoints.length]);

  const warningLevel = getWarningLevel();

  // Show warning dialog when pending check triggers
  useEffect(() => {
    if (pendingWarningCheck && warningLevel !== 'safe') {
      setShowFlightWarning(true);
      setPendingWarningCheck(false);
    } else if (pendingWarningCheck && warningLevel === 'safe') {
      setPendingWarningCheck(false);
    }
  }, [pendingWarningCheck, warningLevel]);

  /**
   * Core path generation logic.
   * Gets latest polygon from Draw, calculates optimal speed, generates path.
   */
  const handleGenerate = useCallback(() => {
    // Force exit edit mode to confirm changes and update UI
    if (mapboxDraw) {
      mapboxDraw.changeMode('simple_select');
    }

    // Get the latest polygon data directly from Draw
    let polygonToUse = currentPolygon;
    if (mapboxDraw) {
      const selected = mapboxDraw.getSelected();
      if (selected.features.length > 0) {
        polygonToUse = selected.features[0];
        if (setCurrentPolygon) {
          setCurrentPolygon(polygonToUse);
        }
      } else if (currentPolygon && currentPolygon.id) {
        const feature = mapboxDraw.get(currentPolygon.id);
        if (feature) {
          polygonToUse = feature;
          if (setCurrentPolygon) {
            setCurrentPolygon(polygonToUse);
          }
        }
      }
    }

    if (!polygonToUse) {
      alert("Draw a shape first!");
      return;
    }

    // Get fresh settings from store
    const currentSettings = useMissionStore.getState().settings;

    // Resolve effective settings for generation
    const dronePreset = getDronePreset(currentSettings.selectedDrone);
    const effectiveFOV = dronePreset?.hfov ?? currentSettings.customFOV;
    const generationSettings = {
      ...currentSettings,
      customFOV: effectiveFOV
    };

    // Step 1: Generate initial path to get waypoint geometry
    const initialPath = generatePhotogrammetryPath(polygonToUse, generationSettings);

    // Step 2: Calculate max safe speed based on photo interval
    const photoInterval = currentSettings.photoInterval;
    const { maxSpeed } = calculateMaxSpeed(
      initialPath,
      photoInterval,
      currentSettings.altitude,
      effectiveFOV,
      currentSettings.gimbalPitch,
      currentSettings.frontOverlap
    );

    // Step 3: Regenerate path with calculated speed
    const finalSettings = {
      ...generationSettings,
      speed: maxSpeed > 0 ? maxSpeed : currentSettings.speed
    };
    const finalPath = generatePhotogrammetryPath(polygonToUse, finalSettings);

    // Step 4: Set waypoints and update metrics
    setWaypoints(finalPath);

    // Update metrics in store
    setTimeout(() => {
      useMissionStore.getState().calculateMissionMetrics();
    }, 50);
  }, [currentPolygon, setCurrentPolygon, mapboxDraw, setWaypoints]);

  /**
   * Generate path with warning check (for explicit Generate button)
   */
  const handleGenerateWithWarning = useCallback(() => {
    handleGenerate();
    // Schedule warning check after metrics are calculated
    setTimeout(() => {
      setPendingWarningCheck(true);
    }, 100);
  }, [handleGenerate]);

  /**
   * Auto-generate path when settings change (only if path already exists)
   */
  const handleAutoGenerate = useCallback(() => {
    const currentWaypoints = useMissionStore.getState().waypoints;
    if (currentWaypoints.length > 0 && currentPolygon) {
      handleGenerate();
    }
  }, [currentPolygon, handleGenerate]);

  return {
    // Functions
    handleGenerate,
    handleGenerateWithWarning,
    handleAutoGenerate,
    // Warning dialog state
    showFlightWarning,
    setShowFlightWarning,
    warningLevel
  };
}
