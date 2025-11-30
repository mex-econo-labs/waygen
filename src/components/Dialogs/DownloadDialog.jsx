import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { toDisplay, toMetric } from '../../utils/units';

export default function DownloadDialog({
    isOpen,
    onClose,
    onDownload,
    defaultFilename,
    defaultMissionEndAction,
    units = 'metric'
}) {
    const [filename, setFilename] = useState('');
    const [missionEndAction, setMissionEndAction] = useState('goHome');
    const [rcLostAction, setRcLostAction] = useState('hover');
    const [globalSpeed, setGlobalSpeed] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setFilename(defaultFilename);
            setMissionEndAction(defaultMissionEndAction);
            setRcLostAction('hover');
            // Default 5m/s converted to display units
            setGlobalSpeed(toDisplay(5, units).toFixed(1));
            setError('');
        }
    }, [isOpen, defaultFilename, defaultMissionEndAction, units]);

    const sanitizeFilename = (name) => {
        return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 100).trim();
    };

    const handleFilenameChange = (e) => {
        const sanitized = sanitizeFilename(e.target.value);
        setFilename(sanitized);
        setError(sanitized.length === 0 ? 'Filename cannot be empty' : '');
    };

    const handleDownload = () => {
        if (!filename || filename.length === 0) {
            setError('Filename cannot be empty');
            return;
        }
        onDownload({ 
            filename, 
            missionEndAction,
            rcLostAction,
            globalTransitionalSpeed: toMetric(Number(globalSpeed), units)
        });
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
            onClose();
        } else if (e.key === 'Enter' && !error && filename) {
            handleDownload();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-bold text-gray-800">Export Mission</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    {/* Mission End Action */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 block">
                            Mission End Action
                        </label>
                        <select
                            value={missionEndAction}
                            onChange={(e) => setMissionEndAction(e.target.value)}
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="goHome">Return to Home</option>
                            <option value="autoLand">Hover</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            {missionEndAction === 'goHome'
                                ? 'Drone will return to launch point after mission'
                                : 'Drone will hover at final waypoint'}
                        </p>
                    </div>

                    {/* RC Signal Lost Action */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 block">
                            Action when RC Signal Lost
                        </label>
                        <select
                            value={rcLostAction}
                            onChange={(e) => setRcLostAction(e.target.value)}
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="hover">Hover</option>
                            <option value="goHome">Return to Home</option>
                        </select>
                    </div>

                    {/* Global Mission Speed */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 block">
                            Global Mission Speed ({units === 'metric' ? 'm/s' : 'ft/s'})
                        </label>
                        <input
                            type="number"
                            min="0.1"
                            step="0.1"
                            value={globalSpeed}
                            onChange={(e) => setGlobalSpeed(e.target.value)}
                            className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Speed to fly to first waypoint
                        </p>
                    </div>

                    {/* Filename */}
                    <div>
                        <label className="text-sm font-bold text-gray-700 mb-2 block">
                            File Name
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={filename}
                                onChange={handleFilenameChange}
                                className={`flex-1 border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none ${error ? 'border-red-500' : ''
                                    }`}
                                placeholder="Enter filename"
                            />
                            <span className="text-sm text-gray-500 font-medium">.kmz</span>
                        </div>
                        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                        <p className="text-xs text-gray-500 mt-1">
                            Allowed: letters, numbers, hyphens, underscores
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDownload}
                        disabled={!!error || !filename}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded text-sm transition-colors"
                    >
                        Download
                    </button>
                </div>
            </div>
        </div>
    );
}
