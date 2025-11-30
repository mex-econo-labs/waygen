import React from 'react';
import { Square, Hexagon, Circle, MousePointer2, Trash2, Plus } from 'lucide-react';

export default function DrawToolbar({ currentMode, onModeChange, onDelete, canDelete }) {
  const tools = [
    { id: 'simple_select', icon: MousePointer2, title: 'Select (Pointer)' },
    { id: 'add_waypoint', icon: Plus, title: 'Add Waypoint' },
    { id: 'draw_rectangle', icon: Square, title: 'Draw Square' },
    { id: 'draw_polygon', icon: Hexagon, title: 'Draw Polygon' },
    { id: 'drag_circle', icon: Circle, title: 'Draw Circle' },
  ];

  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 bg-white rounded-md shadow-md p-1 z-10">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = currentMode === tool.id || (tool.id === 'simple_select' && currentMode === 'direct_select');

        return (
          <button
            key={tool.id}
            onClick={() => {
              console.log('Switching to mode:', tool.id);
              onModeChange(tool.id);
            }}
            className={`p-2 rounded hover:bg-gray-100 flex items-center justify-center ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-700'
              }`}
            title={tool.title}
          >
            <Icon size={20} />
          </button>
        );
      })}

      <div className="h-px bg-gray-200 my-1" />

      <button
        onClick={onDelete}
        disabled={!canDelete}
        className={`p-2 rounded flex items-center justify-center ${canDelete
          ? 'text-red-600 hover:bg-red-50 cursor-pointer'
          : 'text-gray-300 cursor-not-allowed'
          }`}
        title="Delete Selected"
      >
        <Trash2 size={20} />
      </button>
    </div>
  );
}