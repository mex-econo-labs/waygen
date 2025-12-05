import { getRectangleBounds } from '../utils/geospatial';

// Custom mode for drawing a rectangle by dragging
const DragRectangleMode = {
    onSetup: function (opts) {
        const polygon = this.newFeature({
            type: 'Feature',
            properties: {
                isRectangle: true
            },
            geometry: {
                type: 'Polygon',
                coordinates: [[[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]]
            }
        });

        this.addFeature(polygon);
        this.clearSelectedFeatures();
        this.updateUIClasses({ mouse: 'add' });
        this.activateUIButton('polygon');
        this.setActionableState({
            trash: true
        });

        // Disable map dragPan so we can drag to draw
        if (this.map && this.map.dragPan) {
            this.map.dragPan.disable();
        }

        return {
            polygon,
            startPoint: null
        };
    },

    onStop: function (state) {
        this.updateUIClasses({ mouse: 'none' });
        this.activateUIButton();
        this.setActionableState({
            trash: true
        });

        // Re-enable map dragPan
        if (this.map && this.map.dragPan) {
            this.map.dragPan.enable();
        }
    },

    onMouseDown: function (state, e) {
        // Prevent default map interactions
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            e.originalEvent.stopPropagation();
        }

        state.startPoint = [e.lngLat.lng, e.lngLat.lat];

        // Initial update
        this.updateFeature(state, e);
    },

    onDrag: function (state, e) {
        if (state.startPoint) {
            this.updateFeature(state, e);
        }
    },

    onMouseUp: function (state, e) {
        if (state.startPoint) {
            this.updateFeature(state, e);
            this.map.fire('draw.create', {
                features: [state.polygon.toGeoJSON()]
            });
            this.changeMode('simple_select', { featureIds: [state.polygon.id] });
        }
    },

    updateFeature: function (state, e) {
        const start = state.startPoint;
        const end = [e.lngLat.lng, e.lngLat.lat];

        const { minX, maxX, minY, maxY } = getRectangleBounds(start, end);

        // Enforce standard winding: TL -> TR -> BR -> BL -> TL (CCW)
        const coordinates = [
            [minX, maxY], // Top Left
            [maxX, maxY], // Top Right
            [maxX, minY], // Bottom Right
            [minX, minY], // Bottom Left
            [minX, maxY]  // Close Loop
        ];

        // incomingCoords expects an array of rings for Polygon
        state.polygon.incomingCoords([coordinates]);
    },

    toDisplayFeatures: function (state, geojson, display) {
        const isActivePolygon = geojson.properties.id === state.polygon.id;
        geojson.properties.active = isActivePolygon ? 'true' : 'false';
        if (!isActivePolygon) return display(geojson);

        // Don't render points, just the polygon
        if (geojson.geometry.coordinates.length === 0) return;
        display(geojson);
    },

    onTrash: function (state) {
        this.deleteFeature(state.polygon.id, { silent: true });
        this.changeMode('simple_select');
    }
};

export default DragRectangleMode;
