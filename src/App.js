import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FixedSizeList as List } from 'react-window';
import NeighborhoodMap from './NeighborhoodMap';
import NeighborhoodSelector from './NeighborhoodSelector';
import AcrisMortgageTable from './AcrisMortgageTable';
import MapPluto from './MapPluto';
import AlphaNavigator from './AlphaNavigator';
import './App.css';

const MASTER_ENDPOINT = 'https://data.cityofnewyork.us/resource/bnx9-e6tj.json';
const LEGALS_ENDPOINT = 'https://data.cityofnewyork.us/resource/8h5j-fqxa.json';
const DEFAULT_BATCH_SIZE = 1000;
const THREEONEONE_ENDPOINT = 'https://data.cityofnewyork.us/resource/erm2-nwe9.json';
const THREEONEONE_COLUMNS = [
  'unique_key',
  'created_date',
  'complaint_type',
  'descriptor',
  'incident_address',
  'borough',
  'status'
];
const DOBJOBS_ENDPOINT = 'https://data.cityofnewyork.us/resource/hir8-3a8d.json';
const DOBJOBS_COLUMNS = [
  'job__',
  'doc__',
  'borough',
  'house__',
  'street_name',
  'block',
  'lot',
  'job_type',
  'job_status',
  'job_status_descrp',
  'building_type',
  'landmarked',
  'initial_cost',
  'total_est__fee',
  'existing_zoning_sqft',
  'proposed_zoning_sqft',
  'existing_dwelling_units',
  'proposed_dwelling_units',
  'existing_occupancy',
  'proposed_occupancy',
  'owner_s_first_name',
  'owner_s_last_name',
  'job_description'
];
const MASTER_COLUMNS = [
  'document_id',
  'record_type',
  'crfn',
  'recorded_borough',
  'doc_type',
  'document_date',
  'document_amt',
  'recorded_datetime',
  'modified_date'
];
const LEGALS_COLUMNS = [
  'document_id',
  'borough',
  'block',
  'lot',
  'property_type',
  'street_number',
  'street_name',
  'unit',
  'good_through_date'
];

const PLUTO_COLUMNS = [
  'bbl',
  'ntaname',
  'address',
  'cd',
  'council',
  'zipcode',
  'yearbuilt',
  'landuse',
  'ownername',
  'unitsres',
  'unitstotal',
  'lotarea',
  'bldgarea',
  'assessland',
  'assesstot',
  'exempttot'
];

