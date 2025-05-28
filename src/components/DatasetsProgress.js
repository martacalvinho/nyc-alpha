import React from 'react';

const DatasetsProgress = ({ progress }) => (
    <div style={{ border: '1px solid #cbd5e1', borderRadius: 8, padding: 16, maxWidth: 320, marginBottom: 16, backgroundColor: 'white' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Datasets</div>
        {Object.entries(progress).map(([key, value]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', marginBottom: '4px' }}>
                <span>{key.charAt(0).toUpperCase() + key.slice(1)}:</span>
                <span style={{ color: value === 'loading...' ? 'orange' : (value.includes('error') || value.includes('No') ? 'red' : 'green') }}>{value}</span>
            </div>
        ))}
        {progress.error && <div style={{color: 'red', marginTop: '5px'}}>Error: {progress.error}</div>}
    </div>
);

export default DatasetsProgress;
