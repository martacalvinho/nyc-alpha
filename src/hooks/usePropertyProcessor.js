import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

// --- API Endpoints (NYC Open Data) ---
// Using the most recent MapPLUTO dataset
const PLUTO_ENDPOINT = 'https://data.cityofnewyork.us/resource/64uk-42ks.json'; // MapPLUTO
const LEGALS_ENDPOINT = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json'; // ACRIS Legals
const MASTER_ENDPOINT = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json'; // ACRIS Master
const MORTGAGE_ENDPOINT = 'https://data.cityofnewyork.us/resource/qjp4-ri2f.json'; // ACRIS Mortgages
const DOBJOBS_ENDPOINT = 'https://data.cityofnewyork.us/resource/hir8-3a8d.json'; // DOB Jobs
const THREEONEONE_ENDPOINT = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json'; // 311 Complaints

// --- Helper Functions ---
function makeBBL(boroughCode, block, lot) {
    // Assumes boroughCode is already '1' for Manhattan, '2' for Bronx etc.
    if (!boroughCode || !block || !lot || String(boroughCode).length !== 1) return null;
    return String(boroughCode) + String(block).padStart(5, '0') + String(lot).padStart(4, '0');
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
        likelySellers: 0, avgScore: 0, loansMaturing: 0, // Other stats will be 0 for now
    });
    const [progress, setProgress] = useState({});

    const fetchDataAndProcess = useCallback(async () => {
        console.log('fetchDataAndProcess called with:', { selectedBorough, selectedNeighborhood });
        
        if (!selectedNeighborhood || selectedNeighborhood === 'All Manhattan' || !selectedBorough) {
            console.log('No neighborhood selected, skipping data fetch');
            setLeads([]);
            setStats({ likelySellers: 0, avgScore: 0, loansMaturing: 0 });
            setProgress({});
            setIsLoading(false);
            return;
        }
        
        console.log('Processing selection:', { selectedBorough, neighborhood: selectedNeighborhood, ntaCode: selectedNTACode });

        setIsLoading(true);
        setError(null);
        setLeads([]);
        setProgress({ pluto: 'loading...', acris: 'pending...' });

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
            
            // Get data for the specific neighborhood when possible
            const plutoParams = {
                borough: boroughCode,
                $limit: 5000 // Get more data to increase chances of matches
            };
            
            // Add NTA filter if a specific neighborhood is selected
            if (selectedNTACode) {
                // Let's not use direct field filtering since we're not sure of the exact field name
                // Instead, use the borough filter to get all properties in the borough
                // We'll filter by NTA code client-side after fetching the data
                console.log(`Will filter client-side for NTA code: ${selectedNTACode}`);
            } else if (selectedNeighborhood && selectedNeighborhood !== 'All Manhattan') {
                // For neighborhood name, same approach - just get borough data and filter after
                console.log(`Will filter client-side for neighborhood: ${selectedNeighborhood}`);
            }
            
            console.log('Using PLUTO params:', plutoParams);
            console.log('Fetching PLUTO data for:', selectedNeighborhood);
            console.log('Fetching PLUTO data with URL:', PLUTO_ENDPOINT);
            let plutoDataRaw = [];
            try {
                const plutoRes = await axios.get(PLUTO_ENDPOINT, { params: plutoParams });
                plutoDataRaw = plutoRes.data;
                console.log('PLUTO data received:', plutoDataRaw.length, 'records');
                
                // Debug the PLUTO data structure
                if (plutoDataRaw.length > 0) {
                    console.log('First PLUTO record fields:', Object.keys(plutoDataRaw[0]));
                    console.log('Sample PLUTO record:', plutoDataRaw[0]);
                }
                
                // If we have NTA code or neighborhood, filter the data client-side
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
                    
                    // For Upper West Side (MN12), Community District is 107 or 107/108
                    if (selectedNTACode === 'MN12' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
                        const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
                        filteredData = plutoDataRaw.filter(p => p[cdField] === '107' || p[cdField] === '108');
                        console.log(`Filtered by Community District 107/108 for Upper West Side: ${filteredData.length} properties`);
                    }
                    // For Upper East Side (MN40), Community District is 108
                    else if (selectedNTACode === 'MN40' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
                        const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
                        filteredData = plutoDataRaw.filter(p => p[cdField] === '108');
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
                    console.log('No PLUTO data received for params:', plutoParams);
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
                // Ensure BBL is valid
                if (p.bbl) {
                    properties[p.bbl] = {
                        bbl: p.bbl,
                        plutoData: p,
                        address: p.address, // Assuming 'address' field exists in your PLUTO data
                        ntaname: p.ntaname,
                        lastSaleDate: null,
                        tenureMonths: 0,
                        score: 2.0, // Base score
                        // Placeholders for other metrics
                        permitsLast12Months: 0,
                        complaintsLast30Days: 0,
                        unusedFARPercentage: 0,
                        loanMaturityDate: null,
                        daysToLoanMaturity: Infinity,
                    };
                }
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
            
            // Fetch ACRIS Legals data using the target BBLs
            console.log('Fetching ACRIS Legals for target BBLs');
            let allLegalsInArea = [];
            const docIdToBblMap = {};
            
            setProgress(p => ({ ...p, acris: 'fetching legals by BBLs...' }));
            
            try {
                // Process each batch to avoid overwhelming the API
                for (let batchIndex = 0; batchIndex < bblBatches.length; batchIndex++) {
                    const batch = bblBatches[batchIndex];
                    
                    // Create BBL components for ACRIS query ($where needs borough, block, lot)
                    const bblQueryParts = batch.map(bbl => {
                        const borough = bbl.substring(0, 1);
                        const block = parseInt(bbl.substring(1, 6), 10);
                        const lot = parseInt(bbl.substring(6, 10), 10);
                        return `(borough='${borough}' AND block='${block}' AND lot='${lot}')`;
                    });
                    
                    const bblQueryString = bblQueryParts.join(' OR ');
                    
                    // Only proceed if we have a valid query
                    if (bblQueryString) {
                        try {
                            console.log(`Fetching ACRIS Legals batch ${batchIndex + 1}/${bblBatches.length}`);
                            const legalsRes = await axios.get(LEGALS_ENDPOINT, {
                                params: {
                                    $where: bblQueryString,
                                    $limit: 100 * batch.length // Adjust limit based on batch size
                                }
                            });
                            
                            allLegalsInArea = [...allLegalsInArea, ...legalsRes.data];
                            console.log(`Batch ${batchIndex + 1}: Got ${legalsRes.data.length} ACRIS Legals records`);
                            
                            // Add a small delay between batches to avoid rate limiting
                            if (batchIndex < bblBatches.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } catch (err) {
                            console.error(`Error fetching ACRIS Legals batch ${batchIndex + 1}:`, err.message);
                        }
                    }
                }
                
                console.log('ACRIS Legals received:', allLegalsInArea.length);
                setProgress(p => ({ ...p, acris: `${allLegalsInArea.length} legals fetched` }));
                
                // Create a map of document_id to BBL from Legals for properties we care about
                allLegalsInArea.forEach(legal => {
                    const legalBbl = makeBBL(legal.borough, legal.block, legal.lot);
                    if (legalBbl && properties[legalBbl]) {
                        if (!docIdToBblMap[legal.document_id]) {
                            docIdToBblMap[legal.document_id] = [];
                        }
                        docIdToBblMap[legal.document_id].push(legalBbl);
                    }
                });
            } catch (err) {
                console.error('Error in ACRIS Legals processing:', err.message);
                setProgress(p => ({ ...p, acris: `Error: ${err.message}` }));
            }
            console.log('Relevant document IDs found:', Object.keys(docIdToBblMap).length);

            // Fetch Master records for the specific document IDs we found in Legals
            console.log('Relevant document IDs found:', Object.keys(docIdToBblMap).length);
            
            let deedMasterRecords = [];
            
            if (Object.keys(docIdToBblMap).length > 0) {
                setProgress(p => ({ ...p, acris: `${allLegalsInArea.length} legals, fetching deeds...` }));
                
                // Batch the document IDs for the Master query
                const docIdBatches = createBblBatches(Object.keys(docIdToBblMap), 50);
                
                for (let batchIndex = 0; batchIndex < docIdBatches.length; batchIndex++) {
                    const batch = docIdBatches[batchIndex];
                    const docIdQueryParts = batch.map(docId => `document_id='${docId}'`);
                    const docIdQueryString = docIdQueryParts.join(' OR ');
                    
                    try {
                        console.log(`Fetching ACRIS Master batch ${batchIndex + 1}/${docIdBatches.length}`);
                        const masterRes = await axios.get(MASTER_ENDPOINT, {
                            params: {
                                $where: docIdQueryString,
                                $limit: 100 * batch.length,
                                doc_type: 'DEED' // Focus on actual sales
                            }
                        });
                        
                        deedMasterRecords = [...deedMasterRecords, ...masterRes.data];
                        console.log(`Batch ${batchIndex + 1}: Got ${masterRes.data.length} ACRIS Master records`);
                        
                        // Add a small delay between batches
                        if (batchIndex < docIdBatches.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (err) {
                        console.error(`Error fetching ACRIS Master batch ${batchIndex + 1}:`, err.message);
                    }
                }
                
                console.log('ACRIS Master records received:', deedMasterRecords.length);
                setProgress(p => ({ ...p, acris: `${allLegalsInArea.length} legals, ${deedMasterRecords.length} deeds fetched` }));
            } else {
                console.log('No document IDs found, skipping Master records fetch');
                setProgress(p => ({ ...p, acris: 'No matching document IDs found' }));
            }
            
            // Fetch mortgage data from ACRIS
            console.log('Fetching ACRIS Mortgage records...');
            setProgress(p => ({ ...p, mortgages: 'loading...' }));
            let mortgageRecords = [];
            try {
                // Get the document IDs we found from master records
                const relevantDocumentIds = deedMasterRecords
                    .filter(master => docIdToBblMap[master.document_id])
                    .map(master => master.document_id);
                
                console.log('Relevant document IDs for mortgages:', relevantDocumentIds.length);
                
                // If we have document IDs to search for
                if (relevantDocumentIds.length > 0) {
                    // Batch the requests to avoid overwhelming the API
                    const BATCH_SIZE = 25;
                    const batches = [];
                    
                    // Create batches of document IDs
                    for (let i = 0; i < relevantDocumentIds.length; i += BATCH_SIZE) {
                        batches.push(relevantDocumentIds.slice(i, i + BATCH_SIZE));
                    }
                    
                    console.log(`Processing ${batches.length} batches of mortgage requests`);
                    
                    // Process each batch sequentially to avoid rate limits
                    for (let i = 0; i < batches.length; i++) {
                        const batch = batches[i];
                        const batchQuery = batch.map(id => `document_id='${id}'`).join(' OR ');
                        
                        try {
                            const mortgageRes = await axios.get(MORTGAGE_ENDPOINT, {
                                params: {
                                    $limit: 100,
                                    $where: batchQuery
                                }
                            });
                            
                            // Add the results to our mortgage records
                            mortgageRecords = [...mortgageRecords, ...mortgageRes.data];
                            console.log(`Batch ${i+1}/${batches.length}: got ${mortgageRes.data.length} mortgages`);
                            
                            // Brief delay to avoid rate limiting
                            if (i < batches.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 100));
                            }
                        } catch (err) {
                            console.error(`Error in mortgage batch ${i+1}:`, err.message);
                        }
                    }
                    
                    console.log(`Total mortgage records fetched: ${mortgageRecords.length}`);
                    setProgress(p => ({ ...p, mortgages: `${mortgageRecords.length} records fetched` }));
                } else {
                    console.log('No relevant document IDs for mortgages');
                    setProgress(p => ({ ...p, mortgages: 'No relevant document IDs found' }));
                }
            } catch (err) {
                console.error('Error fetching mortgage data:', err.message);
                setProgress(p => ({ ...p, mortgages: `Error: ${err.message}` }));
            }

            // Match deed records to properties via the document_id → BBL map
            let salesMatchCount = 0;
            deedMasterRecords.forEach(master => {
                if (docIdToBblMap[master.document_id]) {
                    docIdToBblMap[master.document_id].forEach(bblKey => {
                        const prop = properties[bblKey];
                        if (prop) {
                            const saleDate = new Date(master.document_date);
                            // Update last sale date if this one is more recent
                            if (!prop.lastSaleDate || saleDate > new Date(prop.lastSaleDate)) {
                                prop.lastSaleDate = master.document_date;
                                prop.documentId = master.document_id; // Store document ID for mortgage matching
                                salesMatchCount++;
                            }
                        }
                    });
                }
            });
            console.log('Properties with sales data matched:', salesMatchCount);
            
            // Organize mortgage and foreclosure data by BBL
            // We'll directly use BBL instead of document ID for matching
            const bblToMortgagesMap = {};
            const bblToForeclosuresMap = {};
            
            mortgageRecords.forEach(record => {
                if (!record.bbl) return; // Skip if no BBL
                
                const normalizedBBL = record.bbl.replace(/-/g, ''); // Remove dashes if present
                
                // Check if it's a mortgage or a foreclosure notice
                if (record.doc_type && (record.doc_type.includes('MORTGAGE') || record.doc_type.includes('MTG'))) {
                    // It's a mortgage
                    if (!bblToMortgagesMap[normalizedBBL]) {
                        bblToMortgagesMap[normalizedBBL] = [];
                    }
                    bblToMortgagesMap[normalizedBBL].push(record);
                } else if (record.doc_type && (record.doc_type === 'LIS PENDENS' || record.doc_type === 'NOTICE OF PENDENCY')) {
                    // It's a foreclosure notice
                    if (!bblToForeclosuresMap[normalizedBBL]) {
                        bblToForeclosuresMap[normalizedBBL] = [];
                    }
                    bblToForeclosuresMap[normalizedBBL].push(record);
                }
            });
            
            // Now match mortgages and foreclosures to properties
            let mortgageMatchCount = 0;
            let foreclosureMatchCount = 0;
            
            Object.values(properties).forEach(prop => {
                // Match mortgages by BBL
                if (bblToMortgagesMap[prop.bbl]) {
                    prop.mortgages = bblToMortgagesMap[prop.bbl];
                    mortgageMatchCount++;
                    
                    // Find most recent mortgage with maturity date
                    const mortgagesWithMaturity = prop.mortgages
                        .filter(m => m.good_through_date)
                        .sort((a, b) => new Date(b.document_date) - new Date(a.document_date));
                    
                    if (mortgagesWithMaturity.length > 0) {
                        const latestMortgage = mortgagesWithMaturity[0];
                        prop.mortgageDate = latestMortgage.document_date;
                        prop.mortgageMaturityDate = latestMortgage.good_through_date;
                    }
                }
                
                // Match foreclosures by BBL
                if (bblToForeclosuresMap[prop.bbl]) {
                    prop.foreclosures = bblToForeclosuresMap[prop.bbl];
                    foreclosureMatchCount++;
                    
                    // Find most recent foreclosure notice
                    prop.foreclosures.sort((a, b) => new Date(b.document_date) - new Date(a.document_date));
                    prop.latestForeclosureDate = prop.foreclosures[0].document_date;
                }
                
                // If we have mortgage data but no sale date, use mortgage date as sale date
                if (!prop.lastSaleDate && prop.mortgageDate) {
                    prop.lastSaleDate = prop.mortgageDate;
                }
            });
            
            console.log('Properties with mortgage data matched:', mortgageMatchCount);
            console.log('Properties with foreclosure data matched:', foreclosureMatchCount);
            
            // 3. Fetch DOB Jobs data
            setProgress(p => ({ ...p, dob: 'loading...' }));
            try {
                console.log('Fetching DOB Jobs for target BBLs');
                let allDobJobs = [];
                
                // Use the same BBL batches to query DOB jobs
                for (let batchIndex = 0; batchIndex < bblBatches.length; batchIndex++) {
                    const batch = bblBatches[batchIndex];
                    
                    // Convert BBLs to DOB format (which uses text borough, block, lot)
                    const boroughMap = { '1': 'MANHATTAN', '2': 'BRONX', '3': 'BROOKLYN', '4': 'QUEENS', '5': 'STATEN ISLAND' };
                    
                    const dobQueryParts = batch.map(bbl => {
                        const boroughCode = bbl.substring(0, 1);
                        const boroughText = boroughMap[boroughCode];
                        const block = parseInt(bbl.substring(1, 6), 10).toString();
                        const lot = parseInt(bbl.substring(6, 10), 10).toString();
                        return `(borough='${boroughText}' AND block='${block}' AND lot='${lot}')`;
                    });
                    
                    const dobQueryString = dobQueryParts.join(' OR ');
                    
                    try {
                        console.log(`Fetching DOB Jobs batch ${batchIndex + 1}/${bblBatches.length}`);
                        const dobJobsRes = await axios.get(DOBJOBS_ENDPOINT, {
                            params: {
                                $where: dobQueryString,
                                $limit: 50 * batch.length
                            }
                        });
                        
                        allDobJobs = [...allDobJobs, ...dobJobsRes.data];
                        console.log(`Batch ${batchIndex + 1}: Got ${dobJobsRes.data.length} DOB Jobs`);
                        
                        // Add a small delay between batches
                        if (batchIndex < bblBatches.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (err) {
                        console.error(`Error fetching DOB Jobs batch ${batchIndex + 1}:`, err.message);
                    }
                }
                
                console.log('DOB Jobs received:', allDobJobs.length);
                const dobJobsRes = { data: allDobJobs };
                
                const dobJobs = dobJobsRes.data;
                console.log('DOB Jobs received:', dobJobs.length);
                
                // Match DOB jobs to properties
                // Map DOB borough text names to numeric codes
                const dobBoroughToNumeric = {
                    'MANHATTAN': '1',
                    'BRONX': '2',
                    'BROOKLYN': '3',
                    'QUEENS': '4',
                    'STATEN ISLAND': '5'
                };
                
                let dobJobsMatched = 0;
                dobJobs.forEach(job => {
                    // Try to construct BBL from job data
                    if (job.block && job.lot && job.borough) {
                        // Convert text borough to numeric code
                        const numericJobBorough = dobBoroughToNumeric[job.borough.toUpperCase()];
                        
                        if (numericJobBorough) {
                            const jobBbl = makeBBL(numericJobBorough, job.block, job.lot);
                            if (jobBbl && properties[jobBbl]) {
                                // If we have jobs.length property, use it, otherwise init to 1
                                properties[jobBbl].dobJobs = properties[jobBbl].dobJobs || [];
                                properties[jobBbl].dobJobs.push(job);
                                dobJobsMatched++;
                            }
                        }
                    }
                });
                
                console.log(`DOB Jobs matched to properties: ${dobJobsMatched}`);
                
                setProgress(p => ({ ...p, dob: `${dobJobs.length} records processed` }));
            } catch (err) {
                console.error('Error fetching DOB Jobs:', err.message);
                setProgress(p => ({ ...p, dob: `Error: ${err.message}` }));
                // Continue with empty data
            }
            
            // 4. Fetch 311 complaints
            setProgress(p => ({ ...p, 311: 'loading...' }));
            try {
                console.log('Fetching 311 complaints for target BBLs');
                let all311Complaints = [];
                
                // Use the same BBL batches to query 311 complaints
                for (let batchIndex = 0; batchIndex < bblBatches.length; batchIndex++) {
                    const batch = bblBatches[batchIndex];
                    
                    // 311 dataset has direct BBL field we can use
                    const bblQueryParts = batch.map(bbl => `bbl='${bbl}'`);
                    const bblQueryString = bblQueryParts.join(' OR ');
                    
                    try {
                        console.log(`Fetching 311 complaints batch ${batchIndex + 1}/${bblBatches.length}`);
                        const threeoneoneRes = await axios.get(THREEONEONE_ENDPOINT, {
                            params: {
                                $where: bblQueryString,
                                $limit: 50 * batch.length
                            }
                        });
                        
                        all311Complaints = [...all311Complaints, ...threeoneoneRes.data];
                        console.log(`Batch ${batchIndex + 1}: Got ${threeoneoneRes.data.length} 311 complaints`);
                        
                        // Add a small delay between batches
                        if (batchIndex < bblBatches.length - 1) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    } catch (err) {
                        console.error(`Error fetching 311 complaints batch ${batchIndex + 1}:`, err.message);
                    }
                }
                
                console.log('311 complaints received:', all311Complaints.length);
                const threeoneoneRes = { data: all311Complaints };
                
                const complaints = threeoneoneRes.data;
                console.log('311 complaints received:', complaints.length);
                
                // Link complaints to properties by BBL when available, then fallback to address matching
                let complaintsMatched = 0;
                complaints.forEach(complaint => {
                    // Try BBL matching first (more accurate)
                    if (complaint.bbl && properties[complaint.bbl]) {
                        const prop = properties[complaint.bbl];
                        prop.complaints = prop.complaints || [];
                        prop.complaints.push(complaint);
                        complaintsMatched++;
                    } 
                    // Fallback to address matching if BBL not available or no match found
                    else if (complaint.incident_address) {
                        Object.values(properties).forEach(prop => {
                            if (prop.address && complaint.incident_address.toUpperCase().includes(prop.address.toUpperCase())) {
                                // Initialize complaints array if needed
                                prop.complaints = prop.complaints || [];
                                prop.complaints.push(complaint);
                                complaintsMatched++;
                            }
                        });
                    }
                });
                
                console.log('311 complaints matched to properties:', complaintsMatched);
                setProgress(p => ({ ...p, 311: `${complaints.length} records (${complaintsMatched} matched)` }));
            } catch (err) {
                console.error('Error fetching 311 complaints:', err.message);
                setProgress(p => ({ ...p, 311: `Error: ${err.message}` }));
                // Continue with empty data
            }
            
            // --- METRIC CALCULATION & SCORING ---
            console.log('Beginning property scoring and filtering...');
            const processedLeads = [];
            let totalScoreSum = 0;
            let loansMaturing = 0;
            
            // No mock data - using only real data from APIs
            console.log('Processing properties with real data only...');
            
            // Calculate metrics for each property
            Object.values(properties).forEach(prop => {
                // Initialize score at 2.0 base
                prop.score = 2.0;
                
                // 1. PRE-FORECLOSURE NOTICES (LIS PENDENS) - HIGHEST PRIORITY INDICATOR
                if (prop.foreclosures && prop.foreclosures.length > 0) {
                    // Pre-foreclosure is a very strong indicator of a distressed seller
                    const daysFromLastForeclosure = timeDiffInMonths(prop.latestForeclosureDate) * 30;
                    
                    // Recent pre-foreclosure notices are extremely strong indicators
                    if (daysFromLastForeclosure <= 90) {
                        prop.score += 2.5; // Highest score boost
                        prop.hasRecentForeclosure = true;
                    } else if (daysFromLastForeclosure <= 180) {
                        prop.score += 2.0;
                        prop.hasRecentForeclosure = true;
                    } else {
                        prop.score += 1.0; // Older but still relevant
                        prop.hasRecentForeclosure = false;
                    }
                }
                
                // 2. MORTGAGE MATURITY - VERY HIGH PRIORITY INDICATOR
                // Calculate months left on mortgage
                if (prop.mortgageMaturityDate) {
                    // Make sure the mortgage date is valid
                    const maturityDate = new Date(prop.mortgageMaturityDate);
                    if (!isNaN(maturityDate.getTime())) {
                        // Valid date - calculate months left
                        prop.mortgageMonthsLeft = monthsLeftUntil(prop.mortgageMaturityDate);
                        
                        // If the mortgage is close to maturity, increase score
                        if (prop.mortgageMonthsLeft !== null) {
                            if (prop.mortgageMonthsLeft <= 6 && prop.mortgageMonthsLeft >= 0) {
                                // Mortgage due within 6 months - very high priority
                                prop.score += 1.8;
                                loansMaturing++;
                                prop.loanMaturingSoon = true;
                            } else if (prop.mortgageMonthsLeft <= 12 && prop.mortgageMonthsLeft > 6) {
                                // Mortgage due within 7-12 months - high priority
                                prop.score += 1.4;
                                loansMaturing++;
                                prop.loanMaturingSoon = true;
                            } else if (prop.mortgageMonthsLeft < 0) {
                                // Mortgage already past due - extremely high priority
                                prop.score += 2.0;
                                loansMaturing++;
                                prop.loanPastDue = true;
                            }
                        }
                    } else {
                        // Invalid date - clear the property
                        prop.mortgageMaturityDate = null;
                    }
                }
                
                // 3. LONG TENURE - SUPPORTING INDICATOR
                if (prop.lastSaleDate) {
                    prop.tenureMonths = timeDiffInMonths(prop.lastSaleDate);
                    
                    // Long tenure increases likelihood of selling
                    if (prop.tenureMonths > 180) { // 15+ years
                        prop.score += 0.6;
                    } else if (prop.tenureMonths >= 120) { // 10+ years
                        prop.score += 0.4;
                    }
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
                    } else if (hasRenovationJobs) {
                        // At least one renovation job
                        prop.score += 0.9;
                    } else if (prop.permitsLast12Months > 2) {
                        // Multiple non-renovation jobs
                        prop.score += 0.7;
                    } else if (prop.permitsLast12Months >= 1) {
                        // At least one job of any type
                        prop.score += 0.4;
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
                    
                    // Add to score based on complaint severity and count
                    if (hasSeriousComplaints && prop.complaintsLast30Days > 2) {
                        // Multiple serious complaints - very strong indicator of fatigue
                        prop.score += 1.0;
                    } else if (hasSeriousComplaints) {
                        // At least one serious complaint
                        prop.score += 0.7;
                    } else if (prop.complaintsLast30Days > 2) {
                        // Multiple non-serious complaints
                        prop.score += 0.6;
                    } else if (prop.complaintsLast30Days >= 1) {
                        // At least one complaint of any type
                        prop.score += 0.3;
                    }
                } else {
                    prop.complaintsLast30Days = 0;
                    prop.complaintTypes = [];
                }
                
                // 6. DEVELOPMENT POTENTIAL (FAR)
                if (prop.builtfar && prop.residfar && prop.residfar > 0) {
                    // Calculate remaining development potential
                    const remainingFAR = prop.residfar;
                    if (remainingFAR > 2) {
                        // Significant development potential
                        prop.score += 0.5;
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
                    
                    // Make DOB jobs and complaints stronger indicators since ACRIS data is limited
                    if (prop.permitsLast12Months > 0 || prop.complaintsLast30Days > 0) {
                        // Boost score for permits and complaints
                        prop.score += 0.5;
                    }
                    
                    // Add to the processed leads list - we want all properties
                    processedLeads.push(prop);
                    totalScoreSum += prop.score;
                }
            });
            
            // Take the top 50 leads by score or all if fewer than 50
            processedLeads.sort((a, b) => b.score - a.score);
            
            // NEVER use sample data - we should have real properties already
            console.log('Using real properties only, no sample data fallback');
            
            // Limit to top 50 for performance
            const displayLeads = processedLeads.slice(0, 50);
            
            console.log('Final leads count:', displayLeads.length);
            setLeads(displayLeads);
            const avgScore = displayLeads.length > 0 ? 
                parseFloat(((totalScoreSum || displayLeads.length * 2.0) / displayLeads.length).toFixed(1)) : 
                0;
                
            setStats({
                likelySellers: processedLeads.length || displayLeads.length,
                avgScore: avgScore,
                loansMaturing: loansMaturing, // Use the count of loans maturing we calculated
            });
            
            // Provide detailed analysis summary
            setProgress(p => ({
                ...p,
                mortgages: `${mortgageRecords.length} records, ${mortgageMatchCount} matched, ${loansMaturing} maturing`,
                analysis: `Complete: Found ${displayLeads.length} leads (${loansMaturing} with maturing loans)`
            }));
        } finally {
            setIsLoading(false);
        }
    }, [selectedBorough, selectedNeighborhood]);

    useEffect(() => {
        fetchDataAndProcess();
    }, [fetchDataAndProcess]); // Re-run when selection changes

    return { leads, isLoading, error, stats, progress, refreshData: fetchDataAndProcess };
}
