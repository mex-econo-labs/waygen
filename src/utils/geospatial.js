import * as turf from '@turf/turf';
import { FLIGHT_WARNING_THRESHOLD, TAKEOFF_LANDING_OVERHEAD } from './dronePresets';


/**
 * Calculates the camera footprint on the ground.
 * @param {Object} center - { lng, lat }
 * @param {number} altitude - Altitude in meters
 * @param {number} heading - Drone heading in degrees (0 = North)
 * @param {number} hfov - Horizontal Field of View in degrees
 * @param {number} gimbalPitch - Gimbal pitch in degrees (0 = Horizon, -90 = Nadir)
 * @returns {Object} GeoJSON Polygon feature
 */
export const calculateFootprint = (center, altitude, heading, hfov, gimbalPitch = -90) => {
    if (!center || !altitude || !hfov) return null;

    // 1. Convert Inputs
    const pitchRad = (gimbalPitch * Math.PI) / 180;
    const aspectRatio = 4 / 3; // Standard Photo Aspect Ratio
    const hfovRad = (hfov * Math.PI) / 180;
    // Calculate VFOV from HFOV and Aspect Ratio
    const vfovRad = 2 * Math.atan(Math.tan(hfovRad / 2) / aspectRatio);

    const halfH = Math.tan(hfovRad / 2);
    const halfV = Math.tan(vfovRad / 2);

    // 2. Define 4 corners in Camera Space (Normalized at Z=1)
    // Camera Frame: X=Right, Y=Up, Z=Forward (Look Dir)
    // Order: TR, BR, BL, TL
    const cornersCam = [
        { x: halfH, y: halfV, z: 1 },   // TR
        { x: halfH, y: -halfV, z: 1 },  // BR
        { x: -halfH, y: -halfV, z: 1 }, // BL
        { x: -halfH, y: halfV, z: 1 }   // TL
    ];

    const centerPt = turf.point([center.lng, center.lat]);
    const coords = [];
    const MAX_RENDER_DIST = altitude * 10; // Clamp for horizon views

    for (const p of cornersCam) {
        // 3. Rotate by Pitch to get Body Frame Vector
        // Drone Body Frame: X=Right, Y=Forward, Z=Up
        // Rotation around X-axis
        const rx = p.x;
        const ry = p.z * Math.cos(pitchRad) - p.y * Math.sin(pitchRad);
        const rz = p.z * Math.sin(pitchRad) + p.y * Math.cos(pitchRad);

        let dist, angle;

        // 4. Intersect with Ground (Z = -altitude)
        // Ray: t * (rx, ry, rz) = (..., ..., -altitude)
        // If rz >= 0, ray points up/flat (Sky/Horizon)
        if (rz >= -0.001) {
            // Horizon Case: Clamp to Max Distance
            const horizontalMag = Math.sqrt(rx * rx + ry * ry);
            const t = MAX_RENDER_DIST / horizontalMag;
            const dx = t * rx;
            const dy = t * ry;
            dist = Math.sqrt(dx * dx + dy * dy);
            angle = Math.atan2(dx, dy) * (180 / Math.PI);
        } else {
            // Ground Intersection
            const t = -altitude / rz;
            const dx = t * rx;
            const dy = t * ry;
            
            // Calculate ground distance and angle
            dist = Math.sqrt(dx * dx + dy * dy);
            
            // Clamp large distances (e.g. near horizon)
            if (dist > MAX_RENDER_DIST) dist = MAX_RENDER_DIST;

            angle = Math.atan2(dx, dy) * (180 / Math.PI);
        }

        // 5. Apply Heading and Geodesic Projection
        const finalBearing = heading + angle;
        const dest = turf.destination(centerPt, dist / 1000, finalBearing, { units: 'kilometers' });
        coords.push(dest.geometry.coordinates);
    }

    // Close the polygon loop
    coords.push(coords[0]);

    return turf.polygon([coords], {
        altitude,
        heading,
        hfov,
        pitch: gimbalPitch
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

