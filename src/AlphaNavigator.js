import React, { useState, useEffect, useCallback } from 'react';
import NeighborhoodSelector from './NeighborhoodSelector';
import MapPluto from './MapPluto';
import PropertyLeadsTable from './components/PropertyLeadsTable';
import SummaryCard from './components/SummaryCard';
import DatasetsProgress from './components/DatasetsProgress';
import { usePropertyProcessor } from './hooks/usePropertyProcessor';

// Clean professional stepper component
const Stepper = ({ currentStep }) => {
    const steps = ["Select", "Load", "Analyze"];
    
    return (
        <div style={{ 
            background: 'white',
            padding: '24px', 
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            marginBottom: '20px',
        }}>
            <div style={{ 
                fontSize: '0.75rem', 
                fontWeight: '600', 
                color: '#64748b', 
                textTransform: 'uppercase', 
                letterSpacing: '0.05em',
                marginBottom: '16px' 
            }}>
                Analysis Progress
            </div>
            <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'relative',
            }}>
                {/* Connecting Line */}
                <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '20px',
                    right: '20px',
                    height: '2px',
                    background: '#f1f5f9',
                    zIndex: 0,
                }}>
                    <div style={{
                        height: '100%',
                        width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
                        background: '#3b82f6',
                        transition: 'width 0.5s ease',
                    }} />
                </div>

                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isActive = currentStep === stepNumber;
                    const isCompleted = currentStep > stepNumber;
                    
                    return (
                        <div key={step} style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 1,
                            position: 'relative',
                        }}>
                            <div style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '50%',
                                background: isCompleted ? '#3b82f6' : isActive ? 'white' : 'white',
                                border: isCompleted ? '2px solid #3b82f6' : isActive ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                color: isCompleted ? 'white' : isActive ? '#3b82f6' : '#94a3b8',
                                fontWeight: '700',
                                fontSize: '10px',
                                marginBottom: '8px',
                                boxShadow: isActive ? '0 0 0 4px rgba(59, 130, 246, 0.1)' : 'none',
                                transition: 'all 0.3s ease',
                            }}>
                                {isCompleted ? '✓' : stepNumber}
                            </div>
                            
                            <div style={{
                                fontSize: '0.75rem',
                                fontWeight: isActive ? '600' : '500',
                                color: isActive ? '#0f172a' : '#94a3b8',
                                transition: 'color 0.3s ease',
                            }}>
                                {step}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

