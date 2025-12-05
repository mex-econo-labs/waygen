import React, { useState } from 'react';
import { useMissionStore } from '../../store/useMissionStore';
import { downloadKMZ } from '../../utils/djiExporter';
import { parseImport } from '../../utils/kmlImporter';
import { Trash2, Undo, Redo, Download, Play, Upload, ChevronDown, ChevronUp, Settings, Camera, Map as MapIcon } from 'lucide-react';
import { useMapboxDraw } from '../../contexts/MapboxDrawContext';
import DownloadDialog from '../Dialogs/DownloadDialog';
import FlightWarningDialog from '../Dialogs/FlightWarningDialog';
import { getDronePreset, getDroneIds, DRONE_PRESETS, mapLegacyDroneId, DEFAULT_PHOTO_INTERVAL } from '../../utils/dronePresets';
import { toDisplay, toMetric } from '../../utils/units';
import { DEFAULT_HFOV } from '../../utils/constants';
import EditSelectedPanel from './EditSelectedPanel';
import MissionMetrics, { formatTime } from './MissionMetrics';
import { generateUUID } from '../../utils/uuid';
import { useMissionGeneration } from '../../hooks/useMissionGeneration';

const Section = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-gray-700">
          <Icon size={18} className="text-blue-600" />
          {title}
        </div>
        {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {isOpen && <div className="p-3 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
        {children}
      </div>}
    </div>
  );
};

