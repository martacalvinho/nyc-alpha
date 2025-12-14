import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const GEOJSON_URL = 'https://services5.arcgis.com/GfwWNkhOj9bNBqoJ/arcgis/rest/services/NYC_Neighborhood_Tabulation_Areas_2020/FeatureServer/0/query?where=1=1&outFields=*&outSR=4326&f=geojson';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const FALLBACK_STYLE = 'https://demotiles.maplibre.org/style.json';

const defaultCenter = [-73.96, 40.75];
const defaultZoom = 10.5;

// MapPluto displays the map and highlights the selected neighborhood. 
// When leads are provided, it visualizes them as interactive points.
export default function MapPluto({ selectedNeighborhood, setSelectedNeighborhood, leads = [], hoveredBBL = null, onSelectLead }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null); // Ref for the popup instance
  const [geojson, setGeojson] = useState(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  // Fetch GeoJSON for Neighborhoods
  useEffect(() => {
    fetch(GEOJSON_URL)
      .then(res => res.json())
      .then((data) => {
        setGeojson(data);
      })
      .catch((err) => {
        setGeojson(null);
        setMapError('Failed to load neighborhood boundaries.');
      });
  }, []);

  // Initialize map only once
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    
    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: defaultCenter,
      zoom: defaultZoom,
      attributionControl: false, // Cleaner look
    });
    
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.on('load', () => {
      try { map.resize(); } catch {}
      setMapReady(true);
    });

    const onWindowResize = () => {
      try { map.resize(); } catch {}
    };
    window.addEventListener('resize', onWindowResize);

    // Error handling
    let usedFallback = false;
    map.on('error', (e) => {
      const msg = (e && e.error && e.error.message) || '';
      const isStyleIssue = msg.includes('Failed to fetch') || msg.includes('style') || msg.includes('Style') || msg.includes('cancel');
      if (!usedFallback && isStyleIssue) {
        usedFallback = true;
        try {
          map.setStyle(FALLBACK_STYLE);
        } catch {}
      }
      if (!isStyleIssue && !mapError) {
          // Only show non-style errors if distinct
          // setMapError('Map error: ' + msg); 
      }
    });

    mapRef.current = map;
    
    // Handle container resizing
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        try { mapRef.current.resize(); } catch {}
      }
    });
    if (mapContainer.current) {
      resizeObserver.observe(mapContainer.current);
    }

    return () => {
      window.removeEventListener('resize', onWindowResize);
      resizeObserver.disconnect();
      if (popupRef.current) popupRef.current.remove();
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
  }, []);

  // Visualizing Leads (Dots)
  useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;
      
      const sourceId = 'leads-source';
      const layerIdCircle = 'leads-circle';
      const layerIdOuter = 'leads-outer';

      // If no leads, remove layers if they exist
      if (!leads || leads.length === 0) {
          if (map.getLayer(layerIdCircle)) map.removeLayer(layerIdCircle);
          if (map.getLayer(layerIdOuter)) map.removeLayer(layerIdOuter);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
          return;
      }

      // Prepare GeoJSON points for leads
      const validLeads = leads.filter(l => l.plutoData && l.plutoData.latitude && l.plutoData.longitude);
      const leadsGeoJson = {
          type: 'FeatureCollection',
          features: validLeads.map(l => ({
              type: 'Feature',
              geometry: {
                  type: 'Point',
                  coordinates: [parseFloat(l.plutoData.longitude), parseFloat(l.plutoData.latitude)]
              },
              properties: {
                  bbl: l.bbl,
                  address: l.address,
                  score: l.score,
                  permits: l.permitsLast12Months || 0,
                  complaints: l.complaintsLast30Days || 0,
                  lastSale: l.lastSaleDate,
                  // Determine category for coloring
                  category: (() => {
                      if (l.score >= 4.0) return 'high_score';
                      if (l.permitsLast12Months > 0) return 'permit';
                      if (l.complaintsLast30Days > 0) return 'complaint';
                      if (l.lastSaleDate && (new Date().getFullYear() - new Date(l.lastSaleDate).getFullYear() <= 2)) return 'sale';
                      return 'other';
                  })()
              }
          }))
      };

      // Add Source
      if (!map.getSource(sourceId)) {
          map.addSource(sourceId, {
              type: 'geojson',
              data: leadsGeoJson
          });
      } else {
          map.getSource(sourceId).setData(leadsGeoJson);
      }

      // Add Layers
      if (!map.getLayer(layerIdOuter)) {
          map.addLayer({
              id: layerIdOuter,
              type: 'circle',
              source: sourceId,
              paint: {
                  'circle-radius': 8,
                  'circle-color': '#ffffff',
                  'circle-opacity': 0.8,
                  'circle-stroke-width': 0
              }
          });
      }
      
      if (!map.getLayer(layerIdCircle)) {
          map.addLayer({
              id: layerIdCircle,
              type: 'circle',
              source: sourceId,
              paint: {
                  'circle-radius': 5,
                  'circle-color': [
                      'match',
                      ['get', 'category'],
                      'high_score', '#ef4444', // Red for hot
                      'permit', '#10b981',      // Green for active
                      'complaint', '#f59e0b',   // Orange for risk
                      'sale', '#3b82f6',        // Blue for recent
                      '#64748b'                 // Slate for others
                  ],
                  'circle-stroke-width': 1,
                  'circle-stroke-color': '#ffffff'
              }
          });

          // Highlight Layer (Hidden by default)
          map.addLayer({
              id: 'leads-highlight',
              type: 'circle',
              source: sourceId,
              filter: ['==', ['get', 'bbl'], ''], // Initially match nothing
              paint: {
                  'circle-radius': 12,
                  'circle-color': 'transparent',
                  'circle-stroke-width': 3,
                  'circle-stroke-color': '#3b82f6',
                  'circle-opacity': 0
              }
          });

          // Interactions
          const popup = new maplibregl.Popup({
              closeButton: false,
              closeOnClick: false,
              offset: 10,
              maxWidth: '300px'
          });
          popupRef.current = popup;

          map.on('mouseenter', layerIdCircle, (e) => {
              map.getCanvas().style.cursor = 'pointer';
              const coords = e.features[0].geometry.coordinates.slice();
              const props = e.features[0].properties;
              
              // Ensure we don't cover the point
              while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
                  coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
              }

              const html = `
                  <div style="font-family: -apple-system, sans-serif; padding: 4px;">
                      <div style="font-weight: 600; font-size: 13px; color: #0f172a; margin-bottom: 2px;">${props.address}</div>
                      <div style="font-size: 11px; color: #64748b; margin-bottom: 6px;">BBL: ${props.bbl}</div>
                      <div style="display: flex; gap: 6px; align-items: center;">
                          <span style="background: ${props.score >= 3 ? '#ecfdf5' : '#f1f5f9'}; color: ${props.score >= 3 ? '#059669' : '#475569'}; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 11px;">
                              Score: ${parseFloat(props.score).toFixed(1)}
                          </span>
                          ${props.permits > 0 ? `<span style="font-size: 11px; color: #10b981;">🔨 ${props.permits} Jobs</span>` : ''}
                          ${props.complaints > 0 ? `<span style="font-size: 11px; color: #f59e0b;">⚠️ ${props.complaints} Issues</span>` : ''}
                      </div>
                  </div>
              `;

              popup.setLngLat(coords).setHTML(html).addTo(map);
          });

          map.on('mouseleave', layerIdCircle, () => {
              map.getCanvas().style.cursor = '';
              popup.remove();
          });

          // Click to select
          map.on('click', layerIdCircle, (e) => {
              const props = e.features[0].properties;
              if (onSelectLead && props.bbl) {
                  onSelectLead(props.bbl);
              }
          });
      }

  }, [leads, mapReady]);

  // Handle hover visual updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    
    // Update the highlight layer filter based on hoveredBBL
    if (map.getLayer('leads-highlight')) {
        if (hoveredBBL) {
            map.setFilter('leads-highlight', ['==', ['get', 'bbl'], hoveredBBL]);
            map.setPaintProperty('leads-highlight', 'circle-opacity', 1);
        } else {
            map.setFilter('leads-highlight', ['==', ['get', 'bbl'], '']);
            map.setPaintProperty('leads-highlight', 'circle-opacity', 0);
        }
    }
  }, [hoveredBBL, mapReady]);

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
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#f8fafc' }}>
      {mapError && (
        <div style={{ 
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 10,
            padding: '12px 16px', 
            color: '#b91c1c', 
            background: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            fontSize: '0.875rem',
            fontWeight: '500',
        }}>
          {mapError}
        </div>
      )}
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
