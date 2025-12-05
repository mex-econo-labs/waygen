import React from 'react';
import { useMissionStore } from '../../store/useMissionStore';
import { calculateDistance } from '../../utils/geospatial';
import { toDisplay, METERS_TO_FEET } from '../../utils/units';

/**
 * Calculate total mission distance from waypoints
 */
const calculateMissionDistance = (waypoints) => {
  if (waypoints.length < 2) return 0;

  let totalDistance = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    totalDistance += calculateDistance(waypoints[i], waypoints[i + 1]);
  }

  return totalDistance;
};

/**
 * Format seconds as MM:SS
 */
const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format distance with appropriate unit
 */
const formatDistance = (meters, units) => {
  if (units === 'metric') {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  } else {
    const feet = meters * METERS_TO_FEET;
    if (feet >= 5280) {
      return `${(feet / 5280).toFixed(2)} mi`;
    }
    return `${Math.round(feet)} ft`;
  }
};

/**
 * MissionMetrics - Compact 2x2 grid displaying mission statistics
 *
 * @param {Object} props
 * @param {Array} props.waypoints - Array of waypoint objects
 * @param {Object} props.settings - Mission settings (units, etc.)
 * @param {string} props.warningLevel - 'safe' | 'warning' | 'critical'
 * @param {number} props.calculatedMaxSpeed - Maximum safe speed in m/s
 * @param {number} props.calculatedOverlapDistance - Forward overlap distance in meters
 */
export default function MissionMetrics({
  waypoints,
  settings,
  warningLevel,
  calculatedMaxSpeed,
  calculatedOverlapDistance
}) {
  return (
    <div className={`bg-white border rounded-lg overflow-hidden ${
      warningLevel === 'critical' ? 'border-red-400' :
      warningLevel === 'warning' ? 'border-yellow-400' : 'border-gray-200'
    }`}>
      <div className="grid grid-cols-2 divide-x divide-gray-200">
        {/* Top Row */}
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Waypoints</div>
          <div className="text-sm font-semibold text-gray-800">{waypoints.length}</div>
        </div>
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Distance</div>
          <div className="text-sm font-semibold text-gray-800">
            {waypoints.length >= 2
              ? formatDistance(calculateMissionDistance(waypoints), settings.units)
              : settings.units === 'metric' ? '0 m' : '0 ft'
            }
          </div>
        </div>
        {/* Bottom Row */}
        <div className="px-3 py-2">
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Max Speed</div>
          <div className="text-sm font-semibold text-gray-800" title={`Based on ${Math.round(calculatedOverlapDistance)}m forward travel`}>
            {waypoints.length >= 2 && calculatedMaxSpeed > 0
              ? `${toDisplay(calculatedMaxSpeed, settings.units).toFixed(1)} ${settings.units === 'metric' ? 'm/s' : 'ft/s'}`
              : settings.units === 'metric' ? '0 m/s' : '0 ft/s'
            }
          </div>
        </div>
        <div className={`px-3 py-2 ${
          warningLevel === 'critical' ? 'bg-red-50' :
          warningLevel === 'warning' ? 'bg-yellow-50' : ''
        }`}>
          <div className="text-[10px] text-gray-400 uppercase tracking-wide">Est. Mission Time</div>
          <div className={`text-sm font-semibold ${
            warningLevel === 'critical' ? 'text-red-600' :
            warningLevel === 'warning' ? 'text-yellow-600' : 'text-gray-800'
          }`}>
            {waypoints.length >= 2 && calculatedMaxSpeed > 0
              ? (() => {
                const missionTime = useMissionStore.getState().getMissionTime();
                const timeStr = formatTime(missionTime);
                const icon = warningLevel === 'critical' ? ' ●' : warningLevel === 'warning' ? ' !' : '';
                return <span title={`${missionTime}s total`}>{timeStr}{icon}</span>;
              })()
              : '0:00'
            }
          </div>
        </div>
      </div>
    </div>
  );
}

// Export helper for reuse in SidebarMain (for download filename)
export { calculateMissionDistance, formatTime, formatDistance };