function AcrisExplorer({ selection, setSelection }) {
  // 311 state
  const [threeoneoneData, setThreeoneoneData] = useState([]);
  const [threeoneoneOffset, setThreeoneoneOffset] = useState(0);
  const [threeoneoneLoading, setThreeoneoneLoading] = useState(false);
  const [threeoneoneError, setThreeoneoneError] = useState('');
  // DOB Jobs state
  const [dobJobsData, setDobJobsData] = useState([]);
  const [dobJobsOffset, setDobJobsOffset] = useState(0);
  const [dobJobsLoading, setDobJobsLoading] = useState(false);
  const [dobJobsError, setDobJobsError] = useState('');
  // No local selection state; use props throughout
  // Master state
  const [masterData, setMasterData] = useState([]);
  // Toggle for showing only Legals with PLUTO match
  const [showOnlyWithPluto, setShowOnlyWithPluto] = useState(true);
  const [masterOffset, setMasterOffset] = useState(0);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterError, setMasterError] = useState('');

  // Legals state
  const [legalsData, setLegalsData] = useState([]);
  const [legalsOffset, setLegalsOffset] = useState(0);
  const [legalsLoading, setLegalsLoading] = useState(false);
  const [legalsError, setLegalsError] = useState('');

  // PLUTO state
  const [plutoData, setPlutoData] = useState([]);
  const [plutoOffset, setPlutoOffset] = useState(0);
  const [plutoLoading, setPlutoLoading] = useState(false);
  const [plutoError, setPlutoError] = useState('');

  // Shared batch size
  const [batchSize, setBatchSize] = useState(DEFAULT_BATCH_SIZE);

  // Fetch Master
  const fetchMaster = useCallback(async (offset, batchSize) => {
    setMasterLoading(true);
    setMasterError('');
    try {
      const params = {
        "$limit": batchSize,
        "$offset": offset,
        "$select": MASTER_COLUMNS.join(",")
      };
      const res = await axios.get(MASTER_ENDPOINT, { params });
      setMasterData(res.data);
    } catch (e) {
      setMasterError('Failed to fetch ACRIS Master data.');
      setMasterData([]);
    }
    setMasterLoading(false);
  }, []);

  // Fetch Legals
  const fetchLegals = useCallback(async (offset, batchSize) => {
    setLegalsLoading(true);
    setLegalsError('');
    try {
      const params = {
        "$limit": batchSize,
        "$offset": offset,
        "$select": LEGALS_COLUMNS.join(",")
      };
      const res = await axios.get(LEGALS_ENDPOINT, { params });
      setLegalsData(res.data);
    } catch (e) {
      setLegalsError('Failed to fetch ACRIS Legals data.');
      setLegalsData([]);
    }
    setLegalsLoading(false);
  }, []);

  // Fetch DOB Jobs
  const fetchDobJobs = useCallback(async (offset, batchSize) => {
    setDobJobsLoading(true);
    setDobJobsError('');
    try {
      const params = {
        $limit: batchSize,
        $offset: offset,
        $select: DOBJOBS_COLUMNS.join(",")
      };
      const res = await axios.get(DOBJOBS_ENDPOINT, { params });
      setDobJobsData(res.data);
    } catch (e) {
      setDobJobsError('Failed to fetch DOB Jobs data.');
      setDobJobsData([]);
    }
    setDobJobsLoading(false);
  }, []);

  // Fetch 311
  const fetchThreeoneone = useCallback(async (offset, batchSize) => {
    setThreeoneoneLoading(true);
    setThreeoneoneError('');
    try {
      const params = {
        $limit: batchSize,
        $offset: offset,
        $select: THREEONEONE_COLUMNS.join(",")
      };
      const res = await axios.get(THREEONEONE_ENDPOINT, { params });
      setThreeoneoneData(res.data);
    } catch (e) {
      setThreeoneoneError('Failed to fetch 311 data.');
      setThreeoneoneData([]);
    }
    setThreeoneoneLoading(false);
  }, []);

  // Fetch PLUTO for Manhattan (borough code MN)
  const fetchPluto = useCallback(async (offset, batchSize) => {
    setPlutoLoading(true);
    setPlutoError('');
    try {
      const params = {
        borough: 'MN',
        $limit: batchSize,
        $offset: offset
      };
      const res = await axios.get('https://data.cityofnewyork.us/resource/64uk-42ks.json', { params });
      setPlutoData(res.data);
    } catch (e) {
      setPlutoError('Failed to fetch PLUTO data.');
      setPlutoData([]);
    }
    setPlutoLoading(false);
  }, []);

  useEffect(() => {
    fetchMaster(masterOffset, batchSize);
  }, [masterOffset, batchSize, fetchMaster]);

  useEffect(() => {
    fetchLegals(legalsOffset, batchSize);
  }, [legalsOffset, batchSize, fetchLegals]);

  useEffect(() => {
    fetchPluto(plutoOffset, batchSize);
  }, [plutoOffset, batchSize, fetchPluto]);

  useEffect(() => {
    fetchThreeoneone(threeoneoneOffset, batchSize);
  }, [threeoneoneOffset, batchSize, fetchThreeoneone]);

  useEffect(() => {
    fetchDobJobs(dobJobsOffset, batchSize);
  }, [dobJobsOffset, batchSize, fetchDobJobs]);

  // Table row components
  const MasterRow = ({ index, style }) => {
    const row = masterData[index];
    return (
      <div className={index % 2 ? 'Row Odd' : 'Row Even'} style={style}>
        {MASTER_COLUMNS.map(col => (
          <span className="Cell" key={col}>{row?.[col] ?? ''}</span>
        ))}
      </div>
    );
  };

  // Map UI selection to ACRIS codes
  const acrisBorough = selection.borough === 'manhattan' ? '1' : '';
  const acrisNeighborhood = selection.neighborhood === 'All Manhattan' ? '' : selection.neighborhood;

  // Build BBL for join
  function makeBBL(borough, block, lot) {
    return String(Number(borough)) + String(Number(block)).padStart(5, '0') + String(Number(lot)).padStart(4, '0');
  }

  // Map PLUTO borough codes to Legals codes
  const plutoBoroughToCode = { MN: '1', BX: '2', BK: '3', QN: '4', SI: '5' };

  // Build a PLUTO lookup by BBL (matching Legals format)
  const plutoByBBL = React.useMemo(() => {
    const map = {};
    for (const p of plutoData) {
      // If PLUTO has separate borough/block/lot, use them; otherwise, parse from bbl
      let borough = p.borough || p.BOROUGH || (p.bbl ? p.bbl[0] : undefined);
      let block = p.block || p.BLOCK;
      let lot = p.lot || p.LOT;
      if (!borough && p.bbl && p.bbl.length === 10) {
        // Try to parse borough/block/lot from bbl
        borough = p.bbl[0];
        block = p.bbl.slice(1, 6);
        lot = p.bbl.slice(6, 10);
      }
      // Map borough code if needed
      if (typeof borough === 'string' && plutoBoroughToCode[borough]) {
        borough = plutoBoroughToCode[borough];
      }
      // Build BBL string in Legals format
      if (borough && block && lot) {
        const bbl = String(Number(borough)) + String(Number(block)).padStart(5, '0') + String(Number(lot)).padStart(4, '0');
        map[bbl] = p;
      } else if (p.bbl) {
        map[p.bbl] = p;
      }
    }
    return map;
  }, [plutoData]);

  // Join ACRIS Legals with PLUTO by BBL
  const joinedLegals = legalsData.map(row => {
    const bbl = makeBBL(row.borough, row.block, row.lot);
    const pluto = plutoByBBL[bbl];
    return { ...row, pluto };
  });

  // Filter joined data by neighborhood (from PLUTO) and toggle
  const filteredLegals = joinedLegals.filter(row => {
    if (showOnlyWithPluto && !row.pluto) return false;
    if (acrisBorough && row.borough !== acrisBorough) return false;
    if (acrisNeighborhood && row.pluto && row.pluto.ntaname && row.pluto.ntaname !== acrisNeighborhood) return false;
    if (acrisNeighborhood && (!row.pluto || !row.pluto.ntaname)) return false;
    return true;
  });

  const LegalsRow = ({ index, style }) => {
    const row = filteredLegals[index];
    return (
      <div className={index % 2 ? 'Row Odd' : 'Row Even'} style={style}>
        {LEGALS_COLUMNS.map(col => (
          <span className="Cell" key={col}>{row?.[col] ?? ''}</span>
        ))}
      </div>
    );
  };

  return (
    <div className="AcrisApp">
      <h1>NYC ACRIS Explorer</h1>
      <NeighborhoodSelector onSelect={setSelection} currentSelection={selection} />

      <h2>ACRIS Master</h2>
      <div className="Controls">
        <button onClick={() => setMasterOffset(Math.max(0, masterOffset - batchSize))} disabled={masterOffset === 0 || masterLoading}>Prev</button>
        <button onClick={() => setMasterOffset(masterOffset + batchSize)} disabled={masterLoading}>Next</button>
        <label>
          Batch size:
          <select value={batchSize} onChange={e => { setBatchSize(Number(e.target.value)); setMasterOffset(0); setLegalsOffset(0); setPlutoOffset(0); }}>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
            <option value={2000}>2000</option>
          </select>
        </label>
        <span style={{marginLeft: 10}}>
          Showing {masterData.length} records (offset {masterOffset})
        </span>
      </div>
      {masterLoading && <div className="Status">Loading...</div>}
      {masterError && <div className="Status Error">{masterError}</div>}
      <div className="TableHeader">
        {MASTER_COLUMNS.map(col => (
          <span className="HeaderCell" key={col}>{col}</span>
        ))}
      </div>
      <List
        height={300}
        itemCount={masterData.length}
        itemSize={36}
        width={"100%"}
      >
        {MasterRow}
      </List>

      <h2 style={{marginTop: 40}}>PLUTO (Manhattan)</h2>
      <div className="Controls">
        <button onClick={() => setPlutoOffset(Math.max(0, plutoOffset - batchSize))} disabled={plutoOffset === 0 || plutoLoading}>Prev</button>
        <button onClick={() => setPlutoOffset(plutoOffset + batchSize)} disabled={plutoLoading}>Next</button>
        <span style={{marginLeft: 10}}>
          Showing {plutoData.length} records (offset {plutoOffset})
        </span>
      </div>
      {plutoLoading && <div className="Status">Loading PLUTO data...</div>}
      {plutoError && <div className="Status Error">{plutoError}</div>}
      <div className="TableHeader">
        {PLUTO_COLUMNS.map(col => (
          <span className="HeaderCell" key={col}>{col}</span>
        ))}
      </div>
      <List
        height={300}
        itemCount={plutoData.length}
        itemSize={36}
        width={"100%"}
      >
        {({ index, style }) => {
          const row = plutoData[index];
          return (
            <div className={index % 2 ? 'Row Odd' : 'Row Even'} style={style}>
              {PLUTO_COLUMNS.map(col => (
                <span className="Cell" key={col}>{row?.[col] ?? ''}</span>
              ))}
            </div>
          );
        }}
      </List>

      <h2 style={{marginTop: 40}}>ACRIS Real Property Legals</h2>
<div style={{marginBottom: 10}}>
  <label>
    <input
      type="checkbox"
      checked={showOnlyWithPluto}
      onChange={e => setShowOnlyWithPluto(e.target.checked)}
      style={{marginRight: 8}}
    />
    Show only records with PLUTO match
  </label>
</div>
      {plutoLoading && <div className="Status">Loading PLUTO data...</div>}
      {plutoError && <div className="Status Error">{plutoError}</div>}
      {selection && selection.neighborhood && selection.neighborhood !== 'All Manhattan' && (
        <div className="Status">
          Showing only records in: <b>{selection.neighborhood}</b>
          <button style={{marginLeft: 16}} onClick={() => setSelection({ borough: 'manhattan', neighborhood: 'All Manhattan' })}>
            Clear selection
          </button>
        </div>
      )}
      <div className="Controls">
        <button onClick={() => setLegalsOffset(Math.max(0, legalsOffset - batchSize))} disabled={legalsOffset === 0 || legalsLoading}>Prev</button>
        <button onClick={() => setLegalsOffset(legalsOffset + batchSize)} disabled={legalsLoading}>Next</button>
        <span style={{marginLeft: 10}}>
          Showing {filteredLegals.length} records (offset {legalsOffset})
        </span>
      </div>
      {legalsLoading && <div className="Status">Loading...</div>}
      {legalsError && <div className="Status Error">{legalsError}</div>}
      <div className="TableHeader">
        {LEGALS_COLUMNS.map(col => (
          <span className="HeaderCell" key={col}>{col}</span>
        ))}
        <span className="HeaderCell" key="pluto_ntaname">neighborhood (PLUTO)</span>
      </div>
      <List
        height={300}
        itemCount={filteredLegals.length}
        itemSize={36}
        width={"100%"}
      >
        {props => {
          const row = filteredLegals[props.index];
          return (
            <div className="TableRow" style={props.style} key={row.document_id}>
              {LEGALS_COLUMNS.map(col => (
                <span className="Cell" key={col}>{row[col]}</span>
              ))}
              <span className="Cell">{row.pluto && row.pluto.ntaname}</span>
            </div>
          );
        }}
      </List>

      {/* PLUTO debug table removed: replaced by full PLUTO table above */}
          <h2 style={{marginTop: 40}}>311 Service Requests</h2>
      <div className="Controls">
        <button onClick={() => setThreeoneoneOffset(Math.max(0, threeoneoneOffset - batchSize))} disabled={threeoneoneOffset === 0 || threeoneoneLoading}>Prev</button>
        <button onClick={() => setThreeoneoneOffset(threeoneoneOffset + batchSize)} disabled={threeoneoneLoading}>Next</button>
        <span style={{marginLeft: 10}}>
          Showing {threeoneoneData.length} records (offset {threeoneoneOffset})
        </span>
      </div>
      {threeoneoneLoading && <div className="Status">Loading 311 data...</div>}
      {threeoneoneError && <div className="Status Error">{threeoneoneError}</div>}
      <div className="TableHeader">
        {THREEONEONE_COLUMNS.map(col => (
          <span className="HeaderCell" key={col}>{col}</span>
        ))}
      </div>
      <List
        height={300}
        itemCount={threeoneoneData.length}
        itemSize={36}
        width={"100%"}
      >
        {({ index, style }) => {
          const row = threeoneoneData[index];
          return (
            <div className={index % 2 ? 'Row Odd' : 'Row Even'} style={style}>
              {THREEONEONE_COLUMNS.map(col => (
                <span className="Cell" key={col}>{row?.[col] ?? ''}</span>
              ))}
            </div>
          );
        }}
      </List>
      <h2 style={{marginTop: 40}}>DOB Jobs (Construction Permits)</h2>
      <div className="Controls">
        <button onClick={() => setDobJobsOffset(Math.max(0, dobJobsOffset - batchSize))} disabled={dobJobsOffset === 0 || dobJobsLoading}>Prev</button>
        <button onClick={() => setDobJobsOffset(dobJobsOffset + batchSize)} disabled={dobJobsLoading}>Next</button>
        <span style={{marginLeft: 10}}>
          Showing {dobJobsData.length} records (offset {dobJobsOffset})
        </span>
      </div>
      {dobJobsLoading && <div className="Status">Loading DOB Jobs data...</div>}
      {dobJobsError && <div className="Status Error">{dobJobsError}</div>}
      <div className="TableHeader">
        {DOBJOBS_COLUMNS.map(col => (
          <span className="HeaderCell" key={col}>{col}</span>
        ))}
      </div>
      <List
        height={300}
        itemCount={dobJobsData.length}
        itemSize={36}
        width={"100%"}
      >
        {({ index, style }) => {
          const row = dobJobsData[index];
          return (
            <div className={index % 2 ? 'Row Odd' : 'Row Even'} style={style}>
              {DOBJOBS_COLUMNS.map(col => (
                <span className="Cell" key={col}>{row?.[col] ?? ''}</span>
              ))}
            </div>
          );
        }}
      </List>
    </div>
  );
}


