import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { lookupNtaCd } from '../data/neighborhoods';
import { boroughSlug } from '../data/ntaList';

// --- API Endpoints (NYC Open Data) ---
// Using the most recent MapPLUTO dataset
const PLUTO_ENDPOINT = 'https://data.cityofnewyork.us/resource/64uk-42ks.json'; // MapPLUTO
const LEGALS_ENDPOINT = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json'; // ACRIS Legals
const MASTER_ENDPOINT = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json'; // ACRIS Master
const DOBJOBS_ENDPOINT = 'https://data.cityofnewyork.us/resource/hir8-3a8d.json'; // DOB Jobs
const THREEONEONE_ENDPOINT = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json'; // 311 Complaints
const MORTGAGE_ENDPOINT = 'https://data.cityofnewyork.us/resource/qjp4-ri2f.json'; // ACRIS Mortgages
const HPD_VIOLATIONS_ENDPOINT = 'https://data.cityofnewyork.us/resource/wvxf-dwi5.json'; // HPD Violations
const HPD_REGISTRATIONS_ENDPOINT = 'https://data.cityofnewyork.us/resource/tesw-yqqr.json'; // HPD Registrations (owner info)
const DOB_PERMITS_ENDPOINT = 'https://data.cityofnewyork.us/resource/ipu4-2q9a.json'; // DOB Permit Issuance

// Estate/Executor deed types to detect inheritance sales
const ESTATE_DEED_TYPES = ['EXECUTOR', 'EXECUTRIX', 'ADMIN', 'ADMINISTRATOR', 'ESTATE', 'HEIR', 'DEVISEE', 'SURV', 'SURVIVOR'];

// --- Helper Functions ---
function makeBBL(boroughCode, block, lot) {
    // Assumes boroughCode is already '1' for Manhattan, '2' for Bronx etc.
    if (!boroughCode || !block || !lot || String(boroughCode).length !== 1) return null;
    return String(boroughCode) + String(block).padStart(5, '0') + String(lot).padStart(4, '0');
}

// If a property's address lacks a leading house number, try deriving one from DOB jobs or 311
function ensureDisplayAddressWithNumber(prop) {
    const hasNumber = prop.address && /^\d/.test(String(prop.address).trim());
    if (hasNumber) return;
    // Try PLUTO parts first
    const ph = prop.plutoData?.housenum || prop.plutoData?.housenumber;
    const ps = prop.plutoData?.stname || prop.plutoData?.street;
    if (ph && ps) {
        prop.address = `${String(ph).trim()} ${String(ps).trim()}`;
        return;
    }
    // Try DOB jobs
    if (prop.dobJobs && prop.dobJobs.length) {
        const counts = {};
        const unitCounts = {};
        prop.dobJobs.forEach(j => {
            const h = j.house__ || j.house || j.houseno || j.house_number;
            const s = j.street_name || j.streetname || j.street;
            const key = normalizeAddressParts(h, s);
            if (key) {
                counts[key] = (counts[key] || 0) + 1;
                const unit = extractUnitFromJob(j);
                if (unit) {
                    if (!unitCounts[key]) unitCounts[key] = {};
                    unitCounts[key][unit] = (unitCounts[key][unit] || 0) + 1;
                }
            }
        });
        const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
        if (best && best[0]) {
            const base = best[0];
            // If there is a dominant unit for this base address, append it
            const uc = unitCounts[base] || {};
            const topUnit = Object.entries(uc).sort((a,b)=>b[1]-a[1])[0];
            prop.address = topUnit && topUnit[0] ? `${base}, Apt ${topUnit[0]}` : base;
            return;
        }
    }
    // Try 311 complaints
    if (prop.complaints && prop.complaints.length) {
        const counts = {};
        prop.complaints.forEach(c => {
            const { house, street } = parseHouseAndStreet(c.incident_address);
            const key = normalizeAddressParts(house, street);
            if (key) counts[key] = (counts[key] || 0) + 1;
        });
        const best = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
        if (best && best[0]) {
            prop.address = best[0];
            return;
        }
    }
}

