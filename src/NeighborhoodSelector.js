import React from "react";
import { getBoroughNTAs } from './data/ntaList';

// Build neighborhoods list from shared data
const boroughNeighborhoods = {
  manhattan: [
    { code: '', name: 'All Manhattan' },
    ...getBoroughNTAs('manhattan'),
  ],
};

const NeighborhoodSelector = ({ onSelect, currentSelection }) => {
  const borough = currentSelection?.borough || "manhattan";
  const neighborhood = currentSelection?.neighborhood || { code: '', name: 'All Manhattan' };

  const handleBoroughChange = (e) => {
    const value = e.target.value;
    const defaultNeighborhood = boroughNeighborhoods[value][0];
    onSelect({ 
      borough: value, 
      neighborhood: defaultNeighborhood.name,
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
  
  const currentNeighborhoodName = typeof neighborhood === 'string' ? 
    neighborhood : 
    (neighborhood?.name || 'All Manhattan');

  const selectStyles = {
    width: '100%',
    padding: '12px 36px 12px 16px',
    fontSize: '0.875rem',
    fontWeight: '500',
    lineHeight: '1.25rem',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    cursor: 'pointer',
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2364748b'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
  };

  const labelStyles = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#64748b',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '12px', 
      padding: '24px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: '#eff6ff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#3b82f6',
        }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
            <div style={{ 
                fontWeight: '600', 
                fontSize: '0.9375rem',
                color: '#0f172a',
            }}>
                Target Area
            </div>
            <div style={{ 
                fontSize: '0.75rem', 
                color: '#64748b',
            }}>
                Select region to analyze
            </div>
        </div>
      </div>
      
      <div style={{ marginBottom: '16px' }}>
        <label style={labelStyles}>
          Borough
        </label>
        <select 
          style={selectStyles} 
          value={borough} 
          onChange={handleBoroughChange}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            e.target.style.backgroundColor = 'white';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            e.target.style.backgroundColor = '#f8fafc';
          }}
        >
          {Object.keys(boroughNeighborhoods).map((b) => (
            <option key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</option>
          ))}
        </select>
      </div>
      
      <div>
        <label style={labelStyles}>
          Neighborhood
        </label>
        <select 
          style={selectStyles}
          value={currentNeighborhoodName} 
          onChange={handleNeighborhoodChange}
          onFocus={(e) => {
            e.target.style.borderColor = '#3b82f6';
            e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)';
            e.target.style.backgroundColor = 'white';
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#e2e8f0';
            e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
            e.target.style.backgroundColor = '#f8fafc';
          }}
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
