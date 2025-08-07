// Shared list of NTAs used in the UI and cache builder

export const MANHATTAN_NTAS = [
  { code: 'MN12', name: 'Upper West Side' },
  { code: 'MN40', name: 'Upper East Side-Carnegie Hill' },
  { code: 'MN17', name: 'Midtown-Midtown South' },
  { code: 'MN13', name: 'Hudson Yards-Chelsea-Flatiron-Union Square' },
  { code: 'MN23', name: 'West Village' },
  { code: 'MN22', name: 'East Village' },
  // Split MN24 into two selectable options, both map to MN24 but filtered by CDs via neighborhoods.js
  { code: 'MN24', name: 'TriBeCa-Civic Center' },
  { code: 'MN24', name: 'SoHo-Little Italy' },
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
  { code: 'MN50', name: 'Stuyvesant Town-Cooper Village' },
];

export function getBoroughNTAs(borough) {
  const b = String(borough || '').toLowerCase();
  if (b === 'manhattan') return MANHATTAN_NTAS;
  return [];
}

export function boroughSlug(borough) {
  return String(borough || '').toLowerCase().replace(/\s+/g, '-');
}
