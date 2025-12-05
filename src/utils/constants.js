/**
 * Waygen Constants
 * Centralized constants to avoid magic numbers throughout the codebase.
 */

// Camera & Sensor
export const DEFAULT_HFOV = 82.1; // Default horizontal field of view (degrees)
export const ASPECT_RATIO_4_3 = 4 / 3; // Standard camera aspect ratio

// Geospatial
export const METERS_PER_DEGREE_LAT = 111111; // Approximate meters per degree latitude
export const COORD_EPSILON = 0.0001; // Tolerance for coordinate comparison

// DJI Export
export const DJI_DRONE_ENUM = 68; // DJI drone enum value for KMZ export
export const DJI_DRONE_SUB_ENUM = 0; // DJI drone sub-enum value