function App() {
  const [activeTab, setActiveTab] = React.useState('alpha'); // 'alpha', 'explorer', 'mortgages'
  const [selection, setSelection] = React.useState({ borough: 'manhattan', neighborhood: 'All Manhattan' });

  // Handler for map click: update dropdown/table selection
  const handleMapNeighborhoodSelect = (ntaname) => {
    setSelection(sel => ({ ...sel, neighborhood: ntaname }));
  };
  // Handler for dropdown: update selection as before
  const handleDropdownSelect = (sel) => {
    setSelection(sel);
  };

  return (
    <div>
      <div className="TabBar">
        <div
          className={`Tab${activeTab === 'alpha' ? ' active' : ''}`}
          onClick={() => setActiveTab('alpha')}
        >
          Alpha Navigator
        </div>
        <div
          className={`Tab${activeTab === 'explorer' ? ' active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          Main Explorer
        </div>
        <div
          className={`Tab${activeTab === 'mortgages' ? ' active' : ''}`}
          onClick={() => setActiveTab('mortgages')}
        >
          ACRIS Mortgages
        </div>
      </div>
      {activeTab === 'alpha' && (
        <div>
          <h2 style={{margin: '18px 0 10px 0'}}>NYC Alpha Navigator</h2>
          <AlphaNavigator />
        </div>
      )}
      {activeTab === 'explorer' && (
        <div>
          <h2 style={{margin: '18px 0 10px 0'}}>NYC ACRIS Explorer</h2>
          <MapPluto
            selectedNeighborhood={selection.neighborhood}
            setSelectedNeighborhood={handleMapNeighborhoodSelect}
          />
          <AcrisExplorer
            selection={selection}
            setSelection={handleDropdownSelect}
          />
        </div>
      )}
      {activeTab === 'mortgages' && (
        <div>
          <h2 style={{margin: '18px 0 10px 0'}}>ACRIS Mortgages</h2>
          <AcrisMortgageTable />
        </div>
      )}
    </div>
  );
}

export default App;
