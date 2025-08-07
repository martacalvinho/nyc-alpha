import React from "react";
import { getBoroughNTAs } from './data/ntaList';
// Replace these with your UI library or use native HTML if needed
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Build neighborhoods list from shared data
const boroughNeighborhoods = {
  manhattan: [
    { code: '', name: 'All Manhattan' },
    ...getBoroughNTAs('manhattan'),
  ],
};

const NeighborhoodSelector = ({ onSelect, currentSelection }) => {
  // Controlled: always use currentSelection for borough and neighborhood
  const borough = currentSelection?.borough || "manhattan";
  const neighborhood = currentSelection?.neighborhood || { code: '', name: 'All Manhattan' };

  const handleBoroughChange = (e) => {
    const value = e.target.value;
    const defaultNeighborhood = boroughNeighborhoods[value][0];
    onSelect({ 
      borough: value, 
      neighborhood: defaultNeighborhood,
      ntaCode: defaultNeighborhood.code 
    });
  };

  const handleNeighborhoodChange = (e) => {
    const selectedValue = e.target.value;
    const selectedNeighborhood = boroughNeighborhoods[borough].find(n => n.name === selectedValue) || 
                                { code: '', name: 'All Manhattan' };
    onSelect({ 
      borough, 
      neighborhood: selectedNeighborhood.name,
      ntaCode: selectedNeighborhood.code
    });
  };
  
  // Get the current neighborhood name for the select value
  const currentNeighborhoodName = typeof neighborhood === 'string' ? 
    neighborhood : 
    (neighborhood?.name || 'All Manhattan');

  return (
    <div style={{border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, maxWidth: 320, marginBottom: 16}}>
      <div style={{fontWeight: 600, marginBottom: 8}}>Geographic Filter</div>
      <div style={{marginBottom: 10}}>
        <div>Borough</div>
        <select style={{width: '100%', padding: 6, fontSize: 16}} value={borough} onChange={handleBoroughChange}>
          {Object.keys(boroughNeighborhoods).map((b) => (
            <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
          ))}
        </select>
      </div>
      <div>
        <div>Neighborhood</div>
        <select 
          style={{width: '100%', padding: 6, fontSize: 16}} 
          value={currentNeighborhoodName} 
          onChange={handleNeighborhoodChange}
        >
          {boroughNeighborhoods[borough].map((n) => (
            <option key={`${n.code || 'all'}-${n.name}`} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default NeighborhoodSelector;
