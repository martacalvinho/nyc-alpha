import React from 'react';

const datasetLabels = {
    pluto: 'PLUTO',
    acris: 'ACRIS Deeds',
    dob: 'DOB Permits',
    '311': '311 Complaints',
    _311: '311 Complaints',
    mortgages: 'Mortgages',
    hpdViolations: 'HPD Violations',
    hpdRegistrations: 'HPD Registry',
};

const DatasetsProgress = ({ progress }) => {
    const entries = Object.entries(progress).filter(([key]) => !['error', 'cacheUpdated'].includes(key));
    
    // Calculate progress for visual indicator
    const total = entries.length;
    const completed = entries.filter(([_, val]) => val !== 'loading...' && !val?.toString().toLowerCase().includes('error')).length;
    const percent = Math.round((completed / total) * 100);

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
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '16px',
            }}>
                <div style={{ 
                    fontWeight: '600', 
                    fontSize: '0.9375rem',
                    color: '#0f172a',
                }}>
                    Data Sources
                </div>
                <div style={{
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: percent === 100 ? '#10b981' : '#3b82f6',
                    background: percent === 100 ? '#ecfdf5' : '#eff6ff',
                    padding: '2px 8px',
                    borderRadius: '9999px',
                }}>
                    {percent}% Ready
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{
                height: '4px',
                background: '#f1f5f9',
                borderRadius: '2px',
                marginBottom: '20px',
                overflow: 'hidden',
            }}>
                <div style={{
                    height: '100%',
                    width: `${percent}%`,
                    background: percent === 100 ? '#10b981' : '#3b82f6',
                    transition: 'width 0.5s ease',
                    borderRadius: '2px',
                }} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {entries.map(([key, value]) => {
                    const isLoading = value === 'loading...';
                    const isError = typeof value === 'string' && (value.toLowerCase().includes('error') || value.includes('No '));
                    const isSuccess = !isLoading && !isError;
                    
                    return (
                        <div 
                            key={key} 
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '0.8125rem',
                            }}
                        >
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#475569',
                            }}>
                                <div style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: isLoading ? '#f59e0b' : isError ? '#ef4444' : '#cbd5e1',
                                    boxShadow: isLoading ? '0 0 0 2px #fef3c7' : 'none',
                                }} />
                                {datasetLabels[key] || key}
                            </div>
                            <span style={{ 
                                fontWeight: '500',
                                color: isLoading ? '#d97706' : isError ? '#dc2626' : '#64748b',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            }}>
                                {isLoading ? 'Syncing...' : isError ? 'Error' : value}
                            </span>
                        </div>
                    );
                })}
            </div>
            
            {progress.error && (
                <div style={{
                    marginTop: '16px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '0.75rem',
                    border: '1px solid #fee2e2',
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'start',
                }}>
                    <span>⚠️</span>
                    {progress.error}
                </div>
            )}
        </div>
    );
};

export default DatasetsProgress;