function AlphaNavigator() {
    const [currentAppStep, setCurrentAppStep] = useState(1); // 1: Select, 2: Load, 3: Analyze
    const [selection, setSelection] = useState({ 
        borough: 'manhattan', 
        neighborhood: 'All Manhattan',
        ntaCode: '' // Add NTA code to the selection state
    });
    // Track when we entered the Load step so we don't immediately skip past it
    const [enteredLoadAt, setEnteredLoadAt] = useState(0);
    
    // UX: Interactive linking state
    const [hoveredBBL, setHoveredBBL] = useState(null);
    const [selectedBBL, setSelectedBBL] = useState(null);

    // Use our property processor hook
    const { leads, isLoading, error, stats, progress, refreshData, reRunNow, isFromCache, cacheLastUpdated } = usePropertyProcessor(
        selection.borough,
        selection // Pass the entire selection object to get access to the ntaCode
    );

    // Handle selection changes from dropdown or map
    const handleSelectionChange = useCallback((newSelection) => {
        console.log('Selection changed:', newSelection);
        setSelection(newSelection);
        if (newSelection.neighborhood && newSelection.neighborhood !== 'All Manhattan') {
            // Go directly to Load step; map will be visible during load
            setCurrentAppStep(2);
            setEnteredLoadAt(Date.now());
        } else {
            setCurrentAppStep(1); // Back to select if "All Manhattan"
        }
    }, []);
    
    // Special handler for map clicks which only provide neighborhood name
    const handleMapNeighborhoodSelect = useCallback((ntaName) => {
        console.log('Map selection:', ntaName);
        if (ntaName) {
            // Try to find the matching NTA code from the neighborhood name
            // This would need to be enhanced with a proper mapping if available
            // For now, we'll set just the name which should work with our existing code
            setSelection(prev => ({
                ...prev,
                neighborhood: ntaName,
                ntaCode: '' // We'd need a lookup table to get the proper NTA code from the name
            }));
            // Stay on Load step (map visible) to show the highlight
            setCurrentAppStep(2);
            setEnteredLoadAt(Date.now());
        }
    }, []);

    // Move to Analyze step when loading is done and data is present
    useEffect(() => {
        if (currentAppStep === 2 && !isLoading && leads.length > 0) {
            const dwellMs = 900; // keep Load visible for a brief moment so map initializes
            const elapsed = Date.now() - enteredLoadAt;
            if (elapsed >= dwellMs) {
                setCurrentAppStep(3);
            } else {
                const timeout = setTimeout(() => setCurrentAppStep(3), dwellMs - elapsed);
                return () => clearTimeout(timeout);
            }
        }
    }, [isLoading, leads, currentAppStep, enteredLoadAt]);

    return (
        <div style={{ 
            padding: '32px 40px',
            minHeight: '100vh',
            background: '#f8fafc', // Slate-50
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
            color: '#0f172a', // Slate-900
        }}>
            <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
                {/* Header Section */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    marginBottom: '32px',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '24px',
                }}>
                    <div>
                        <h1 style={{
                            fontSize: '1.875rem',
                            fontWeight: '800',
                            color: '#0f172a',
                            margin: '0 0 8px 0',
                            letterSpacing: '-0.025em',
                        }}>
                            NYC Alpha
                        </h1>
                        <p style={{
                            color: '#64748b', // Slate-500
                            fontSize: '1rem',
                            margin: 0,
                            fontWeight: '400',
                        }}>
                            Real Estate Intelligence & Lead Generation
                        </p>
                    </div>
                    
                    {/* Status Badge */}
                    <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'white',
                        padding: '10px 16px',
                        borderRadius: '9999px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    }}>
                        <div style={{
                            position: 'relative',
                            width: '8px',
                            height: '8px',
                        }}>
                            <div style={{
                                position: 'absolute',
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: isLoading ? '#f59e0b' : '#10b981',
                            }} />
                            {isLoading && (
                                <div style={{
                                    position: 'absolute',
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: '#f59e0b',
                                    opacity: 0.5,
                                    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                                }} />
                            )}
                        </div>
                        <span style={{ 
                            color: '#334155', 
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            fontVariantNumeric: 'tabular-nums',
                        }}>
                            {isLoading ? "Syncing Data..." : `Last Synced ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </span>
                    </div>
                </div>

                {/* Summary Cards Grid */}
                <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px', 
                    marginBottom: '32px',
                }}>
                    <SummaryCard 
                        title="High Potential" 
                        subtitle="Score ≥ 3.0"
                        value={stats.likelySellers} 
                        color="#ef4444" // Red-500
                        isLoading={isLoading && currentAppStep < 3} 
                    />
                    <SummaryCard 
                        title="Properties Analyzed" 
                        subtitle="Current View"
                        value={stats.totalAnalyzed} 
                        color="#3b82f6" // Blue-500
                        isLoading={isLoading && currentAppStep < 3} 
                    />
                    <SummaryCard 
                        title="Average Score" 
                        subtitle="Seller Likelihood"
                        value={typeof stats.avgScore === 'number' ? stats.avgScore.toFixed(1) : stats.avgScore} 
                        color="#f59e0b" // Amber-500
                        isLoading={isLoading && currentAppStep < 3} 
                    />
                    <SummaryCard 
                        title="Visible Leads" 
                        subtitle="Filtered Results"
                        value={stats.displayedLeads} 
                        color="#10b981" // Emerald-500
                        isLoading={isLoading && currentAppStep < 3} 
                    />
                </div>

                {/* Main Content Area */}
                <div style={{ 
                    display: 'flex', 
                    gap: '32px',
                    alignItems: 'flex-start',
                }}>
                    {/* Left Panel - Controls */}
                    <div style={{ 
                        flex: '0 0 320px', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '20px',
                        position: 'sticky',
                        top: '24px',
                    }}>
                        <Stepper currentStep={currentAppStep} />
                        
                        <NeighborhoodSelector
                            onSelect={handleSelectionChange}
                            currentSelection={selection}
                        />
                        
                        <DatasetsProgress progress={progress} />
                        
                        {/* Cache Control Card */}
                        {selection.neighborhood !== 'All Manhattan' && (
                            <div style={{
                                background: 'white',
                                borderRadius: '12px',
                                padding: '16px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                            }}>
                                <div style={{ 
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <div>
                                        <div style={{ 
                                            fontSize: '0.875rem', 
                                            fontWeight: '600',
                                            color: '#0f172a',
                                            marginBottom: '2px',
                                        }}>
                                            {isFromCache ? 'Cached Analysis' : 'Live Analysis'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                            {isFromCache && cacheLastUpdated 
                                                ? `Updated ${new Date(cacheLastUpdated).toLocaleDateString()}`
                                                : 'Running real-time'
                                            }
                                        </div>
                                    </div>
                                    <button
                                        disabled={isLoading}
                                        onClick={() => {
                                            if (currentAppStep !== 2) setCurrentAppStep(2);
                                            setEnteredLoadAt(Date.now());
                                            reRunNow();
                                        }}
                                        style={{
                                            background: isLoading ? '#f1f5f9' : 'white',
                                            color: isLoading ? '#94a3b8' : '#3b82f6',
                                            border: '1px solid',
                                            borderColor: isLoading ? 'transparent' : '#3b82f6',
                                            borderRadius: '8px',
                                            padding: '8px 12px',
                                            fontSize: '0.8125rem',
                                            fontWeight: '600',
                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isLoading) {
                                                e.currentTarget.style.background = '#eff6ff';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isLoading) {
                                                e.currentTarget.style.background = 'white';
                                            }
                                        }}
                                    >
                                        {isLoading ? 'Running...' : 'Refresh Data'}
                                    </button>
                                </div>
                            </div>
                        )}
                        
                        {error && (
                            <div style={{ 
                                background: '#fef2f2',
                                padding: '16px', 
                                borderRadius: '12px', 
                                border: '1px solid #fee2e2',
                                display: 'flex',
                                gap: '12px',
                            }}>
                                <div style={{ color: '#ef4444' }}>⚠️</div>
                                <div>
                                    <div style={{ 
                                        fontWeight: '600',
                                        color: '#991b1b',
                                        fontSize: '0.875rem',
                                        marginBottom: '2px',
                                    }}>
                                        System Error
                                    </div>
                                    <div style={{ fontSize: '0.8125rem', color: '#b91c1c' }}>{error}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Panel - Map and Leads */}
                    <div style={{ 
                        flex: 1, 
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        height: currentAppStep === 3 && selection.neighborhood !== 'All Manhattan' ? 'calc(100vh - 140px)' : 'auto',
                    }}>
                        {/* Split View Container for Step 3 */}
                        {currentAppStep === 3 && selection.neighborhood !== 'All Manhattan' ? (
                            <div style={{ 
                                display: 'grid',
                                gridTemplateColumns: '55% 1fr', // Table wider than Map
                                gap: '24px',
                                height: '100%',
                                minHeight: 0, // Required for nested scrolling
                            }}>
                                {/* Left Column: Table */}
                                <div style={{ 
                                    height: '100%', 
                                    minHeight: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    animation: 'fadeIn 0.5s ease-out'
                                }}>
                                    <PropertyLeadsTable 
                                        leads={leads} 
                                        onHoverLead={setHoveredBBL}
                                        selectedBBL={selectedBBL}
                                        onSelectLead={setSelectedBBL}
                                    />
                                </div>

                                {/* Right Column: Map */}
                                <div style={{ 
                                    height: '100%', 
                                    borderRadius: '16px', 
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                                    background: 'white',
                                    position: 'relative'
                                }}>
                                    <MapPluto
                                        selectedNeighborhood={selection.neighborhood}
                                        setSelectedNeighborhood={handleMapNeighborhoodSelect}
                                        leads={leads}
                                        hoveredBBL={hoveredBBL}
                                        onSelectLead={setSelectedBBL}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* Default Stacked View for Selection/Loading Steps */
                            <>
                                <div style={{ 
                                    width: '100%', 
                                    height: '600px', // Taller map for selection
                                    marginBottom: '24px',
                                    borderRadius: '16px', 
                                    overflow: 'hidden',
                                    border: '1px solid #e2e8f0',
                                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
                                    background: 'white',
                                    transition: 'height 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                }}>
                                    <MapPluto
                                        selectedNeighborhood={selection.neighborhood}
                                        setSelectedNeighborhood={handleMapNeighborhoodSelect}
                                        leads={leads}
                                        hoveredBBL={hoveredBBL}
                                    />
                                </div>
                                
                                {selection.neighborhood === 'All Manhattan' && (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        padding: '80px 40px', 
                                        background: 'white',
                                        borderRadius: '16px', 
                                        border: '1px dashed #cbd5e1',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <div style={{ 
                                            fontSize: '48px',
                                            marginBottom: '24px',
                                            background: '#f1f5f9',
                                            width: '96px',
                                            height: '96px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                        }}>
                                            🏙️
                                        </div>
                                        <h2 style={{ 
                                            fontSize: '1.5rem', 
                                            fontWeight: '700', 
                                            marginBottom: '8px',
                                            color: '#0f172a',
                                        }}>
                                            Ready to Analyze
                                        </h2>
                                        <p style={{
                                            color: '#64748b',
                                            fontSize: '1rem',
                                            maxWidth: '480px',
                                            margin: '0 auto',
                                            lineHeight: 1.6,
                                        }}>
                                            Select a neighborhood from the sidebar or click on the map to begin the comprehensive property analysis.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
            <style>
                {`
                    @keyframes ping {
                        75%, 100% {
                            transform: scale(2);
                            opacity: 0;
                        }
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `}
            </style>
        </div>
    );
}

export default AlphaNavigator;
