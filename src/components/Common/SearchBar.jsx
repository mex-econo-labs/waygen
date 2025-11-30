import React, { useEffect, useRef } from 'react';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';

export default function SearchBar({ map }) {
  const container = useRef(null);

  useEffect(() => {
    if (!map || !container.current) return;

    // Check if control already added to avoid duplicates
    if (document.querySelector('.mapboxgl-ctrl-geocoder')) return;

    const geocoder = new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl,
      marker: false,
      collapsed: false,
    });

    container.current.appendChild(geocoder.onAdd(map));
  }, [map]);

  return <div ref={container} className="absolute top-4 right-4 z-10" />;
}