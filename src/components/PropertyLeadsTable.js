import React, { useState } from 'react';

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

const PropertyLeadsTable = ({ leads }) => {
    // Set up filter state
    const [activeFilter, setActiveFilter] = useState('all');
    const [showStrategyExplanation, setShowStrategyExplanation] = useState(true);
    const [expandedBBL, setExpandedBBL] = useState(null);
    
    // Filter functions for different strategies
    const filterStrategies = {
        'all': (lead) => true,
        'renovations': (lead) => lead.permitsLast12Months && lead.permitsLast12Months > 0,
        'complaints': (lead) => lead.complaintsLast30Days && lead.complaintsLast30Days > 0,
        'recent': (lead) => lead.lastSaleDate && (new Date().getFullYear() - new Date(lead.lastSaleDate).getFullYear() <= 5),
        'high_score': (lead) => lead.score >= 3.0
    };
    
    // Strategy explanations
    const strategyExplanations = {
        'all': "Showing all properties in the selected area without filtering.",
        'renovations': "Properties with active DOB permits in the last 12 months - likely undergoing renovations that might indicate fix & flip activity.",
        'complaints': "Properties with 311 complaints in the last 30 days - possibly neglected properties with management issues.",
        'recent': "Properties sold within the last 5 years - owners may still be in investment phase or considering moves.",
        'high_score': "Properties with a score of 3.0 or higher - our algorithm detected multiple strong signals of potential seller motivation."
    };
    
    // Apply active filter and sort by score
    const filteredLeads = [...leads]
        .filter(filterStrategies[activeFilter])
        .sort((a, b) => b.score - a.score);
    
    // Show the specific columns the user wants with improved formatting
    const columns = [
        { accessor: 'bbl', Header: 'BBL' },
        { accessor: 'address', Header: 'Address' },
        { 
            accessor: 'score', 
            Header: 'Score', 
            Cell: ({ value }) => <span style={{ fontWeight: 'bold', color: value >= 4.0 ? '#d32f2f' : value >= 3.0 ? '#f57c00' : '#2e7d32' }}>{value}</span>
        },
        // Highlight key motivation indicators
        { 
            accessor: 'topIndicator', 
            Header: 'Key Motivation', 
            Cell: ({ row }) => {
                // Determine the top motivation indicator based on available data
                if (row.permitsLast12Months > 2) {
                    return <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Multiple Permits</span>;
                } else if (row.permitsLast12Months > 0) {
                    return <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>Recent Permit</span>;
                } else if (row.complaintsLast30Days > 2) {
                    return <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>Multiple Complaints</span>;
                } else if (row.complaintsLast30Days > 0) {
                    return <span style={{ color: '#f57c00', fontWeight: 'bold' }}>Recent Complaint</span>;
                } else if (row.lastSaleDate && (new Date().getFullYear() - new Date(row.lastSaleDate).getFullYear() <= 2)) {
                    return <span style={{ color: '#1976d2', fontWeight: 'bold' }}>Recent Sale</span>;
                }
                return 'None detected';
            }
        },
        { accessor: 'lastSaleDate', Header: 'Last Sale', Cell: ({ value }) => formatDate(value) },
        { accessor: 'complaintsLast30Days', Header: 'Complaints 30d', Cell: ({ value }) => value || '0' },
        { accessor: 'permitsLast12Months', Header: 'DOB Jobs 12m', Cell: ({ value }) => value || '0' },
        { 
            accessor: 'details', 
            Header: 'Property Details', 
            Cell: ({ row }) => {
                const details = [];
                if (row.jobTypes && row.jobTypes.length > 0) {
                    details.push(`Jobs: ${row.jobTypes.join(', ')}`);
                }
                if (row.complaintTypes && row.complaintTypes.length > 0) {
                    details.push(`Issues: ${row.complaintTypes.slice(0, 2).join(', ')}${row.complaintTypes.length > 2 ? '...' : ''}`);
                }
                if (typeof row.ownedYears === 'number') {
                    details.push(`Owned ${row.ownedYears} years`);
                } else if (row.tenureMonths) {
                    details.push(`Owned ${Math.floor(row.tenureMonths/12)} years`);
                }
                return details.join(' | ') || 'No details';
            }
        },
    ];

    return (
        <div style={{ 
            overflowX: 'auto', 
            marginTop: '20px', 
            backgroundColor: 'white', 
            padding: '20px', 
            borderRadius: '12px',
            boxShadow: '0 3px 15px rgba(0,0,0,0.05)',
        }}>
             <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start', 
                marginBottom: '16px',
                flexWrap: 'wrap',
                gap: '16px'
             }}>
                <h4 style={{ 
                    margin: '6px 0', 
                    fontSize: '1.2rem', 
                    color: '#334155',
                    fontWeight: '600'
                }}>Property Leads ({filteredLeads.length} of {leads.length})</h4>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ marginRight: '15px' }}>
                        <span style={{ fontWeight: '600', marginRight: '12px', color: '#334155' }}>Strategy:</span>
                        <button 
                            onClick={() => {
                                setActiveFilter('all');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '6px',
                                backgroundColor: activeFilter === 'all' ? '#1976d2' : '#f8fafc',
                                color: activeFilter === 'all' ? 'white' : '#475569',
                                border: activeFilter === 'all' ? 'none' : '1px solid #e2e8f0',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFilter === 'all' ? '0 2px 5px rgba(25, 118, 210, 0.2)' : 'none'
                            }}
                        >
                            All Leads
                        </button>
                        <button 
                            onClick={() => {
                                setActiveFilter('renovations');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '6px',
                                backgroundColor: activeFilter === 'renovations' ? '#2e7d32' : '#f8fafc',
                                color: activeFilter === 'renovations' ? 'white' : '#475569',
                                border: activeFilter === 'renovations' ? 'none' : '1px solid #e2e8f0',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFilter === 'renovations' ? '0 2px 5px rgba(46, 125, 50, 0.2)' : 'none'
                            }}
                        >
                            Fix & Flip
                        </button>
                        <button 
                            onClick={() => {
                                setActiveFilter('complaints');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '6px',
                                backgroundColor: activeFilter === 'complaints' ? '#e53935' : '#f8fafc',
                                color: activeFilter === 'complaints' ? 'white' : '#475569',
                                border: activeFilter === 'complaints' ? 'none' : '1px solid #e2e8f0',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFilter === 'complaints' ? '0 2px 5px rgba(229, 57, 53, 0.2)' : 'none'
                            }}
                        >
                            Neglected
                        </button>
                        <button 
                            onClick={() => {
                                setActiveFilter('recent');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '6px',
                                backgroundColor: activeFilter === 'recent' ? '#0288d1' : '#f8fafc',
                                color: activeFilter === 'recent' ? 'white' : '#475569',
                                border: activeFilter === 'recent' ? 'none' : '1px solid #e2e8f0',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFilter === 'recent' ? '0 2px 5px rgba(2, 136, 209, 0.2)' : 'none'
                            }}
                        >
                            Recent Sales
                        </button>
                        <button 
                            onClick={() => {
                                setActiveFilter('high_score');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '6px',
                                backgroundColor: activeFilter === 'high_score' ? '#9c27b0' : '#f8fafc',
                                color: activeFilter === 'high_score' ? 'white' : '#475569',
                                border: activeFilter === 'high_score' ? 'none' : '1px solid #e2e8f0',
                                padding: '7px 12px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                                fontSize: '0.9rem',
                                transition: 'all 0.2s ease',
                                boxShadow: activeFilter === 'high_score' ? '0 2px 5px rgba(156, 39, 176, 0.2)' : 'none'
                            }}
                        >
                            High Score
                        </button>
                    </div>
                    {showStrategyExplanation && (
                        <div style={{
                            backgroundColor: '#f8faff',
                            padding: '16px 20px',
                            borderRadius: '10px',
                            marginTop: '16px',
                            marginBottom: '10px',
                            fontSize: '0.95rem',
                            color: '#334155',
                            borderLeft: '4px solid',
                            borderColor: activeFilter === 'renovations' ? '#2e7d32' : 
                                       activeFilter === 'complaints' ? '#e53935' : 
                                       activeFilter === 'recent' ? '#0288d1' : 
                                       activeFilter === 'high_score' ? '#9c27b0' : '#1976d2',
                            boxShadow: '0 3px 8px rgba(0,0,0,0.06)',
                            lineHeight: '1.5',
                            transition: 'all 0.3s ease'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>
                                    Strategy: {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1).replace('_', ' ')}
                                </strong>
                                <button 
                                    onClick={() => setShowStrategyExplanation(false)}
                                    style={{ 
                                        background: 'none', 
                                        border: 'none', 
                                        cursor: 'pointer', 
                                        color: '#64748b',
                                        fontSize: '16px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        transition: 'background-color 0.2s ease'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
                                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                    ✕
                                </button>
                            </div>
                            <p style={{ margin: '8px 0 0 0', lineHeight: '1.6' }}>{strategyExplanations[activeFilter]}</p>
                        </div>
                    )}
                    <div>
                        <button style={{ 
                            padding: '8px 16px',
                            backgroundColor: '#f8fafc',
                            color: '#475569',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                        }}>
                            <span style={{ fontSize: '14px' }}>↓</span> Export CSV
                        </button>
                    </div>
                </div>
            </div>
            {filteredLeads.length === 0 ? 
                <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
                    <p>No properties match the selected strategy filter. Try another filter or neighborhood.</p>
                </div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f0f0f0' }}>
                        {columns.map(col => (
                            <th key={col.Header} style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>{col.Header}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {filteredLeads.map((row, rowIndex) => (
                        <>
                            <tr
                                key={row.bbl || rowIndex}
                                onClick={() => setExpandedBBL(expandedBBL === row.bbl ? null : row.bbl)}
                                style={{ backgroundColor: rowIndex % 2 ? '#f9f9f9' : '#fff', cursor: 'pointer' }}
                                title="Click to view details"
                            >
                                {columns.map(col => (
                                    <td key={col.accessor} style={{ border: '1px solid #ddd', padding: '8px', whiteSpace: 'nowrap' }}>
                                        {col.Cell ? col.Cell({ value: row[col.accessor], row }) : row[col.accessor]}
                                    </td>
                                ))}
                            </tr>
                            {expandedBBL === row.bbl && (
                                <tr>
                                    <td colSpan={columns.length} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {row.signalBadges && row.signalBadges.length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                    {row.signalBadges.slice(0, 8).map((b, i) => (
                                                        <span key={i} style={{ background: '#e2e8f0', color: '#334155', padding: '4px 8px', borderRadius: '999px', fontSize: '12px' }}>{b}</span>
                                                    ))}
                                                    {row.signalBadges.length > 8 && <span style={{ fontSize: '12px', color: '#64748b' }}>+{row.signalBadges.length - 8} more</span>}
                                                </div>
                                            )}
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                                                <div>
                                                    <strong>Ownership</strong>
                                                    <div>Owned: {typeof row.ownedYears === 'number' ? `${row.ownedYears} years` : row.tenureMonths ? `${Math.floor(row.tenureMonths/12)} years` : 'Unknown'}</div>
                                                    <div>Last Deed Type: {row.lastDeedType || 'N/A'}</div>
                                                    <div>Last Sale: {formatDate(row.lastSaleDate)}</div>
                                                </div>
                                                <div>
                                                    <strong>DOB Jobs (12m)</strong>
                                                    {row.dobJobs && row.dobJobs.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                                            {row.dobJobs.slice(0, 3).map((j, idx) => (
                                                                <li key={idx}>
                                                                    {j.job_type || 'Job'} — {j.job_status || 'Status'} {j.filing_date ? `(${formatDate(j.filing_date)})` : ''}
                                                                    {j._displayAddress ? ` — ${j._displayAddress}` : ''}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div>None</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <strong>311 Complaints (30d)</strong>
                                                    {row.complaints && row.complaints.length > 0 ? (
                                                        <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                                            {row.complaints.slice(0, 3).map((c, idx) => (
                                                                <li key={idx}>{c.complaint_type || 'Complaint'} {c.created_date ? `(${formatDate(c.created_date)})` : ''}</li>
                                                            ))}
                                                        </ul>
                                                    ) : (
                                                        <div>None</div>
                                                    )}
                                                </div>
                                                <div>
                                                    <strong>Development</strong>
                                                    <div>Underbuilt FAR: {(() => {
                                                        const pd = row.plutoData || {}; 
                                                        const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
                                                        const built = toNum(pd.builtfar); const allowed = Math.max(toNum(pd.residfar), toNum(pd.commfar), toNum(pd.facilfar));
                                                        const rem = allowed - built; return rem > 0 ? rem.toFixed(1) : '0.0';
                                                    })()}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </>
                    ))}
                </tbody>
            </table>
            )}
        </div>
    );
};

export default PropertyLeadsTable;
