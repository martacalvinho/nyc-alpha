import React, { useEffect, useState } from 'react';

// Utility to fetch and parse GeoJSON (Manhattan only)
async function fetchNeighborhoods() {
  // Official NYC NTA boundaries (GeoJSON, stable)
  const url = 'https://data.cityofnewyork.us/api/geospatial/cpf4-rkhq?method=export&format=GeoJSON';
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load NYC neighborhoods GeoJSON');
  const geo = await res.json();
  // Only Manhattan neighborhoods, borough code 1
  return geo.features.filter(f => f.properties.borough === 'Manhattan' && String(f.properties.boro_code) === '1');
}

export default function GeographicFilter({ onChange, selected }) {
  const [features, setFeatures] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [neighborhood, setNeighborhood] = useState(selected?.neighborhood || '');

  useEffect(() => {
    fetchNeighborhoods()
      .then(f => setFeatures(f))
      .catch(() => setFeatures([]));
  }, []);

  useEffect(() => {
    // Extract unique Manhattan neighborhoods
    const nSet = new Set(features.map(f => f.properties.neighborhood));
    setNeighborhoods([...nSet].sort());
  }, [features]);

  // Sync props
  useEffect(() => {
    setNeighborhood(selected?.neighborhood || '');
  }, [selected]);

  function handleNeighborhood(e) {
    setNeighborhood(e.target.value);
    if (onChange) onChange({ borough: '1', neighborhood: e.target.value });
  }

  return (
    <div style={{border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, maxWidth: 320, marginBottom: 16}}>
      <div style={{fontWeight: 600, marginBottom: 8}}>Geographic Filter</div>
      {features.length === 0 && (
        <div style={{color: 'red', marginBottom: 8}}>Failed to load neighborhoods. Please check your internet connection or try again later.</div>
      )}
      <div>
        <div>Neighborhood</div>
        <select style={{width: '100%', padding: 6, fontSize: 16}} value={neighborhood} onChange={handleNeighborhood}>
          <option value=''>All Manhattan</option>
          {(neighborhoods || []).map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
    </div>
  );
}
