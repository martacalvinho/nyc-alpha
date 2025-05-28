import React, { useEffect, useState } from 'react';
import axios from 'axios';

const MORTGAGE_ENDPOINT = 'https://data.cityofnewyork.us/resource/qjp4-ri2f.json';
const MORTGAGE_COLUMNS = [
  'document_id',
  'record_type',
  'crfn',
  'recorded_borough',
  'doc_type',
  'document_date',
  'document_amt',
  'recorded_datetime',
  'modified_date',
  'percent_trans',
  'good_through_date',
  'time_since_document',
];

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString();
}

function calcTimeSince(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const doc = new Date(dateStr);
  const diffMs = now - doc;
  if (isNaN(diffMs)) return '';
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  const days = diffDays % 30;
  let result = '';
  if (years) result += `${years}y `;
  if (months) result += `${months}m `;
  if (days || (!years && !months)) result += `${days}d`;
  return result.trim();
}

const AcrisMortgageTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    axios.get(MORTGAGE_ENDPOINT, { params: { $limit: 100 } })
      .then(res => {
        setData(res.data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load mortgage data.');
        setLoading(false);
      });
  }, []);

  return (
    <div className="AcrisApp">
      <h1>ACRIS Mortgages</h1>
      {loading && <div className="Status">Loading...</div>}
      {error && <div className="Status Error">{error}</div>}
      {!loading && !error && (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ display: 'flex', fontWeight: 600, background: '#e3e9f6', borderRadius: '4px 4px 0 0' }}>
            {MORTGAGE_COLUMNS.map(col => (
              <span className="HeaderCell" key={col}>{col.replace(/_/g, ' ').toUpperCase()}</span>
            ))}
          </div>
          {data.map((row, idx) => (
            <div className={idx % 2 ? 'Row Odd' : 'Row Even'} key={row.document_id || idx}>
              <span className="Cell">{row.document_id}</span>
              <span className="Cell">{row.record_type}</span>
              <span className="Cell">{row.crfn}</span>
              <span className="Cell">{row.recorded_borough}</span>
              <span className="Cell">{row.doc_type}</span>
              <span className="Cell">{formatDate(row.document_date)}</span>
              <span className="Cell">{row.document_amt}</span>
              <span className="Cell">{formatDate(row.recorded_datetime)}</span>
              <span className="Cell">{formatDate(row.modified_date)}</span>
              <span className="Cell">{row.percent_trans}</span>
              <span className="Cell">{formatDate(row.good_through_date)}</span>
              <span className="Cell">{calcTimeSince(row.document_date)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AcrisMortgageTable;
