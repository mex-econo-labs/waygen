import React, { useState, Suspense } from 'react';
import SidebarMain from './components/Sidebar/SidebarMain';

const SearchBar = React.lazy(() => import('./components/Common/SearchBar'));

// Lazy load MapContainer to split the bundle
const MapContainer = React.lazy(() => import('./components/Map/MapContainer'));

function App() {
  const [currentPolygon, setCurrentPolygon] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000); // Simulate initialization
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="text-2xl font-bold text-blue-600 animate-pulse">
          Waygen Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <div className="relative flex-grow">
        <Suspense fallback={null}>
          <SearchBar />
        </Suspense>
        <Suspense fallback={
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <div className="text-lg font-semibold text-gray-500">Loading Map...</div>
          </div>
        }>
          <MapContainer onPolygonDrawn={setCurrentPolygon} polygon={currentPolygon} />
        </Suspense>
      </div>
      <SidebarMain currentPolygon={currentPolygon} setCurrentPolygon={setCurrentPolygon} />
    </div>
  );
}

export default App;