(function (G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@latest/match/xrd/';
    const BIN_WIDTH = 0.5;
    const PRECISION = 100;
    const TOLERANCE = 0.4;

    let selectedPeaks = [];
    let compositions = null;
    let elementFilter = { elements: [], mode: 'and', count: 0 };

    const PERIODIC_TABLE = {
        'H': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8, 'F': 9, 'Ne': 10,
        'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16, 'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20,
        'Sc': 21, 'Ti': 22, 'V': 23, 'Cr': 24, 'Mn': 25, 'Fe': 26, 'Co': 27, 'Ni': 28, 'Cu': 29, 'Zn': 30,
        'Ga': 31, 'Ge': 32, 'As': 33, 'Se': 34, 'Br': 35, 'Kr': 36, 'Rb': 37, 'Sr': 38, 'Y': 39, 'Zr': 40,
        'Nb': 41, 'Mo': 42, 'Tc': 43, 'Ru': 44, 'Rh': 45, 'Pd': 46, 'Ag': 47, 'Cd': 48, 'In': 49, 'Sn': 50,
        'Sb': 51, 'Te': 52, 'I': 53, 'Xe': 54, 'Cs': 55, 'Ba': 56, 'La': 57, 'Ce': 58, 'Pr': 59, 'Nd': 60,
        'Pm': 61, 'Sm': 62, 'Eu': 63, 'Gd': 64, 'Tb': 65, 'Dy': 66, 'Ho': 67, 'Er': 68, 'Tm': 69, 'Yb': 70,
        'Lu': 71, 'Hf': 72, 'Ta': 73, 'W': 74, 'Re': 75, 'Os': 76, 'Ir': 77, 'Pt': 78, 'Au': 79, 'Hg': 80,
        'Tl': 81, 'Pb': 82, 'Bi': 83, 'Po': 84, 'At': 85, 'Rn': 86, 'Fr': 87, 'Ra': 88, 'Ac': 89, 'Th': 90,
        'Pa': 91, 'U': 92, 'Np': 93, 'Pu': 94, 'Am': 95, 'Cm': 96, 'Bk': 97, 'Cf': 98, 'Es': 99, 'Fm': 100,
        'Md': 101, 'No': 102, 'Lr': 103, 'Rf': 104, 'Db': 105, 'Sg': 106, 'Bh': 107, 'Hs': 108, 'Mt': 109,
        'Ds': 110, 'Rg': 111, 'Cn': 112, 'Nh': 113, 'Fl': 114, 'Mc': 115, 'Lv': 116, 'Ts': 117, 'Og': 118
    };

    const updateLabel = (text) => {
        const lbl = document.getElementById('xrd-match-label');
        if (lbl) lbl.textContent = text;
    };

    const passesElementFilter = (compId) => {
        if (!compositions) return true;
        const compAtoms = compositions[compId];
        if (!compAtoms) return true;

        const { elements, mode, count } = elementFilter;
        if (count > 0 && compAtoms.length !== count) return false;
        if (elements.length === 0) return true;

        const compSet = new Set(compAtoms);

        if (mode === 'and') {
            for (const el of elements) {
                if (!compSet.has(el)) return false;
            }
            return true;
        } else if (mode === 'or') {
            for (const el of elements) {
                if (compSet.has(el)) return true;
            }
            return false;
        } else if (mode === 'only') {
            if (compAtoms.length !== elements.length) return false;
            for (const el of elements) {
                if (!compSet.has(el)) return false;
            }
            return true;
        }
        return true;
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
                        if (selectedPeaks.length === 0) updateLabel("Select Peak");
                        G.matchXRD.renderUserMarkers();
                    });
            });
        },

        showReferencePeaks: (peaks, intensities) => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-ref-peak').remove();

            peaks.forEach((x, idx) => {
                const xPos = G.state.lastXScale(x);
                if (xPos < G.config.DIM.ML || xPos > G.config.DIM.W - G.config.DIM.MR) return;

                const intensity = intensities?.[idx] ?? 100;
                const lineHeight = 15 + (intensity / 100) * 25;

                svg.append('line')
                    .attr('class', 'xrd-ref-peak')
                    .attr('x1', xPos).attr('x2', xPos)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - lineHeight)
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

        setElementFilter: (elements, mode, count) => {
            const atomicNums = [];
            for (const el of elements) {
                const trimmed = el.trim();
                if (PERIODIC_TABLE[trimmed]) {
                    atomicNums.push(PERIODIC_TABLE[trimmed]);
                }
            }
            elementFilter = { elements: atomicNums, mode: mode || 'and', count: count || 0 };
        },

        clearElementFilter: () => {
            elementFilter = { elements: [], mode: 'and', count: 0 };
        },

        search: async () => {
            if (selectedPeaks.length === 0) {
                updateLabel('Select Peak');
                return { matches: [], cols: [] };
            }

            d3.select('#matchedData').html('<p>Searching records...</p>');

            if (!compositions) {
                try {
                    const resp = await fetch(`${XRD_BASE}meta/compositions.json`);
                    compositions = await resp.json();
                } catch {
                    d3.select('#matchedData').html('<p>Error loading data.</p>');
                    return { matches: [], cols: [] };
                }
            }

            const results = new Map();

            for (const userPeak of selectedPeaks) {
                const binId = Math.floor(userPeak / BIN_WIDTH);
                const matchesForThisPeak = new Map();

                try {
                    const res = await fetch(`${XRD_BASE}index/${binId}.json`);
                    const index = await res.json();

                    for (let j = 0; j < index.d.length; j++) {
                        const packed = index.d[j];
                        const compId = index.c[j];

                        if (!passesElementFilter(compId)) continue;

                        const refId = packed >> 8;
                        const offset = packed & 0xFF;
                        const refPeak = (binId * BIN_WIDTH) + (offset / PRECISION);
                        const diff = Math.abs(userPeak - refPeak);

                        if (diff <= TOLERANCE) {
                            if (!matchesForThisPeak.has(refId) || diff < matchesForThisPeak.get(refId)) {
                                matchesForThisPeak.set(refId, diff);
                            }
                        }
                    }
                } catch (e) { /* Ignore missing bins */ }

                matchesForThisPeak.forEach((diff, refId) => {
                    const proximityFactor = 1 - (diff / TOLERANCE);
                    const peakScore = 1 + proximityFactor;
                    results.set(refId, (results.get(refId) || 0) + peakScore);
                });
            }

            const maxPossibleScore = selectedPeaks.length * 2;
            const sorted = [...results.entries()]
                .map(([refId, rawScore]) => [refId, (rawScore / maxPossibleScore) * 100])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 50);

            if (!sorted.length) {
                updateLabel('No matches');
                return { matches: [], cols: [] };
            }

            const finalMatches = [];
            const chunkGroups = d3.group(sorted, d => Math.floor(d[0] / 1000));

            for (const [chunkId, items] of chunkGroups) {
                try {
                    const res = await fetch(`${XRD_BASE}data/${chunkId}.json`);
                    const chunkData = await res.json();
                    items.forEach(([refId, finalScore]) => {
                        const localIdx = refId % 1000;
                        const d = chunkData[localIdx];
                        // d = [RefCode, Formula, [Top5Peaks], [Top5Intensities]]
                        const refPeaks = d[2].map(p => p / PRECISION);
                        const refIntensities = d[3] || [];

                        finalMatches.push({
                            row: [d[0], d[1], finalScore.toFixed(1)],
                            peaks: refPeaks,
                            intensities: refIntensities,
                            score: finalScore
                        });
                    });
                } catch (e) { /* Ignore missing chunks */ }
            }

            updateLabel(`Found ${finalMatches.length}`);
            return {
                matches: finalMatches.sort((a, b) => b.score - a.score),
                cols: ['Ref ID', 'Formula', 'Score (%)']
            };
        }
    };
})(window.GraphPlotter);
