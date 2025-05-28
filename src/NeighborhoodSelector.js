import React from "react";
// Replace these with your UI library or use native HTML if needed
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// NTA codes and names for Manhattan
const manhattanNTAs = [
  { code: 'MN12', name: 'Upper West Side' },
  { code: 'MN40', name: 'Upper East Side-Carnegie Hill' },
  { code: 'MN17', name: 'Midtown-Midtown South' },
  { code: 'MN13', name: 'Hudson Yards-Chelsea-Flatiron-Union Square' },
  { code: 'MN23', name: 'West Village' },
  { code: 'MN22', name: 'East Village' },
  { code: 'MN24', name: 'SoHo-TriBeCa-Civic Center-Little Italy' },
  { code: 'MN25', name: 'Battery Park City-Lower Manhattan' },
  { code: 'MN27', name: 'Chinatown' },
  { code: 'MN28', name: 'Lower East Side' },
  { code: 'MN31', name: 'Lenox Hill-Roosevelt Island' },
  { code: 'MN32', name: 'Yorkville' },
  { code: 'MN01', name: 'Marble Hill-Inwood' },
  { code: 'MN03', name: 'Central Harlem North-Polo Grounds' },
  { code: 'MN04', name: 'Hamilton Heights' },
  { code: 'MN06', name: 'Manhattanville' },
  { code: 'MN09', name: 'Morningside Heights' },
  { code: 'MN11', name: 'Central Harlem South' },
  { code: 'MN14', name: 'Lincoln Square' },
  { code: 'MN15', name: 'Clinton' },
  { code: 'MN19', name: 'Turtle Bay-East Midtown' },
  { code: 'MN20', name: 'Murray Hill-Kips Bay' },
  { code: 'MN21', name: 'Gramercy' },
  { code: 'MN33', name: 'East Harlem South' },
  { code: 'MN34', name: 'East Harlem North' },
  { code: 'MN35', name: 'Washington Heights North' },
  { code: 'MN36', name: 'Washington Heights South' },
  { code: 'MN50', name: 'Stuyvesant Town-Cooper Village' }
];

const boroughNeighborhoods = {
  manhattan: [
    { code: '', name: 'All Manhattan' },
    ...manhattanNTAs
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
            <option key={n.code || 'all'} value={n.name}>
              {n.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default NeighborhoodSelector;
