import React, { useState, useEffect } from 'react';

const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : 'N/A';

// Strategy filter configurations
const strategies = [
    { id: 'all', label: 'All Leads', icon: '📋', color: '#3b82f6' },
    { id: 'high_score', label: 'High Score', icon: '🎯', color: '#f43f5e' },
    { id: 'renovations', label: 'Fix & Flip', icon: '🔨', color: '#10b981' },
    { id: 'complaints', label: 'Distressed', icon: '⚠️', color: '#f59e0b' },
    { id: 'recent', label: 'Recent Sales', icon: '🏷️', color: '#8b5cf6' },
];

const strategyDescriptions = {
    'all': "All properties in the selected area, sorted by likelihood score.",
    'high_score': "Properties scoring 3.0+ with multiple strong seller signals detected.",
    'renovations': "Active DOB permits suggest fix & flip or pre-sale improvements.",
    'complaints': "311 complaints indicate potential owner fatigue or neglect.",
    'recent': "Sold within 5 years - owners may be in investment or exit phase.",
};

const PropertyLeadsTable = ({ leads, onHoverLead, selectedBBL, onSelectLead }) => {
    const [activeFilter, setActiveFilter] = useState('all');
    // Internal state for standalone usage, though likely not used in main app anymore
    const [internalExpandedBBL, setInternalExpandedBBL] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });
    
    // Use controlled state if provided, otherwise internal
    const expandedBBL = selectedBBL !== undefined ? selectedBBL : internalExpandedBBL;
    const handleExpand = (bbl) => {
        const newBBL = expandedBBL === bbl ? null : bbl;
        if (onSelectLead) {
            onSelectLead(newBBL);
        } else {
            setInternalExpandedBBL(newBBL);
        }
    };
    
    const filterStrategies = {
        'all': () => true,
        'renovations': (lead) => lead.permitsLast12Months && lead.permitsLast12Months > 0,
        'complaints': (lead) => lead.complaintsLast30Days && lead.complaintsLast30Days > 0,
        'recent': (lead) => lead.lastSaleDate && (new Date().getFullYear() - new Date(lead.lastSaleDate).getFullYear() <= 5),
        'high_score': (lead) => lead.score >= 3.0
    };
    
    // First filter, then sort
    const filteredLeads = [...leads].filter(filterStrategies[activeFilter]);
    
    const sortedLeads = filteredLeads.sort((a, b) => {
        const { key, direction } = sortConfig;
        let valA = a[key];
        let valB = b[key];
        
        // Handle specifics
        if (key === 'lastSaleDate') {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
        }
        
        // Default numbers/strings
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        
        const result = valA < valB ? -1 : 1;
        return direction === 'asc' ? result : -result;
    });
    
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };
    
    // Show the specific columns the user wants with improved formatting
    const columns = [
        { accessor: 'bbl', Header: 'BBL', sortable: true },
        { accessor: 'address', Header: 'Address', sortable: true },
        { 
            accessor: 'score', 
            Header: 'Score', 
            sortable: true,
            Cell: ({ value }) => <span style={{ fontWeight: 'bold', color: value >= 4.0 ? '#d32f2f' : value >= 3.0 ? '#f57c00' : '#2e7d32' }}>{value.toFixed(1)}</span>
        },
        // Highlight key motivation indicators
        { 
            accessor: 'topIndicator', 
            Header: 'Key Motivation', 
            sortable: false,
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
                return <span style={{ color: '#94a3b8' }}>None detected</span>;
            }
        },
        { accessor: 'lastSaleDate', Header: 'Last Sale', sortable: true, Cell: ({ value }) => formatDate(value) },
        { accessor: 'complaintsLast30Days', Header: 'Complaints 30d', sortable: true, Cell: ({ value }) => value || '0' },
        { accessor: 'permitsLast12Months', Header: 'DOB Jobs 12m', sortable: true, Cell: ({ value }) => value || '0' },
        { 
            accessor: 'details', 
            Header: 'Property Details', 
            sortable: false,
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

    // Auto-scroll to selected row when it changes (e.g. from map selection)
    useEffect(() => {
        if (selectedBBL) {
            const rowElement = document.getElementById(`lead-row-${selectedBBL}`);
            if (rowElement) {
                rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [selectedBBL]);

    const activeStrategy = strategies.find(s => s.id === activeFilter) || strategies[0];
    
    return (
        <div style={{ 
            background: 'white',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            height: '100%', // Fill parent
        }}>
            {/* Header */}
            <div style={{
                padding: '24px 32px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexShrink: 0, // Prevent header from shrinking
            }}>
                <div>
                    <h2 style={{ 
                        margin: 0,
                        fontSize: '1.25rem', 
                        color: '#0f172a',
                        fontWeight: '700',
                        letterSpacing: '-0.025em',
                        marginBottom: '4px',
                    }}>
                        Property Leads
                    </h2>
                    <p style={{
                        margin: 0,
                        color: '#64748b',
                        fontSize: '0.875rem',
                    }}>
                        {filteredLeads.length} properties matched • Sorted by likelihood
                    </p>
                </div>
                
                <button style={{ 
                    padding: '10px 16px',
                    background: 'white',
                    color: '#0f172a',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.2s ease',
                }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                </button>
            </div>
            
            {/* Strategy Filters */}
            <div style={{
                padding: '16px 32px',
                background: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0, // Prevent filters from shrinking
            }}>
                <div style={{ 
                    display: 'flex', 
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginBottom: '16px',
                }}>
                    {strategies.map((strategy) => {
                        const isActive = activeFilter === strategy.id;
                        return (
                            <button 
                                key={strategy.id}
                                onClick={() => setActiveFilter(strategy.id)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '9999px',
                                    border: isActive ? '1px solid transparent' : '1px solid #cbd5e1',
                                    background: isActive ? '#0f172a' : 'white',
                                    color: isActive ? 'white' : '#64748b',
                                    cursor: 'pointer',
                                    fontWeight: isActive ? '600' : '500',
                                    fontSize: '0.875rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: isActive ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                                }}
                            >
                                <span>{strategy.icon}</span>
                                {strategy.label}
                            </button>
                        );
                    })}
                </div>
                
                {/* Strategy Description */}
                <div style={{
                    display: 'flex',
                    alignItems: 'start',
                    gap: '10px',
                    padding: '12px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.875rem',
                    color: '#64748b',
                }}>
                    <span style={{ fontSize: '1.2em' }}>💡</span>
                    <span>
                        <strong style={{ color: '#0f172a', fontWeight: '600' }}>Strategy Insight:</strong> {strategyDescriptions[activeFilter]}
                    </span>
                </div>
            </div>
            
            {/* Table Content */}
            {filteredLeads.length === 0 ? (
                <div style={{ 
                    padding: '64px 32px', 
                    textAlign: 'center',
                    flex: 1, // Fill remaining space
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <h3 style={{ 
                        margin: '0 0 8px 0',
                        color: '#0f172a',
                        fontWeight: '600',
                        fontSize: '1.125rem',
                    }}>No Properties Found</h3>
                    <p style={{ 
                        color: '#64748b',
                        margin: '0 0 24px 0',
                        fontSize: '0.9375rem',
                    }}>Try adjusting your filters or selecting a different neighborhood.</p>
                    {activeFilter !== 'all' && (
                        <button 
                            onClick={() => setActiveFilter('all')}
                            style={{
                                padding: '8px 16px',
                                background: 'white',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                color: '#475569',
                                fontWeight: '500',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ 
                    overflowX: 'auto',
                    flex: 1, // Fill remaining space
                    overflowY: 'auto',
                    scrollbarWidth: 'thin',
                }}>
                    <table style={{ 
                        width: '100%', 
                        borderCollapse: 'separate', // Required for sticky headers
                        borderSpacing: 0,
                        fontSize: '0.875rem',
                    }}>
                        <thead>
                            <tr style={{ 
                                background: '#f8fafc',
                            }}>
                                {columns.map(col => (
                                    <th 
                                        key={col.Header} 
                                        onClick={() => col.sortable && handleSort(col.accessor)}
                                        style={{ 
                                            position: 'sticky',
                                            top: 0,
                                            zIndex: 10,
                                            background: '#f8fafc',
                                            padding: '16px 24px',
                                            textAlign: 'left',
                                            fontWeight: '600',
                                            color: sortConfig.key === col.accessor ? '#0f172a' : '#475569',
                                            fontSize: '0.75rem',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em',
                                            whiteSpace: 'nowrap',
                                            borderBottom: '1px solid #e2e8f0',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                            cursor: col.sortable ? 'pointer' : 'default',
                                            userSelect: 'none',
                                            transition: 'color 0.2s ease',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {col.Header}
                                            {col.sortable && (
                                                <span style={{ 
                                                    fontSize: '1rem',
                                                    lineHeight: 1,
                                                    color: sortConfig.key === col.accessor ? '#3b82f6' : '#cbd5e1' 
                                                }}>
                                                    {sortConfig.key === col.accessor 
                                                        ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                                                        : '↕'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeads.map((row, rowIndex) => (
                                <React.Fragment key={row.bbl || rowIndex}>
                                    <tr
                                        onClick={() => handleExpand(row.bbl)}
                                        style={{ 
                                            background: expandedBBL === row.bbl ? '#eff6ff' : 'white',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f1f5f9',
                                            transition: 'background 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (expandedBBL !== row.bbl) e.currentTarget.style.background = '#f8fafc';
                                            if (onHoverLead) onHoverLead(row.bbl);
                                        }}
                                        onMouseLeave={(e) => {
                                            if (expandedBBL !== row.bbl) e.currentTarget.style.background = 'white';
                                            if (onHoverLead) onHoverLead(null);
                                        }}
                                        id={`lead-row-${row.bbl}`} // Add ID for scrolling
                                    >
                                        {columns.map(col => (
                                            <td key={col.accessor} style={{ 
                                                padding: '16px 24px',
                                                color: '#334155',
                                                whiteSpace: 'nowrap',
                                                verticalAlign: 'middle',
                                            }}>
                                                {col.Cell ? col.Cell({ value: row[col.accessor], row }) : row[col.accessor]}
                                            </td>
                                        ))}
                                    </tr>
                                    
                                    {/* Expanded Details Row */}
                                    {expandedBBL === row.bbl && (
                                        <tr>
                                            <td colSpan={columns.length} style={{ 
                                                padding: 0,
                                                background: '#f8fafc',
                                                boxShadow: 'inset 0 4px 6px -4px rgba(0,0,0,0.1)',
                                            }}>
                                                <div style={{ 
                                                    padding: '24px 32px',
                                                    borderBottom: '1px solid #e2e8f0',
                                                }}>
                                                    {/* Signal Badges */}
                                                    {row.signalBadges && row.signalBadges.length > 0 && (
                                                        <div style={{ 
                                                            display: 'flex', 
                                                            flexWrap: 'wrap', 
                                                            gap: '8px',
                                                            marginBottom: '24px',
                                                        }}>
                                                            {row.signalBadges.slice(0, 10).map((badge, i) => (
                                                                <span key={i} style={{ 
                                                                    background: 'white',
                                                                    color: '#475569',
                                                                    padding: '6px 12px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: '500',
                                                                    border: '1px solid #e2e8f0',
                                                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                                                }}>
                                                                    {badge}
                                                                </span>
                                                            ))}
                                                            {row.signalBadges.length > 10 && (
                                                                <span style={{ fontSize: '0.75rem', color: '#64748b', alignSelf: 'center' }}>
                                                                    +{row.signalBadges.length - 10} more signals
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {/* Details Grid */}
                                                    <div style={{ 
                                                        display: 'grid', 
                                                        gridTemplateColumns: 'repeat(4, 1fr)', 
                                                        gap: '24px',
                                                    }}>
                                                        {/* Ownership */}
                                                        <div style={{
                                                            background: 'white',
                                                            borderRadius: '8px',
                                                            padding: '20px',
                                                            border: '1px solid #e2e8f0',
                                                        }}>
                                                            <div style={{ 
                                                                fontWeight: '600',
                                                                color: '#3b82f6',
                                                                fontSize: '0.8125rem',
                                                                marginBottom: '12px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}>
                                                                Ownership Profile
                                                            </div>
                                                            <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.6, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>Held For</span>
                                                                    <span style={{ fontWeight: '500' }}>{typeof row.ownedYears === 'number' ? `${row.ownedYears} yrs` : row.tenureMonths ? `${Math.floor(row.tenureMonths/12)} yrs` : 'Unknown'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>Deed Type</span>
                                                                    <span style={{ fontWeight: '500' }}>{row.lastDeedType || 'N/A'}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>Last Sale</span>
                                                                    <span style={{ fontWeight: '500' }}>{formatDate(row.lastSaleDate)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        
                                                        {/* DOB Jobs */}
                                                        <div style={{
                                                            background: 'white',
                                                            borderRadius: '8px',
                                                            padding: '20px',
                                                            border: '1px solid #e2e8f0',
                                                        }}>
                                                            <div style={{ 
                                                                fontWeight: '600',
                                                                color: '#10b981',
                                                                fontSize: '0.8125rem',
                                                                marginBottom: '12px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}>
                                                                Permits & Jobs
                                                            </div>
                                                            {row.dobJobs && row.dobJobs.length > 0 ? (
                                                                <div style={{ fontSize: '0.875rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                    {row.dobJobs.slice(0, 3).map((j, idx) => (
                                                                        <div key={idx} style={{ 
                                                                            paddingBottom: idx < 2 ? '8px' : '0',
                                                                            borderBottom: idx < 2 ? '1px solid #f1f5f9' : 'none'
                                                                        }}>
                                                                            <div style={{ fontWeight: '500' }}>{j.job_type || 'Job'}</div>
                                                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{j.job_status || 'Status'}</div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ) : (
                                                                <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontStyle: 'italic' }}>No active permits found</div>
                                                            )}
                                                        </div>
                                                        
                                                        {/* Issues */}
                                                        <div style={{
                                                            background: 'white',
                                                            borderRadius: '8px',
                                                            padding: '20px',
                                                            border: '1px solid #e2e8f0',
                                                        }}>
                                                            <div style={{ 
                                                                fontWeight: '600',
                                                                color: '#f59e0b',
                                                                fontSize: '0.8125rem',
                                                                marginBottom: '12px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}>
                                                                Violations
                                                            </div>
                                                            <div style={{ fontSize: '0.875rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>311 (30d)</span>
                                                                    <span style={{ fontWeight: '500', color: row.complaintsLast30Days > 0 ? '#ef4444' : 'inherit' }}>{row.complaintsLast30Days || 0}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>HPD Total</span>
                                                                    <span style={{ fontWeight: '500', color: row.totalHpdViolations > 0 ? '#ef4444' : 'inherit' }}>{row.totalHpdViolations || 0}</span>
                                                                </div>
                                                                {row.hpdClassC > 0 && (
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', background: '#fef2f2', padding: '4px 8px', borderRadius: '4px', marginTop: '4px' }}>
                                                                        <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: '600' }}>Class C Hazardous</span>
                                                                        <span style={{ fontWeight: '700', color: '#dc2626' }}>{row.hpdClassC}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Owner & Potential */}
                                                        <div style={{
                                                            background: 'white',
                                                            borderRadius: '8px',
                                                            padding: '20px',
                                                            border: '1px solid #e2e8f0',
                                                        }}>
                                                            <div style={{ 
                                                                fontWeight: '600',
                                                                color: '#8b5cf6',
                                                                fontSize: '0.8125rem',
                                                                marginBottom: '12px',
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                            }}>
                                                                Owner & Potential
                                                            </div>
                                                            <div style={{ fontSize: '0.875rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span style={{ color: '#64748b' }}>Unused FAR</span>
                                                                    <span style={{ fontWeight: '500' }}>{(() => {
                                                                        const pd = row.plutoData || {}; 
                                                                        const toNum = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
                                                                        const built = toNum(pd.builtfar); 
                                                                        const allowed = Math.max(toNum(pd.residfar), toNum(pd.commfar), toNum(pd.facilfar));
                                                                        const rem = allowed - built; 
                                                                        return rem > 0 ? rem.toFixed(1) : '0.0';
                                                                    })()}</span>
                                                                </div>
                                                                {row.ownerPortfolioSize > 1 && (
                                                                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Portfolio in View</span>
                                                                            <span style={{ fontWeight: '600', color: '#8b5cf6', fontSize: '0.8125rem' }}>{row.ownerPortfolioSize} Properties</span>
                                                                        </div>
                                                                        <div style={{ 
                                                                            maxHeight: '120px', 
                                                                            overflowY: 'auto',
                                                                            fontSize: '0.75rem',
                                                                            color: '#475569',
                                                                            border: '1px solid #f1f5f9',
                                                                            borderRadius: '6px',
                                                                            background: '#f8fafc'
                                                                        }}>
                                                                            {row.ownerPortfolioBBLs && row.ownerPortfolioBBLs
                                                                                .filter(bbl => bbl !== row.bbl)
                                                                                .map(bbl => {
                                                                                    const peer = leads.find(l => l.bbl === bbl);
                                                                                    return (
                                                                                        <div key={bbl} style={{ 
                                                                                            padding: '6px 8px',
                                                                                            borderBottom: '1px solid #f1f5f9',
                                                                                            display: 'flex',
                                                                                            justifyContent: 'space-between'
                                                                                        }}>
                                                                                            <span style={{ fontWeight: '500' }}>{peer ? peer.address : bbl}</span>
                                                                                            {peer && peer.score >= 3.0 && (
                                                                                                <span style={{ color: '#ef4444' }}>★ {peer.score}</span>
                                                                                            )}
                                                                                        </div>
                                                                                    );
                                                                                })
                                                                            }
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PropertyLeadsTable;
