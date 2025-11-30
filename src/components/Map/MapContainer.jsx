import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Map as MapIcon, Satellite, Crosshair } from 'lucide-react';
import * as turf from '@turf/turf';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import { CircleMode, DragCircleMode, DirectMode, SimpleSelectMode } from 'mapbox-gl-draw-circle';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import { useMissionStore } from '../../store/useMissionStore';
import DragRectangleMode from '../../logic/DragRectangleMode';
import DirectSelectRectangleMode from '../../logic/DirectSelectRectangleMode';
import { calculateFootprint } from '../../utils/geospatial';
import DrawToolbar from './DrawToolbar';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Custom Teardrop Icon (Blue - Solid)
const TEARDROP_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 0 L35 20 A 15 15 0 0 1 5 20 Z" fill="#3b82f6" stroke="white" stroke-width="2"/>
</svg>
`);

// Custom Teardrop Icon (Red - Solid for Selected)
const TEARDROP_SELECTED_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
  <path d="M20 0 L35 20 A 15 15 0 0 1 5 20 Z" fill="#ef4444" stroke="white" stroke-width="2"/>
</svg>
`);

// Direction Arrow Icon (White with Blue outline)
const ARROW_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
  <path d="M12 2 L22 22 L12 17 L2 22 Z" fill="#ffffff" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>
