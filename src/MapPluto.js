import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GEOJSON_URL = 'https://data.cityofnewyork.us/resource/cpf4-rkhq.geojson';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

const defaultCenter = [-73.96, 40.75];
const defaultZoom = 10.5;

// MapPluto displays the map and highlights the selected neighborhood. When a neighborhood is clicked, it calls setSelectedNeighborhood (from App).
export default function MapPluto({ selectedNeighborhood, setSelectedNeighborhood }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [geojson, setGeojson] = useState(null);

  // Fetch GeoJSON
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then(setGeojson)
      .catch(() => setGeojson(null));
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: true,
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  // Add/update neighborhoods layer when geojson or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;

    function setupNeighborhoodLayers() {
      // Remove old layers/sources if present, with guards
      try {
        if (map.getLayer && map.getLayer('neighborhoods-fill')) map.removeLayer('neighborhoods-fill');
        if (map.getLayer && map.getLayer('neighborhoods-outline')) map.removeLayer('neighborhoods-outline');
        if (map.getSource && map.getSource('neighborhoods')) map.removeSource('neighborhoods');
      } catch (e) {
        // Defensive: ignore errors from missing layers/sources
      }
      // Add source and layers
      try {
        map.addSource('neighborhoods', {
          type: 'geojson',
          data: geojson,
        });
        map.addLayer({
          id: 'neighborhoods-fill',
          type: 'fill',
          source: 'neighborhoods',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'ntaname'], selectedNeighborhood], '#1976d2',
              '#b3c6e6'
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'ntaname'], selectedNeighborhood], 0.65,
              0.30
            ]
          }
        });
        map.addLayer({
          id: 'neighborhoods-outline',
          type: 'line',
          source: 'neighborhoods',
          paint: {
            'line-color': '#1976d2',
            'line-width': 1.5
          }
        });
      } catch (e) {
        // Defensive: ignore errors if map is not ready
      }
      // Hover effect
      let hoveredId = null;
      function handleMouseMove(e) {
        if (e.features.length > 0) {
          if (hoveredId !== null) {
            map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: false });
          }
          hoveredId = e.features[0].id;
          map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: true });
          map.getCanvas().style.cursor = 'pointer';
        }
      }
      function handleMouseLeave() {
        if (hoveredId !== null) {
          map.setFeatureState({ source: 'neighborhoods', id: hoveredId }, { hover: false });
        }
        hoveredId = null;
        map.getCanvas().style.cursor = '';
      }
      function handleClick(e) {
        if (e.features.length > 0) {
          const ntaname = e.features[0].properties.ntaname;
          setSelectedNeighborhood(ntaname);
        }
      }
      map.on('mousemove', 'neighborhoods-fill', handleMouseMove);
      map.on('mouseleave', 'neighborhoods-fill', handleMouseLeave);
      map.on('click', 'neighborhoods-fill', handleClick);
      // Cleanup listeners on update
      return () => {
        map.off('mousemove', 'neighborhoods-fill', handleMouseMove);
        map.off('mouseleave', 'neighborhoods-fill', handleMouseLeave);
        map.off('click', 'neighborhoods-fill', handleClick);
        if (map.getLayer('neighborhoods-fill')) map.removeLayer('neighborhoods-fill');
        if (map.getLayer('neighborhoods-outline')) map.removeLayer('neighborhoods-outline');
        if (map.getSource('neighborhoods')) map.removeSource('neighborhoods');
      };
    }

    // Setup on style load, and immediately if already loaded
    let cleanup = null;
    function onStyleLoad() {
      if (cleanup) cleanup();
      cleanup = setupNeighborhoodLayers();
    }
    map.on('style.load', onStyleLoad);
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      onStyleLoad();
    }
    return () => {
      map.off('style.load', onStyleLoad);
      if (cleanup) cleanup();
    };
  }, [geojson, selectedNeighborhood, setSelectedNeighborhood]);

  return (
    <div style={{ width: '100%', height: 420, marginBottom: 18, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
