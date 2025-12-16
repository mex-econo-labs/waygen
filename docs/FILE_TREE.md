# PROJECT FILE STRUCTURE
.
├── README.md
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── vite.config.js
├── .env.local
├── .gitignore
├── docs/
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── CODE_QUALITY.md
│   ├── COMPONENTS.md
│   ├── DEPENDENCIES.md
│   ├── FILE_TREE.md
│   └── REFACTORING_PLAN.md
└── src/
    ├── App.jsx
    ├── main.jsx
    ├── index.css
    ├── contexts/
    │   └── MapboxDrawContext.jsx
    ├── hooks/
    │   └── useMissionGeneration.js
    ├── store/
    │   └── useMissionStore.js
    ├── components/
    │   ├── Map/
    │   │   ├── MapContainer.jsx
    │   │   └── DrawToolbar.jsx
    │   ├── Sidebar/
    │   │   ├── SidebarMain.jsx
    │   │   ├── EditSelectedPanel.jsx
    │   │   └── MissionMetrics.jsx
    │   ├── Dialogs/
    │   │   ├── DownloadDialog.jsx
    │   │   └── FlightWarningDialog.jsx
    │   └── Common/
    │       └── SearchBar.jsx
    ├── logic/
    │   ├── pathGenerator.js
    │   ├── DragRectangleMode.js
    │   └── DirectSelectRectangleMode.js
    └── utils/
        ├── constants.js
        ├── djiExporter.js
        ├── dronePresets.js
        ├── geospatial.js
        ├── kmlImporter.js
        ├── units.js
        └── uuid.js