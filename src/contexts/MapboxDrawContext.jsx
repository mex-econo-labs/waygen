import { createContext, useContext } from 'react';

/**
 * Context for sharing the Mapbox Draw instance between components.
 * Replaces the window.mapboxDraw global pattern.
 */
export const MapboxDrawContext = createContext(null);

/**
 * Hook to access the Mapbox Draw instance.
 * @returns {Object|null} The Mapbox Draw instance or null if not available
 */
export function useMapboxDraw() {
  return useContext(MapboxDrawContext);
}
