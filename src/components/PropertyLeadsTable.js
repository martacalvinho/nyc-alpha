import React, { useState } from 'react';

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

const PropertyLeadsTable = ({ leads }) => {
    // Set up filter state
    const [activeFilter, setActiveFilter] = useState('all');
    const [showStrategyExplanation, setShowStrategyExplanation] = useState(true);
    
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
        { 
            accessor: 'mortgageMonthsLeft', 
            Header: 'Mortgage Mo. Left', 
            Cell: ({ value }) => {
                if (value === null) return 'N/A';
                if (value < 0) return <span style={{ color: '#d32f2f' }}>{Math.abs(value)} overdue</span>;
                return <span>{value}</span>;
            } 
        },
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
                if (row.tenureMonths) {
                    details.push(`Owned ${Math.floor(row.tenureMonths/12)} years`);
                }
                return details.join(' | ') || 'No details';
            }
        },
    ];

    return (
        <div style={{ overflowX: 'auto', marginTop: '20px', backgroundColor: 'white', padding: '15px', borderRadius: '8px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4>Property Leads ({filteredLeads.length} of {leads.length})</h4>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ marginRight: '15px' }}>
                        <span style={{ fontWeight: 'bold', marginRight: '10px' }}>Strategy:</span>
                        <button 
                            onClick={() => {
                                setActiveFilter('all');
                                setShowStrategyExplanation(true);
                            }}
                            style={{
                                marginRight: '5px',
                                backgroundColor: activeFilter === 'all' ? '#1976d2' : '#f0f0f0',
                                color: activeFilter === 'all' ? 'white' : 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer'
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
                                marginRight: '5px',
                                backgroundColor: activeFilter === 'renovations' ? '#2e7d32' : '#f0f0f0',
                                color: activeFilter === 'renovations' ? 'white' : 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer'
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
                                marginRight: '5px',
                                backgroundColor: activeFilter === 'complaints' ? '#1976d2' : '#f0f0f0',
                                color: activeFilter === 'complaints' ? 'white' : 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer'
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
                                marginRight: '5px',
                                backgroundColor: activeFilter === 'recent' ? '#1976d2' : '#f0f0f0',
                                color: activeFilter === 'recent' ? 'white' : 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer'
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
                                marginRight: '5px',
                                backgroundColor: activeFilter === 'high_score' ? '#9c27b0' : '#f0f0f0',
                                color: activeFilter === 'high_score' ? 'white' : 'black',
                                border: 'none',
                                padding: '5px 10px',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            High Score
                        </button>
                    </div>
                    {showStrategyExplanation && (
                        <div style={{
                            backgroundColor: '#f8f9fa',
                            padding: '10px 15px',
                            borderRadius: '6px',
                            marginTop: '10px',
                            fontSize: '0.9rem',
                            color: '#505050',
                            borderLeft: '4px solid #1976d2',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <strong>Strategy: {activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1).replace('_', ' ')}</strong>
                                <button 
                                    onClick={() => setShowStrategyExplanation(false)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777' }}
                                >
                                    ✕
                                </button>
                            </div>
                            <p style={{ margin: '5px 0 0 0' }}>{strategyExplanations[activeFilter]}</p>
                        </div>
                    )}
                    <div>
                        <button style={{ marginRight: '5px' }}>Export CSV</button>
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
                        <tr key={row.bbl || rowIndex} style={{ backgroundColor: rowIndex % 2 ? '#f9f9f9' : '#fff' }}>
                            {columns.map(col => (
                                <td key={col.accessor} style={{ border: '1px solid #ddd', padding: '8px', whiteSpace: 'nowrap' }}>
                                    {col.Cell ? col.Cell({ value: row[col.accessor], row }) : row[col.accessor]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            )}
        </div>
    );
};

export default PropertyLeadsTable;
