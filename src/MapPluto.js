import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GEOJSON_URL = 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Neighborhood_Tabulation_Areas_2020/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const defaultCenter = [-73.96, 40.75];
const defaultZoom = 10.5;

// MapPluto displays the map and highlights the selected neighborhood. When a neighborhood is clicked, it calls setSelectedNeighborhood (from App).
export default function MapPluto({ selectedNeighborhood, setSelectedNeighborhood }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [geojson, setGeojson] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  // Fetch GeoJSON
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then((data) => {
        // eslint-disable-next-line no-console
        console.log('[MapPluto] fetched neighborhoods:', Array.isArray(data?.features) ? data.features.length : 0);
        setGeojson(data);
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[MapPluto] failed to fetch neighborhoods', err);
        setGeojson(null);
        setMapError('Failed to load neighborhood boundaries.');
      });
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    // eslint-disable-next-line no-console
    console.log('[MapPluto] creating map instance...');
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: true,
    });
    // Ensure map draws when container becomes visible
    map.on('load', () => {
      // eslint-disable-next-line no-console
      console.log('[MapPluto] map load event');
      try { map.resize(); } catch {}
      setMapReady(true);
    });
    const onWindowResize = () => {
      try { map.resize(); } catch {}
    };
    window.addEventListener('resize', onWindowResize);
    // Log any map errors to help debugging
    let usedFallback = false;
    map.on('style.load', () => {
      // eslint-disable-next-line no-console
      console.log('[MapPluto] style.load event');
    });
    map.on('error', (e) => {
      // eslint-disable-next-line no-console
      console.error('MapLibre error:', e && (e.error || e));
      setMapError((e && (e.error && e.error.message)) || 'An error occurred initializing the map.');
      const msg = (e && e.error && e.error.message) || '';
      const isStyleIssue = msg.includes('Failed to fetch') || msg.includes('style') || msg.includes('Style') || msg.includes('cancel');
      if (!usedFallback && isStyleIssue) {
        usedFallback = true;
        try {
          // eslint-disable-next-line no-console
          console.warn('[MapPluto] switching to fallback style');
          map.setStyle(FALLBACK_STYLE);
        } catch {}
      }
    });
    mapRef.current = map;
    return () => {
      window.removeEventListener('resize', onWindowResize);
      try { map.remove(); } catch {}
      // Important: allow re-init on React 18 StrictMode double-mount
      mapRef.current = null;
    };
  }, []);

  // Add/update neighborhoods layer when geojson or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const selectedName = (typeof selectedNeighborhood === 'string' 
      ? selectedNeighborhood 
      : (selectedNeighborhood?.name || '')).toString().trim();

    function setupNeighborhoodLayers() {
      // Remove old layers/sources if present, with guards
      try {
        if (map.getLayer && map.getLayer('neighborhoods-fill')) map.removeLayer('neighborhoods-fill');
        if (map.getLayer && map.getLayer('neighborhoods-outline')) map.removeLayer('neighborhoods-outline');
        if (map.getLayer && map.getLayer('neighborhoods-selected-fill')) map.removeLayer('neighborhoods-selected-fill');
        if (map.getLayer && map.getLayer('neighborhoods-selected-outline')) map.removeLayer('neighborhoods-selected-outline');
        if (map.getLayer && map.getLayer('neighborhoods-label')) map.removeLayer('neighborhoods-label');
        if (map.getSource && map.getSource('neighborhoods')) map.removeSource('neighborhoods');
      } catch (e) {
        // Defensive: ignore errors from missing layers/sources
      }
      // Add source and layers
      try {
        // eslint-disable-next-line no-console
        console.log('[MapPluto] adding neighborhoods source with features:', Array.isArray(geojson?.features) ? geojson.features.length : 0);
        const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        const selectedNorm = normalize(selectedName);
        const normData = {
          ...geojson,
          features: (Array.isArray(geojson?.features) ? geojson.features : []).map(f => {
            const props = f.properties || {};
            const baseName = props.NTAName ?? props.ntaname ?? '';
            return {
              ...f,
              properties: { ...props, name_norm: normalize(baseName) }
            };
          })
        };
        map.addSource('neighborhoods', {
          type: 'geojson',
          data: normData,
          generateId: true,
        });
        // Determine best-matching normalized name for selection (exact or partial)
        const allNorms = (normData.features || []).map(f => f.properties?.name_norm).filter(Boolean);
        const findBestNorm = (norm) => {
          if (!norm) return '';
          if (allNorms.includes(norm)) return norm;
          let best = '';
          let bestLen = 0;
          for (const n of allNorms) {
            if (n.includes(norm) || norm.includes(n)) {
              if (n.length > bestLen) { best = n; bestLen = n.length; }
            }
          }
          return best || norm;
        };
        const selectedBestNorm = findBestNorm(selectedNorm);
        map.on('sourcedata', (e) => {
          if (e.sourceId === 'neighborhoods' && e.isSourceLoaded) {
            // eslint-disable-next-line no-console
            console.log('[MapPluto] neighborhoods source loaded');
          }
        });
        map.addLayer({
          id: 'neighborhoods-fill',
          type: 'fill',
          source: 'neighborhoods',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'name_norm'], selectedBestNorm], '#1976d2',
              '#cbd5e1' // light slate grey for non-selected
            ],
            'fill-opacity': [
              'case',
              ['==', ['get', 'name_norm'], selectedBestNorm], 0.65,
              0.35
            ]
          }
        });
        map.addLayer({
          id: 'neighborhoods-outline',
          type: 'line',
          source: 'neighborhoods',
          paint: {
            'line-color': '#111827', // slate-900 for stronger contrast
            'line-width': 1.6
          }
        });
        if (selectedName && selectedName !== 'All Manhattan') {
          map.addLayer({
            id: 'neighborhoods-selected-fill',
            type: 'fill',
            source: 'neighborhoods',
            filter: ['==', ['get', 'name_norm'], selectedBestNorm],
            paint: {
              'fill-color': '#1976d2',
              'fill-opacity': 0.65
            }
          });
          map.addLayer({
            id: 'neighborhoods-selected-outline',
            type: 'line',
            source: 'neighborhoods',
            filter: ['==', ['get', 'name_norm'], selectedBestNorm],
            paint: {
              'line-color': '#0b5aa4',
              'line-width': 3.0
            }
          });
          // eslint-disable-next-line no-console
          console.log('[MapPluto] selected highlight layers added for', selectedName);
        }
        // Labels
        map.addLayer({
          id: 'neighborhoods-label',
          type: 'symbol',
          source: 'neighborhoods',
          layout: {
            'text-field': ['coalesce', ['get', 'NTAName'], ['get', 'ntaname']],
            'text-size': [
              'interpolate', ['linear'], ['zoom'],
              10, 10,
              12, 12,
              14, 14
            ],
            'text-allow-overlap': false
          },
          paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 1
          }
        });
        // eslint-disable-next-line no-console
        console.log('[MapPluto] neighborhood layers added');
        try {
          // make sure our layers are on top
          map.moveLayer('neighborhoods-fill');
          map.moveLayer('neighborhoods-outline');
          if (map.getLayer('neighborhoods-selected-fill')) map.moveLayer('neighborhoods-selected-fill');
          if (map.getLayer('neighborhoods-selected-outline')) map.moveLayer('neighborhoods-selected-outline');
          map.moveLayer('neighborhoods-label');
        } catch {}
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[MapPluto] error adding neighborhood layers', e);
      }
      // If we have a selected neighborhood, zoom to it
      if (selectedName) {
        try {
          const features = (geojson && geojson.features) ? geojson.features : [];
          const match = features.find(f => {
            const props = f.properties || {};
            const propName = (props.NTAName || props.ntaname || '').toString().toLowerCase();
            return propName === selectedName.toString().toLowerCase();
          });
          if (match && match.geometry) {
            // Compute bbox for Polygon/MultiPolygon
            function computeBBox(coords) {
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
              function processPos(pos) {
                const [x, y] = pos;
                if (x < minX) minX = x; if (y < minY) minY = y;
                if (x > maxX) maxX = x; if (y > maxY) maxY = y;
              }
              function walk(c) {
                if (typeof c[0] === 'number') {
                  processPos(c);
                } else {
                  for (const sub of c) walk(sub);
                }
              }
              walk(coords);
              return [[minX, minY], [maxX, maxY]];
            }
            const geom = match.geometry;
            let bounds = null;
            if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
              bounds = computeBBox(geom.coordinates);
            }
            if (bounds) {
              map.fitBounds(bounds, { padding: 24, duration: 600 });
            }
          }
        } catch (e) {
          // ignore zoom errors
        }
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
          const ntaname = e.features[0].properties.NTAName;
          setSelectedNeighborhood(ntaname);
        }
      }
      map.on('mousemove', 'neighborhoods-fill', handleMouseMove);
      map.on('mouseleave', 'neighborhoods-fill', handleMouseLeave);
      map.on('click', 'neighborhoods-fill', handleClick);
      // Cleanup listeners on update
      return () => {
        try { map.off('mousemove', 'neighborhoods-fill', handleMouseMove); } catch {}
        try { map.off('mouseleave', 'neighborhoods-fill', handleMouseLeave); } catch {}
        try { map.off('click', 'neighborhoods-fill', handleClick); } catch {}
        try { if (map.getLayer('neighborhoods-selected-outline')) map.removeLayer('neighborhoods-selected-outline'); } catch {}
        try { if (map.getLayer('neighborhoods-selected-fill')) map.removeLayer('neighborhoods-selected-fill'); } catch {}
        try { if (map.getLayer('neighborhoods-label')) map.removeLayer('neighborhoods-label'); } catch {}
        try { if (map.getLayer('neighborhoods-outline')) map.removeLayer('neighborhoods-outline'); } catch {}
        try { if (map.getLayer('neighborhoods-fill')) map.removeLayer('neighborhoods-fill'); } catch {}
        try { if (map.getSource('neighborhoods')) map.removeSource('neighborhoods'); } catch {}
      };
    }

    // Setup layers as soon as style is ready, and also immediately if already loaded
    let cleanup = null;
    const applyLayers = () => {
      if (cleanup) cleanup();
      cleanup = setupNeighborhoodLayers();
    };
    let detached = false;
    const detach = () => {
      if (detached) return;
      detached = true;
      try {
        map.off('load', onReady);
      } catch {}
      try {
        map.off('style.load', onReady);
      } catch {}
      try {
        map.off('idle', onReady);
      } catch {}
    };
    const onReady = () => {
      applyLayers();
      detach();
    };
    if (map.isStyleLoaded && map.isStyleLoaded()) {
      applyLayers();
    } else {
      map.on('load', onReady);
      map.on('style.load', onReady);
      map.on('idle', onReady);
    }
    return () => {
      detach();
      if (cleanup) cleanup();
    };
  }, [geojson, selectedNeighborhood, setSelectedNeighborhood]);

  // Dedicated zoom effect on selection change to ensure fit even if layers already exist
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const selectedName = (typeof selectedNeighborhood === 'string' 
      ? selectedNeighborhood 
      : (selectedNeighborhood?.name || '')).toString().trim();
    if (!selectedName || selectedName === 'All Manhattan') return;
    // eslint-disable-next-line no-console
    console.log('[MapPluto] selection changed ->', selectedName);
    try {
      const features = Array.isArray(geojson.features) ? geojson.features : [];
      const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      const selectedNorm = normalize(selectedName);
      let match = features.find(f => {
        const props = f.properties || {};
        const base = (props.NTAName || props.ntaname || '');
        const propNorm = normalize(base);
        return propNorm === selectedNorm;
      });
      // eslint-disable-next-line no-console
      console.log('[MapPluto] zoom match found:', !!match);
      // If no immediate match (e.g., async race), try once after source loads
      if (!match) {
        const tryLater = () => {
          try {
            const feats = Array.isArray(geojson.features) ? geojson.features : [];
            match = feats.find(f => {
              const props = f.properties || {};
              const base = (props.NTAName || props.ntaname || '');
              const propNorm = normalize(base);
              return propNorm === selectedNorm;
            });
            // eslint-disable-next-line no-console
            console.log('[MapPluto] zoom retry match:', !!match);
            if (match && match.geometry) {
              const geom = match.geometry;
              let bounds = null;
              if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
                const computeBBox = (coords) => {
                  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                  const processPos = (pos) => { const [x, y] = pos; if (x < minX) minX = x; if (y < minY) minY = y; if (x > maxX) maxX = x; if (y > maxY) maxY = y; };
                  const walk = (c) => { if (typeof c[0] === 'number') processPos(c); else for (const sub of c) walk(sub); };
                  walk(coords);
                  return [[minX, minY], [maxX, maxY]];
                };
                bounds = computeBBox(geom.coordinates);
              }
              if (bounds) {
                try { map.resize(); } catch {}
                try { map.fitBounds(bounds, { padding: 32, duration: 700 }); } catch {}
              }
            }
          } finally {
            try { map.off('sourcedata', onSourceLoaded); } catch {}
          }
        };
        const onSourceLoaded = (e) => {
          if (e && e.sourceId === 'neighborhoods' && e.isSourceLoaded) tryLater();
        };
        try { map.on('sourcedata', onSourceLoaded); } catch {}
      }
      if (!match || !match.geometry) return;
      function computeBBox(coords) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        function processPos(pos) {
          const [x, y] = pos;
          if (x < minX) minX = x; if (y < minY) minY = y;
          if (x > maxX) maxX = x; if (y > maxY) maxY = y;
        }
        function walk(c) {
          if (typeof c[0] === 'number') {
            processPos(c);
          } else {
            for (const sub of c) walk(sub);
          }
        }
        walk(coords);
        return [[minX, minY], [maxX, maxY]];
      }
      const geom = match.geometry;
      let bounds = null;
      if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
        bounds = computeBBox(geom.coordinates);
      }
      if (!bounds) return;
      const doFit = () => {
        try { map.resize(); } catch {}
        try { map.fitBounds(bounds, { padding: 32, duration: 700 }); } catch {}
      };
      if (map.isStyleLoaded && map.isStyleLoaded()) {
        doFit();
      } else {
        map.once('idle', doFit);
        return () => { try { map.off('idle', doFit); } catch {} };
      }
    } catch {}
  }, [geojson, selectedNeighborhood]);

  // Update highlight styling dynamically when selection changes without rebuilding layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geojson) return;
    const normalize = (s) => (s || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const selectedName = (typeof selectedNeighborhood === 'string' 
      ? selectedNeighborhood 
      : (selectedNeighborhood?.name || '')).toString().trim();
    const selectedNorm = normalize(selectedName);
    try {
      if (map.getLayer('neighborhoods-fill')) {
        map.setPaintProperty('neighborhoods-fill', 'fill-color', [
          'case', ['==', ['get', 'name_norm'], selectedNorm], '#1976d2', '#cbd5e1'
        ]);
        map.setPaintProperty('neighborhoods-fill', 'fill-opacity', [
          'case', ['==', ['get', 'name_norm'], selectedNorm], 0.65, 0.35
        ]);
      }
      // Ensure selected layers exist then update their filters
      if (!map.getLayer('neighborhoods-selected-fill') && map.getSource('neighborhoods') && selectedName && selectedName !== 'All Manhattan') {
        map.addLayer({
          id: 'neighborhoods-selected-fill', type: 'fill', source: 'neighborhoods',
          filter: ['==', ['get', 'name_norm'], selectedNorm],
          paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.65 }
        });
      }
      if (!map.getLayer('neighborhoods-selected-outline') && map.getSource('neighborhoods') && selectedName && selectedName !== 'All Manhattan') {
        map.addLayer({
          id: 'neighborhoods-selected-outline', type: 'line', source: 'neighborhoods',
          filter: ['==', ['get', 'name_norm'], selectedNorm],
          paint: { 'line-color': '#0b5aa4', 'line-width': 3.0 }
        });
      }
      // Keep selected layers above others
      try {
        if (map.getLayer('neighborhoods-selected-fill')) map.moveLayer('neighborhoods-selected-fill');
        if (map.getLayer('neighborhoods-selected-outline')) map.moveLayer('neighborhoods-selected-outline');
      } catch {}
      if (map.getLayer('neighborhoods-selected-fill')) {
        map.setFilter('neighborhoods-selected-fill', ['==', ['get', 'name_norm'], selectedNorm]);
      }
      if (map.getLayer('neighborhoods-selected-outline')) {
        map.setFilter('neighborhoods-selected-outline', ['==', ['get', 'name_norm'], selectedNorm]);
      }
      // If selection cleared, remove selected layers
      if (!selectedName || selectedName === 'All Manhattan') {
        try { if (map.getLayer('neighborhoods-selected-outline')) map.removeLayer('neighborhoods-selected-outline'); } catch {}
        try { if (map.getLayer('neighborhoods-selected-fill')) map.removeLayer('neighborhoods-selected-fill'); } catch {}
      }
      // eslint-disable-next-line no-console
      console.log('[MapPluto] highlight updated for', selectedName);
    } catch {}
  }, [selectedNeighborhood, geojson]);

  return (
    <div style={{ width: '100%', height: 420, marginBottom: 18, borderRadius: 8, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', background: '#f1f5f9' }}>
      {mapError && (
        <div style={{ padding: 16, color: '#b91c1c', background: '#fef2f2' }}>
          {mapError}
        </div>
      )}
      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'relative' }} />
    </div>
  );
}
