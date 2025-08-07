const axios = require('axios');

// --- API Endpoints (NYC Open Data) ---
const PLUTO_ENDPOINT = 'https://data.cityofnewyork.us/resource/64uk-42ks.json'; // MapPLUTO
const LEGALS_ENDPOINT = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json'; // ACRIS Legals
const MASTER_ENDPOINT = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json'; // ACRIS Master
const DOBJOBS_ENDPOINT = 'https://data.cityofnewyork.us/resource/hir8-3a8d.json'; // DOB Jobs
const THREEONEONE_ENDPOINT = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json'; // 311 Complaints

// Helper utilities (duplicated from hook for Node runtime)
function makeBBL(boroughCode, block, lot) {
  if (!boroughCode || !block || !lot || String(boroughCode).length !== 1) return null;
  return String(boroughCode) + String(block).padStart(5, '0') + String(lot).padStart(4, '0');
}
function normalizeBBLString(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (digits.length >= 10) return digits.slice(0, 10);
  return null;
}
const boroughTextToNumeric = {
  'MANHATTAN': '1', 'MN': '1', 'NY': '1',
  'BRONX': '2', 'BX': '2', 'BRX': '2',
  'BROOKLYN': '3', 'BKLYN': '3', 'BK': '3', 'KINGS': '3',
  'QUEENS': '4', 'QNS': '4',
  'STATEN ISLAND': '5', 'STATEN IS': '5', 'SI': '5', 'RICHMOND': '5'
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
  if (p.address) return String(p.address).trim();
  return [num, st].filter(Boolean).join(' ').trim();
}

