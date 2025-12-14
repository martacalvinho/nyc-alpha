import React from 'react';

const SummaryCard = ({ title, subtitle, value, color = '#2563eb', change, isLoading }) => (
    <div style={{
        background: 'white',
        borderRadius: '12px', 
        padding: '24px',
        border: '1px solid #f1f5f9',
        boxShadow: '0 2px 4px rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
    }}
    onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.04), 0 4px 8px rgba(0,0,0,0.02)';
    }}
    onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02), 0 1px 0 rgba(0,0,0,0.02)';
    }}
    >
        <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            marginBottom: '16px'
        }}>
            <div>
                <div style={{ 
                    fontSize: '0.75rem', 
                    color: '#64748b', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '4px',
                }}>
                    {title}
                </div>
                
                {subtitle && (
                    <div style={{ 
                        fontSize: '0.8125rem', 
                        color: '#94a3b8',
                        fontWeight: '400',
                    }}>
                        {subtitle}
                    </div>
                )}
            </div>
            
            {/* Status Indicator Dot */}
            <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 0 2px white, 0 0 0 4px ${color}15`,
            }} />
        </div>
        
        <div style={{ marginTop: 'auto' }}>
            <div style={{ 
                fontSize: '2.25rem', 
                fontWeight: '700', 
                color: '#0f172a',
                lineHeight: 1,
                letterSpacing: '-0.03em',
                marginBottom: change ? '8px' : '0',
            }}>
                {isLoading ? (
                    <div style={{
                        width: '80px',
                        height: '32px',
                        background: '#f1f5f9',
                        borderRadius: '6px',
                        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                    }} />
                ) : (
                    value || '—'
                )}
            </div>
            
            {change && !isLoading && (
                <div style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem', 
                    color: change.startsWith('+') ? '#059669' : '#dc2626',
                    fontWeight: '600',
                    background: change.startsWith('+') ? '#f0fdf4' : '#fef2f2',
                    padding: '4px 8px',
                    borderRadius: '4px',
                }}>
                    <span>{change.startsWith('+') ? '↑' : '↓'}</span>
                    {change}
                </div>
            )}
        </div>
        <style>
            {`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }
            `}
        </style>
    </div>
);

export default SummaryCard;
