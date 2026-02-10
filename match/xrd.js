(function (G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@v1.0.0/match/xrd/';
    const BIN_WIDTH = 0.5;
    const PRECISION = 100;
    const TOLERANCE = 0.5;
    const FETCH_CONCURRENCY = 8;
    let selectedPeaks = [];
    let compositions = null;
    let elementFilter = { elements: [], mode: 'and', count: 0 };
    let lastSearchResults = null;
    const metaCache = new Map();
    const indexCache = new Map();
    const chunkCache = new Map();
    const PERIODIC_TABLE = { 'H': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8, 'F': 9, 'Ne': 10, 'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16, 'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20, 'Sc': 21, 'Ti': 22, 'V': 23, 'Cr': 24, 'Mn': 25, 'Fe': 26, 'Co': 27, 'Ni': 28, 'Cu': 29, 'Zn': 30, 'Ga': 31, 'Ge': 32, 'As': 33, 'Se': 34, 'Br': 35, 'Kr': 36, 'Rb': 37, 'Sr': 38, 'Y': 39, 'Zr': 40, 'Nb': 41, 'Mo': 42, 'Tc': 43, 'Ru': 44, 'Rh': 45, 'Pd': 46, 'Ag': 47, 'Cd': 48, 'In': 49, 'Sn': 50, 'Sb': 51, 'Te': 52, 'I': 53, 'Xe': 54, 'Cs': 55, 'Ba': 56, 'La': 57, 'Ce': 58, 'Pr': 59, 'Nd': 60, 'Pm': 61, 'Sm': 62, 'Eu': 63, 'Gd': 64, 'Tb': 65, 'Dy': 66, 'Ho': 67, 'Er': 68, 'Tm': 69, 'Yb': 70, 'Lu': 71, 'Hf': 72, 'Ta': 73, 'W': 74, 'Re': 75, 'Os': 76, 'Ir': 77, 'Pt': 78, 'Au': 79, 'Hg': 80, 'Tl': 81, 'Pb': 82, 'Bi': 83, 'Po': 84, 'At': 85, 'Rn': 86, 'Fr': 87, 'Ra': 88, 'Ac': 89, 'Th': 90, 'Pa': 91, 'U': 92, 'Np': 93, 'Pu': 94, 'Am': 95, 'Cm': 96, 'Bk': 97, 'Cf': 98, 'Es': 99, 'Fm': 100, 'Md': 101, 'No': 102, 'Lr': 103, 'Rf': 104, 'Db': 105, 'Sg': 106, 'Bh': 107, 'Hs': 108, 'Mt': 109, 'Ds': 110, 'Rg': 111, 'Cn': 112, 'Nh': 113, 'Fl': 114, 'Mc': 115, 'Lv': 116, 'Ts': 117, 'Og': 118 };
    const updateLabel = (t) => { const l = document.getElementById('xrd-match-label'); if (l) l.textContent = t; };
    const setProgress = (p) => { const b = document.getElementById('xrd-search-btn'); if (!b) return; if (p === 'done') b.classList.add('progress-done'); else { b.classList.contains('progress-done') && (b.classList.add('no-anim'), void b.offsetHeight); b.classList.remove('progress-done', 'no-anim'); b.style.setProperty('--progress', p + '%'); } };
    const setStatusMessage = (msg) => {
        const box = document.getElementById('xrd-matchedData');
        if (!box) return;
        const p = document.createElement('p');
        p.textContent = msg;
        box.replaceChildren(p);
    };
    async function mapLimit(items, limit, worker) {
        if (!items.length) return [];
        const out = new Array(items.length);
        let next = 0;
        async function run() {
            while (next < items.length) {
                const idx = next++;
                out[idx] = await worker(items[idx], idx);
            }
        }
        const slots = Math.min(limit, items.length);
        await Promise.all(Array.from({ length: slots }, run));
        return out;
    }
    async function fetchJsonWithCache(cache, url) {
        if (cache.has(url)) return cache.get(url);
        const req = fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null).then(data => {
            if (data == null) cache.delete(url);
            return data;
        });
        cache.set(url, req);
        return req;
    }
    const passesFilter = (cid) => {
        if (!compositions) return true;
        const ca = compositions[cid];
        if (!ca) return true;
        const { elements, mode, count } = elementFilter;
        if (count > 0 && ca.length !== count) return false;
        if (!elements.length) return true;
        const cs = new Set(ca);
        if (mode === 'and') { for (const e of elements) if (!cs.has(e)) return false; return true; }
        if (mode === 'or') { for (const e of elements) if (cs.has(e)) return true; return false; }
        if (mode === 'only') { if (ca.length !== elements.length) return false; for (const e of elements) if (!cs.has(e)) return false; return true; }
        return true;
    };
    const normalizeIntensity = () => {
        if (!selectedPeaks.length) return;
        const maxInt = Math.max(...selectedPeaks.map(p => p.intensity));
        if (maxInt > 0) selectedPeaks.forEach(p => p.normInt = (p.intensity / maxInt) * 100);
    };

    async function getTableSHA() {
        const raw = JSON.stringify(G.state.hot.getData());
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function getSampleCount() {
        const data = G.state.hot.getData();
        return data[0].filter((h, i) => h === 'Y-axis' && G.state.colEnabled[i] !== false).length || 1;
    }

    async function ajaxPost(action, extra = {}) {
        if (typeof instananoCredits === 'undefined') return null;
        const fd = new FormData();
        fd.append('action', action);
        fd.append('nonce', instananoCredits.nonce);
        for (const [k, v] of Object.entries(extra)) {
            if (Array.isArray(v)) v.forEach(i => fd.append(k + '[]', i));
            else fd.append(k, v);
        }
        const r = await fetch(instananoCredits.ajaxUrl, { method: 'POST', body: fd });
        return r.json();
    }

    async function fetchFullRefs(matches) {
        const refIds = matches.map(m => m.refId);
        const refs = await ajaxPost('instanano_xrd_fetch_refs', { ref_ids: refIds });
        if (refs?.success) {
            matches.forEach(m => {
                const rd = refs.data[m.refId];
                if (rd) m.fullData = rd;
            });
        }
    }

    G.matchXRD = {
        addPeak: (x, intensity) => {
            selectedPeaks.push({ x, intensity, normInt: 0 });
            normalizeIntensity();
            G.matchXRD.render();
            updateLabel("Search Database");
        },
        render: () => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-user-peak').remove();
            selectedPeaks.forEach((p, i) => {
                const xp = G.state.lastXScale(p.x);
                svg.append('line').attr('class', 'xrd-user-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 7)
                    .attr('stroke', 'red').attr('stroke-width', 3)
                    .style('cursor', 'pointer')
                    .on('click', (e) => { e.stopPropagation(); selectedPeaks.splice(i, 1); normalizeIntensity(); if (!selectedPeaks.length) updateLabel("Select Peak"); G.matchXRD.render(); });
            });
        },
        showRef: (peaks, ints) => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-ref-peak').remove();
            peaks.forEach((x, i) => {
                const xp = G.state.lastXScale(x);
                if (xp < G.config.DIM.ML || xp > G.config.DIM.W - G.config.DIM.MR) return;
                const h = 5 + ((ints?.[i] ?? 100) / 100) * 35;
                svg.append('line').attr('class', 'xrd-ref-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - h)
                    .attr('stroke', 'blue').attr('stroke-width', 1)
                    .attr('stroke-dasharray', '4,2').style('pointer-events', 'none');
            });
        },
        clear: () => { selectedPeaks = []; lastSearchResults = null; d3.selectAll('.xrd-user-peak,.xrd-ref-peak').remove(); updateLabel("Select Peak"); },
        validate: (input) => {
            if (!input.trim()) return { valid: true, invalid: [] };
            const parts = input.split(',').map(e => e.trim()).filter(e => e);
            const invalid = parts.filter(e => !PERIODIC_TABLE[e]);
            return { valid: invalid.length === 0, invalid };
        },
        setFilter: (els, mode, count) => {
            const nums = [];
            for (const e of els) { const t = e.trim(); if (PERIODIC_TABLE[t]) nums.push(PERIODIC_TABLE[t]); }
            elementFilter = { elements: nums, mode: mode || 'and', count: count || 0 };
        },
        clearFilter: () => { elementFilter = { elements: [], mode: 'and', count: 0 }; },
        search: async () => {
            if (!selectedPeaks.length) { updateLabel('Select Peak'); return { matches: [], cols: [] }; }
            setProgress(0);
            setStatusMessage('Searching and matching from ~1 million references...');
            if (!compositions) {
                compositions = await fetchJsonWithCache(metaCache, `${XRD_BASE}meta/compositions.json`);
                if (!compositions) {
                    setProgress(0);
                    setStatusMessage('Error loading.');
                    return { matches: [], cols: [] };
                }
            }
            setProgress(10);
            const candidates = new Map();
            const binSet = new Set();
            for (const p of selectedPeaks) binSet.add(Math.floor(p.x / BIN_WIDTH));
            const binArr = [...binSet];
            const binTotal = Math.max(1, binArr.length);
            let binDone = 0;
            const fetches = await mapLimit(binArr, FETCH_CONCURRENCY, async b => {
                const data = await fetchJsonWithCache(indexCache, `${XRD_BASE}index/${b}.json`);
                binDone++;
                setProgress(10 + (binDone / binTotal) * 40);
                return data;
            });
            const binData = {};
            binArr.forEach((b, i) => { if (fetches[i]) binData[b] = fetches[i]; });
            for (const up of selectedPeaks) {
                const bid = Math.floor(up.x / BIN_WIDTH);
                const idx = binData[bid];
                if (!idx) continue;
                for (let j = 0; j < idx.d.length; j++) {
                    const p = idx.d[j], cid = idx.c[j];
                    if (!passesFilter(cid)) continue;
                    const rid = p >> 8, off = p & 0xFF;
                    const rp = (bid * BIN_WIDTH) + (off / PRECISION);
                    const diff = Math.abs(up.x - rp);
                    if (diff <= TOLERANCE) {
                        if (!candidates.has(rid)) candidates.set(rid, []);
                        candidates.get(rid).push({ rp, diff, userInt: up.normInt });
                    }
                }
            }
            const sorted = [...candidates.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 50);
            if (!sorted.length) { setProgress(0); updateLabel('No matches'); return { matches: [], cols: [] }; }
            const chunks = {};
            const cids = [...new Set(sorted.map(([r]) => Math.floor(r / 1000)))];
            const chunkTotal = Math.max(1, cids.length);
            let chunkDone = 0;
            await mapLimit(cids, FETCH_CONCURRENCY, async c => {
                chunks[c] = await fetchJsonWithCache(chunkCache, `${XRD_BASE}data/${c}.json`);
                chunkDone++;
                setProgress(50 + (chunkDone / chunkTotal) * 40);
            });
            setProgress(95);
            const final = [];
            for (const [rid] of sorted) {
                const c = chunks[Math.floor(rid / 1000)];
                const d = c?.[rid % 1000];
                if (!d) continue;
                const refPeaks = d[2].map(p => p / PRECISION);
                const refInts = d[3] || [];
                const totalRefPeaks = refPeaks.length;
                let posPenalty = 0;
                let intPenalty = 0;
                let matchCount = 0;
                const usedUserPeaks = new Set();
                for (let i = 0; i < totalRefPeaks; i++) {
                    const rp = refPeaks[i];
                    const ri = refInts[i] || 50;
                    let bestMatch = null;
                    let bestIdx = -1;
                    for (let j = 0; j < selectedPeaks.length; j++) {
                        if (usedUserPeaks.has(j)) continue;
                        const diff = Math.abs(selectedPeaks[j].x - rp);
                        if (diff <= TOLERANCE && (!bestMatch || diff < bestMatch.diff)) {
                            bestMatch = { diff, userInt: selectedPeaks[j].normInt };
                            bestIdx = j;
                        }
                    }
                    if (bestMatch && bestIdx >= 0) {
                        usedUserPeaks.add(bestIdx);
                        matchCount++;
                        posPenalty += (bestMatch.diff / TOLERANCE) * 8;
                        const intDiff = Math.abs(bestMatch.userInt - ri);
                        intPenalty += (intDiff / 100) * 2;
                    } else {
                        posPenalty += 8;
                        intPenalty += 2;
                    }
                }
                const finalScore = Math.max(0, 100 - posPenalty - intPenalty);
                final.push({ row: [d[0], d[1], finalScore.toFixed(1)], refId: d[0], peaks: refPeaks, intensities: refInts, score: finalScore, matched: matchCount, total: totalRefPeaks });
            }
            final.sort((a, b) => b.score - a.score);
            setProgress('done');
            lastSearchResults = final;

            if (typeof instananoCredits !== 'undefined') {
                const sha = await getTableSHA();
                const v = await ajaxPost('instanano_verify_sha', { sha_hash: sha });
                if (v?.success && v.data.exists) {
                    await fetchFullRefs(final);
                    updateLabel(`Found ${final.length} (already unlocked)`);
                    return { matches: final, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: false };
                }
            }

            updateLabel(`Found ${final.length}`);
            return { matches: final, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: true };
        },
        getSampleCount,
        getTableSHA,
        checkCredit: async () => {
            const r = await ajaxPost('instanano_check_credit');
            return r?.success ? r.data : null;
        },
        unlock: async () => {
            if (!lastSearchResults?.length) return { ok: false, message: 'Search first.' };
            const sha = await getTableSHA();
            const n = getSampleCount();
            const r = await ajaxPost('instanano_use_credit', { sha_hash: sha, sample_count: n });
            if (!r?.success) return { ok: false, message: r?.data?.message || 'Failed.', remaining: r?.data?.remaining };
            await fetchFullRefs(lastSearchResults);
            return { ok: true, matches: lastSearchResults, remaining: r.data.remaining, already_done: r.data.already_done };
        }
    };
})(window.GraphPlotter);
