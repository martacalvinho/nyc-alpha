import React from 'react';

const SummaryCard = ({ title, value, change, isLoading }) => (
    <div style={{
        border: '1px solid #e2e8f0', 
        borderRadius: '12px', 
        padding: '18px 20px',
        minWidth: '220px', 
        textAlign: 'left', 
        backgroundColor: 'white', 
        flex: 1,
        boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden'
    }}>
        <div style={{ 
            fontSize: '0.9em', 
            color: '#64748b', 
            marginBottom: '8px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
        }}>{title}</div>
        <div style={{ 
            fontSize: '2.2em', 
            fontWeight: '700', 
            color: '#1e293b',
            letterSpacing: '-0.5px',
            marginBottom: '4px'
        }}>
            {isLoading ? (
                <div style={{
                    width: '60px',
                    height: '20px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s infinite ease-in-out'
                }} />
            ) : value}
        </div>
        {change && !isLoading && (
            <div style={{ 
                fontSize: '0.9em', 
                color: change.startsWith('+') ? '#10b981' : '#ef4444',
                fontWeight: '500'
            }}>
                {change}
            </div>
        )}
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '5px',
            height: '100%',
            backgroundColor: title === 'Likely Sellers' ? '#1976d2' :
                           title === 'New Today' ? '#10b981' :
                           title === 'Avg Score' ? '#f59e0b' :
                           title === 'Loans Maturing' ? '#ef4444' : '#1976d2'
        }} />
    </div>
);

export default SummaryCard;
