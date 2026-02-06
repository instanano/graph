(function(G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@latest/match/xrd/';
    const BIN_WIDTH = 0.5;
    const PRECISION = 100;
    const TOLERANCE = 0.4; // Validated: Searching +/- 0.4 degrees
    let selectedPeaks = [];

    const updateLabel = (text) => {
        const lbl = document.getElementById('xrd-match-label');
        if (lbl) lbl.textContent = text;
    };

    G.matchXRD = {
        addPeak: (x) => {
            selectedPeaks.push(x);
            G.matchXRD.renderUserMarkers();
            updateLabel("Search Database");
        },
        renderUserMarkers: () => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-user-peak').remove();
            selectedPeaks.forEach((x, i) => {
                const xPos = G.state.lastXScale(x);
                // User peaks: RED solid lines
                svg.append('line')
                    .attr('class', 'xrd-user-peak')
                    .attr('x1', xPos).attr('x2', xPos)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 15)
                    .attr('stroke', 'red').attr('stroke-width', 3)
                    .style('cursor', 'pointer')
                    .on('click', (e) => {
                        e.stopPropagation();
                        selectedPeaks.splice(i, 1);
                        if(selectedPeaks.length === 0) updateLabel("Select Peak");
                        G.matchXRD.renderUserMarkers();
                    });
            });
        },
        // Visualization: Reference peaks as BLUE dashed lines
        showReferencePeaks: (peaks) => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-ref-peak').remove(); 
            
            peaks.forEach(x => {
                const xPos = G.state.lastXScale(x);
                if (xPos < G.config.DIM.ML || xPos > G.config.DIM.W - G.config.DIM.MR) return;

                svg.append('line')
                    .attr('class', 'xrd-ref-peak')
                    .attr('x1', xPos).attr('x2', xPos)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 25) 
                    .attr('stroke', 'blue') 
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4,2') 
                    .style('pointer-events', 'none');
            });
        },
        clear: () => {
            selectedPeaks = [];
            d3.selectAll('.xrd-user-peak').remove();
            d3.selectAll('.xrd-ref-peak').remove();
            updateLabel("XRD Data Match");
        },
        search: async () => {
            if (selectedPeaks.length === 0) return;
            d3.select('#matchedData').html('<p>Searching records...</p>');
            
            // Map: RefID -> Accumulative Score
            const results = new Map(); 

            for (const userPeak of selectedPeaks) {
                const binId = Math.floor(userPeak / BIN_WIDTH);
                
                // Track best match for THIS user peak to avoid double counting same Ref
                const matchesForThisPeak = new Map(); // RefID -> bestDiff

                try {
                    const res = await fetch(`${XRD_BASE}index/${binId}.json`);
                    const index = await res.json();
                    
                    index.d.forEach((packed) => {
                        const refId = packed >> 8;
                        const offset = packed & 0xFF;
                        const refPeak = (binId * BIN_WIDTH) + (offset / PRECISION);
                        const diff = Math.abs(userPeak - refPeak);
                        
                        if (diff <= TOLERANCE) {
                            // If reference has multiple peaks in range, take the closest one
                            if (!matchesForThisPeak.has(refId) || diff < matchesForThisPeak.get(refId)) {
                                matchesForThisPeak.set(refId, diff);
                            }
                        }
                    });
                } catch (e) { /* Ignore missing bins */ }

                // Add scores to global results
                matchesForThisPeak.forEach((diff, refId) => {
                    // SCORING LOGIC:
                    // 1. Base Score for matching: 1.0
                    // 2. Proximity Bonus: 0.0 to 1.0 (1.0 = perfect match, 0.0 = at 0.4 limit)
                    // Formula: Score = 1 + (1 - diff/0.4)
                    const proximityFactor = 1 - (diff / TOLERANCE);
                    const peakScore = 1 + proximityFactor; // Range: 1.0 to 2.0
                    
                    results.set(refId, (results.get(refId) || 0) + peakScore);
                });
            }

            // Calculate percentage based on max possible score (2.0 * numPeaks)
            const maxPossibleScore = selectedPeaks.length * 2;
            const sorted = [...results.entries()]
                .map(([refId, rawScore]) => [refId, (rawScore / maxPossibleScore) * 100])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50); // Top 50

            if (!sorted.length) return { matches: [], cols: [] };

            const finalMatches = [];
            const chunkGroups = d3.group(sorted, d => Math.floor(d[0] / 1000));
            
            for (const [chunkId, items] of chunkGroups) {
                const res = await fetch(`${XRD_BASE}data/${chunkId}.json`);
                const chunkData = await res.json();
                items.forEach(([refId, finalScore]) => {
                    const localIdx = refId % 1000;
                    const d = chunkData[localIdx]; 
                    // d = [RefID, Formula, [Top5Peaks...]]
                    
                    const refPeaks = d[2].map(p => p / PRECISION);

                    finalMatches.push({
                        row: [d[0], d[1], finalScore.toFixed(1)], 
                        peaks: refPeaks,
                        score: finalScore
                    });
                });
            }

            return { 
                matches: finalMatches.sort((a,b) => b.score - a.score), 
                cols: ['Ref ID', 'Formula', 'Score (%)'] 
            };
        }
    };
})(window.GraphPlotter);
