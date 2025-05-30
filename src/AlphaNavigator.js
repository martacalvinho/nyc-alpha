import React, { useState, useEffect, useCallback } from 'react';
import NeighborhoodSelector from './NeighborhoodSelector';
import MapPluto from './MapPluto';
import PropertyLeadsTable from './components/PropertyLeadsTable';
import SummaryCard from './components/SummaryCard';
import DatasetsProgress from './components/DatasetsProgress';
import { usePropertyProcessor } from './hooks/usePropertyProcessor';

// Modern stepper component for navigation
const Stepper = ({ currentStep }) => {
    const steps = ["Select", "Map", "Load", "Analyze"];
    return (
        <div style={{ 
            display: 'flex', 
            marginBottom: '24px', 
            backgroundColor: 'white', 
            padding: '15px', 
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        }}>
            {steps.map((step, index) => {
                const stepNumber = index + 1;
                const isActive = currentStep === stepNumber;
                const isCompleted = currentStep > stepNumber;
                const stepColor = isActive ? '#1976d2' : isCompleted ? '#4caf50' : '#9e9e9e';
                
                return (
                    <div
                        key={step}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            flex: 1,
                            position: 'relative',
                        }}
                    >
                        {/* Connector line */}
                        {index > 0 && (
                            <div style={{
                                position: 'absolute',
                                left: '-50%',
                                right: '50%',
                                top: '18px',
                                height: '2px',
                                backgroundColor: isCompleted ? '#4caf50' : '#e0e0e0',
                                zIndex: 1
                            }} />
                        )}
                        
                        {/* Step circle */}
                        <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: isActive ? stepColor : 'white',
                            border: `2px solid ${stepColor}`,
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: isActive ? 'white' : stepColor,
                            fontWeight: 'bold',
                            marginBottom: '8px',
                            zIndex: 2,
                            transition: 'all 0.3s ease'
                        }}>
                            {isCompleted ? (
                                <span style={{fontSize: '16px'}}>✓</span>
                            ) : stepNumber}
                        </div>
                        
                        {/* Step label */}
                        <div style={{
                            fontSize: '14px',
                            color: isActive ? stepColor : '#666',
                            fontWeight: isActive ? '600' : '400',
                        }}>
                            {step}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

function AlphaNavigator() {
    const [currentAppStep, setCurrentAppStep] = useState(1); // 1: Select, 2: Map, 3: Load, 4: Analyze
    const [selection, setSelection] = useState({ 
        borough: 'manhattan', 
        neighborhood: 'All Manhattan',
        ntaCode: '' // Add NTA code to the selection state
    });
    const [showMap, setShowMap] = useState(false); // Map is hidden by default

    // Use our property processor hook
    const { leads, isLoading, error, stats, progress, refreshData } = usePropertyProcessor(
        selection.borough,
        selection // Pass the entire selection object to get access to the ntaCode
    );

    // Handle selection changes from dropdown or map
    const handleSelectionChange = useCallback((newSelection) => {
        console.log('Selection changed:', newSelection);
        setSelection(newSelection);
        if (newSelection.neighborhood && newSelection.neighborhood !== 'All Manhattan') {
            setCurrentAppStep(3); // Move to Load step, processor hook will auto-fetch
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
            setCurrentAppStep(3);
        }
    }, []);

    // Move to Analyze step when loading is done and data is present
    useEffect(() => {
        if (currentAppStep === 3 && !isLoading && (leads.length > 0 || progress.analysis === 'complete')) {
            setCurrentAppStep(4);
        }
    }, [isLoading, leads, progress, currentAppStep]);

    return (
        <div style={{ 
            padding: '24px', 
            backgroundColor: '#f8fafc', 
            minHeight: '100vh',
            maxWidth: '1600px',
            margin: '0 auto'
        }}>
            <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-end', 
                marginBottom: '24px'
            }}>
                <div style={{ 
                    fontSize: '0.9em', 
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                }}>
                    <span style={{ color: isLoading ? '#e67e22' : '#10b981', marginRight: '4px' }}>
                        {isLoading ? '●' : '●'}
                    </span>
                    Last Sync: {isLoading ? "Syncing..." : new Date().toLocaleTimeString()}
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ 
                display: 'flex', 
                gap: '16px', 
                marginBottom: '24px', 
                flexWrap: 'wrap' 
            }}>
                <SummaryCard title="Likely Sellers" value={stats.likelySellers} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="New Today" value={"N/A"} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="Avg Score" value={typeof stats.avgScore === 'number' ? stats.avgScore.toFixed(1) : stats.avgScore} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="Loans Maturing" value={stats.loansMaturing} isLoading={isLoading && currentAppStep < 4} />
            </div>

            <div style={{ display: 'flex', gap: '24px' }}>
                {/* Left Panel */}
                <div style={{ 
                    flex: '0 0 320px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '16px' 
                }}>
                    <Stepper currentStep={currentAppStep} />
                    <NeighborhoodSelector
                        onSelect={handleSelectionChange}
                        currentSelection={selection}
                    />
                    <DatasetsProgress progress={progress} />
                    {error && (
                        <div style={{ 
                            color: '#b91c1c', 
                            backgroundColor: '#fef2f2', 
                            padding: '14px 16px', 
                            borderRadius: '8px', 
                            borderLeft: '4px solid #ef4444',
                            boxShadow: '0 2px 6px rgba(239, 68, 68, 0.15)'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <span style={{ fontSize: '1.2em' }}>⚠</span>
                                <strong>API Error:</strong> 
                            </div>
                            <div>{error}</div>
                            <p style={{ 
                                marginTop: '8px', 
                                fontSize: '0.9em',
                                color: '#64748b'
                            }}>
                                The system is using simulated data for demonstration purposes.
                            </p>
                        </div>
                    )}
                </div>

                {/* Right Panel (Map and Leads) */}
                <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '24px' }}>
                        <button 
                            onClick={() => setShowMap(!showMap)}
                            style={{
                                padding: '10px 16px',
                                marginBottom: '12px',
                                backgroundColor: showMap ? '#1976d2' : '#f8fafc',
                                color: showMap ? 'white' : '#475569',
                                border: showMap ? 'none' : '1px solid #e2e8f0',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontSize: '0.95rem',
                                fontWeight: '500',
                                boxShadow: showMap ? '0 2px 5px rgba(25, 118, 210, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '20px',
                                height: '20px'
                            }}>
                                {showMap ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 16L12 8L20 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M4 8L12 16L20 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                )}
                            </span>
                            {showMap ? 'Hide Map' : 'Show Map'}
                        </button>
                        
                        {showMap && (
                            <div style={{ 
                                width: '100%', 
                                height: '400px', 
                                marginBottom: '20px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }}>
                                <MapPluto
                                    selectedNeighborhood={selection.neighborhood}
                                    setSelectedNeighborhood={handleMapNeighborhoodSelect}
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Always show the property leads table when on the analyze step */}
                    {currentAppStep === 4 && selection.neighborhood !== 'All Manhattan' && (
                        <PropertyLeadsTable leads={leads} />
                    )}
                    {selection.neighborhood === 'All Manhattan' && (
                        <div style={{ 
                            textAlign: 'center', 
                            padding: '32px 24px', 
                            backgroundColor: 'white', 
                            borderRadius: '12px', 
                            marginTop: '20px',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                            border: '1px solid #e2e8f0',
                            color: '#475569'
                        }}>
                            <div style={{ 
                                fontSize: '4rem', 
                                marginBottom: '16px', 
                                color: '#cbd5e1' 
                            }}>
                                🏙️
                            </div>
                            <div style={{ 
                                fontSize: '1.25rem', 
                                fontWeight: '600', 
                                marginBottom: '8px',
                                color: '#334155'
                            }}>
                                Ready to Explore
                            </div>
                            <div>
                                Please select a specific neighborhood from the dropdown menu or map to begin your analysis.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AlphaNavigator;
