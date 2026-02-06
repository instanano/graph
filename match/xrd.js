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
        },
        removePeak: (idx) => {
            selectedPeaks.splice(idx, 1);
            G.matchXRD.renderUserMarkers();
        },
        clearPeaks: () => {
            selectedPeaks = [];
            G.matchXRD.renderUserMarkers();
        },
        getPeaks: () => selectedPeaks,

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
                updateLabel('Select peaks first');
                return [];
            }

            updateLabel('Loading...');

            if (!compositions) {
                try {
                    const resp = await fetch(`${XRD_BASE}meta/compositions.json`);
                    compositions = await resp.json();
                } catch {
                    updateLabel('Error loading data');
                    return [];
                }
            }

            const candidateScores = new Map();
            const binPromises = [];
            const binInfos = [];

            for (const peak of selectedPeaks) {
                const minBin = Math.floor((peak - TOLERANCE) / BIN_WIDTH);
                const maxBin = Math.floor((peak + TOLERANCE) / BIN_WIDTH);

                for (let bin = minBin; bin <= maxBin; bin++) {
                    binPromises.push(fetch(`${XRD_BASE}index/${bin}.json`).then(r => r.ok ? r.json() : null).catch(() => null));
                    binInfos.push({ peak, bin });
                }
            }

            updateLabel('Searching...');
            const binResults = await Promise.all(binPromises);

            for (let i = 0; i < binResults.length; i++) {
                const indexData = binResults[i];
                if (!indexData) continue;

                const { peak, bin } = binInfos[i];
                const binStart = bin * BIN_WIDTH;
                const packed = indexData.d;
                const compIds = indexData.c;

                for (let j = 0; j < packed.length; j++) {
                    const p = packed[j];
                    const refId = p >> 8;
                    const offset = p & 0xFF;
                    const compId = compIds[j];

                    if (!passesElementFilter(compId)) continue;

                    const refPeak = binStart + (offset / PRECISION);
                    const diff = Math.abs(refPeak - peak);

                    if (diff <= TOLERANCE) {
                        const score = 1 - (diff / TOLERANCE);
                        const prev = candidateScores.get(refId) || 0;
                        candidateScores.set(refId, prev + score);
                    }
                }
            }

            const results = [];
            for (const [refId, score] of candidateScores) {
                results.push({ id: refId, score });
            }

            results.sort((a, b) => b.score - a.score);
            const topResults = results.slice(0, 50);

            if (topResults.length === 0) {
                updateLabel('No matches found');
                return [];
            }

            updateLabel('Loading details...');
            const chunkIds = [...new Set(topResults.map(r => Math.floor(r.id / 1000)))];
            const chunkData = {};

            await Promise.all(chunkIds.map(async (chunkId) => {
                try {
                    const resp = await fetch(`${XRD_BASE}data/${chunkId}.json`);
                    chunkData[chunkId] = await resp.json();
                } catch { }
            }));

            const finalResults = [];
            const maxScore = selectedPeaks.length;

            for (const r of topResults) {
                const chunkId = Math.floor(r.id / 1000);
                const localIdx = r.id % 1000;
                const chunk = chunkData[chunkId];
                if (!chunk || !chunk[localIdx]) continue;

                const entry = chunk[localIdx];
                const peaks = entry[2].map(p => p / PRECISION);
                const intensities = entry[3] || [];

                let intensityBonus = 0;
                for (let i = 0; i < Math.min(selectedPeaks.length, peaks.length); i++) {
                    for (const up of selectedPeaks) {
                        if (Math.abs(peaks[i] - up) <= TOLERANCE) {
                            intensityBonus += (intensities[i] || 100) / 100;
                            break;
                        }
                    }
                }

                const finalScore = Math.min(100, ((r.score + intensityBonus * 0.5) / (maxScore * 1.5)) * 100);

                finalResults.push({
                    refCode: entry[0],
                    formula: entry[1],
                    peaks: peaks,
                    intensities: intensities,
                    score: finalScore.toFixed(1)
                });
            }

            finalResults.sort((a, b) => parseFloat(b.score) - parseFloat(a.score));
            updateLabel(`Found ${finalResults.length} matches`);
            return finalResults;
        },

        renderUserMarkers: () => {
            const svg = d3.select('#chart-area svg');
            svg.selectAll('.xrd-user-peak').remove();
            const yRange = G.currentScales?.y?.range?.() || [0, 400];

            selectedPeaks.forEach((peak, idx) => {
                const x = G.currentScales?.x?.(peak) || 0;
                svg.append('line')
                    .attr('class', 'xrd-user-peak')
                    .attr('x1', x).attr('y1', yRange[0])
                    .attr('x2', x).attr('y2', yRange[1])
                    .attr('stroke', 'red')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '5,3')
                    .style('cursor', 'pointer')
                    .on('click', () => {
                        G.matchXRD.removePeak(idx);
                    });
            });
        },

        renderReferencePreview: (result) => {
            const svg = d3.select('#chart-area svg');
            svg.selectAll('.xrd-ref-peak').remove();

            if (!result || !result.peaks) return;

            const yRange = G.currentScales?.y?.range?.() || [0, 400];
            const height = Math.abs(yRange[1] - yRange[0]);

            result.peaks.forEach((peak, idx) => {
                const x = G.currentScales?.x?.(peak) || 0;
                const intensity = result.intensities?.[idx] ?? 100;
                const lineHeight = (intensity / 100) * height * 0.8;

                svg.append('line')
                    .attr('class', 'xrd-ref-peak')
                    .attr('x1', x).attr('y1', yRange[0])
                    .attr('x2', x).attr('y2', yRange[0] - lineHeight)
                    .attr('stroke', '#2196F3')
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4,2');
            });
        },

        clearReferencePreview: () => {
            d3.select('#chart-area svg').selectAll('.xrd-ref-peak').remove();
        },

        updatePeakList: () => {
            const list = document.getElementById('xrd-peaks-list');
            if (!list) return;

            list.innerHTML = selectedPeaks.map((p, i) =>
                `<span class="xrd-peak-tag" data-idx="${i}">${p.toFixed(2)}° <span class="remove">×</span></span>`
            ).join('');

            list.querySelectorAll('.xrd-peak-tag').forEach(tag => {
                tag.querySelector('.remove').addEventListener('click', (e) => {
                    e.stopPropagation();
                    G.matchXRD.removePeak(parseInt(tag.dataset.idx));
                    G.matchXRD.updatePeakList();
                });
            });
        }
    };
})(window.G = window.G || {});