// Main processor
// params: { borough: 'manhattan', neighborhood: 'Upper West Side', ntaCode: 'MN12' }
async function processNeighborhood(params, log = console) {
  const selectedBorough = params?.borough;
  const selectedNeighborhood = params?.neighborhood;
  const selectedNTACode = params?.ntaCode;

  const acrisBoroughCode = { manhattan: '1', bronx: '2', brooklyn: '3', queens: '4', 'staten island': '5' }[String(selectedBorough || '').toLowerCase()];
  if (!acrisBoroughCode) throw new Error('Invalid borough');

  const progress = {};

  // 1) Fetch PLUTO for borough and filter by NTA/CD if available
  const boroughCodes = { manhattan: 'MN', bronx: 'BX', brooklyn: 'BK', queens: 'QN', 'staten island': 'SI' };
  const boroughCode = boroughCodes[String(selectedBorough).toLowerCase()];
  const whereClauses = [`borough='${boroughCode}'`];
  const whereClause = whereClauses.join(' AND ');
  const PAGE_LIMIT = 50000;
  let plutoDataRaw = [];
  let page = 0; let offset = 0;
  while (true) {
    const params = { $limit: PAGE_LIMIT, $offset: offset, $where: whereClause };
    const res = await axios.get(PLUTO_ENDPOINT, { params });
    const rows = res.data || [];
    plutoDataRaw = plutoDataRaw.concat(rows);
    if (rows.length < PAGE_LIMIT) break;
    offset += PAGE_LIMIT;
    await new Promise(r => setTimeout(r, 100));
  }
  progress.pluto = `${plutoDataRaw.length} records found`;

  if (selectedNTACode && plutoDataRaw.length > 0) {
    // Basic client-side NTA filter using cd / borocd for key NTAs we know
    if (selectedNTACode === 'MN12' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
      const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
      plutoDataRaw = plutoDataRaw.filter(p => ['107','108'].includes(String(p[cdField]).trim()));
    } else if (selectedNTACode === 'MN40' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
      const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
      plutoDataRaw = plutoDataRaw.filter(p => String(p[cdField]).trim() === '108');
    } else if (selectedNTACode === 'MN24' && (plutoDataRaw[0].cd || plutoDataRaw[0].borocd)) {
      const cdField = plutoDataRaw[0].cd ? 'cd' : 'borocd';
      const name = String(selectedNeighborhood || '').toLowerCase();
      if (name.includes('tribeca') || name.includes('civic center')) {
        plutoDataRaw = plutoDataRaw.filter(p => String(p[cdField]).trim() === '101');
      } else if (name.includes('soho') || name.includes('little italy')) {
        plutoDataRaw = plutoDataRaw.filter(p => String(p[cdField]).trim() === '102');
      } else {
        plutoDataRaw = plutoDataRaw.filter(p => ['101','102'].includes(String(p[cdField]).trim()));
      }
    }
  }

  // Properties map
  const properties = {};
  plutoDataRaw.forEach(p => {
    let bblNorm = null;
    if (p.bbl) bblNorm = normalizeBBLString(p.bbl);
    if (!bblNorm) {
      const boro = (p.borough || p.BOROUGH || '').toString().toUpperCase();
      const boroNum = plutoBoroughToNumeric[boro] || (p.bbl ? p.bbl[0] : null);
      const block = p.block || p.BLOCK;
      const lot = p.lot || p.LOT;
      if (boroNum && block && lot) bblNorm = makeBBL(boroNum, block, lot);
    }
    if (!bblNorm) return;
    properties[bblNorm] = {
      bbl: bblNorm,
      plutoData: p,
      address: buildDisplayAddressFromPluto(p),
      ntaname: p.ntaname,
      lastSaleDate: null,
      tenureMonths: 0,
      score: 2.0,
      permitsLast12Months: 0,
      complaintsLast30Days: 0,
      unusedFARPercentage: 0,
      signalBadges: []
    };
  });
  if (Object.keys(properties).length === 0) {
    return { leads: [], stats: { likelySellers: 0, avgScore: 0, loansMaturing: 0, displayedLeads: 0, totalAnalyzed: 0 }, progress };
  }

  // 2) ACRIS Legals -> docIdToBblMap
  const targetBBLs = Object.keys(properties);
  const createBatches = (arr, size) => { const out = []; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; };
  const bblBatches = createBatches(targetBBLs, 50);
  let allLegalsInArea = [];
  const docIdToBblMap = {};
  for (let batchIndex = 0; batchIndex < bblBatches.length; batchIndex++) {
    const batch = bblBatches[batchIndex];
    const bblQueryParts = batch.map(bbl => {
      const borough = bbl.substring(0, 1);
      const block = parseInt(bbl.substring(1, 6), 10).toString();
      const lot = parseInt(bbl.substring(6, 10), 10).toString();
      return `(borough='${borough}' AND block='${block}' AND lot='${lot}')`;
    });
    const bblQueryString = bblQueryParts.join(' OR ');
    const legalsRes = await axios.get(LEGALS_ENDPOINT, { params: { $where: bblQueryString, $limit: 100 * batch.length }});
    allLegalsInArea = allLegalsInArea.concat(legalsRes.data);
    await new Promise(r => setTimeout(r, 80));
  }
  progress.acris = `${allLegalsInArea.length} legals fetched`;
  allLegalsInArea.forEach(legal => {
    const legalBbl = makeBBL(legal.borough, legal.block, legal.lot);
    if (legalBbl && properties[legalBbl]) {
      if (!docIdToBblMap[legal.document_id]) docIdToBblMap[legal.document_id] = [];
      docIdToBblMap[legal.document_id].push(legalBbl);
    }
  });

  // 3) ACRIS Master deeds for those document_ids
  const docIdKeys = Object.keys(docIdToBblMap);
  let deedMasterRecords = [];
  if (docIdKeys.length) {
    const docIdBatches = createBatches(docIdKeys, 50);
    for (let batchIndex = 0; batchIndex < docIdBatches.length; batchIndex++) {
      const batch = docIdBatches[batchIndex];
      const docIdQueryString = batch.map(docId => `document_id='${docId}'`).join(' OR ');
      const masterRes = await axios.get(MASTER_ENDPOINT, { params: { $where: `(${docIdQueryString}) AND doc_type='DEED'`, $limit: 100 * batch.length } });
      deedMasterRecords = deedMasterRecords.concat(masterRes.data);
      await new Promise(r => setTimeout(r, 80));
    }
  }
  progress.deeds = `${deedMasterRecords.length} deeds fetched`;

  // Match deeds to properties
  deedMasterRecords.forEach(master => {
    if (docIdToBblMap[master.document_id]) {
      docIdToBblMap[master.document_id].forEach(bblKey => {
        const prop = properties[bblKey];
        if (prop) {
          const saleDate = new Date(master.document_date);
          if (!prop.lastSaleDate || saleDate > new Date(prop.lastSaleDate)) {
            prop.lastSaleDate = master.document_date;
            prop.lastDeedType = master.doc_type || null;
            prop.documentId = master.document_id;
          }
        }
      });
    }
  });

  // Build address index for PLUTO properties to match DOB jobs by address
  const addressIndex = {};
  Object.keys(properties).forEach(bbl => {
    const p = properties[bbl];
    // Prefer explicit components if present
    let house = p.plutoData?.housenum || p.plutoData?.housenumber || null;
    let street = p.plutoData?.stname || p.plutoData?.street || null;
    if ((!house || !street) && p.address) {
      const parts = String(p.address).trim().split(/\s+/);
      if (parts.length > 1) {
        house = parts[0];
        street = parts.slice(1).join(' ');
      }
    }
    const key = normalizeAddressParts(house, street);
    if (key) {
      if (!addressIndex[key]) addressIndex[key] = [];
      addressIndex[key].push(bbl);
    }
  });

  // 4) DOB Jobs by address batches (avoid SoQL IN() quirks on block)
  let allDobJobs = [];
  const boroughText = Object.keys(boroughTextToNumeric).find(k => boroughTextToNumeric[k] === acrisBoroughCode) || 'MANHATTAN';
  const addrKeys = Object.keys(addressIndex);
  const ADDR_BATCH_SIZE = 20;
  for (let i = 0; i < addrKeys.length; i += ADDR_BATCH_SIZE) {
    const batchKeys = addrKeys.slice(i, i + ADDR_BATCH_SIZE);
    const clauses = batchKeys.map(k => {
      const parts = k.split(' ');
      const house = parts.shift();
      const street = parts.join(' ');
      const safeHouse = house.replace(/'/g, "''");
      const safeStreetU = street.replace(/'/g, "''").toUpperCase();
      // Match against both street_name and streetname; match multiple possible house columns
      return `((upper(street_name)='${safeStreetU}' OR upper(streetname)='${safeStreetU}') AND (house__='${safeHouse}' OR house='${safeHouse}' OR houseno='${safeHouse}' OR house_number='${safeHouse}'))`;
    });
    const where = `(borough='${boroughText}' OR borough=${acrisBoroughCode}) AND (${clauses.join(' OR ')})`;
    try {
      const res = await axios.get(DOBJOBS_ENDPOINT, { params: { $where: where, $limit: 50000 } });
      allDobJobs = allDobJobs.concat(res.data);
    } catch {}
    if (i + ADDR_BATCH_SIZE < addrKeys.length) {
      await new Promise(r => setTimeout(r, 80));
    }
  }
  progress.dob = `${allDobJobs.length} jobs fetched`;

  // Match DOB jobs to properties by normalized address, with BBL fallback
  allDobJobs.forEach(job => {
    const street = job.street_name || job.streetname || job.street || null;
    const house = job.house__ || job.house || job.houseno || job.house_number || null;
    const key = normalizeAddressParts(house, street);
    let matched = false;
    if (key && addressIndex[key] && addressIndex[key].length) {
      let candidates = addressIndex[key];
      // If multiple candidates, try to filter by block
      if (candidates.length > 1 && job.block) {
        const jobBlock = String(job.block).replace(/[^0-9]/g, '');
        const filtered = candidates.filter(bbl => bbl.substring(1, 6) === jobBlock.padStart(5, '0'));
        if (filtered.length) candidates = filtered;
      }
      const bbl = candidates[0];
      if (properties[bbl]) {
        properties[bbl].dobJobs = properties[bbl].dobJobs || [];
        // Annotate job with display address including apartment/unit (if present)
        job._displayAddress = buildDisplayAddressFromJob(job);
        job._unit = extractUnitFromJob(job);
        properties[bbl].dobJobs.push(job);
        matched = true;
      }
    }
    if (!matched) {
      // Fallback to BBL-based match if present
      if (job.bbl) {
        const jobBbl = normalizeBBLString(job.bbl);
        if (jobBbl && properties[jobBbl]) {
          properties[jobBbl].dobJobs = properties[jobBbl].dobJobs || [];
          properties[jobBbl].dobJobs.push(job);
          matched = true;
        }
      } else if (job.block && job.lot && job.borough) {
        const boroughRaw = String(job.borough).toUpperCase();
        const numericJobBorough = boroughTextToNumeric[boroughRaw] || (['1','2','3','4','5'].includes(boroughRaw) ? boroughRaw : undefined);
        if (numericJobBorough) {
          const blockDigits = String(job.block).replace(/[^0-9]/g, '');
          const lotDigits = String(job.lot).replace(/[^0-9]/g, '');
          const jobBbl = makeBBL(numericJobBorough, blockDigits, lotDigits);
          if (jobBbl && properties[jobBbl]) {
            properties[jobBbl].dobJobs = properties[jobBbl].dobJobs || [];
            properties[jobBbl].dobJobs.push(job);
          }
        }
      }
    }
  });

  // 6) 311 complaints for last 60 days
  let all311Complaints = [];
  const createdCutoff = new Date();
  createdCutoff.setDate(createdCutoff.getDate() - 60);
  const createdIso = createdCutoff.toISOString();
  const targetBBLsArr = Object.keys(properties);
  const BBL_BATCH_SIZE = 10;
  for (let i = 0; i < targetBBLsArr.length; i += BBL_BATCH_SIZE) {
    const batch = targetBBLsArr.slice(i, i + BBL_BATCH_SIZE);
    const where = `created_date >= '${createdIso}' AND bbl IN(${batch.map(b => `'${b}'`).join(',')})`;
    try {
      const threeoneoneRes = await axios.get(THREEONEONE_ENDPOINT, { params: { $where: where, $limit: 50000, $select: 'unique_key,bbl,incident_address,complaint_type,created_date' } });
      all311Complaints = all311Complaints.concat(threeoneoneRes.data);
    } catch {}
    await new Promise(r => setTimeout(r, 80));
  }
  progress._311 = `${all311Complaints.length} complaints fetched (60d)`;

  // Attach matched data to properties and score
  let processedLeads = [];
  let totalScoreSum = 0;

  targetBBLsArr.forEach(bbl => {
    const prop = properties[bbl];

    // permits from DOB jobs in last 12 months
    const twelveMonthsAgo = new Date(); twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const jobs = (prop.dobJobs || []).filter(j => j.filing_date && new Date(j.filing_date) >= twelveMonthsAgo);
    prop.permitsLast12Months = jobs.length;
    const renovationJobTypes = ['A1','A2','DM'];
    const hasRenovationJobs = jobs.some(job => renovationJobTypes.includes(job.job_type));
    if (hasRenovationJobs && prop.permitsLast12Months > 1) { prop.score += 1.2; prop.signalBadges.push('Renovations (A1/A2/DM)'); }
    else if (hasRenovationJobs) { prop.score += 0.9; prop.signalBadges.push('Renovation Permit'); }
    else if (prop.permitsLast12Months > 2) { prop.score += 0.7; prop.signalBadges.push('Multiple Permits'); }
    else if (prop.permitsLast12Months >= 1) { prop.score += 0.4; prop.signalBadges.push('Recent Permit'); }

    // 311 last 30 days
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const complaints = all311Complaints.filter(c => normalizeBBLString(c.bbl) === bbl);
    const recentComplaints = complaints.filter(c => c.created_date && new Date(c.created_date) >= thirtyDaysAgo);
    prop.complaints = complaints;
    prop.complaintsLast30Days = recentComplaints.length;
    const seriousComplaintTypes = ['HEAT/HOT WATER','PLUMBING','WATER LEAK','NO WATER','ELECTRIC','ELEVATOR','PAINT/PLASTER','DOOR/WINDOW'];
    const hasSeriousComplaints = recentComplaints.some(c => seriousComplaintTypes.some(type => c.complaint_type && c.complaint_type.includes(type)));
    const unitsRes = parseInt((prop.plutoData && prop.plutoData.unitsres) || 0, 10);
    const denom = Number.isFinite(unitsRes) && unitsRes > 0 ? unitsRes : 1;
    const cpu = prop.complaintsLast30Days / denom;
    prop.complaintsPerUnit30Days = parseFloat(cpu.toFixed(2));
    const steps = Math.floor(prop.complaintsLast30Days / 5);
    if (steps > 0) { const inc = parseFloat((steps * 0.3).toFixed(1)); prop.score += inc; prop.signalBadges.push(`Complaints +${inc} (${prop.complaintsLast30Days} in 30d)`); }
    if (hasSeriousComplaints) { prop.score += 0.2; prop.signalBadges.push('Serious Complaint'); }
    if (prop.complaintsPerUnit30Days >= 0.15) { prop.score += 0.2; prop.signalBadges.push('High Complaints/Unit'); }

    // FAR potential
    const pd = prop.plutoData || {};
    const toNum = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
    const built = toNum(pd.builtfar);
    const allowed = Math.max(toNum(pd.residfar), toNum(pd.commfar), toNum(pd.facilfar));
    const lotArea = toNum(pd.lotarea);
    const remainingFAR = allowed - built;
    if (lotArea >= 2000) {
      if (remainingFAR >= 8) { prop.score += 4.0; prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)} (8+)`); }
      else if (remainingFAR >= 5) { prop.score += 2.0; prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)} (5+)`); }
      else if (remainingFAR >= 2) { prop.score += 0.5; prop.signalBadges.push(`Underbuilt FAR +${remainingFAR.toFixed(1)}`); }
    }

    prop.score = parseFloat(prop.score.toFixed(1));
    if (prop.address) { processedLeads.push(prop); totalScoreSum += prop.score; }
  });

  processedLeads.sort((a, b) => b.score - a.score);
  const MAX_LEADS = 200;
  const displayLeads = processedLeads.slice(0, MAX_LEADS);
  const avgScore = displayLeads.length > 0 ? parseFloat((displayLeads.reduce((sum, p) => sum + (p.score || 0), 0) / displayLeads.length).toFixed(1)) : 0;
  const flaggedCount = processedLeads.filter(p => (p.score || 0) >= 3.0).length;
  const stats = { likelySellers: flaggedCount, avgScore, loansMaturing: 0, displayedLeads: displayLeads.length, totalAnalyzed: processedLeads.length };

  return { leads: displayLeads, stats, progress };
}

// CommonJS export for Node scripts
module.exports = { processNeighborhood };
