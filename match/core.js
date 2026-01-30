(function (G) {
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph@latest/match';
    let compositions = null;

    G.MatchEngine = {
        materials: null,
        threshold: 50,

        async loadDB(type) {
            const url = `${CDN_BASE}/${type}/match.json`;
            const res = await fetch(url);
            if (!res.ok) return [];
            this.materials = await res.json();
            return this.materials;
        },

        match(peakPositions, options = {}) {
            const { tolerance = 20, limit = 50, mode } = options;
            if (!this.materials || !peakPositions.length) return [];
            const results = [];
            for (const mat of this.materials) {
                const refPeaks = mat.peaks || mat.p || [];
                let matchCount = 0;
                for (const up of peakPositions) {
                    for (const rp of refPeaks) {
                        const refVal = typeof rp === 'number' ? rp : rp.pos || rp[0];
                        if (Math.abs(up - refVal) <= tolerance) { matchCount++; break; }
                    }
                }
                if (matchCount > 0) {
                    results.push({ ref: mat.ref || mat.n || mat.name, formula: mat.formula || mat.f, score: matchCount / peakPositions.length, matches: matchCount });
                }
            }
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        }
    };

    G.XRDMatch = {
        binWidth: 0.5,
        precision: 100,
        indexCache: {},

        async loadCompositions() {
            if (compositions) return compositions;
            const res = await fetch(`${CDN_BASE}/xrd/meta/compositions.json`);
            compositions = await res.json();
            return compositions;
        },

        async loadBin(binId) {
            if (this.indexCache[binId]) return this.indexCache[binId];
            const url = `${CDN_BASE}/xrd/index/${binId}.json`;
            try {
                const res = await fetch(url);
                if (!res.ok) return null;
                const data = await res.json();
                this.indexCache[binId] = data;
                return data;
            } catch (e) { return null; }
        },

        async search(peaks, options = {}) {
            const { tolerance = 0.4, elements = [], limit = 50 } = options;
            await this.loadCompositions();
            const binsNeeded = new Set();
            peaks.forEach(peak => {
                const centerBin = Math.floor(peak / this.binWidth);
                const rangeBins = Math.ceil(tolerance / this.binWidth);
                for (let b = centerBin - rangeBins; b <= centerBin + rangeBins; b++) {
                    if (b >= 0) binsNeeded.add(b);
                }
            });
            const binData = await Promise.all([...binsNeeded].map(b => this.loadBin(b)));
            const scores = {};
            binData.filter(Boolean).forEach(bin => {
                const d = bin.d, c = bin.c;
                for (let i = 0; i < d.length; i++) {
                    const refId = d[i] >> 8, offset = d[i] & 0xFF;
                    const binId = Math.floor(offset / (this.binWidth * this.precision));
                    const peakPos = (binId * this.binWidth) + (offset / this.precision);
                    for (const userPeak of peaks) {
                        if (Math.abs(userPeak - peakPos) <= tolerance) {
                            scores[refId] = (scores[refId] || 0) + 1;
                            break;
                        }
                    }
                }
            });
            const results = Object.entries(scores).map(([refId, count]) => ({ refId: +refId, score: count / peaks.length, matches: count }));
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        }
    };

    G.bindMatchControls = function () {
        document.getElementById('matchBtn')?.addEventListener('click', async function () {
            const mode = document.querySelector('input[name="axistitles"]:checked')?.value;
            if (!mode) return alert('Select a chart mode first');
            const series = G.getSeries();
            if (!series.length) return alert('No data to match');
            const peaks = [];
            series.forEach(sv => {
                const maxY = Math.max(...sv.y.filter(Number.isFinite));
                sv.y.forEach((y, i) => { if (y > maxY * 0.1 && Number.isFinite(sv.x[i])) peaks.push(sv.x[i]); });
            });
            peaks.sort((a, b) => a - b);
            const uniquePeaks = peaks.filter((v, i, a) => i === 0 || v - a[i - 1] > 1);
            await G.MatchEngine.loadDB(mode);
            const results = G.MatchEngine.match(uniquePeaks, { tolerance: mode === 'xrd' ? 0.2 : 20 });
            const container = document.getElementById('matchResults');
            if (!results.length) { container.innerHTML = '<p>No matches found</p>'; return; }
            container.innerHTML = results.map((r, i) => `<div class="match-result"><b>${i + 1}. ${r.ref}</b> (${r.formula || 'N/A'}) - Score: ${(r.score * 100).toFixed(1)}%</div>`).join('');
        });
    };

})(window.GraphPlotter);
