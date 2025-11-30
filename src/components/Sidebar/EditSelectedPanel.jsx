import React, { useState, useEffect } from 'react';
import { Settings, Trash2, Save, Plus } from 'lucide-react';
import * as turf from '@turf/turf';
import { toDisplay, toMetric } from '../../utils/units';

export default function EditSelectedPanel({
    selectedWaypoints,
    selectedIds,
    waypoints,
    settings,
    onUpdate,
    onDelete,
    onInsert
}) {
    const [localState, setLocalState] = useState({});
    const [hasChanges, setHasChanges] = useState(false);

    // Check if we can insert a waypoint (exactly 2 selected, adjacent)
    const canInsert = selectedIds.length === 2 && waypoints && (() => {
        const indices = selectedIds.map(id => waypoints.findIndex(wp => wp.id === id)).sort((a, b) => a - b);
        return indices[0] !== -1 && indices[1] !== -1 && (indices[1] - indices[0] === 1);
    })();

    const handleInsert = () => {
        if (!canInsert) return;

        const indices = selectedIds.map(id => waypoints.findIndex(wp => wp.id === id)).sort((a, b) => a - b);
        const firstIdx = indices[0];
        // const secondIdx = indices[1]; // Not needed for logic, just verification
        const firstWp = waypoints[firstIdx];
        const secondWp = waypoints[indices[1]];

        const p1 = turf.point([firstWp.lng, firstWp.lat]);
        const p2 = turf.point([secondWp.lng, secondWp.lat]);
        const mid = turf.midpoint(p1, p2);
        const [midLng, midLat] = mid.geometry.coordinates;

        const newWp = {
            lat: midLat,
            lng: midLng,
            // Inherit attributes from first waypoint
            altitude: firstWp.altitude,
            speed: firstWp.speed,
            gimbalPitch: firstWp.gimbalPitch,
            heading: firstWp.heading,
            straightenLegs: firstWp.straightenLegs,
            action: firstWp.action
        };

        // Insert at index + 1 (between them)
        onInsert(firstIdx + 1, newWp);
    };

    // Initialize local state when selection changes
    useEffect(() => {
        if (selectedWaypoints.length === 0) return;

        const firstWp = selectedWaypoints[0];

        // Helper to resolve effective values
        const resolveStraighten = (wp) => {
            if (wp.straightenLegs !== undefined) return wp.straightenLegs.toString();
            return settings.straightenLegs ? 'true' : 'false';
        };

        const resolveAction = (wp) => {
            if (wp.action) return wp.action;
            if (settings.waypointAction === 'photo') return 'photo';
            // For 'record', we default to 'none' in the UI to enforce explicit selection, 
            // as 'record' is a complex global state (start/stop) not easily mapped to a single point without context.
            return 'none';
        };

        const firstStraighten = resolveStraighten(firstWp);
        const firstAction = resolveAction(firstWp);

        // Helper to check if all selected have same value (for simple fields)
        const allSame = (key) => selectedWaypoints.every(wp => wp[key] === firstWp[key]);
        // Helper to check if all selected have same RESOLVED value (for complex fields)
        const allSameResolved = (resolver, val) => selectedWaypoints.every(wp => resolver(wp) === val);

        const initialState = {
            lat: selectedIds.length === 1 ? firstWp.lat : '',
            lng: selectedIds.length === 1 ? firstWp.lng : '',
            altitude: allSame('altitude') ? toDisplay(firstWp.altitude, settings.units) : '',
            speed: allSame('speed') ? toDisplay(firstWp.speed, settings.units) : '',
            gimbalPitch: allSame('gimbalPitch') ? firstWp.gimbalPitch : '',
            heading: allSame('heading') ? firstWp.heading : '',
            straightenLegs: allSameResolved(resolveStraighten, firstStraighten) ? firstStraighten : 'mixed',
            action: allSameResolved(resolveAction, firstAction) ? firstAction : 'mixed'
        };

        setLocalState(initialState);
        setHasChanges(false);
    }, [selectedIds, selectedWaypoints, settings]);

    const handleChange = (key, value) => {
        setLocalState(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

    const handleSave = () => {
        const updates = {};

        // Only include fields that are not "mixed" or empty

        if (selectedIds.length === 1) {
            updates.lat = Number(localState.lat);
            updates.lng = Number(localState.lng);
        }

        if (localState.altitude !== '') updates.altitude = toMetric(Number(localState.altitude), settings.units);
        if (localState.speed !== '') updates.speed = toMetric(Number(localState.speed), settings.units);
        if (localState.gimbalPitch !== '') updates.gimbalPitch = Number(localState.gimbalPitch);
        if (localState.heading !== '') updates.heading = Number(localState.heading);

        if (localState.straightenLegs !== 'mixed') {
            // Always save explicit value, never undefined
            updates.straightenLegs = localState.straightenLegs === 'true';
        }

        if (localState.action !== 'mixed') {
            // Always save explicit value
            updates.action = localState.action;
        }

        onUpdate(updates);
        setHasChanges(false);
    };

    const singleSelection = selectedIds.length === 1;

    return (
        <div className="p-4 bg-gray-50 h-full border-l w-80 flex flex-col shadow-xl z-10 overflow-y-auto">
            <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
                <Settings size={20} /> Edit Selected ({selectedIds.length})
            </h2>

            {singleSelection && (
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500">Lat</label>
                        <input
                            type="number"
                            className="border p-2 rounded w-full text-xs"
                            value={localState.lat}
                            onChange={(e) => handleChange('lat', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500">Lng</label>
                        <input
                            type="number"
                            className="border p-2 rounded w-full text-xs"
                            value={localState.lng}
                            onChange={(e) => handleChange('lng', e.target.value)}
                        />
                    </div>
                </div>
            )}

            <label className="text-xs font-bold text-gray-500">Altitude ({settings.units === 'metric' ? 'm' : 'ft'})</label>
            <input
                type="number"
                className="border p-2 rounded w-full mb-4"
                placeholder={localState.altitude === '' ? "Mixed" : ""}
                value={localState.altitude}
                onChange={(e) => handleChange('altitude', e.target.value)}
            />

            <label className="text-xs font-bold text-gray-500">Speed ({settings.units === 'metric' ? 'm/s' : 'ft/s'})</label>
            <input
                type="number"
                className="border p-2 rounded w-full mb-4"
                placeholder={localState.speed === '' ? "Mixed" : ""}
                value={localState.speed}
                onChange={(e) => handleChange('speed', e.target.value)}
            />

            <label className="text-xs font-bold text-gray-500">Gimbal Pitch (°)</label>
            <input
                type="number"
                className="border p-2 rounded w-full mb-4"
                placeholder={localState.gimbalPitch === '' ? "Mixed" : ""}
                value={localState.gimbalPitch}
                onChange={(e) => handleChange('gimbalPitch', e.target.value)}
            />

            <label className="text-xs font-bold text-gray-500">Heading (°)</label>
            <input
                type="number"
                className="border p-2 rounded w-full mb-4"
                placeholder={localState.heading === '' ? "Mixed" : ""}
                value={localState.heading}
                onChange={(e) => handleChange('heading', e.target.value)}
            />

            <label className="text-xs font-bold text-gray-500">Turn Mode</label>
            <select
                className="border p-2 rounded w-full mb-4 text-sm bg-white"
                value={localState.straightenLegs}
                onChange={(e) => handleChange('straightenLegs', e.target.value)}
            >
                <option value="mixed" disabled hidden>Mixed</option>
                <option value="false">Curved (Continuous)</option>
                <option value="true">Straight (Stop & Turn)</option>
            </select>

            <label className="text-xs font-bold text-gray-500">Action</label>
            <select
                className="border p-2 rounded w-full mb-4 text-sm bg-white"
                value={localState.action}
                onChange={(e) => handleChange('action', e.target.value)}
            >
                <option value="mixed" disabled hidden>Mixed</option>
                <option value="none">None</option>
                <option value="photo">Take Photo</option>
                <option value="record_start">Start Recording</option>
                <option value="record_stop">Stop Recording</option>
            </select>

            <div className="mt-auto flex flex-col gap-2 pt-4">
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className={`w-full p-3 rounded-lg shadow-md flex items-center justify-center gap-2 transition-all font-bold text-white ${hasChanges ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'}`}
                >
                    <Save size={18} /> Update Point(s)
                </button>

                {canInsert && (
                    <button
                        onClick={handleInsert}
                        className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 p-2 rounded flex items-center justify-center gap-2 transition-colors font-medium border border-blue-200"
                    >
                        <Plus size={16} /> Insert Waypoint
                    </button>
                )}

                <button onClick={onDelete} className="w-full bg-red-100 hover:bg-red-200 text-red-600 p-2 rounded flex items-center justify-center gap-2 transition-colors font-medium">
                    <Trash2 size={16} /> Delete Selected
                </button>
            </div>
        </div>
    );
}
