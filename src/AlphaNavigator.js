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
    const [selection, setSelection] = useState({ borough: 'manhattan', neighborhood: 'All Manhattan' });
    const [showMap, setShowMap] = useState(false); // Map is hidden by default

    // Use our property processor hook
    const { leads, isLoading, error, stats, progress, refreshData } = usePropertyProcessor(
        selection.borough,
        selection.neighborhood
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
            setSelection(prev => ({
                ...prev,
                neighborhood: ntaName
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
        <div style={{ padding: '20px', backgroundColor: '#f4f6f8', minHeight: '100vh' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '1.8em', color: '#333' }}>Alpha Navigator</h1>
                <div style={{ fontSize: '0.9em', color: '#777' }}>Last Sync: {isLoading ? "Syncing..." : new Date().toLocaleTimeString()}</div>
            </header>

            {/* Summary Cards */}
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <SummaryCard title="Likely Sellers" value={stats.likelySellers} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="New Today" value={"N/A"} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="Avg Score" value={typeof stats.avgScore === 'number' ? stats.avgScore.toFixed(1) : stats.avgScore} isLoading={isLoading && currentAppStep < 4} />
                <SummaryCard title="Loans Maturing" value={stats.loansMaturing} isLoading={isLoading && currentAppStep < 4} />
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                {/* Left Panel */}
                <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    <Stepper currentStep={currentAppStep} />
                    <NeighborhoodSelector
                        onSelect={handleSelectionChange}
                        currentSelection={selection}
                    />
                    <DatasetsProgress progress={progress} />
                    {error && (
                        <div style={{ color: 'red', backgroundColor: 'white', padding: '10px', borderRadius: '4px', marginTop: '10px' }}>
                            <strong>API Error:</strong> {error}
                            <p style={{ marginTop: '5px', fontSize: '0.9em' }}>
                                The system is using simulated data for demonstration purposes.
                            </p>
                        </div>
                    )}
                </div>

                {/* Right Panel (Map and Leads) */}
                <div style={{ flex: 1 }}>
                    <div style={{ marginBottom: '20px' }}>
                        <button 
                            onClick={() => setShowMap(!showMap)}
                            style={{
                                padding: '8px 15px',
                                marginBottom: '10px',
                                backgroundColor: showMap ? '#1976d2' : '#f0f0f0',
                                color: showMap ? 'white' : '#333',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px',
                                fontSize: '0.9rem'
                            }}
                        >
                            {showMap ? 'Hide Map' : 'Show Map'} {showMap ? '▲' : '▼'}
                        </button>
                        
                        {showMap && (
                            <div style={{ width: '100%', height: '400px', marginBottom: '15px' }}>
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
                        <div style={{ textAlign: 'center', padding: '20px', backgroundColor: 'white', borderRadius: '8px', marginTop: '20px' }}>
                            Please select a specific neighborhood to begin analysis.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AlphaNavigator;
