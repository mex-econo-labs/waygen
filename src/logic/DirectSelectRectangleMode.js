import { DirectMode } from 'mapbox-gl-draw-circle';
import * as turf from '@turf/turf';

const DirectSelectRectangleMode = {
    ...DirectMode,

    isRectangle: function (feature) {
        if (!feature) return false;

        // 1. Check explicit property
        if (feature.properties && (feature.properties.isRectangle === true || feature.properties.isRectangle === 'true')) {
            return true;
        }

        // 2. Geometric Check: Is it a Quad (5 points)?
        // We relax the check to just "Is it a 4-sided polygon?" to be more aggressive in treating it as a rectangle
        // This avoids floating point issues entirely.
        if (feature.geometry && feature.geometry.type === 'Polygon' && feature.geometry.coordinates.length > 0) {
            const coords = feature.geometry.coordinates[0];
            // Must have 5 points (4 corners + close)
            if (coords.length === 5) {
                // Optional: We could check if it's "roughly" rectangular, but for now, let's assume any quad in this mode is a rectangle
                // to ensure we suppress midpoints.
                return true;
            }
        }
        return false;
    },

    onSetup: function (opts) {
        const state = DirectMode.onSetup.call(this, opts);
        state.draggingHandle = null;
        return state;
    },

    onMouseDown: function (state, e) {
        // Check if we clicked a vertex (corner)
        // Mapbox Draw handles vertex selection automatically, but we want to intercept it for our custom drag logic
        // We can check if 'active' is 'true' and meta is 'vertex'
        const featureId = state.featureId;
        const feature = this.getFeature(featureId);

        if (this.isRectangle(feature)) {
            // If we clicked a vertex, we want to treat it as a corner drag
            // We need to know WHICH vertex.
            // The default behavior will select the vertex. We can use onDrag to handle the movement.
        }

        // Otherwise delegate to default
        DirectMode.onMouseDown.call(this, state, e);
    },

    onDrag: function (state, e) {
        const { featureId } = state;
        const feature = this.getFeature(featureId);

        // If not a rectangle, use default behavior
        if (!this.isRectangle(feature)) {
            return DirectMode.onDrag.call(this, state, e);
        }

        // Handle Corner Scaling (Vertex Drag)
        if (state.selectedCoordPaths && state.selectedCoordPaths.length > 0) {
            // We assume single vertex selection for resizing
            const coordPath = state.selectedCoordPaths[0];
            const parts = coordPath.split('.');
            const ringIndex = parseInt(parts[0], 10);
            const pointIndex = parseInt(parts[1], 10);

            if (ringIndex === 0 && pointIndex >= 0 && pointIndex <= 4) {
                const coordinates = feature.coordinates[0];
                const lng = e.lngLat.lng;
                const lat = e.lngLat.lat;

                // Normalize point index: 4 -> 0
                const normalizedPointIndex = pointIndex === 4 ? 0 : pointIndex;

                // Opposite corner index: (i + 2) % 4
                const oppositeIndex = (normalizedPointIndex + 2) % 4;
                const oppositePoint = coordinates[oppositeIndex];

                if (!oppositePoint) return;

                // Calculate new bounding box from Opposite Point (Fixed) and Mouse (Moving)
                const minX = Math.min(lng, oppositePoint[0]);
                const maxX = Math.max(lng, oppositePoint[0]);
                const minY = Math.min(lat, oppositePoint[1]);
                const maxY = Math.max(lat, oppositePoint[1]);

                // Reconstruct rectangle with standard winding
                // TL, TR, BR, BL, TL
                // TL = [minX, maxY]
                // TR = [maxX, maxY]
                // BR = [maxX, minY]
                // BL = [minX, minY]

                const newCoords = [
                    [minX, maxY], // TL
                    [maxX, maxY], // TR
                    [maxX, minY], // BR
                    [minX, minY], // BL
                    [minX, maxY]  // Close
                ];

                feature.incomingCoords([newCoords]);
                state.draggingHandle = true; // Ensure we fire update on mouse up
                return;
            }
        }

        // Fallback
        DirectMode.onDrag.call(this, state, e);
    },

    onMouseUp: function (state, e) {
        if (state.draggingHandle) {
            state.draggingHandle = null;
            this.map.dragPan.enable();
            this.fireUpdate();
        }
        DirectMode.onMouseUp.call(this, state, e);
    },

    fireUpdate: function () {
        this.map.fire('draw.update', {
            action: 'move',
            features: this.getSelected().map(f => f.toGeoJSON())
        });
    },

    toDisplayFeatures: function (state, geojson, display) {
        const feature = this.getFeature(state.featureId);

        if (this.isRectangle(feature)) {
            // Wrap the display callback to filter out midpoints
            // DirectMode.toDisplayFeatures generates the midpoints and calls display() for them.
            // We intercept this to prevent them from being rendered.
            const filteredDisplay = (outputGeojson) => {
                if (outputGeojson.properties.meta === 'midpoint') return;
                display(outputGeojson);
            };
            DirectMode.toDisplayFeatures.call(this, state, geojson, filteredDisplay);
            return;
        }

        // Use parent display logic to show vertices and the polygon itself
        DirectMode.toDisplayFeatures.call(this, state, geojson, display);
    }
};

export default DirectSelectRectangleMode;
