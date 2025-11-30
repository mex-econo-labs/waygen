import * as turf from '@turf/turf';
import { FLIGHT_WARNING_THRESHOLD, TAKEOFF_LANDING_OVERHEAD } from './dronePresets';

/**
 * Calculates the camera footprint on the ground.
 * @param {Object} center - { lng, lat }
 * @param {number} altitude - Altitude in meters
 * @param {number} heading - Drone heading in degrees (0 = North)
 * @param {number} hfov - Horizontal Field of View in degrees
 * @returns {Object} GeoJSON Polygon feature
 */
export const calculateFootprint = (center, altitude, heading, hfov) => {
    if (!center || !altitude || !hfov) return null;

    // 1. Calculate Dimensions
    // Width = 2 * h * tan(HFOV / 2)
    const width = 2 * altitude * Math.tan((hfov * Math.PI) / 360);
    const height = width * (3 / 4); // 4:3 Aspect Ratio

    // 2. Calculate Corners (relative to center, before rotation)
    // We need to find the distance to the corners to use turf.destination
    // Actually, it's easier to calculate the 4 corners as offsets in meters and then map them to coordinates.
    // But turf.destination takes bearing and distance.

    // Let's calculate the half-width and half-height
    const hw = width / 2;
    const hh = height / 2;

    // Distance from center to corner
    const diagDist = Math.sqrt(hw * hw + hh * hh);

    // Bearings to corners (relative to North 0, clockwise)
    // Top-Right (NE): atan(w/h) -> but wait, heading is 0.
    // Let's assume the drone is pointing North (0).
    // Top-Right is at angle atan(hw/hh).
    const angleTR = (Math.atan2(hw, hh) * 180) / Math.PI;
    const angleBR = 180 - angleTR;
    const angleBL = 180 + angleTR;
    const angleTL = 360 - angleTR;

    // 3. Generate the 4 corners using turf.destination
    // We add the drone's heading to the corner angles.
    const centerPt = turf.point([center.lng, center.lat]);

    const p1 = turf.destination(centerPt, diagDist / 1000, heading + angleTR, { units: 'kilometers' });
    const p2 = turf.destination(centerPt, diagDist / 1000, heading + angleBR, { units: 'kilometers' });
    const p3 = turf.destination(centerPt, diagDist / 1000, heading + angleBL, { units: 'kilometers' });
    const p4 = turf.destination(centerPt, diagDist / 1000, heading + angleTL, { units: 'kilometers' });

    // 4. Create Polygon
    const coordinates = [
        [
            p1.geometry.coordinates,
            p2.geometry.coordinates,
            p3.geometry.coordinates,
            p4.geometry.coordinates,
            p1.geometry.coordinates // Close the loop
        ]
    ];

    return turf.polygon(coordinates, {
        altitude,
        heading,
        hfov
    });
};

/**
 * Calculate distance between two waypoints in meters
 * @param {Object} wp1 - First waypoint { lng, lat }
 * @param {Object} wp2 - Second waypoint { lng, lat }
 * @returns {number} Distance in meters
 */
export const calculateDistance = (wp1, wp2) => {
    const from = turf.point([wp1.lng, wp1.lat]);
    const to = turf.point([wp2.lng, wp2.lat]);
    return turf.distance(from, to, { units: 'meters' });
};

/**
 * Calculate maximum safe speed based on waypoint geometry and photo interval
 * Ensures drone doesn't arrive at next waypoint before camera is ready
 * @param {Array} waypoints - Array of waypoint objects with lng, lat
 * @param {number} photoInterval - Minimum seconds between photos
 * @returns {Object} { maxSpeed: number, minDistance: number }
 */
export const calculateMaxSpeed = (waypoints, photoInterval) => {
    if (!waypoints || waypoints.length < 2 || !photoInterval || photoInterval <= 0) {
        return { maxSpeed: 0, minDistance: 0 };
    }

    const distances = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const distance = calculateDistance(waypoints[i], waypoints[i + 1]);
        distances.push(distance);
    }

    const minDistance = Math.min(...distances);
    const maxSpeed = minDistance / photoInterval;

    return {
        maxSpeed: Math.max(0, maxSpeed), // Ensure non-negative
        minDistance
    };
};

/**
 * Calculate estimated mission time including transit and overhead
 * @param {number} totalDistance - Total path distance in meters
 * @param {number} speed - Mission speed in m/s
 * @returns {number} Estimated mission time in seconds
 */
export const calculateMissionTime = (totalDistance, speed) => {
    if (!speed || speed <= 0) return TAKEOFF_LANDING_OVERHEAD;

    const transitTime = totalDistance / speed;
    const missionTime = transitTime + TAKEOFF_LANDING_OVERHEAD;

    return Math.round(missionTime);
};

/**
 * Determine flight warning level based on mission time vs max flight time
 * @param {number} missionTimeSeconds - Estimated mission time in seconds
 * @param {number} maxFlightTimeMinutes - Drone max flight time in minutes
 * @returns {string} 'safe' | 'warning' | 'critical'
 */
export const getFlightWarningLevel = (missionTimeSeconds, maxFlightTimeMinutes) => {
    if (!maxFlightTimeMinutes || maxFlightTimeMinutes <= 0) {
        return 'safe'; // Custom drone or no limit
    }

    const maxFlightTimeSeconds = maxFlightTimeMinutes * 60;
    const warningThreshold = maxFlightTimeSeconds * FLIGHT_WARNING_THRESHOLD;

    if (missionTimeSeconds >= maxFlightTimeSeconds) {
        return 'critical'; // Red - exceeds max flight time
    } else if (missionTimeSeconds >= warningThreshold) {
        return 'warning'; // Yellow - approaching limit (85%)
    }

    return 'safe'; // Green - within limits
};

