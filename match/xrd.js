(function (G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@v1.0.0/match/xrd/';
    const BIN_WIDTH = 0.5;
    const LOCK_VERSION = 1;
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
        async function run() { while (next < items.length) { const idx = next++; out[idx] = await worker(items[idx], idx); } }
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
        return out;
    }
    async function fetchJsonWithCache(cache, url) {
        if (cache.has(url)) return cache.get(url);
        const req = fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null).then(data => { if (data == null) cache.delete(url); return data; });
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
    const normalizeIntensity = (peaks) => {
        if (!peaks.length) return;
        const maxInt = Math.max(...peaks.map(p => p.intensity));
        if (maxInt > 0) peaks.forEach(p => p.normInt = (p.intensity / maxInt) * 100);
    };
    async function getTableSHA() {
        const raw = JSON.stringify(G.state.hot.getData());
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    async function sha256Hex(raw) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function canonicalizePeaks(peaks) {
        return peaks.map(p => [Number(p.x).toFixed(4), Number(p.intensity ?? 0).toFixed(4)])
            .sort((a, b) => a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1);
    }
    async function getPeaksHash(peaks) {
        const raw = JSON.stringify(canonicalizePeaks(peaks));
        return sha256Hex(raw);
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

    G.matchXRD = {
        lockActive: false,
        lockInfo: null,
        lockedPeaks: [],
        addPeak: (x, intensity) => {
            if (G.matchXRD.lockActive) return;
            selectedPeaks.push({ x, intensity, normInt: 0 });
            normalizeIntensity(selectedPeaks);
            G.matchXRD.render();
            updateLabel("Search Database");
        },
        render: () => {
            const svg = d3.select('#chart svg');
            const tab = document.getElementById('icon5');
            if (tab && !tab.checked) { svg.selectAll('.xrd-user-peak,.xrd-ref-peak').remove(); return; }
            svg.selectAll('.xrd-user-peak').remove();
            const peaks = G.matchXRD.lockActive ? G.matchXRD.lockedPeaks : selectedPeaks;
            peaks.forEach((p, i) => {
                const xp = G.state.lastXScale(p.x);
                const line = svg.append('line').attr('class', 'xrd-user-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 7)
                    .attr('stroke', 'red').attr('stroke-width', 3);
                if (!G.matchXRD.lockActive) {
                    line.style('cursor', 'pointer').on('click', (e) => { e.stopPropagation(); selectedPeaks.splice(i, 1); normalizeIntensity(selectedPeaks); if (!selectedPeaks.length) updateLabel("Select Peak"); G.matchXRD.render(); });
                } else {
                    line.style('cursor', 'default');
                }
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
        clear: () => {
            selectedPeaks = [];
            lastSearchResults = null;
            d3.selectAll('.xrd-user-peak,.xrd-ref-peak').remove();
            if (G.matchXRD.lockActive) { G.matchXRD.render(); return; }
            updateLabel("Select Peak");
        },
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
            const peaks = G.matchXRD.lockActive ? G.matchXRD.lockedPeaks : selectedPeaks;
            if (!peaks.length) { updateLabel('Select Peak'); return { matches: [], cols: [] }; }
            normalizeIntensity(peaks);
            setProgress(0);
            setStatusMessage('Searching and matching from ~1 million references...');
            if (!compositions) {
                compositions = await fetchJsonWithCache(metaCache, `${XRD_BASE}meta/compositions.json`);
                if (!compositions) { setProgress(0); setStatusMessage('Error loading.'); return { matches: [], cols: [] }; }
            }
            setProgress(10);
            const candidates = new Map();
            const binSet = new Set();
            for (const p of peaks) binSet.add(Math.floor(p.x / BIN_WIDTH));
            const binArr = [...binSet];
            let binDone = 0;
            const fetches = await mapLimit(binArr, FETCH_CONCURRENCY, async b => {
                const data = await fetchJsonWithCache(indexCache, `${XRD_BASE}index/${b}.json`);
                binDone++;
                setProgress(10 + (binDone / Math.max(1, binArr.length)) * 40);
                return data;
            });
            const binData = {};
            binArr.forEach((b, i) => { if (fetches[i]) binData[b] = fetches[i]; });
            for (const up of peaks) {
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
            const sorted = [...candidates.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 25);
            if (!sorted.length) { setProgress(0); updateLabel('No matches'); return { matches: [], cols: [] }; }
            const chunks = {};
            const cids = [...new Set(sorted.map(([r]) => Math.floor(r / 1000)))];
            let chunkDone = 0;
            await mapLimit(cids, FETCH_CONCURRENCY, async c => {
                chunks[c] = await fetchJsonWithCache(chunkCache, `${XRD_BASE}data/${c}.json`);
                chunkDone++;
                setProgress(50 + (chunkDone / Math.max(1, cids.length)) * 40);
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
                let posPenalty = 0, intPenalty = 0, matchCount = 0;
                const usedUserPeaks = new Set();
                for (let i = 0; i < totalRefPeaks; i++) {
                    const rp = refPeaks[i], ri = refInts[i] || 50;
                    let bestMatch = null, bestIdx = -1;
                for (let j = 0; j < peaks.length; j++) {
                    if (usedUserPeaks.has(j)) continue;
                    const diff = Math.abs(peaks[j].x - rp);
                    if (diff <= TOLERANCE && (!bestMatch || diff < bestMatch.diff)) { bestMatch = { diff, userInt: peaks[j].normInt }; bestIdx = j; }
                }
                    if (bestMatch && bestIdx >= 0) {
                        usedUserPeaks.add(bestIdx); matchCount++;
                        posPenalty += (bestMatch.diff / TOLERANCE) * 8;
                        intPenalty += (Math.abs(bestMatch.userInt - ri) / 100) * 2;
                    } else { posPenalty += 8; intPenalty += 2; }
                }
                final.push({ row: [d[0], d[1], Math.max(0, 100 - posPenalty - intPenalty).toFixed(1)], refId: d[0], peaks: refPeaks, intensities: refInts, score: Math.max(0, 100 - posPenalty - intPenalty) });
            }
            final.sort((a, b) => b.score - a.score);
            setProgress('done');
            lastSearchResults = final;
            const locked = !G.matchXRD.lockActive;
            if (locked) {
                updateLabel(`Found ${final.length}`);
                const preview = final.slice(0, 5).map(m => ({
                    ...m,
                    peaks: m.peaks.slice(0, 3),
                    intensities: m.intensities.slice(0, 3)
                }));
                return { matches: preview, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: true };
            }

            updateLabel(`Found ${final.length} (already unlocked)`);
            return { matches: final, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: false };
        },
        getSampleCount,
        getTableSHA,
        checkCredit: async () => { const r = await ajaxPost('instanano_check_credit'); return r?.success ? r.data : null; },
        unlock: async () => {
            if (!selectedPeaks.length) return { ok: false, message: 'No peaks selected.' };
            const n = getSampleCount();
            const tableHash = await getTableSHA();
            const peaksHash = await getPeaksHash(selectedPeaks);
            const lockRaw = `${LOCK_VERSION}|${tableHash}|${peaksHash}`;
            const lockHash = await sha256Hex(lockRaw);
            const r = await ajaxPost('instanano_use_credit', { lock_hash: lockHash, lock_version: LOCK_VERSION, sample_count: n });
            if (!r?.success || !r?.data?.signature) return { ok: false, message: r?.data?.message || 'Failed.', remaining: r?.data?.remaining };
            G.matchXRD.lockActive = true;
            G.matchXRD.lockedPeaks = selectedPeaks.map(p => ({ x: p.x, intensity: p.intensity, normInt: p.normInt }));
            G.matchXRD.lockInfo = { lock_hash: lockHash, signature: r.data.signature, lock_version: LOCK_VERSION, table_hash: tableHash, peaks_hash: peaksHash, verified: true };
            return { ok: true, matches: lastSearchResults, remaining: r.data.remaining, already_done: false };
        },
        fetchRef: async (refId) => {
            const lock = G.matchXRD.lockInfo;
            if (!G.matchXRD.lockActive || !lock?.signature) return null;
            const r = await ajaxPost('instanano_xrd_fetch_refs', { ref_ids: [refId], lock_hash: lock.lock_hash, signature: lock.signature });
            return r?.success ? r.data[refId] : null;
        },
        isLocked: () => !G.matchXRD.lockActive
    };
})(window.GraphPlotter);