// Parse a freeform address into {house, street} and drop unit/apt parts
function parseHouseAndStreet(addr) {
    if (!addr) return { house: null, street: null };
    let s = String(addr).toUpperCase().trim();
    // Remove commas
    s = s.replace(/,/g, ' ');
    // Strip common unit markers and everything after them
    s = s.replace(/\s+(APT|APARTMENT|UNIT|STE|SUITE|FL|FLOOR|#)\b.*$/i, '');
    // House number is the first token with digits
    const m = s.match(/^(\d+[A-Z]?)\s+(.+)$/i);
    if (!m) return { house: null, street: s };
    const house = m[1];
    const street = m[2];
    return { house, street };
}

// Normalize any incoming BBL-ish value to a 10-digit string (no decimals)
function normalizeBBLString(value) {
    if (!value) return null;
    // If we already have borough+block+lot, return as-is when 10 digits
    const digits = String(value).replace(/[^0-9]/g, '');
    if (digits.length >= 10) return digits.slice(0, 10);
    return null;
}

// Map borough text to numeric code (includes common synonyms)
const boroughTextToNumeric = {
    'MANHATTAN': '1',
    'MN': '1',
    'NY': '1',
    'BRONX': '2',
    'BX': '2',
    'BRX': '2',
    'BROOKLYN': '3',
    'BKLYN': '3',
    'BK': '3',
    'KINGS': '3',
    'QUEENS': '4',
    'QNS': '4',
    'STATEN ISLAND': '5',
    'STATEN IS': '5',
    'SI': '5',
    'RICHMOND': '5'
};
const plutoBoroughToNumeric = { MN: '1', BX: '2', BK: '3', QN: '4', SI: '5' };

// Address normalization helpers for matching DOB jobs by street_name
function normalizeStreetName(s) {
    if (!s) return null;
    let t = String(s).toUpperCase();
    t = t.replace(/[\.,]/g, ' ');
    t = t.replace(/\bAVENUE\b/g, 'AVE');
    t = t.replace(/\bSTREET\b/g, 'ST');
    t = t.replace(/\bBOULEVARD\b/g, 'BLVD');
    t = t.replace(/\bPLACE\b/g, 'PL');
    t = t.replace(/\bROAD\b/g, 'RD');
    t = t.replace(/\bDRIVE\b/g, 'DR');
    t = t.replace(/\bPARKWAY\b/g, 'PKWY');
    t = t.replace(/\bTERRACE\b/g, 'TER');
    t = t.replace(/\bLANE\b/g, 'LN');
    t = t.replace(/\bCOURT\b/g, 'CT');
    t = t.replace(/\bEAST\b/g, 'E');
    t = t.replace(/\bWEST\b/g, 'W');
    t = t.replace(/\bNORTH\b/g, 'N');
    t = t.replace(/\bSOUTH\b/g, 'S');
    t = t.replace(/\s+/g, ' ').trim();
    return t;
}
function normalizeHouseNumber(s) {
    if (!s && s !== 0) return null;
    const t = String(s).toUpperCase().replace(/[^0-9A-Z]/g, '');
    return t || null;
}
function normalizeAddressParts(house, street) {
    const h = normalizeHouseNumber(house);
    const st = normalizeStreetName(street);
    if (!h || !st) return null;
    return `${h} ${st}`;
}

// Extract apartment/unit from DOB job record (supports multiple possible field names)
function extractUnitFromJob(job) {
    const cand = job.apartment || job.apartment__ || job.apt || job.apt__ || job.apt_no || job.unit || job.unit__ || job.apartment_number || job.aptnum || null;
    if (!cand) return null;
    let u = String(cand).trim();
    u = u.replace(/^APT\s*/i, '').replace(/^UNIT\s*/i, '').replace(/^#\s*/, '').trim();
    return u || null;
}

function buildDisplayAddressFromJob(job) {
    const street = job.street_name || job.streetname || job.street || '';
    const house = job.house__ || job.house || job.houseno || job.house_number || '';
    const base = [house, street].filter(Boolean).join(' ').trim();
    const unit = extractUnitFromJob(job);
    return unit ? `${base}, Apt ${unit}` : base;
}

// Build a display address from PLUTO record, preferring house number + street name
function buildDisplayAddressFromPluto(p) {
    const house = p.housenum || p.housenumber || null;
    const street = p.stname || p.street || null;
    const num = house ? String(house).trim() : '';
    const st = street ? String(street).trim() : '';
    if (num && st) return `${num} ${st}`;
    // Fallback: use provided address field if available
    if (p.address) return String(p.address).trim();
    // Last resort: join available parts
    return [num, st].filter(Boolean).join(' ').trim();
}

// Calculate months difference (past dates = positive number, future dates = negative number)
const timeDiffInMonths = (dateStr, from = new Date()) => {
    if (!dateStr) return null;
    const targetDate = new Date(dateStr);
    if (isNaN(targetDate.getTime())) return null;

    // Calculate months between dates
    let months = (from.getFullYear() - targetDate.getFullYear()) * 12;
    months += from.getMonth() - targetDate.getMonth();
    
    // Adjust for day of month
    if (from.getDate() < targetDate.getDate()) {
        months--;
    }
    
    return months;
};

// Calculate months left (positive = months remaining, negative = months overdue)
const monthsLeftUntil = (futureDate) => {
    if (!futureDate) return null;
    const months = timeDiffInMonths(futureDate);
    return months ? -months : null; // Invert the sign (future = positive)
};

export function usePropertyProcessor(selectedBorough, selection) {
    // Extract neighborhood info from the selection object
    const selectedNeighborhood = selection?.neighborhood || 'All Manhattan';
    const selectedNTACode = selection?.ntaCode || '';
    const [leads, setLeads] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [stats, setStats] = useState({
        likelySellers: 0,
        avgScore: 0,
        loansMaturing: 0,
        displayedLeads: 0,
        totalAnalyzed: 0, // Other stats will be 0 for now
    });
    const [progress, setProgress] = useState({});
    const [isFromCache, setIsFromCache] = useState(false);
    const [cacheLastUpdated, setCacheLastUpdated] = useState(null);

    const fetchDataAndProcess = useCallback(async (forceLive = false) => {
        console.log('fetchDataAndProcess called with:', { selectedBorough, selectedNeighborhood });
        
        if (!selectedNeighborhood || selectedNeighborhood === 'All Manhattan' || !selectedBorough) {
            console.log('No neighborhood selected, skipping data fetch');
            setLeads([]);
            setStats({ likelySellers: 0, avgScore: 0, loansMaturing: 0, displayedLeads: 0, totalAnalyzed: 0 });
            setProgress({});
            setIsLoading(false);
            return;
        }
        
        console.log('Processing selection:', { selectedBorough, neighborhood: selectedNeighborhood, ntaCode: selectedNTACode });

        setIsLoading(true);
        setError(null);
        setLeads([]);
        setProgress({ pluto: 'loading...', acris: 'pending...' });
        setIsFromCache(false);
        setCacheLastUpdated(null);

        // Cache-first: try to load neighborhood cache unless forceLive is true
        if (!forceLive && selectedNTACode) {
            try {
                const slug = boroughSlug(selectedBorough);
                const url = `/cache/${slug}/${selectedNTACode}.json`;
                const res = await axios.get(url, { validateStatus: () => true });
                if (res && res.status === 200 && res.data && Array.isArray(res.data.leads)) {
                    console.log('Loaded cached results from', url);
                    setLeads(res.data.leads || []);
                    setStats(res.data.stats || { likelySellers: 0, avgScore: 0, loansMaturing: 0, displayedLeads: 0, totalAnalyzed: 0 });
                    setProgress(p => ({
                        ...p,
                        cache: 'hit',
                        cacheUpdated: res.data.lastUpdated || null,
                    }));
                    setIsFromCache(true);
                    setCacheLastUpdated(res.data.lastUpdated || null);
                    setIsLoading(false);
                    return; // do not run live automatically when cache exists
                } else {
                    console.log('No cache found or bad cache response; falling back to live fetch');
                }
            } catch (e) {
                console.log('Cache fetch error; proceeding to live fetch', e?.message || e);
            }
        }

        const acrisBoroughCode = { manhattan: '1', bronx: '2', brooklyn: '3', queens: '4', 'staten island': '5' }[selectedBorough.toLowerCase()];
        if (!acrisBoroughCode) {
            setError("Invalid borough selected for ACRIS.");
            setIsLoading(false);
            setProgress(p => ({ ...p, pluto: 'error', acris: 'error' }));
            return;
        }

        try {
            // 1. Fetch PLUTO Data for the neighborhood
            // Socrata $where for NTA name (case-sensitive)
            // PLUTO uses borough codes
            const boroughCodes = {
                manhattan: 'MN',
                bronx: 'BX',
                brooklyn: 'BK',
                queens: 'QN',
                'staten island': 'SI'
            };
            const boroughCode = boroughCodes[selectedBorough.toLowerCase()];
            
            // Build server-side filters where possible and paginate to fetch ALL rows
            // Known fields: borough (e.g., 'MN'), cd (e.g., '107', '108'), bbl
            const whereClauses = [`borough='${boroughCode}'`];
            // We will not add CD filters server-side to avoid 400s from schema differences (cd numeric vs borocd string).
            // Instead, fetch by borough only and filter client-side by CDs where needed (e.g., MN24 => 101/102).
            const mapped = lookupNtaCd(selectedNeighborhood);
            if (selectedNTACode && (mapped?.cd || mapped?.cds)) {
                console.log('Will apply Community District filter client-side for', selectedNeighborhood, mapped);
            } else if (selectedNTACode) {
                // Unknown mapping for provided NTA; proceed without server-side NTA filter
                console.log(`No CD mapping for neighborhood ${selectedNeighborhood} (NTA ${selectedNTACode}); will filter client-side if needed.`);
            } else if (selectedNeighborhood && selectedNeighborhood !== 'All Manhattan') {
                console.log(`No NTA/CD mapping for neighborhood: ${selectedNeighborhood}; will filter client-side if needed.`);
            }

            const whereClause = whereClauses.join(' AND ');
            const PAGE_LIMIT = 50000; // Socrata allows up to 50k per page
            let plutoDataRaw = [];
            let page = 0;
            let offset = 0;
            console.log('Fetching PLUTO with server-side where:', whereClause || '(none)');
            setProgress(p => ({ ...p, pluto: 'fetching page 1...' }));
            try {
                while (true) {
                    const params = { $limit: PAGE_LIMIT, $offset: offset };
                    if (whereClause) params.$where = whereClause;
                    const res = await axios.get(PLUTO_ENDPOINT, { params, timeout: 60000 }); // 60s timeout
                    const rows = res.data || [];
                    plutoDataRaw = plutoDataRaw.concat(rows);
                    page++;
                    console.log(`PLUTO page ${page}: received ${rows.length} rows (total: ${plutoDataRaw.length})`);
                    setProgress(p => ({ ...p, pluto: `page ${page}: ${plutoDataRaw.length} records...` }));
                    if (rows.length < PAGE_LIMIT) break; // last page reached
                    offset += PAGE_LIMIT;
                    // Small delay to be nice to the API
                    await new Promise(r => setTimeout(r, 100));
                }
                console.log('PLUTO data received total:', plutoDataRaw.length, 'records');
                setProgress(p => ({ ...p, pluto: `${plutoDataRaw.length} records loaded` }));
                
                // Debug the PLUTO data structure
                if (plutoDataRaw.length > 0) {
                    console.log('First PLUTO record fields:', Object.keys(plutoDataRaw[0]));
                    console.log('Sample PLUTO record:', plutoDataRaw[0]);
                }
                
                // If we have NTA code or neighborhood and could not filter server-side, filter the data client-side
                if (selectedNTACode && plutoDataRaw.length > 0) {
                    console.log(`Filtering ${plutoDataRaw.length} properties by NTA code: ${selectedNTACode}`);
                    
                    // First try to find any NTA field
                    const possibleNtaFields = ['ntacode', 'nta', 'nta2020', 'nta_code', 'ntaname', 'cd', 'borocd', 'boro_cd', 'bbl'];
                    
                    // Check which fields exist in the data
                    const existingFields = [];
                    for (const field of possibleNtaFields) {
                        if (plutoDataRaw[0][field] !== undefined) {
                            existingFields.push(field);
                            console.log(`Found potential field in PLUTO data: ${field} = ${plutoDataRaw[0][field]}`);
                        }
                    }
                    
                    // Try to filter using different strategies
                    let filteredData = plutoDataRaw;
                    
                    // Apply client-side CD filtering based on neighborhoods.js mapping (supports split MN24)
                    const mappedForFilter = lookupNtaCd(selectedNeighborhood);
                    if (mappedForFilter && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
                        const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
                        if (Array.isArray(mappedForFilter.cds) && mappedForFilter.cds.length) {
                            const cdsSet = new Set(mappedForFilter.cds.map(c => String(c).trim()));
                            filteredData = plutoDataRaw.filter(p => cdsSet.has(String(p[cdField]).trim()));
                            console.log(`Filtered by mapped CDs ${[...cdsSet].join(', ')} for ${selectedNeighborhood}: ${filteredData.length} properties`);
                        } else if (mappedForFilter.cd) {
                            const target = String(mappedForFilter.cd).trim();
                            filteredData = plutoDataRaw.filter(p => String(p[cdField]).trim() === target);
                            console.log(`Filtered by mapped CD ${target} for ${selectedNeighborhood}: ${filteredData.length} properties`);
                        }
                    }
                    // For Upper West Side (MN12), Community District is 107 or 107/108 (fallback if mapping absent)
                    else if (selectedNTACode === 'MN12' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
                        const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
                        filteredData = plutoDataRaw.filter(p => ['107','108'].includes(String(p[cdField]).trim())) ;
                        console.log(`Filtered by Community District 107/108 for Upper West Side: ${filteredData.length} properties`);
                    }
                    // For Upper East Side (MN40), Community District is 108
                    else if (selectedNTACode === 'MN40' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
                        const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
                        filteredData = plutoDataRaw.filter(p => String(p[cdField]).trim() === '108');
                        console.log(`Filtered by Community District 108 for Upper East Side: ${filteredData.length} properties`);
                    }
                    // For other neighborhoods, try using ZIP codes or other geographic indicators
                    else if (plutoDataRaw[0].zipcode) {
                        // We could add zip code mapping here if needed
                        console.log('Found zipcode field, but no mapping implemented for this NTA');
                    } 
                    // Last resort - keep all properties
                    else {
                        console.log('Using all properties from borough without NTA filtering');
                    }
                    
                    plutoDataRaw = filteredData;
                }
                
                // If we specifically selected Upper West Side and there's no other filtering
                if (selectedNeighborhood === 'Upper West Side' && plutoDataRaw.length > 3000) {
                    // Community Districts for Upper West Side are 107 and 108
                    const cdField = plutoDataRaw[0].cd ? 'cd' : (plutoDataRaw[0].borocd ? 'borocd' : null);
                    if (cdField) {
                        const filteredData = plutoDataRaw.filter(p => p[cdField] === '107' || p[cdField] === '108');
                        console.log(`Filtered to ${filteredData.length} properties in Upper West Side CDs (107/108)`);
                        plutoDataRaw = filteredData;
                    }
                }
                
                setProgress(p => ({ ...p, pluto: `${plutoDataRaw.length} records found` }));
                
                // If we didn't get any data, log the issue
                if (plutoDataRaw.length === 0) {
                    console.log('No PLUTO data received for where:', whereClause);
                }
            } catch (err) {
                console.error('PLUTO API error:', err.message);
                setProgress(p => ({ ...p, pluto: `Error: ${err.message}` }));
                
                // No simulated data - just show the error
                setProgress(p => ({ ...p, pluto: `Error: ${err.message}` }));
                throw err; // Re-throw to exit the processing
            }

            if (plutoDataRaw.length === 0) {
                setProgress(p => ({ ...p, pluto: 'No PLUTO data for selection.' }));
                setIsLoading(false);
                return;
            }

            // Create initial properties map from PLUTO
            // Create properties map from actual PLUTO data
            const properties = {};
            
            // Add debugging info
            console.log('First 3 PLUTO records for inspection:', plutoDataRaw.slice(0, 3));
                        
            plutoDataRaw.forEach(p => {
                // Derive a normalized 10-digit BBL
                let bblNorm = null;
                if (p.bbl) {
                    bblNorm = normalizeBBLString(p.bbl);
                }
                if (!bblNorm) {
                    // Try to build from borough/block/lot when available
                    const boro = (p.borough || p.BOROUGH || '').toString().toUpperCase();
                    const boroNum = plutoBoroughToNumeric[boro] || (p.bbl ? p.bbl[0] : null);
                    const block = p.block || p.BLOCK;
                    const lot = p.lot || p.LOT;
                    if (boroNum && block && lot) bblNorm = makeBBL(boroNum, block, lot);
                }
                if (!bblNorm) return; // skip if we cannot normalize

                properties[bblNorm] = {
                    bbl: bblNorm,
                    plutoData: p,
                    address: buildDisplayAddressFromPluto(p),
                    ntaname: p.ntaname,
                    lastSaleDate: null,
                    tenureMonths: 0,
                    score: 2.0, // Base score
                    // Placeholders for other metrics
                    permitsLast12Months: 0,
                    complaintsLast30Days: 0,
                    unusedFARPercentage: 0,
                };
            });

            if (Object.keys(properties).length === 0) {
                setProgress(p => ({ ...p, pluto: 'No properties matched after filtering.' }));
                setIsLoading(false);
                return;
            }
            console.log('Properties initialized:', Object.keys(properties).length);
            setProgress(p => ({ ...p, pluto: `${Object.keys(properties).length} properties initialized`, acris: 'loading...' }));


            // 2. Fetch ACRIS Legals and Master to determine sales history
            // This is a simplified approach. A more robust way would be to:
            //   a. Fetch Legals for all BBLs in `properties`.
            //   b. Get unique document_ids from those Legals.
            //   c. Fetch Master records for those document_ids.
            // For now, fetch recent Legals & Master for the borough and filter.

            // Extract the BBLs from the PLUTO data to make targeted queries
            const targetBBLs = Object.keys(properties);
            console.log('Target BBLs for queries:', targetBBLs.length);
            
            // Batch BBLs for query parameters to avoid URL length limits
            const createBblBatches = (bbls, batchSize = 50) => {
                const batches = [];
                for (let i = 0; i < bbls.length; i += batchSize) {
                    batches.push(bbls.slice(i, i + batchSize));
                }
                return batches;
            };
            
            // Create batches of BBLs for querying other APIs
            const bblBatches = createBblBatches(targetBBLs);
            console.log(`Created ${bblBatches.length} BBL batches for targeted queries`);
            
            // Fetch ACRIS data using a SIMPLER approach: query Master directly by borough for recent deeds
            // This avoids the Legals→Master join which creates too many batches
            console.log('Fetching ACRIS Master deeds directly by block');
            let allLegalsInArea = [];
            const docIdToBblMap = {};
            let deedMasterRecords = [];
            
            setProgress(p => ({ ...p, acris: 'fetching all deeds...' }));
            
            try {
                // Extract unique blocks from our properties
                const uniqueBlocks = [...new Set(Object.keys(properties).map(bbl => {
                    return parseInt(bbl.substring(1, 6), 10).toString(); // Unpadded block number
                }))];
                
                console.log(`Fetching ALL deeds for ${uniqueBlocks.length} blocks (no date filter)`);
                
                // Batch blocks for Master query
                const BLOCK_BATCH_SIZE = 20;
                for (let i = 0; i < uniqueBlocks.length; i += BLOCK_BATCH_SIZE) {
                    const blockBatch = uniqueBlocks.slice(i, i + BLOCK_BATCH_SIZE);
                    if (i % 60 === 0) console.log(`Fetching ACRIS deeds batch ${Math.floor(i/BLOCK_BATCH_SIZE) + 1}/${Math.ceil(uniqueBlocks.length/BLOCK_BATCH_SIZE)}`);
                    
                    // Query Legals by block to get document IDs, then we'll fetch Master
                    const blockClauses = blockBatch.map(b => `block='${b}'`).join(' OR ');
                    const where = `borough='${acrisBoroughCode}' AND (${blockClauses})`;
                    
                    try {
                        const legalsRes = await axios.get(LEGALS_ENDPOINT, {
                            params: { $where: where, $limit: 50000, $select: 'document_id,borough,block,lot' }
                        });
                        
                        // Map document IDs to BBLs
                        legalsRes.data.forEach(legal => {
                            const legalBbl = makeBBL(legal.borough, legal.block, legal.lot);
                            if (legalBbl && properties[legalBbl]) {
                                if (!docIdToBblMap[legal.document_id]) {
                                    docIdToBblMap[legal.document_id] = [];
                                }
                                if (!docIdToBblMap[legal.document_id].includes(legalBbl)) {
                                    docIdToBblMap[legal.document_id].push(legalBbl);
                                }
                            }
                        });
                        
                        allLegalsInArea = [...allLegalsInArea, ...legalsRes.data];
                    } catch (err) {
                        console.error(`Error fetching Legals block batch:`, err.message);
                    }
                    
                    if (i + BLOCK_BATCH_SIZE < uniqueBlocks.length) {
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                }
                
                console.log('ACRIS Legals received:', allLegalsInArea.length);
                console.log('Unique document IDs:', Object.keys(docIdToBblMap).length);
                setProgress(p => ({ ...p, acris: `${allLegalsInArea.length} legals, fetching deeds...` }));
                
                // Now fetch Master records - but ONLY for deed types and limit batches
                const docIds = Object.keys(docIdToBblMap);
                const DOC_BATCH_SIZE = 100; // Larger batches
                const MAX_BATCHES = 50; // Cap at 50 batches to avoid 20+ min waits
                const batchCount = Math.min(Math.ceil(docIds.length / DOC_BATCH_SIZE), MAX_BATCHES);
                
                for (let i = 0; i < Math.min(docIds.length, MAX_BATCHES * DOC_BATCH_SIZE); i += DOC_BATCH_SIZE) {
                    const batch = docIds.slice(i, i + DOC_BATCH_SIZE);
                    if (i % 500 === 0) console.log(`Fetching ACRIS Master batch ${Math.floor(i/DOC_BATCH_SIZE) + 1}/${batchCount}`);
                    
                    const docIdList = batch.map(id => `'${id}'`).join(',');
                    const where = `document_id IN(${docIdList}) AND doc_type='DEED'`;
                    
                    try {
                        const masterRes = await axios.get(MASTER_ENDPOINT, {
                            params: { $where: where, $limit: 5000 }
                        });
                        deedMasterRecords = [...deedMasterRecords, ...masterRes.data];
                    } catch (err) {
                        console.error(`Error fetching Master batch:`, err.message);
                    }
                    
                    if (i + DOC_BATCH_SIZE < docIds.length) {
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                }
                
                console.log('ACRIS Master deeds received:', deedMasterRecords.length);
                setProgress(p => ({ ...p, acris: `${allLegalsInArea.length} legals, ${deedMasterRecords.length} deeds` }));
            } catch (err) {
                console.error('Error in ACRIS processing:', err.message);
                setProgress(p => ({ ...p, acris: `Error: ${err.message}` }));
            }

            // Match deed records to properties via the document_id → BBL map
            let salesMatchCount = 0;
            let estateDeeds = 0;
            deedMasterRecords.forEach(master => {
                if (docIdToBblMap[master.document_id]) {
                    docIdToBblMap[master.document_id].forEach(bblKey => {
                        const prop = properties[bblKey];
                        if (prop) {
                            const saleDate = new Date(master.document_date);
                            // Update last sale date and deed type if this one is more recent
                            if (!prop.lastSaleDate || saleDate > new Date(prop.lastSaleDate)) {
                                prop.lastSaleDate = master.document_date;
                                prop.lastDeedType = master.doc_type || null;
                                prop.documentId = master.document_id;
                                prop.documentAmount = master.document_amt;
                                salesMatchCount++;
                                
                                // Detect estate/executor deeds (inheritance indicator)
                                const docType = (master.doc_type || '').toUpperCase();
                                const isEstateDeed = ESTATE_DEED_TYPES.some(type => docType.includes(type));
                                if (isEstateDeed) {
                                    prop.isEstateDeed = true;
                                    prop.estateDeedType = master.doc_type;
                                    estateDeeds++;
                                }
                            }
                            
                            // Store all deeds for the property (for history view)
                            prop.allDeeds = prop.allDeeds || [];
                            prop.allDeeds.push({
                                date: master.document_date,
                                type: master.doc_type,
                                amount: master.document_amt,
                                documentId: master.document_id
                            });
                        }
                    });
                }
            });
            console.log('Properties with sales data matched:', salesMatchCount);
            console.log('Estate/executor deeds detected:', estateDeeds);

            // 3. Fetch DOB Jobs data by BLOCK (much faster than address-based queries)
            setProgress(p => ({ ...p, dob: 'loading...' }));
            try {
                console.log('Fetching DOB Jobs by block');
                let allDobJobs = [];
                
                // DOB Jobs uses text borough names, not numeric codes
                const boroughCodeToText = { '1': 'MANHATTAN', '2': 'BRONX', '3': 'BROOKLYN', '4': 'QUEENS', '5': 'STATEN ISLAND' };
                const dobBoroughText = boroughCodeToText[acrisBoroughCode] || 'MANHATTAN';
                
                // Extract unique blocks from our PLUTO properties
                // DOB Jobs stores block as 5-digit zero-padded strings (e.g., '00955')
                const uniqueBlocks = [...new Set(Object.keys(properties).map(bbl => {
                    return bbl.substring(1, 6); // Already 5-digit padded in our BBL format
                }))];
                console.log(`Found ${uniqueBlocks.length} unique blocks to query for ${dobBoroughText}`);
                
                const BLOCK_BATCH_SIZE = 30;
                for (let i = 0; i < uniqueBlocks.length; i += BLOCK_BATCH_SIZE) {
                    const blockBatch = uniqueBlocks.slice(i, i + BLOCK_BATCH_SIZE);
                    if (i % 90 === 0) console.log(`Fetching DOB Jobs blocks ${i + 1}-${Math.min(i + BLOCK_BATCH_SIZE, uniqueBlocks.length)}/${uniqueBlocks.length}`);
                    
                    // Query by borough TEXT and block IN clause (blocks are 5-digit padded strings)
                    const blockList = blockBatch.map(b => `'${b}'`).join(',');
                    const where = `borough='${dobBoroughText}' AND block IN(${blockList})`;
                    
                    try {
                        const res = await axios.get(DOBJOBS_ENDPOINT, { params: { $where: where, $limit: 50000 } });
                        allDobJobs = [...allDobJobs, ...res.data];
                    } catch (err) {
                        console.error(`Error fetching DOB Jobs block batch ${Math.floor(i / BLOCK_BATCH_SIZE) + 1}:`, err.message);
                    }
                    
                    if (i + BLOCK_BATCH_SIZE < uniqueBlocks.length) {
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                }

                console.log('DOB Jobs received:', allDobJobs.length);
                
                // Match DOB jobs to properties by BBL (block + lot)
                let dobJobsMatched = 0;
                allDobJobs.forEach(job => {
                    // Build BBL from job's block and lot - pad to match our 10-digit format
                    const jobBlock = job.block ? String(job.block).replace(/[^0-9]/g, '').padStart(5, '0') : null;
                    const jobLot = job.lot ? String(job.lot).replace(/[^0-9]/g, '').padStart(4, '0') : null;
                    
                    if (jobBlock && jobLot) {
                        const jobBbl = acrisBoroughCode + jobBlock + jobLot;
                        if (properties[jobBbl]) {
                            job._unit = extractUnitFromJob(job);
                            job._displayAddress = buildDisplayAddressFromJob(job);
                            properties[jobBbl].dobJobs = properties[jobBbl].dobJobs || [];
                            properties[jobBbl].dobJobs.push(job);
                            dobJobsMatched++;
                        }
                    }
                });
                
                console.log(`DOB Jobs matched to properties: ${dobJobsMatched}`);
                setProgress(p => ({ ...p, dob: `${allDobJobs.length} records, ${dobJobsMatched} matched` }));
            } catch (err) {
                console.error('Error fetching DOB Jobs:', err.message);
                setProgress(p => ({ ...p, dob: `Error: ${err.message}` }));
                // Continue with empty data
            }
            
            // 4. Fetch 311 complaints by community board (much more reliable than BBL)
            setProgress(p => ({ ...p, 311: 'loading...' }));
            try {
                console.log('Fetching 311 complaints by community board');
                let all311Complaints = [];
                
                // Get community districts from our PLUTO properties
                const communityDistricts = [...new Set(Object.values(properties)
                    .map(p => p.plutoData?.cd)
                    .filter(cd => cd))];
                
                const createdCutoff = new Date();
                createdCutoff.setDate(createdCutoff.getDate() - 60);
                // Use simple date format without timezone (YYYY-MM-DDTHH:MM:SS) for Socrata compatibility
                const createdIso = createdCutoff.toISOString().replace('Z', '').split('.')[0];
                
                // 311 uses borough name format
                const boroughCodeToText = { '1': 'MANHATTAN', '2': 'BRONX', '3': 'BROOKLYN', '4': 'QUEENS', '5': 'STATEN ISLAND' };
                const boroughText = boroughCodeToText[acrisBoroughCode] || 'MANHATTAN';
                
                // Fetch by borough - simpler and more reliable
                console.log(`Fetching 311 for ${boroughText}, last 60 days, since ${createdIso}`);
                setProgress(p => ({ ...p, 311: 'fetching...' }));
                try {
                    const where = `created_date >= '${createdIso}' AND borough='${boroughText}'`;
                    const res = await axios.get(THREEONEONE_ENDPOINT, {
                        params: { $where: where, $limit: 50000, $select: 'unique_key,bbl,incident_address,complaint_type,created_date,borough' }
                    });
                    all311Complaints = res.data;
                    console.log(`311 complaints fetched for ${boroughText}:`, all311Complaints.length);
                } catch (err) {
                    console.error('Error fetching 311 by borough:', err.message);
                }
                
                console.log('311 complaints received:', all311Complaints.length);
                
                // Match complaints to properties by BBL
                let complaintsMatched = 0;
                all311Complaints.forEach(complaint => {
                    const bbl = complaint.bbl ? normalizeBBLString(complaint.bbl) : null;
                    if (bbl && properties[bbl]) {
                        properties[bbl].complaints = properties[bbl].complaints || [];
                        properties[bbl].complaints.push(complaint);
                        complaintsMatched++;
                    }
                });
                
                console.log('311 complaints matched:', complaintsMatched);
                Object.values(properties).forEach(prop => ensureDisplayAddressWithNumber(prop));
                setProgress(p => ({ ...p, 311: `${all311Complaints.length} records, ${complaintsMatched} matched` }));
            } catch (err) {
                console.error('Error fetching 311 complaints:', err.message);
                setProgress(p => ({ ...p, 311: `Error: ${err.message}` }));
                // Continue with empty data
            }
            
            // 5. Fetch HPD Violations (more specific than 311 for building issues)
            setProgress(p => ({ ...p, hpdViolations: 'loading...' }));
            try {
                console.log('Fetching HPD Violations by BBL');
                let allHpdViolations = [];
                
                // HPD Violations use BBL field directly
                const targetBBLsForHpd = Object.keys(properties);
                const HPD_BATCH_SIZE = 50;
                
                for (let i = 0; i < targetBBLsForHpd.length; i += HPD_BATCH_SIZE) {
                    const batch = targetBBLsForHpd.slice(i, i + HPD_BATCH_SIZE);
                    if (i % 200 === 0) {
                        console.log(`Fetching HPD Violations ${i + 1}-${Math.min(i + HPD_BATCH_SIZE, targetBBLsForHpd.length)}/${targetBBLsForHpd.length}`);
                        setProgress(p => ({ ...p, hpdViolations: `${i}/${targetBBLsForHpd.length} props...` }));
                    }
                    
                    // HPD uses 10-digit BBL format
                    const bblList = batch.map(b => `'${b}'`).join(',');
                    const where = `bbl IN(${bblList})`;
                    
                    try {
                        const res = await axios.get(HPD_VIOLATIONS_ENDPOINT, {
                            params: { $where: where, $limit: 50000, $select: 'violationid,bbl,boroid,block,lot,class,inspectiondate,approveddate,currentstatus,currentstatusdate,novdescription' }
                        });
                        allHpdViolations = [...allHpdViolations, ...res.data];
                    } catch (err) {
                        console.error(`Error fetching HPD Violations batch:`, err.message);
                    }
                    
                    if (i + HPD_BATCH_SIZE < targetBBLsForHpd.length) {
                        await new Promise(resolve => setTimeout(resolve, 80));
                    }
                }
                
                console.log('HPD Violations received:', allHpdViolations.length);
                
                // Match violations to properties - track unique properties with violations
                const propsWithViolations = new Set();
                allHpdViolations.forEach(violation => {
                    const bbl = violation.bbl ? String(violation.bbl).padStart(10, '0') : null;
                    if (bbl && properties[bbl]) {
                        properties[bbl].hpdViolations = properties[bbl].hpdViolations || [];
                        properties[bbl].hpdViolations.push(violation);
                        propsWithViolations.add(bbl);
                    }
                });
                
                console.log('HPD Violations: properties with violations:', propsWithViolations.size);
                setProgress(p => ({ ...p, hpdViolations: `${allHpdViolations.length} violations, ${propsWithViolations.size} props` }));
            } catch (err) {
                console.error('Error fetching HPD Violations:', err.message);
                setProgress(p => ({ ...p, hpdViolations: `Error: ${err.message}` }));
            }
            
            // 6. Fetch HPD Registrations (owner information for portfolio analysis)
            setProgress(p => ({ ...p, hpdRegistrations: 'loading...' }));
            const ownerPortfolio = {}; // Map owner name -> list of BBLs they own
            try {
                console.log('Fetching HPD Registrations for owner data');
                let allRegistrations = [];
                
                const targetBBLsForReg = Object.keys(properties);
                const REG_BATCH_SIZE = 20; // Smaller batches for OR-based queries
                
                // Parse BBL into components for querying (HPD uses separate boroid/block/lot fields)
                const parseBBL = (bbl) => {
                    const s = String(bbl).padStart(10, '0');
                    return { boroid: s[0], block: parseInt(s.slice(1, 6), 10), lot: parseInt(s.slice(6), 10) };
                };
                
                for (let i = 0; i < targetBBLsForReg.length; i += REG_BATCH_SIZE) {
                    const batch = targetBBLsForReg.slice(i, i + REG_BATCH_SIZE);
                    if (i % 200 === 0) {
                        console.log(`Fetching HPD Registrations ${i + 1}-${Math.min(i + REG_BATCH_SIZE, targetBBLsForReg.length)}/${targetBBLsForReg.length}`);
                        setProgress(p => ({ ...p, hpdRegistrations: `${i}/${targetBBLsForReg.length}...` }));
                    }
                    
                    // Build OR conditions for each BBL (boroid='1' AND block=123 AND lot=45)
                    const conditions = batch.map(bbl => {
                        const { boroid, block, lot } = parseBBL(bbl);
                        return `(boroid='${boroid}' AND block=${block} AND lot=${lot})`;
                    });
                    const where = conditions.join(' OR ');
                    
                    try {
                        const res = await axios.get(HPD_REGISTRATIONS_ENDPOINT, {
                            params: { $where: where, $limit: 50000, $select: 'registrationid,boroid,block,lot,housenumber,streetname,ownername,businesshousenumber,businessstreetname,businesscity,businessstate,businesszip' }
                        });
                        allRegistrations = [...allRegistrations, ...res.data];
                    } catch (err) {
                        console.error(`Error fetching HPD Registrations batch:`, err.message);
                    }
                    
                    if (i + REG_BATCH_SIZE < targetBBLsForReg.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                }
                
                console.log('HPD Registrations received:', allRegistrations.length);
                
                // Match registrations to properties and build owner portfolio
                allRegistrations.forEach(reg => {
                    const bbl = makeBBL(reg.boroid, reg.block, reg.lot);
                    if (bbl && properties[bbl]) {
                        properties[bbl].hpdRegistration = reg;
                        properties[bbl].ownerName = reg.ownername;
                        
                        // Build owner portfolio map
                        if (reg.ownername) {
                            const ownerKey = reg.ownername.toUpperCase().trim();
                            if (!ownerPortfolio[ownerKey]) {
                                ownerPortfolio[ownerKey] = [];
                            }
                            if (!ownerPortfolio[ownerKey].includes(bbl)) {
                                ownerPortfolio[ownerKey].push(bbl);
                            }
                        }
                    }
                });
                
                // Add portfolio size to each property
                Object.values(properties).forEach(prop => {
                    if (prop.ownerName) {
                        const ownerKey = prop.ownerName.toUpperCase().trim();
                        prop.ownerPortfolioSize = ownerPortfolio[ownerKey]?.length || 1;
                        prop.ownerPortfolioBBLs = ownerPortfolio[ownerKey] || [];
                    }
                });
                
                console.log('Unique owners found:', Object.keys(ownerPortfolio).length);
                setProgress(p => ({ ...p, hpdRegistrations: `${allRegistrations.length} records` }));
            } catch (err) {
                console.error('Error fetching HPD Registrations:', err.message);
                setProgress(p => ({ ...p, hpdRegistrations: `Error: ${err.message}` }));
            }
            
            // 7. Fetch ACRIS Mortgage data to identify loans that may be maturing
            setProgress(p => ({ ...p, mortgages: 'loading...' }));
            let loansMaturing = 0;
            try {
                const docIds = Object.keys(docIdToBblMap);
                console.log(`Fetching ACRIS Mortgages for ${docIds.length} document IDs`);
                let allMortgages = [];
                
                // Fetch mortgages using the same document IDs we found in Legals
                if (docIds.length > 0) {
                    const docIdBatchesMtg = createBblBatches(docIds, 50);
                    
                    for (let batchIndex = 0; batchIndex < docIdBatchesMtg.length; batchIndex++) {
                        const batch = docIdBatchesMtg[batchIndex];
                        
                        // Progress update every 10 batches
                        if (batchIndex % 10 === 0) {
                            const progress = Math.round((batchIndex / docIdBatchesMtg.length) * 100);
                            console.log(`Mortgages batch ${batchIndex + 1}/${docIdBatchesMtg.length} (${progress}%), ${allMortgages.length} found so far`);
                            setProgress(p => ({ ...p, mortgages: `${progress}% (${allMortgages.length} found)` }));
                        }
                        
                        const docIdQueryParts = batch.map(docId => `document_id='${docId}'`);
                        const docIdQueryString = docIdQueryParts.join(' OR ');
                        
                        try {
                            const mortgageRes = await axios.get(MORTGAGE_ENDPOINT, {
                                params: {
                                    $where: `(${docIdQueryString})`,
                                    $limit: 100 * batch.length
                                }
                            });
                            
                            allMortgages = [...allMortgages, ...mortgageRes.data];
                            
                            if (batchIndex < docIdBatchesMtg.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } catch (err) {
                            console.error(`Error fetching mortgages batch ${batchIndex + 1}:`, err.message);
                        }
                    }
                } else {
                    console.log('No document IDs to fetch mortgages for');
                }
                
                console.log('ACRIS Mortgages received:', allMortgages.length);
                setProgress(p => ({ ...p, mortgages: `${allMortgages.length} records` }));
                
                // Match mortgages to properties and analyze loan age
                allMortgages.forEach(mortgage => {
                    if (docIdToBblMap[mortgage.document_id]) {
                        docIdToBblMap[mortgage.document_id].forEach(bblKey => {
                            const prop = properties[bblKey];
                            if (prop) {
                                prop.mortgages = prop.mortgages || [];
                                prop.mortgages.push(mortgage);
                                
                                // Calculate mortgage age
                                if (mortgage.document_date) {
                                    const mortgageAge = timeDiffInMonths(mortgage.document_date);
                                    // Typical mortgage terms: 5, 7, 10, 15, 20, 25, 30 years
                                    // Flag if mortgage is approaching common maturity periods
                                    const yearsOld = mortgageAge / 12;
                                    
                                    // Check if mortgage is near common maturity milestones
                                    const nearMaturity = [5, 7, 10, 15, 20, 25, 30].some(term => {
                                        const diff = Math.abs(yearsOld - term);
                                        return diff <= 1; // Within 1 year of a common term
                                    });
                                    
                                    if (nearMaturity && yearsOld >= 4) {
                                        prop.loanNearMaturity = true;
                                        prop.mortgageAgeYears = Math.floor(yearsOld);
                                        loansMaturing++;
                                    }
                                    
                                    // Track oldest mortgage for the property
                                    if (!prop.oldestMortgageAge || mortgageAge > prop.oldestMortgageAge) {
                                        prop.oldestMortgageAge = mortgageAge;
                                        prop.mortgageAmount = mortgage.document_amt;
                                    }
                                }
                            }
                        });
                    }
                });
                
                console.log('Properties with maturing loans:', loansMaturing);
            } catch (err) {
                console.error('Error fetching mortgages:', err.message);
                setProgress(p => ({ ...p, mortgages: `Error: ${err.message}` }));
            }
            
            // --- METRIC CALCULATION & SCORING ---
            console.log('Beginning property scoring and filtering...');
            const processedLeads = [];
            let totalScoreSum = 0;
            
            // No mock data - using only real data from APIs
            console.log('Processing properties with real data only...');
            
            // Calculate metrics for each property
            Object.values(properties).forEach(prop => {
                // Initialize score at 1.5 base to increase spread among signals
                prop.score = 1.5;
                
                // Prepare badges container
                prop.signalBadges = [];

                // 1. LONG TENURE - SUPPORTING INDICATOR
                if (prop.lastSaleDate) {
                    prop.tenureMonths = timeDiffInMonths(prop.lastSaleDate);
                    if (typeof prop.tenureMonths === 'number') {
                        if (prop.tenureMonths > 180) { // 15+ years
                            prop.score += 0.6;
                            prop.signalBadges.push('Owned 15+ years');
                        } else if (prop.tenureMonths >= 120) { // 10+ years
                            prop.score += 0.4;
                            prop.signalBadges.push('Owned 10+ years');
                        }
                    }
                }
                // Derive owned years for display from tenure only
                if (typeof prop.tenureMonths === 'number') {
                    prop.ownedYears = Math.floor(prop.tenureMonths / 12);
                }
                
                // 4. DOB JOBS (PERMITS) - STRONG SUPPORTING INDICATOR
                if (prop.dobJobs && prop.dobJobs.length > 0) {
                    // Count jobs in the last 12 months
                    const oneYearAgo = new Date();
                    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                    
                    // Get recent jobs
                    const recentJobs = prop.dobJobs.filter(job => {
                        const jobDate = job.filing_date || job.pre_filing_date;
                        return jobDate && new Date(jobDate) >= oneYearAgo;
                    });
                    
                    prop.permitsLast12Months = recentJobs.length;
                    
                    // Store job types for review
                    prop.jobTypes = recentJobs
                        .map(job => job.job_type)
                        .filter((type, index, self) => self.indexOf(type) === index); // Unique types
                    
                    // Check for renovation/value-add job types (stronger indicators)
                    const renovationJobTypes = ['A1', 'A2', 'AL', 'DM']; // Alteration, demolition types
                    const hasRenovationJobs = recentJobs.some(job => renovationJobTypes.includes(job.job_type));
                    
                    // Add to score - More weight as per user's requirements
                    if (hasRenovationJobs && prop.permitsLast12Months > 1) {
                        // Multiple renovation jobs - very strong indicator
                        prop.score += 1.2;
                        prop.signalBadges.push('Renovations (A1/A2/DM)');
                    } else if (hasRenovationJobs) {
                        // At least one renovation job
                        prop.score += 0.9;
                        prop.signalBadges.push('Renovation Permit');
                    } else if (prop.permitsLast12Months > 2) {
                        // Multiple non-renovation jobs
                        prop.score += 0.7;
                        prop.signalBadges.push('Multiple Permits');
                    } else if (prop.permitsLast12Months >= 1) {
                        // At least one job of any type
                        prop.score += 0.4;
                        prop.signalBadges.push('Recent Permit');
                    }
                } else {
                    prop.permitsLast12Months = 0;
                    prop.jobTypes = [];
                }
                
                // 5. 311 COMPLAINTS - INDICATOR OF OWNER FATIGUE
                if (prop.complaints && prop.complaints.length > 0) {
                    // Count complaints in the last 30 days
                    const thirtyDaysAgo = new Date();
                    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                    
                    const recentComplaints = prop.complaints.filter(c => {
                        return c.created_date && new Date(c.created_date) >= thirtyDaysAgo;
                    });
                    
                    prop.complaintsLast30Days = recentComplaints.length;
                    
                    // Extract complaint types for display
                    prop.complaintTypes = recentComplaints
                        .map(c => c.complaint_type)
                        .filter((type, index, self) => self.indexOf(type) === index); // Unique types
                    
                    // Check for serious complaints that indicate property issues
                    const seriousComplaintTypes = [
                        'HEAT/HOT WATER', 'PLUMBING', 'WATER LEAK', 'NO WATER',
                        'ELECTRIC', 'ELEVATOR', 'PAINT/PLASTER', 'DOOR/WINDOW'
                    ];
                    
                    const hasSeriousComplaints = recentComplaints.some(c => 
                        seriousComplaintTypes.some(type => c.complaint_type && c.complaint_type.includes(type)));
                    
                    // Per-unit normalization using PLUTO unitsres
                    const unitsRes = parseInt((prop.plutoData && prop.plutoData.unitsres) || 0, 10);
                    const denom = Number.isFinite(unitsRes) && unitsRes > 0 ? unitsRes : 1;
                    const cpu = prop.complaintsLast30Days / denom;
                    prop.complaintsPerUnit30Days = parseFloat(cpu.toFixed(2));

                    // Add to score: +0.3 for every 5 complaints in the last 30 days (linear)
                    const steps = Math.floor(prop.complaintsLast30Days / 5);
                    if (steps > 0) {
                        const inc = parseFloat((steps * 0.3).toFixed(1));
                        prop.score += inc;
                        prop.signalBadges.push(`Complaints +${inc} (${prop.complaintsLast30Days} in 30d)`);
                    }
                    // Small extra nudge for presence of any serious complaint
                    if (hasSeriousComplaints) {
                        prop.score += 0.2;
                        prop.signalBadges.push('Serious Complaint');
                    }
                    // Extra nudge if complaints per unit is high
                    if (prop.complaintsPerUnit30Days >= 0.15) {
                        prop.score += 0.2;
                        prop.signalBadges.push('High Complaints/Unit');
                    }
                } else {
                    prop.complaintsLast30Days = 0;
                    prop.complaintTypes = [];
                }
                
                // 6. LOAN MATURITY - STRONG INDICATOR OF POTENTIAL SALE
                if (prop.loanNearMaturity) {
                    prop.score += 1.0;
                    prop.signalBadges.push(`Loan ~${prop.mortgageAgeYears}yr (near maturity)`);
                }
                // Also flag very old mortgages (20+ years) as potential refinance/sale candidates
                if (prop.oldestMortgageAge && prop.oldestMortgageAge >= 240) { // 20+ years
                    prop.score += 0.5;
                    prop.signalBadges.push('Long-held mortgage (20+ yrs)');
                }
                
                // 7. HPD VIOLATIONS - STRONG INDICATOR OF DEFERRED MAINTENANCE
                if (prop.hpdViolations && prop.hpdViolations.length > 0) {
                    // Count open violations (not yet resolved)
                    const openViolations = prop.hpdViolations.filter(v => 
                        v.currentstatus && !v.currentstatus.toUpperCase().includes('CLOSE'));
                    prop.openHpdViolations = openViolations.length;
                    prop.totalHpdViolations = prop.hpdViolations.length;
                    
                    // Class A = non-hazardous, B = hazardous, C = immediately hazardous
                    const classC = prop.hpdViolations.filter(v => v.class === 'C').length;
                    const classB = prop.hpdViolations.filter(v => v.class === 'B').length;
                    
                    prop.hpdClassC = classC;
                    prop.hpdClassB = classB;
                    
                    // Scoring based on severity
                    if (classC >= 5) {
                        prop.score += 1.5;
                        prop.signalBadges.push(`${classC} Class C Violations (Critical)`);
                    } else if (classC >= 2) {
                        prop.score += 1.0;
                        prop.signalBadges.push(`${classC} Class C Violations`);
                    } else if (classC >= 1) {
                        prop.score += 0.5;
                        prop.signalBadges.push('Class C Violation');
                    }
                    
                    if (classB >= 10) {
                        prop.score += 0.8;
                        prop.signalBadges.push(`${classB} Class B Violations`);
                    } else if (classB >= 5) {
                        prop.score += 0.4;
                        prop.signalBadges.push(`${classB} Class B Violations`);
                    }
                    
                    // High total violations indicates overwhelmed owner
                    if (prop.totalHpdViolations >= 20) {
                        prop.score += 0.5;
                        prop.signalBadges.push('High Violation Count');
                    }
                }
                
                // 8. ESTATE/EXECUTOR DEED - STRONG INDICATOR (inheritance often leads to sale)
                if (prop.isEstateDeed) {
                    prop.score += 1.5;
                    prop.signalBadges.push(`Estate Deed (${prop.estateDeedType})`);
                }
                
                // 9. FIX & FLIP PATTERN - Recent purchase + renovation = likely flip
                if (prop.tenureMonths && prop.tenureMonths <= 36) { // Purchased in last 3 years
                    const hasRenovation = prop.dobJobs && prop.dobJobs.some(job => {
                        const renovationTypes = ['A1', 'A2', 'AL', 'DM'];
                        return renovationTypes.includes(job.job_type);
                    });
                    
                    if (hasRenovation) {
                        prop.isFixAndFlip = true;
                        prop.score += 2.0;
                        prop.signalBadges.push('Fix & Flip Pattern');
                    }
                }
                
                // 10. PORTFOLIO LANDLORD - Multiple properties may indicate liquidation potential
                if (prop.ownerPortfolioSize && prop.ownerPortfolioSize >= 3) {
                    prop.isPortfolioProperty = true;
                    if (prop.ownerPortfolioSize >= 10) {
                        prop.score += 0.8;
                        prop.signalBadges.push(`Portfolio Owner (${prop.ownerPortfolioSize} properties)`);
                    } else if (prop.ownerPortfolioSize >= 5) {
                        prop.score += 0.5;
                        prop.signalBadges.push(`Portfolio Owner (${prop.ownerPortfolioSize} properties)`);
                    } else {
                        prop.score += 0.3;
                        prop.signalBadges.push(`Multi-property Owner (${prop.ownerPortfolioSize})`);
                    }
                    
                    // Extra score if portfolio owner has violations across properties
                    if (prop.hpdViolations && prop.hpdViolations.length > 0 && prop.ownerPortfolioSize >= 5) {
                        prop.score += 0.5;
                        prop.signalBadges.push('Portfolio + Violations');
                    }
                }
                
                // 11. DEVELOPMENT POTENTIAL (FAR)
                // Use PLUTO fields to estimate remaining FAR = max(residfar, commfar, facilfar) - builtfar
                {
                    const pd = prop.plutoData || {};
                    const toNum = (v) => {
                        const n = parseFloat(v);
                        return Number.isFinite(n) ? n : 0;
                    };
                    const built = toNum(pd.builtfar);
                    const allowed = Math.max(toNum(pd.residfar), toNum(pd.commfar), toNum(pd.facilfar));
                    const lotArea = toNum(pd.lotarea);
                    const remainingFAR = allowed - built;
                    if (lotArea >= 2000) {
                        if (remainingFAR >= 8) {
                            prop.score += 4.0;
                            prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)} (8+)`);
                        } else if (remainingFAR >= 5) {
                            prop.score += 2.0;
                            prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)} (5+)`);
                        } else if (remainingFAR >= 2) {
                            prop.score += 0.5;
                            prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)}`);
                        }
                    }
                }
                
                // Round score to one decimal place
                prop.score = parseFloat(prop.score.toFixed(1));
                
                // We want to show ALL properties from the targeted NTA
                // We're already filtering properly by location, so include all properties
                // Only minimal filtering to ensure property has an address
                if (prop.address) {
                    // If no specific indicators were found, still show the property but
                    // with just the base score (2.0)
                    
                    // Keep scores driven by specific signals above; remove generic boost
                    
                    // Add to the processed leads list - we want all properties
                    processedLeads.push(prop);
                    totalScoreSum += prop.score;
                }
            });
            
            // Sort by score and limit for performance
            processedLeads.sort((a, b) => b.score - a.score);
            
            // NEVER use sample data - we should have real properties already
            console.log('Using real properties only, no sample data fallback');
            
            // Limit to top N for performance (increase from 50 to 200)
            const MAX_LEADS = 200;
            const displayLeads = processedLeads.slice(0, MAX_LEADS);
            
            console.log('Final leads count:', displayLeads.length);
            setLeads(displayLeads);
            const avgScore = displayLeads.length > 0 ? 
                parseFloat((displayLeads.reduce((sum, p) => sum + (p.score || 0), 0) / displayLeads.length).toFixed(1)) : 
                0;
            const flaggedCount = processedLeads.filter(p => (p.score || 0) >= 3.0).length;
                
            setStats({
                likelySellers: flaggedCount,
                avgScore: avgScore,
                loansMaturing: loansMaturing,
                displayedLeads: displayLeads.length,
                totalAnalyzed: processedLeads.length,
            });
            
            // Provide detailed analysis summary
            setProgress(p => ({
                ...p,
                analysis: `Complete: Found ${displayLeads.length} leads (${flaggedCount} scored ≥ 3.0)`
            }));
        } finally {
            setIsLoading(false);
        }
    }, [selectedBorough, selectedNeighborhood]);

    useEffect(() => {
        fetchDataAndProcess();
    }, [fetchDataAndProcess]); // Re-run when selection changes

    const reRunNow = useCallback(() => fetchDataAndProcess(true), [fetchDataAndProcess]);

    return { 
        leads, 
        isLoading, 
        error, 
        stats, 
        progress, 
        refreshData: fetchDataAndProcess,
        reRunNow,
        isFromCache,
        cacheLastUpdated,
    };
}