</svg>
`);

const simpleStyles = [
  {
    "id": "gl-draw-line",
    "type": "line",
    "filter": ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#3b82f6", "line-width": 2 }
  },
  {
    "id": "gl-draw-polygon-fill",
    "type": "fill",
    "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    "paint": { "fill-color": "#3b82f6", "fill-outline-color": "#3b82f6", "fill-opacity": 0.2 }
  },
  {
    "id": "gl-draw-polygon-stroke-active",
    "type": "line",
    "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#3b82f6", "line-width": 2 }
  },
  {
    "id": "gl-draw-point-point-stroke-active",
    "type": "circle",
    "filter": ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
    "paint": { "circle-radius": 6, "circle-color": "#fff" }
  },
  {
    "id": "gl-draw-point",
    "type": "circle",
    "filter": ["all", ["==", "$type", "Point"], ["!=", "mode", "static"]],
    "paint": { "circle-radius": 4, "circle-color": "#3b82f6" }
  },
  {
    "id": "gl-draw-polygon-fill-static",
    "type": "fill",
    "filter": ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
    "paint": { "fill-color": "#000", "fill-outline-color": "#000", "fill-opacity": 0.1 }
  },
  {
    "id": "gl-draw-polygon-stroke-static",
    "type": "line",
    "filter": ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#000", "line-width": 2 }
  },
  {
    "id": "gl-draw-polygon-midpoint",
    "type": "circle",
    "filter": ["all", ["==", "$type", "Point"], ["==", "meta", "resize-handle"]],
    "paint": { "circle-radius": 4, "circle-color": "#fbb03b" }
  }
];

export default function MapContainer({ onPolygonDrawn, polygon }) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const draw = useRef(null);
  const { waypoints, selectedIds, selectWaypoint, setSelectedIds, resetTrigger, settings, updateWaypoint, addWaypoint, setMapRef } = useMissionStore();

  // Drag State
  const draggedPoint = useRef(null); // { id, isMulti, initialWaypoints, startLngLat }

  const [currentMode, setCurrentMode] = useState('simple_select');
  const [mapStyle, setMapStyle] = useState('satellite');
  const currentModeRef = useRef(currentMode);

  useEffect(() => {
    currentModeRef.current = currentMode;
  }, [currentMode]);

  // Handle Reset
  useEffect(() => {
    if (resetTrigger > 0 && draw.current) {
      draw.current.deleteAll();
      onPolygonDrawn(null);
    }
  }, [resetTrigger, onPolygonDrawn]);

  const [selectionBox, setSelectionBox] = useState(null);
  const [canDelete, setCanDelete] = useState(false);
  const startPointRef = useRef(null);

  // Handle Radius Change from Store (Two-way binding)
  useEffect(() => {
    if (!draw.current || !map.current) return;

    const selectedIds = draw.current.getSelectedIds();
    if (selectedIds.length === 0) return;

    const feature = draw.current.get(selectedIds[0]);
    if (!feature || feature.geometry.type !== 'Polygon') return;

    // Check if it's a "circle" (heuristic or property)
    // For now, we'll assume if we are in Orbit mode, we treat it as a circle
    // or if it was created with our circle tool.

    // Calculate current radius to avoid infinite loops
    const center = turf.centroid(feature);
    const currentRadius = turf.distance(
      center,
      turf.point(feature.geometry.coordinates[0][0]),
      { units: 'meters' }
    );

    if (Math.abs(currentRadius - settings.orbitRadius) > 1) {
      // Update the circle geometry
      const newCircle = turf.circle(
        center.geometry.coordinates,
        settings.orbitRadius,
        { steps: 64, units: 'meters' }
      );

      // Preserve ID and properties
      newCircle.id = feature.id;
      newCircle.properties = { ...feature.properties, isCircle: true };

      draw.current.add(newCircle);
      onPolygonDrawn(newCircle);
    }
  }, [settings.orbitRadius]);

  // Update store when circle is drawn/edited
  const updateRadiusFromFeature = (feature) => {
    if (!feature || feature.geometry.type !== 'Polygon') return;

    const center = turf.centroid(feature);
    const radius = turf.distance(
      center,
      turf.point(feature.geometry.coordinates[0][0]),
      { units: 'meters' }
    );

    // Only update if significantly different to avoid loops
    if (Math.abs(radius - settings.orbitRadius) > 1) {
      useMissionStore.getState().updateSettings({ orbitRadius: Math.round(radius) });
    }
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [-98, 39],
      zoom: 4,
      boxZoom: false
    });

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      collapsed: true
    });
    map.current.addControl(geocoder, 'top-right');

    // Set map reference in store for auto-zoom functionality
    setMapRef(map.current);

    draw.current = new MapboxDraw({
      userProperties: true,
      displayControlsDefault: false,
      controls: {
        point: false,
        line: false,
        polygon: false,
        trash: false,
        combine_features: false,
        uncombine_features: false
      },
      styles: simpleStyles,
      modes: {
        ...MapboxDraw.modes,
        drag_circle: DragCircleMode,
        draw_rectangle: DragRectangleMode,
        direct_select: DirectSelectRectangleMode,
        simple_select: SimpleSelectMode
      }
    });
    map.current.addControl(draw.current);
    window.mapboxDraw = draw.current;

    map.current.on('draw.create', (e) => {
      const feature = e.features[0];

      // 1. Enforce "Circle" property if created via drag_circle
      if (draw.current.getMode() === 'drag_circle') {
        draw.current.setFeatureProperty(feature.id, 'isCircle', true);
        feature.properties.isCircle = true;

        // Auto-switch to Orbit mode
        useMissionStore.getState().updateSettings({ pathType: 'orbit', spacing: 10 });
      }

      // 2. Handle Rectangle Creation
      // Check if it comes from DragRectangleMode (which sets isRectangle: true)
      // or if we are currently in the mode (handling race conditions)
      if (feature.properties.isRectangle || draw.current.getMode() === 'draw_rectangle') {
        draw.current.setFeatureProperty(feature.id, 'isRectangle', true);
        feature.properties.isRectangle = true;
      }

      // 3. Check for "Accidental Large Circle" (Click vs Drag)
      // If the user just clicks, it might create a huge default circle. We resize it to 50m.
      const center = turf.centroid(feature);
      const currentRadius = turf.distance(
        center,
        turf.point(feature.geometry.coordinates[0][0]),
        { units: 'meters' }
      );

      if (currentRadius > 500) {
        // Resize to 50m
        const newCircle = turf.circle(
          center.geometry.coordinates,
          50,
          { steps: 64, units: 'meters' }
        );
        newCircle.id = feature.id;
        newCircle.properties = { ...feature.properties, isCircle: true };

        draw.current.add(newCircle);
        // Update store with 50m
        useMissionStore.getState().updateSettings({ orbitRadius: 50 });
        onPolygonDrawn(newCircle);
      } else {
        updateRadiusFromFeature(feature);
        onPolygonDrawn(feature);
      }

      // 3. Auto-Deselect Tool (Switch to Simple Select)
      // This prevents drawing another circle immediately and shows resize handles
      setCurrentMode('simple_select');
    });

    map.current.on('draw.update', (e) => {
      const feature = e.features[0];
      updateRadiusFromFeature(feature);
      onPolygonDrawn(feature);
    });

    map.current.on('draw.selectionchange', (e) => {
      if (e.features.length > 0) {
        updateRadiusFromFeature(e.features[0]);
        onPolygonDrawn(e.features[0]);
        setCanDelete(true);
      } else {
        // onPolygonDrawn(null); // Do not clear polygon on deselect
        setCanDelete(false);
      }
    });

    map.current.on('draw.delete', () => onPolygonDrawn(null));

    map.current.on('click', (e) => {
      if (e.originalEvent._isDrag) return;

      // Handle Add Waypoint Mode
      if (currentModeRef.current === 'add_waypoint') {
        const { lng, lat } = e.lngLat;
        addWaypoint({ lng, lat });
        return;
      }

      const features = map.current.queryRenderedFeatures(e.point, { layers: ['waypoints-symbol'] });

      if (features.length) {
        const id = features[0].properties.id;
        selectWaypoint(id, e.originalEvent.shiftKey);
      } else {
        const drawFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: ['gl-draw-polygon-fill-static.cold', 'gl-draw-polygon-fill.hot']
        });
        if (drawFeatures.length === 0) setSelectedIds([]);
      }
    });

    const onMouseMove = (e) => {
      if (!startPointRef.current) return;
      const start = startPointRef.current;
      const current = e.point;
      const minX = Math.min(start.x, current.x);
      const maxX = Math.max(start.x, current.x);
      const minY = Math.min(start.y, current.y);
      const maxY = Math.max(start.y, current.y);
      setSelectionBox({ left: minX, top: minY, width: maxX - minX, height: maxY - minY });
    };

    const onMouseUp = (e) => {
      if (!startPointRef.current) return;
      const start = startPointRef.current;
      const end = e.point;

      if (Math.abs(start.x - end.x) < 5 && Math.abs(start.y - end.y) < 5) {
        startPointRef.current = null;
        setSelectionBox(null);
        map.current.dragPan.enable();
        map.current.off('mousemove', onMouseMove);
        map.current.off('mouseup', onMouseUp);
        return;
      }

      const bbox = [start, end];
      const features = map.current.queryRenderedFeatures(bbox, { layers: ['waypoints-symbol'] });
      const ids = features.map(f => f.properties.id);
      if (ids.length > 0) setSelectedIds(ids);

      startPointRef.current = null;
      setSelectionBox(null);
      map.current.dragPan.enable();
      e.originalEvent._isDrag = true;
      setTimeout(() => { if (e.originalEvent) delete e.originalEvent._isDrag }, 100);
      map.current.off('mousemove', onMouseMove);
      map.current.off('mouseup', onMouseUp);
    };

    map.current.on('mousedown', (e) => {
      if (e.originalEvent.shiftKey) {
        e.preventDefault();
        map.current.dragPan.disable();
        startPointRef.current = e.point;
        map.current.on('mousemove', onMouseMove);
        map.current.on('mouseup', onMouseUp);
      }
    });

    // --- Waypoint Drag & Drop Logic ---

    const onPointMouseEnter = () => {
      if (!draggedPoint.current) {
        map.current.getCanvas().style.cursor = 'pointer';
      }
    };

    const onPointMouseLeave = () => {
      if (!draggedPoint.current) {
        map.current.getCanvas().style.cursor = '';
      }
    };

    const onPointMouseDown = (e) => {
      // Prevent drag if we are in a drawing mode or holding shift (selection)
      if (draw.current.getMode() !== 'simple_select' && draw.current.getMode() !== 'direct_select') return;
      if (e.originalEvent.shiftKey) return;

      // REQUIRE ALT KEY FOR DRAGGING
      if (!e.originalEvent.altKey) return;

      e.preventDefault();

      const feature = e.features[0];
      if (!feature) return;

      map.current.dragPan.disable();
      map.current.getCanvas().style.cursor = 'grabbing';

      const clickedId = feature.properties.id;
      const currentWaypoints = useMissionStore.getState().waypoints;
      const currentSelectedIds = useMissionStore.getState().selectedIds;

      // Determine if we are doing a multi-drag
      // We do multi-drag if the clicked point is ALREADY selected.
      // If it's not selected, we treat it as a single drag (even if others are selected, we assume the user wants to move just this one, or we could auto-select it, but let's stick to "move selection" logic).
      // Actually, standard behavior is: if I click an unselected item, it becomes the only selection. But here we are just dragging.
      // Let's say: If clicked ID is in selectedIds, move all selected. Else, move just this one.

      const isMulti = currentSelectedIds.includes(clickedId);
      const idsToMove = isMulti ? currentSelectedIds : [clickedId];

      // Store initial state for all moving points
      const initialWaypoints = currentWaypoints
        .filter(wp => idsToMove.includes(wp.id))
        .map(wp => ({ id: wp.id, lng: wp.lng, lat: wp.lat }));

      draggedPoint.current = {
        ids: idsToMove,
        isMulti,
        initialWaypoints,
        startLngLat: e.lngLat // { lng, lat }
      };

      map.current.on('mousemove', onPointDragMove);
      map.current.on('mouseup', onPointDragUp);
    };

    const onPointDragMove = (e) => {
      if (!draggedPoint.current) return;

      const { lng, lat } = e.lngLat;
      const { startLngLat, initialWaypoints } = draggedPoint.current;

      const deltaLng = lng - startLngLat.lng;
      const deltaLat = lat - startLngLat.lat;

      // Update the specific feature in the source directly for performance
      const wpSource = map.current.getSource('waypoints');
      const pathSource = map.current.getSource('mission-path');

      // We need to construct a new FeatureCollection based on current store state + the moving points
      const currentWaypoints = useMissionStore.getState().waypoints;
      const currentSelectedIds = useMissionStore.getState().selectedIds;

      const newFeatures = currentWaypoints.map((wp, index) => {
        // Check if this waypoint is one of the ones being dragged
        const movingWp = initialWaypoints.find(iw => iw.id === wp.id);

        let coords = [wp.lng, wp.lat];
        if (movingWp) {
          coords = [movingWp.lng + deltaLng, movingWp.lat + deltaLat];
        }

        return {
          type: 'Feature',
          properties: {
            id: wp.id,
            index: index + 1,
            selected: currentSelectedIds.includes(wp.id),
            heading: wp.heading || 0
          },
          geometry: {
            type: 'Point',
            coordinates: coords
          }
        };
      });

      if (wpSource) {
        wpSource.setData({ type: 'FeatureCollection', features: newFeatures });
      }

      // Also update the path line
      if (pathSource) {
        const lineCoords = newFeatures.map(f => f.geometry.coordinates);
        pathSource.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords }
        });
      }
    };

    const onPointDragUp = (e) => {
      if (!draggedPoint.current) return;

      const { lng, lat } = e.lngLat;
      const { startLngLat, ids } = draggedPoint.current;

      const deltaLng = lng - startLngLat.lng;
      const deltaLat = lat - startLngLat.lat;

      // Commit to store
      // We use a batch update action
      useMissionStore.getState().moveWaypoints(ids, deltaLng, deltaLat);

      // Cleanup
      draggedPoint.current = null;
      map.current.dragPan.enable();
      map.current.getCanvas().style.cursor = '';

      // Prevent click event from triggering selection
      e.originalEvent._isDrag = true;

      map.current.off('mousemove', onPointDragMove);
      map.current.off('mouseup', onPointDragUp);
    };

    // Attach listeners to the symbol layer
    map.current.on('mouseenter', 'waypoints-symbol', onPointMouseEnter);
    map.current.on('mouseleave', 'waypoints-symbol', onPointMouseLeave);
    map.current.on('mousedown', 'waypoints-symbol', onPointMouseDown);

    // Removed legacy restore-polygon listener in favor of prop-based sync

    const initializeLayers = () => {
      console.log("Initializing Map Layers...");

      // Load Images
      const loadIcon = (name, url) => {
        if (map.current.hasImage(name)) return;
        const img = new Image();
        img.src = url;
        img.onload = () => {
          if (!map.current.hasImage(name)) map.current.addImage(name, img);
        };
      };
      loadIcon('teardrop', TEARDROP_IMAGE);
      loadIcon('teardrop-selected', TEARDROP_SELECTED_IMAGE);
      loadIcon('arrow', ARROW_IMAGE);

      // Add Sources
      if (!map.current.getSource('mission-path')) {
        map.current.addSource('mission-path', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'LineString', coordinates: [] } }
        });
      }

      if (!map.current.getSource('path-arrows')) {
        map.current.addSource('path-arrows', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.current.getSource('footprints')) {
        map.current.addSource('footprints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      if (!map.current.getSource('waypoints')) {
        map.current.addSource('waypoints', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] }
        });
      }

      // Add Layers (Order matters: Bottom to Top)

      // 1. Footprints (Fill)
      if (!map.current.getLayer('footprints-fill')) {
        map.current.addLayer({
          id: 'footprints-fill',
          type: 'fill',
          source: 'footprints',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.15,
            'fill-outline-color': 'rgba(0,0,0,0)'
          }
        });
      }

      // 2. Footprints (Outline)
      if (!map.current.getLayer('footprints-outline')) {
        map.current.addLayer({
          id: 'footprints-outline',
          type: 'line',
          source: 'footprints',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 1,
            'line-opacity': 0.6
          }
        });
      }

      // 3. Mission Path
      if (!map.current.getLayer('mission-path-line')) {
        map.current.addLayer({
          id: 'mission-path-line',
          type: 'line',
          source: 'mission-path',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });
      }

      // 3.5 Path Arrows (Direction Indicators)
      if (!map.current.getLayer('path-arrows-symbol')) {
        map.current.addLayer({
          id: 'path-arrows-symbol',
          type: 'symbol',
          source: 'path-arrows',
          layout: {
            'icon-image': 'arrow',
            'icon-size': 0.6,
            'icon-allow-overlap': true,
            'icon-rotate': ['get', 'rotation'],
            'icon-rotation-alignment': 'map',
            'icon-ignore-placement': true
          }
        });
      }

      // 4. Waypoints (Symbol) - Should be on top
      if (!map.current.getLayer('waypoints-symbol')) {
        map.current.addLayer({
          id: 'waypoints-symbol',
          type: 'symbol',
          source: 'waypoints',
          layout: {
            'icon-image': ['case', ['get', 'selected'], 'teardrop-selected', 'teardrop'],
            'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.5, 15, 0.75, 20, 1],
            'icon-anchor': 'center',
            'icon-allow-overlap': true,
            'icon-rotate': ['get', 'heading'],
            'icon-rotation-alignment': 'map',
            'text-field': ['to-string', ['get', 'index']],
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 11, 20, 13],
            'text-offset': [0, 0],
            'text-anchor': 'center',
            'text-allow-overlap': true,
            'text-rotation-alignment': 'viewport'
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#000000',
            'text-halo-width': 0.5
          }
        });
      }

      // Force Initial Data Update
      const currentWaypoints = useMissionStore.getState().waypoints;
      const currentSelectedIds = useMissionStore.getState().selectedIds;

      if (currentWaypoints.length > 0) {
        console.log("Initial waypoints found, updating source...", currentWaypoints.length);
        const features = currentWaypoints.map((wp, index) => ({
          type: 'Feature',
          properties: {
            id: wp.id,
            index: index + 1,
            selected: currentSelectedIds.includes(wp.id),
            heading: wp.heading || 0
          },
          geometry: {
            type: 'Point',
            coordinates: [wp.lng, wp.lat]
          }
        }));
        map.current.getSource('waypoints').setData({ type: 'FeatureCollection', features });

        const lineCoords = currentWaypoints.map(wp => [wp.lng, wp.lat]);
        map.current.getSource('mission-path').setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords }
        });

        if (currentWaypoints.length >= 2) {
          const arrowFeatures = [];
          for (let i = 0; i < currentWaypoints.length - 1; i++) {
            const p1 = turf.point([currentWaypoints[i].lng, currentWaypoints[i].lat]);
            const p2 = turf.point([currentWaypoints[i + 1].lng, currentWaypoints[i + 1].lat]);
            const midpoint = turf.midpoint(p1, p2);
            const bearing = turf.bearing(p1, p2);
            
            arrowFeatures.push({
              type: 'Feature',
              geometry: midpoint.geometry,
              properties: { rotation: bearing }
            });
          }
          map.current.getSource('path-arrows').setData({ type: 'FeatureCollection', features: arrowFeatures });
        }
      }
    };

    if (map.current.loaded()) {
      initializeLayers();
    } else {
      map.current.on('load', initializeLayers);
    }

    // Re-initialize layers when style changes
    map.current.on('style.load', initializeLayers);

    const updateMode = (e) => {
      // If we are in 'add_waypoint' mode and Mapbox Draw switches to 'simple_select',
      // we ignore it because 'add_waypoint' relies on 'simple_select' under the hood.
      if (currentModeRef.current === 'add_waypoint' && e.mode === 'simple_select') {
        return;
      }
      setCurrentMode(e.mode);
    };

    map.current.on('draw.modechange', updateMode);

    // Global Escape Key Listener
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        // If we are in a drawing mode or add_waypoint, switch to simple_select
        if (currentModeRef.current !== 'simple_select') {
          // If in Mapbox Draw mode, we might need to cancel the current feature first.
          // Mapbox Draw handles Escape internally to cancel, but we want to ensure we exit the mode too.
          if (draw.current) {
            draw.current.changeMode('simple_select');
          }
          setCurrentMode('simple_select');
        } else {
          // If already in simple_select, maybe deselect?
          setSelectedIds([]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      // window.removeEventListener('waygen:restore-polygon', handleRestorePolygon); // Removed
    };

  }, []);

  // Centralized Mode Management
  useEffect(() => {
    if (!draw.current || !map.current) return;

    const mode = currentMode;
    const drawMode = draw.current.getMode();

    if (mode === 'add_waypoint') {
      // When in add_waypoint, we use simple_select for Draw so we can still interact/select if needed,
      // but we might want to suppress selection if it interferes.
      // For now, simple_select is fine.
      if (drawMode !== 'simple_select') {
        draw.current.changeMode('simple_select');
      }
      // Force crosshair
      map.current.getCanvas().style.cursor = 'crosshair';
    } else {
      // For standard Draw modes
      if (drawMode !== mode) {
        try {
          draw.current.changeMode(mode);
        } catch (err) {
          console.warn('Failed to switch mode:', err);
        }
      }
      map.current.getCanvas().style.cursor = '';
    }
  }, [currentMode]);

  // Force Layout Updates (Fix for HMR/Persisted Styles)
  useEffect(() => {
    if (!map.current || !map.current.getLayer('waypoints-symbol')) return;

    map.current.setLayoutProperty('waypoints-symbol', 'text-offset', [0, 0]);
    map.current.setLayoutProperty('waypoints-symbol', 'text-anchor', 'center');
    map.current.setLayoutProperty('waypoints-symbol', 'icon-anchor', 'center');
    map.current.setLayoutProperty('waypoints-symbol', 'text-rotation-alignment', 'viewport');
  }, []);

  // Update Waypoints Source & Path
  useEffect(() => {
    if (!map.current) return;
    if (!map.current) return;
    // Removed loaded() check to ensure data updates even if map is "loading" (e.g. tiles/movement)


    const wpSource = map.current.getSource('waypoints');
    const pathSource = map.current.getSource('mission-path');
    const arrowSource = map.current.getSource('path-arrows');

    if (wpSource) {
      const features = waypoints.map((wp, index) => ({
        type: 'Feature',
        properties: {
          id: wp.id,
          index: index + 1,
          selected: selectedIds.includes(wp.id),
          heading: wp.heading || 0
        },
        geometry: {
          type: 'Point',
          coordinates: [wp.lng, wp.lat]
        }
      }));
      wpSource.setData({ type: 'FeatureCollection', features });
    }

    if (pathSource) {
      const lineCoords = waypoints.map(wp => [wp.lng, wp.lat]);
      pathSource.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: lineCoords
        }
      });
    }

    if (arrowSource && waypoints.length >= 2) {
      const arrowFeatures = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const p1 = turf.point([waypoints[i].lng, waypoints[i].lat]);
        const p2 = turf.point([waypoints[i + 1].lng, waypoints[i + 1].lat]);
        
        // Calculate midpoint and bearing
        const midpoint = turf.midpoint(p1, p2);
        const bearing = turf.bearing(p1, p2);
        
        arrowFeatures.push({
          type: 'Feature',
          geometry: midpoint.geometry,
          properties: {
            rotation: bearing
          }
        });
      }
      arrowSource.setData({ type: 'FeatureCollection', features: arrowFeatures });
    } else if (arrowSource) {
      arrowSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [waypoints, selectedIds]);

  // Update Footprints
  useEffect(() => {
    if (!map.current || !map.current.getSource('footprints')) return;

    if (!settings.showFootprints) {
      map.current.getSource('footprints').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const features = waypoints.map((wp, index) => {
      const heading = wp.heading || 0;
      return {
        ...calculateFootprint(
          { lng: wp.lng, lat: wp.lat },
          settings.altitude,
          heading,
          settings.customFOV
        ),
        properties: {
          index: index + 1,
          color: settings.footprintColor
        }
      };
    }).filter(f => f !== null);

    map.current.getSource('footprints').setData({ type: 'FeatureCollection', features });

  }, [waypoints, settings.showFootprints, settings.altitude, settings.customFOV, settings.footprintColor]);

  // Ensure default radius is reasonable on load
  useEffect(() => {
    if (settings.orbitRadius > 500) {
      useMissionStore.getState().updateSettings({ orbitRadius: 50 });
    }
  }, []);

  const handleDelete = () => {
    if (draw.current) {
      draw.current.trash();
      onPolygonDrawn(null);
      setCanDelete(false);
    }
  };

  // Sync Polygon Prop with Mapbox Draw
  useEffect(() => {
    if (!draw.current || !map.current) return;

    // If prop is null, clear draw
    if (!polygon) {
      if (draw.current.getAll().features.length > 0) {
        draw.current.deleteAll();
      }
      return;
    }

    // Check if we need to update (avoid loops)
    const currentFeatures = draw.current.getAll().features;
    const alreadyExists = currentFeatures.some(f => f.id === polygon.id);

    if (!alreadyExists) {
      console.log("Syncing polygon from prop:", polygon);
      draw.current.deleteAll();
      draw.current.add(polygon);

      // Fit bounds for new polygon (e.g. import)
      try {
        const bbox = turf.bbox(polygon);
        map.current.fitBounds(bbox, { padding: 100 });
      } catch (err) {
        console.warn("Could not fit bounds:", err);
      }
    }
  }, [polygon]);

  return (
    <div className={`relative w-full h-full ${currentMode === 'add_waypoint' ? 'force-crosshair' : ''}`}>
      <style>{`
        .force-crosshair .mapboxgl-canvas-container {
          cursor: crosshair !important;
        }
        .force-crosshair .mapboxgl-canvas {
          cursor: crosshair !important;
        }
      `}</style>
      <div ref={mapContainer} className="w-full h-full" />
      {selectionBox && (
        <div
          style={{
            position: 'absolute',
            left: selectionBox.left,
            top: selectionBox.top,
            width: selectionBox.width,
            height: selectionBox.height,
            border: '2px solid #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            pointerEvents: 'none',
            zIndex: 20
          }}
        />
      )}

      {/* Custom Draw Controls */}
      <DrawToolbar
        currentMode={currentMode}
        onModeChange={setCurrentMode}
        onDelete={handleDelete}
        canDelete={canDelete}
      />

      {/* Map Controls */}
      <div className="absolute bottom-8 left-4 flex flex-col gap-2 z-10">
        <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
          <button
            onClick={() => {
              if (mapStyle !== 'satellite') {
                setMapStyle('satellite');
                map.current.setStyle('mapbox://styles/mapbox/satellite-streets-v12');
              }
            }}
            className={`p-2 hover:bg-gray-50 transition-colors ${mapStyle === 'satellite' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
            title="Satellite View"
          >
            <Satellite size={20} />
          </button>
          <div className="h-px bg-gray-200" />
          <button
            onClick={() => {
              if (mapStyle !== 'streets') {
                setMapStyle('streets');
                map.current.setStyle('mapbox://styles/mapbox/streets-v12');
              }
            }}
            className={`p-2 hover:bg-gray-50 transition-colors ${mapStyle === 'streets' ? 'bg-blue-50 text-blue-600' : 'text-gray-700'}`}
            title="Street Map"
          >
            <MapIcon size={20} />
          </button>
        </div>

        <button
          onClick={() => {
            if ('geolocation' in navigator) {
              navigator.geolocation.getCurrentPosition(position => {
                map.current.flyTo({
                  center: [position.coords.longitude, position.coords.latitude],
                  zoom: 16
                });
              }, error => {
                console.error("Error getting location:", error);
                alert("Could not get your location. Please check permissions.");
              });
            } else {
              alert("Geolocation is not supported by your browser.");
            }
          }}
          className="bg-white p-2 rounded-lg shadow-md border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors"
          title="My Location"
        >
          <Crosshair size={20} />
        </button>
      </div>
    </div>
  );
}
