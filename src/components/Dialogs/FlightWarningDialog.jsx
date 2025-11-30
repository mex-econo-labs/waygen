import React from 'react';
import { AlertTriangle, XCircle, X } from 'lucide-react';

export default function FlightWarningDialog({
    isOpen,
    onClose,
    warningLevel, // 'warning' | 'critical'
    missionTime, // Formatted time string (MM:SS)
    droneName,
    maxFlightTime // minutes
}) {
    if (!isOpen) return null;

    const isCritical = warningLevel === 'critical';
    const icon = isCritical ? XCircle : AlertTriangle;
    const Icon = icon;
    const iconColor = isCritical ? 'text-red-500' : 'text-yellow-500';
    const bgColor = isCritical ? 'bg-red-50' : 'bg-yellow-50';
    const borderColor = isCritical ? 'border-red-200' : 'border-yellow-200';

    const message = isCritical
        ? `Mission time (${missionTime}) exceeds the ${droneName} maximum flight duration (~${maxFlightTime} minutes).`
        : `Mission time (${missionTime}) is approaching the ${droneName} maximum flight duration (~${maxFlightTime} minutes).`;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl w-96 max-w-full mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className={`flex items-center justify-between p-4 border-b ${borderColor} ${bgColor}`}>
                    <div className="flex items-center gap-2">
                        <Icon size={24} className={iconColor} />
                        <h2 className="text-lg font-bold text-gray-800">Flight Duration Warning</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-700">
                        {message}
                    </p>

                    <div className={`p-3 rounded border ${borderColor} ${bgColor}`}>
                        <p className="text-sm font-bold text-gray-700 mb-2">Consider:</p>
                        <ul className="text-sm text-gray-600 space-y-1.5 list-disc list-inside">
                            <li>Reducing waypoint coverage area</li>
                            <li>Increasing spacing/overlap settings</li>
                            <li>Splitting into multiple missions</li>
                        </ul>
                    </div>

                    <p className="text-xs text-gray-500 italic">
                        You can proceed, but ensure sufficient battery for the mission.
                    </p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 p-4 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded text-sm transition-colors"
                    >
                        OK, Got It
                    </button>
                </div>
            </div>
        </div>
    );
}
