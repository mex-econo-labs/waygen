/**
 * Drone Presets Database
 * 
 * Centralized configuration for DJI drone models supporting waypoint missions.
 * Contains HFOV, photo interval constraints, and max flight times.
 */

// Configurable warning threshold for flight duration (85% of max flight time)
export const FLIGHT_WARNING_THRESHOLD = 0.85;

// Default photo interval for conservative estimation (seconds)
export const DEFAULT_PHOTO_INTERVAL = 5.5;

// Takeoff and landing overhead time (seconds)
export const TAKEOFF_LANDING_OVERHEAD = 0; // 2 minutes

/**
 * Drone preset configurations
 * 
 * @property {string} name - Display name
 * @property {number} hfov - Horizontal Field of View in degrees
 * @property {number} photoInterval - Minimum seconds between photos at max resolution
 * @property {number} maxFlightTime - Maximum practical flight time in minutes (~90% battery)
 */
export const DRONE_PRESETS = {
    'mini-4-pro': {
        name: 'DJI Mini 4 Pro',
        hfov: 82.1,
        photoInterval: 5.5,
        maxFlightTime: 31
    },
    'mini-5-pro': {
        name: 'DJI Mini 5 Pro',
        hfov: 84,
        photoInterval: 5.5,
        maxFlightTime: 40,
        isDefault: true
    },
    'mavic-4-pro': {
        name: 'DJI Mavic 4 Pro',
        hfov: 72,
        photoInterval: 5.5, // Placeholder - pending research
        maxFlightTime: 40
    },
    'custom': {
        name: 'Custom',
        hfov: null, // User must provide
        photoInterval: 5.5, // Default conservative value
        maxFlightTime: null // No flight warnings
    }
};

/**
 * Get the ID of the default drone preset
 * @returns {string} Default drone ID
 */
export const getDefaultDroneId = () => {
    return Object.keys(DRONE_PRESETS).find(id => DRONE_PRESETS[id].isDefault) || Object.keys(DRONE_PRESETS)[0];
};

/**
 * Get drone preset by ID
 * @param {string} droneId - Drone preset identifier
 * @returns {Object|null} Drone preset object or null if not found
 */
export const getDronePreset = (droneId) => {
    const mappedId = mapLegacyDroneId(droneId);
    return DRONE_PRESETS[mappedId] || null;
};

/**
 * Get all drone preset IDs
 * @returns {Array<string>} Array of drone preset IDs
 */
export const getDroneIds = () => {
    return Object.keys(DRONE_PRESETS);
};

/**
 * Map legacy drone ID to new preset ID
 * Maintains backwards compatibility with existing settings
 * @param {string} legacyId - Old drone identifier (e.g., 'dji_mini_4_pro')
 * @returns {string} New preset identifier (e.g., 'mini-4-pro')
 */
export const mapLegacyDroneId = (legacyId) => {
    const mapping = {
        'dji_mini_4_pro': 'mini-4-pro',
        'dji_mini_5_pro': 'mini-5-pro',
        'dji_mavic_4_pro': 'mavic-4-pro',
        'custom': 'custom'
    };
    return mapping[legacyId] || legacyId;
};
