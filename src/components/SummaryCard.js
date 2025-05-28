import React from 'react';

const SummaryCard = ({ title, value, change, isLoading }) => (
    <div style={{
        border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px',
        minWidth: '200px', textAlign: 'left', backgroundColor: 'white', flex: 1
    }}>
        <div style={{ fontSize: '0.9em', color: '#555', marginBottom: '5px' }}>{title}</div>
        <div style={{ fontSize: '2em', fontWeight: 'bold', color: '#333' }}>
            {isLoading ? '...' : value}
        </div>
        {change && !isLoading && <div style={{ fontSize: '0.9em', color: change.startsWith('+') ? 'green' : 'red' }}>{change}</div>}
    </div>
);

export default SummaryCard;