export default function SidebarMain({ currentPolygon, setCurrentPolygon }) {
  const mapboxDraw = useMapboxDraw();
  const {
    waypoints, selectedIds, settings,
    setWaypoints, updateSelectedWaypoints, deleteSelectedWaypoints, insertWaypoint,
    undo, redo, updateSettings, resetMission, fitMapToWaypoints,
    currentMissionFilename, setMissionFilename,
    calculatedMaxSpeed, minSegmentDistance, calculatedOverlapDistance
  } = useMissionStore();

  // Mission generation hook
  const {
    handleGenerateWithWarning,
    handleAutoGenerate,
    showFlightWarning,
    setShowFlightWarning,
    warningLevel
  } = useMissionGeneration({ currentPolygon, setCurrentPolygon, mapboxDraw });

  // Dialog state for KMZ download
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);

  const handleReset = () => {
    if (confirm("Are you sure you want to reset the mission? This will clear all waypoints and shapes.")) {
      resetMission();
      setCurrentPolygon(null); // Clear the polygon on map
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    try {
      const { geojson, sessionData } = await parseImport(file);
      const newPoints = [];
      geojson.features.forEach(f => {
        if (f.geometry.type === "Point") {
          newPoints.push({
            id: generateUUID(),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
            altitude: f.properties.altitude !== undefined ? f.properties.altitude : settings.altitude,
            speed: f.properties.speed !== undefined ? f.properties.speed : settings.speed,
            gimbalPitch: f.properties.gimbalPitch !== undefined ? f.properties.gimbalPitch : settings.gimbalPitch,
            heading: f.properties.heading !== undefined ? f.properties.heading : 0
          });
        }
      });

      if (newPoints.length > 0) {
        setWaypoints(newPoints);

        // Restore Session Data (Settings + Polygon)
        if (sessionData) {
          if (sessionData.settings) {
            updateSettings(sessionData.settings);
          }
          if (sessionData.polygon && setCurrentPolygon) {
            setCurrentPolygon(sessionData.polygon);
            window.dispatchEvent(new CustomEvent('waygen:restore-polygon', { detail: sessionData.polygon }));
          } else {
            console.warn("No polygon in session data or setCurrentPolygon missing", { polygon: sessionData.polygon, fn: !!setCurrentPolygon });
          }
          alert(`Imported ${newPoints.length} waypoints and restored session!`);
        } else {
          alert(`Imported ${newPoints.length} waypoints!`);
        }

        // Extract and store filename (without extension)
        const filename = file.name.replace(/\.(kmz|kml)$/i, '');
        setMissionFilename(filename);

        // Auto-zoom to fit all waypoints with a small delay
        setTimeout(() => {
          fitMapToWaypoints();
          // Calculate mission metrics for imported waypoints
          const store = useMissionStore.getState();
          store.calculateMissionMetrics();
        }, 100);
      } else {
        alert("No waypoints found in file.");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to parse file. Ensure it is a valid KML/KMZ.");
    }
  };

  const handleFileUpload = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Helper function to generate default filename
  const getDefaultFilename = () => {
    if (currentMissionFilename) {
      return currentMissionFilename;
    }
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+/, '')
      .replace('T', '_')
      .substring(0, 15); // YYYYMMDD_HHMMSS
    return `waygen_${timestamp}`;
  };

  // Download dialog handlers
  const handleDownloadClick = () => {
    setShowDownloadDialog(true);
  };

  const handleDownloadConfirm = ({ filename, missionEndAction, rcLostAction, globalTransitionalSpeed }) => {
    // Update mission end action in settings
    updateSettings({ missionEndAction });

    // Capture Session Data
    const sessionData = {
      settings: settings,
      polygon: currentPolygon
    };

    // Create a merged settings object for export
    const exportSettings = {
      ...settings,
      missionEndAction,
      rcLostAction,
      globalTransitionalSpeed
    };

    // Download with custom filename and session data
    downloadKMZ(waypoints, exportSettings, filename, sessionData);
  };


  // Bulk Edit Mode
  if (selectedIds.length > 0) {
    const selectedWaypoints = waypoints.filter(wp => selectedIds.includes(wp.id));

    return (
      <EditSelectedPanel
        selectedWaypoints={selectedWaypoints}
        selectedIds={selectedIds}
        waypoints={waypoints}
        settings={settings}
        onUpdate={updateSelectedWaypoints}
        onDelete={deleteSelectedWaypoints}
        onInsert={insertWaypoint}
      />
    );
  }

  return (
    <div className="bg-white h-full border-l w-80 flex flex-col shadow-xl z-10 flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <div>
          <h1 className="font-bold text-xl text-gray-800">Waygen</h1>
          {currentMissionFilename && (
            <div
              className="text-sm text-gray-500 truncate max-w-[200px]"
              title={currentMissionFilename}
            >
              {currentMissionFilename}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button onClick={handleReset} className="p-2 hover:bg-red-100 hover:text-red-600 rounded-full shadow-sm border transition-all" title="Reset Mission"><Trash2 size={16} /></button>
          <div className="w-px h-6 bg-gray-300 mx-1 self-center"></div>
          <button onClick={undo} className="p-2 hover:bg-white rounded-full shadow-sm border transition-all"><Undo size={16} /></button>
          <button onClick={redo} className="p-2 hover:bg-white rounded-full shadow-sm border transition-all"><Redo size={16} /></button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">

        {/* Import */}
        <div className="p-3">
          <label
            className={`flex items-center justify-center gap-2 w-full py-3 px-2 rounded-lg border transition-all cursor-pointer font-bold ${isDragging
                ? 'bg-blue-100 border-blue-500 border-dashed scale-[1.02]'
                : 'bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100'
              }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload size={16} className={isDragging ? 'animate-bounce' : ''} />
            {isDragging ? 'Drop File Here' : 'Import KMZ Mission'}
            <input type="file" onChange={handleFileUpload} className="hidden" accept=".kml,.kmz" />
          </label>
          <p className="text-center text-xs text-gray-500 mt-1">Click to upload or drag & drop</p>
        </div>

        <Section title="Basics" icon={Settings} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Units</label>
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="units"
                    value="metric"
                    checked={settings.units === 'metric'}
                    onChange={() => updateSettings({ units: 'metric' })}
                    className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500 transition duration-150 ease-in-out"
                  />
                  <span className="ml-2 text-sm text-gray-700">Metric (m)</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="radio"
                    name="units"
                    value="imperial"
                    checked={settings.units === 'imperial'}
                    onChange={() => updateSettings({ units: 'imperial' })}
                    className="form-radio h-4 w-4 text-blue-600 focus:ring-blue-500 transition duration-150 ease-in-out"
                  />
                  <span className="ml-2 text-sm text-gray-700">Imperial (ft)</span>
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500 mb-1 block">Altitude ({settings.units === 'metric' ? 'm' : 'ft'})</label>
              <input
                type="number"
                value={toDisplay(settings.altitude, settings.units)}
                onChange={e => {
                  updateSettings({ altitude: toMetric(Number(e.target.value), settings.units) });
                  handleAutoGenerate();
                }}
                className="w-full border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="mt-4 border-t pt-3">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Drone Model (FOV)</label>
            <select
              value={mapLegacyDroneId(settings.selectedDrone)}
              onChange={e => {
                const val = e.target.value;
                const preset = DRONE_PRESETS[val];
                let fov;
                let newPhotoInterval;

                if (val === 'custom') {
                  fov = settings.customFOV;
                  newPhotoInterval = settings.photoInterval; // Keep current custom interval
                } else {
                  fov = preset?.hfov || DEFAULT_HFOV;
                  newPhotoInterval = preset?.photoInterval || DEFAULT_PHOTO_INTERVAL;
                }

                updateSettings({
                  selectedDrone: val,
                  customFOV: fov,
                  photoInterval: newPhotoInterval
                });
                // We need to wait for the store update to propagate if we were using the hook's settings,
                // but handleGenerate now pulls fresh state, so we can call it immediately.
                // However, updateSettings is synchronous in Zustand, so state is updated.
                // We just need to ensure handleAutoGenerate is called.
                // Since we are inside the onChange, we can call it directly.
                // But wait, we need to make sure the state is actually updated.
                // Zustand set is synchronous.
                handleAutoGenerate();
              }}
              className="w-full border rounded p-1.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {getDroneIds().map(id => {
                const preset = DRONE_PRESETS[id];
                return (
                  <option key={id} value={id}>
                    {preset.name} {preset.hfov ? `(${preset.hfov}°)` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="mt-2">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Photo Interval (seconds)</label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={settings.photoInterval}
              onChange={e => updateSettings({ photoInterval: Number(e.target.value) })}
              className="w-full border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {settings.selectedDrone === 'custom' && (
            <div className="mt-2">
              <label className="text-xs font-bold text-gray-500 mb-1 block">Custom HFOV (°)</label>
              <input
                type="number"
                value={settings.customFOV}
                onChange={e => updateSettings({ customFOV: Number(e.target.value) })}
                className="w-full border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
        </Section>

        <Section title="Coverage" icon={MapIcon} defaultOpen={true}>
          <div className="mb-3">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Path Type</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => updateSettings({ pathType: 'grid' })}
                className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${settings.pathType === 'grid' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Grid
              </button>
              <button
                onClick={() => updateSettings({ pathType: 'orbit', spacing: 10 })}
                className={`flex-1 py-1 text-xs font-bold rounded-md transition-all ${settings.pathType === 'orbit' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Orbit
              </button>
            </div>
          </div>



          {settings.pathType === 'grid' ? (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Side Overlap {settings.sideOverlap}%</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={settings.sideOverlap}
                  onChange={e => updateSettings({ sideOverlap: Number(e.target.value) })}
                  onMouseUp={handleAutoGenerate}
                  onTouchEnd={handleAutoGenerate}
                  className="w-full accent-blue-600"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Front Overlap {settings.frontOverlap}%</label>
                <input
                  type="range"
                  min="0"
                  max="90"
                  value={settings.frontOverlap}
                  onChange={e => updateSettings({ frontOverlap: Number(e.target.value) })}
                  onMouseUp={handleAutoGenerate}
                  onTouchEnd={handleAutoGenerate}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="flex items-center justify-between mt-2">
                <label className="text-sm text-gray-700">Auto Path Angle</label>
                <input
                  type="checkbox"
                  checked={settings.autoDirection}
                  onChange={e => {
                    updateSettings({ autoDirection: e.target.checked });
                    handleAutoGenerate();
                  }}
                  className="accent-blue-600 w-4 h-4"
                />
              </div>

              <div className={`mt-2 transition-opacity ${settings.autoDirection ? 'opacity-50' : 'opacity-100'}`}>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Path Angle {settings.angle}°</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={settings.angle}
                  onChange={e => updateSettings({ angle: Number(e.target.value) })}
                  disabled={settings.autoDirection}
                  className={`w-full ${settings.autoDirection ? 'accent-gray-400 cursor-not-allowed' : 'accent-blue-600'}`}
                  onMouseUp={handleAutoGenerate}
                  onTouchEnd={handleAutoGenerate}
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Spacing ({settings.units === 'metric' ? 'm' : 'ft'})</label>
                <input
                  type="number"
                  min="1"
                  value={toDisplay(settings.spacing, settings.units)}
                  onChange={e => updateSettings({ spacing: toMetric(Number(e.target.value), settings.units) })}
                  className="w-full border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1">Distance between waypoints along the perimeter.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">Start Angle {settings.startAngle}°</label>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={settings.startAngle}
                  onChange={e => updateSettings({ startAngle: Number(e.target.value) })}
                  className="w-full accent-blue-600"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            <label className="text-sm text-gray-700">Reverse Path</label>
            <input
              type="checkbox"
              checked={settings.pathType === 'orbit' ? settings.direction === 'clockwise' : settings.reversePath}
              onChange={e => {
                if (settings.pathType === 'orbit') {
                  updateSettings({ direction: settings.direction === 'counter-clockwise' ? 'clockwise' : 'counter-clockwise' });
                } else {
                  updateSettings({ reversePath: e.target.checked });
                }
                handleAutoGenerate();
              }}
              className="accent-blue-600 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <label className="text-sm text-gray-700">Straighten Legs</label>
            <input
              type="checkbox"
              checked={settings.straightenLegs}
              onChange={e => updateSettings({ straightenLegs: e.target.checked })}
              className="accent-blue-600 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <label className="text-sm text-gray-700">Generate Every Point</label>
            <input
              type="checkbox"
              checked={settings.generateEveryPoint}
              onChange={e => {
                updateSettings({ generateEveryPoint: e.target.checked });
                handleAutoGenerate();
              }}
              className="accent-blue-600 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <label className="text-sm text-gray-700" title="Locks the drone heading to the first leg's direction for the entire mission. Useful for surveys where orientation doesn't matter.">Eliminate Extra Yaw Maneuvers</label>
            <input
              type="checkbox"
              checked={settings.eliminateExtraYaw}
              onChange={e => {
                updateSettings({ eliminateExtraYaw: e.target.checked });
                handleAutoGenerate();
              }}
              className="accent-blue-600 w-4 h-4"
            />
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-700">Show Image Footprints</label>
              {settings.showFootprints && (
                <input
                  type="color"
                  value={settings.footprintColor}
                  onChange={e => updateSettings({ footprintColor: e.target.value })}
                  className="w-4 h-4 rounded border border-gray-300 cursor-pointer"
                  title="Choose footprint color"
                />
              )}
            </div>
            <input
              type="checkbox"
              checked={settings.showFootprints}
              onChange={e => updateSettings({ showFootprints: e.target.checked })}
              className="accent-blue-600 w-4 h-4"
            />
          </div>

          {settings.showFootprints && (() => {
            // Calculate estimated footprint size
            const hfov = settings.customFOV || DEFAULT_HFOV;
            const altitude = settings.altitude; // Already in metric if stored that way, or mixed. Store seems to keep metric.
            // Store keeps metric.
            const widthMeters = 2 * altitude * Math.tan((hfov * Math.PI) / 360);
            const heightMeters = widthMeters * (3 / 4); // 4:3 Aspect Ratio

            const wDisplay = toDisplay(widthMeters, settings.units).toFixed(1);
            const hDisplay = toDisplay(heightMeters, settings.units).toFixed(1);
            const unitLabel = settings.units === 'metric' ? 'm' : 'ft';

            return (
              <div className="mt-0 text-xs text-gray-500">
                Est. Size: {wDisplay} x {hDisplay} {unitLabel}
              </div>
            );
          })()}
        </Section>

        <Section title="Camera" icon={Camera} defaultOpen={true}>
          <div>
            <label className="text-xs font-bold text-gray-500 mb-1 block">Gimbal Pitch {settings.gimbalPitch}°</label>
            <input type="range" min="-90" max="0" value={settings.gimbalPitch} onChange={e => updateSettings({ gimbalPitch: Number(e.target.value) })} className="w-full accent-blue-600" />
          </div>
          <div className="mt-2">
            <label className="text-xs font-bold text-gray-500 mb-1 block">Action per Waypoint</label>
            <select
              value={settings.waypointAction}
              onChange={e => updateSettings({ waypointAction: e.target.value })}
              className="w-full border rounded p-1.5 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="none">No Action</option>
              <option value="photo">Take Photo</option>
              <option value="record">Start/Stop Recording</option>
            </select>
          </div>

        </Section>





      </div >

      {/* Footer */}
      < div className="p-4 border-t bg-gray-50" >
        <button onClick={handleGenerateWithWarning} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold p-3 rounded-lg shadow-md mb-3 flex items-center justify-center gap-2 transition-all transform active:scale-95">
          <Play size={18} /> Generate Path
        </button>

        <MissionMetrics
          waypoints={waypoints}
          settings={settings}
          warningLevel={warningLevel}
          calculatedMaxSpeed={calculatedMaxSpeed}
          calculatedOverlapDistance={calculatedOverlapDistance}
        />

        <button onClick={handleDownloadClick} disabled={waypoints.length === 0} className="w-full mt-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold p-3 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all">
          <Download size={18} /> Download KMZ Mission
        </button>
      </div >

      {/* Download Dialog */}
      < DownloadDialog
        isOpen={showDownloadDialog}
        onClose={() => setShowDownloadDialog(false)
        }
        onDownload={handleDownloadConfirm}
        defaultFilename={getDefaultFilename()}
        defaultMissionEndAction={settings.missionEndAction}
        units={settings.units}
      />

      {/* Flight Warning Dialog */}
      <FlightWarningDialog
        isOpen={showFlightWarning}
        onClose={() => setShowFlightWarning(false)}
        warningLevel={warningLevel}
        missionTime={waypoints.length >= 2 ? formatTime(useMissionStore.getState().getMissionTime()) : '0:00'}
        droneName={getDronePreset(settings.selectedDrone)?.name || 'Unknown Drone'}
        maxFlightTime={getDronePreset(settings.selectedDrone)?.maxFlightTime || 0}
      />
    </div >
  );
}
