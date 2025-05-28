import React from "react";
// Replace these with your UI library or use native HTML if needed
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const boroughNeighborhoods = {
  manhattan: [
    "All Manhattan",
    "Upper West Side",
    "Upper East Side",
    "Midtown",
    "Chelsea",
    "West Village",
    "East Village",
    "SoHo",
    "Financial District"
  ],
};

const NeighborhoodSelector = ({ onSelect, currentSelection }) => {
  // Controlled: always use currentSelection for borough and neighborhood
  const borough = currentSelection?.borough || "manhattan";
  const neighborhood = currentSelection?.neighborhood || "All Manhattan";

  const handleBoroughChange = (e) => {
    const value = e.target.value;
    const defaultNeighborhood = boroughNeighborhoods[value][0];
    onSelect({ borough: value, neighborhood: defaultNeighborhood });
  };

  const handleNeighborhoodChange = (e) => {
    const value = e.target.value;
    onSelect({ borough, neighborhood: value });
  };

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
        <select style={{width: '100%', padding: 6, fontSize: 16}} value={neighborhood} onChange={handleNeighborhoodChange}>
          {boroughNeighborhoods[borough].map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default NeighborhoodSelector;
