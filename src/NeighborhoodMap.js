import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Example NYC Neighborhoods GeoJSON (replace with full dataset for production)
const NEIGHBORHOODS_GEOJSON_URL =
  'https://data.cityofnewyork.us/resource/cpf4-rkhq.geojson';

export default function NeighborhoodMap({ onNeighborhoodSelect }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return; // Only initialize once

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-73.96, 40.75],
      zoom: 10.5,
      attributionControl: true,
    });
    mapRef.current = map;

    // Add navigation controls
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Load neighborhoods GeoJSON
    map.on('load', () => {
      map.addSource('neighborhoods', {
        type: 'geojson',
        data: NEIGHBORHOODS_GEOJSON_URL,
      });
      map.addLayer({
        id: 'neighborhoods-fill',
        type: 'fill',
        source: 'neighborhoods',
        paint: {
          'fill-color': '#1976d2',
          'fill-opacity': 0.15,
        },
      });
      map.addLayer({
        id: 'neighborhoods-outline',
        type: 'line',
        source: 'neighborhoods',
        paint: {
          'line-color': '#1976d2',
          'line-width': 1.5,
        },
      });

      // Click event for neighborhood selection
      map.on('click', 'neighborhoods-fill', (e) => {
        const feature = e.features[0];
        if (feature && onNeighborhoodSelect) {
          onNeighborhoodSelect(feature.properties);
        }
      });

      // Change cursor on hover
      map.on('mouseenter', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'neighborhoods-fill', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    return () => map.remove();
  }, [onNeighborhoodSelect]);

  return (
    <div style={{ width: '100%', height: 420, marginBottom: 16 }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
