// Neighborhood to NTA/CD mapping (Manhattan)
// Source: Provided by user (NYC website)

export const NEIGHBORHOOD_TO_NTA_CD = {
  'marble hill-inwood': { nta: 'MN01', cd: '112' },
  'central harlem north-polo grounds': { nta: 'MN03', cd: '110' },
  'hamilton heights': { nta: 'MN04', cd: '109' },
  'manhattanville': { nta: 'MN06', cd: '109' },
  'morningside heights': { nta: 'MN09', cd: '109' },
  'central harlem south': { nta: 'MN11', cd: '110' },
  'upper west side': { nta: 'MN12', cd: '107' },
  'hudson yards-chelsea-flatiron-union square': { nta: 'MN13', cd: '104' },
  'lincoln square': { nta: 'MN14', cd: '107' },
  'clinton': { nta: 'MN15', cd: '104' },
  'midtown-midtown south': { nta: 'MN17', cd: '105' },
  'turtle bay-east midtown': { nta: 'MN19', cd: '106' },
  'murray hill-kips bay': { nta: 'MN20', cd: '106' },
  'gramercy': { nta: 'MN21', cd: '106' },
  'east village': { nta: 'MN22', cd: '103' },
  'west village': { nta: 'MN23', cd: '102' },
  'tribeca-civic center': { nta: 'MN24', cds: ['101'] },
  'soho-little italy': { nta: 'MN24', cds: ['102'] },
  'battery park city-lower manhattan': { nta: 'MN25', cd: '101' },
  'chinatown': { nta: 'MN27', cd: '103' },
  'lower east side': { nta: 'MN28', cd: '103' },
  'lenox hill-roosevelt island': { nta: 'MN31', cd: '108' },
  'yorkville': { nta: 'MN32', cd: '108' },
  'east harlem south': { nta: 'MN33', cd: '111' },
  'east harlem north': { nta: 'MN34', cd: '111' },
  'washington heights north': { nta: 'MN35', cd: '112' },
  'washington heights south': { nta: 'MN36', cd: '112' },
  'upper east side-carnegie hill': { nta: 'MN40', cd: '108' },
  'stuyvesant town-cooper village': { nta: 'MN50', cd: '106' },
  'park-cemetery-etc-manhattan': { nta: 'MN99', cd: '111' },
};

// Normalize strings to be robust against punctuation and spacing
function normalizeKey(s) {
  return s
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ') // non-alphanumeric to space
    .trim()
    .replace(/\s+/g, ' '); // collapse spaces
}

// Build a normalized lookup map so variations like hyphens/extra spaces still match
const NORMALIZED_MAP = Object.entries(NEIGHBORHOOD_TO_NTA_CD).reduce((acc, [k, v]) => {
  acc[normalizeKey(k)] = v;
  return acc;
}, {});

export function lookupNtaCd(neighborhood) {
  if (!neighborhood) return null;
  const norm = normalizeKey(neighborhood);
  return NORMALIZED_MAP[norm] || null;
}
