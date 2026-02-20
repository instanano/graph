(function (G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@v1.0.0/match/xrd/';
    const BIN_WIDTH = 0.5;
    const LOCK_VERSION = 1;
    const PRECISION = 100;
    const TOLERANCE = 0.5;
    const MIN_TOLERANCE = 0.25;
    const FETCH_CONCURRENCY = 8;
    const FREE_PREVIEW_REFS = 3;
    const FREE_PREVIEW_PEAKS = 3;
    const MAX_RANKED_REFS = 25;
    let selectedPeaks = [];
    let previewRef = null;
    let compositions = null;
    let elementFilter = { elements: [], mode: 'and', count: 0 };
    const selectedRefs = new Map();
    const metaCache = new Map();
    const indexCache = new Map();
    const chunkCache = new Map();
    const PERIODIC_TABLE = { 'H': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8, 'F': 9, 'Ne': 10, 'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16, 'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20, 'Sc': 21, 'Ti': 22, 'V': 23, 'Cr': 24, 'Mn': 25, 'Fe': 26, 'Co': 27, 'Ni': 28, 'Cu': 29, 'Zn': 30, 'Ga': 31, 'Ge': 32, 'As': 33, 'Se': 34, 'Br': 35, 'Kr': 36, 'Rb': 37, 'Sr': 38, 'Y': 39, 'Zr': 40, 'Nb': 41, 'Mo': 42, 'Tc': 43, 'Ru': 44, 'Rh': 45, 'Pd': 46, 'Ag': 47, 'Cd': 48, 'In': 49, 'Sn': 50, 'Sb': 51, 'Te': 52, 'I': 53, 'Xe': 54, 'Cs': 55, 'Ba': 56, 'La': 57, 'Ce': 58, 'Pr': 59, 'Nd': 60, 'Pm': 61, 'Sm': 62, 'Eu': 63, 'Gd': 64, 'Tb': 65, 'Dy': 66, 'Ho': 67, 'Er': 68, 'Tm': 69, 'Yb': 70, 'Lu': 71, 'Hf': 72, 'Ta': 73, 'W': 74, 'Re': 75, 'Os': 76, 'Ir': 77, 'Pt': 78, 'Au': 79, 'Hg': 80, 'Tl': 81, 'Pb': 82, 'Bi': 83, 'Po': 84, 'At': 85, 'Rn': 86, 'Fr': 87, 'Ra': 88, 'Ac': 89, 'Th': 90, 'Pa': 91, 'U': 92, 'Np': 93, 'Pu': 94, 'Am': 95, 'Cm': 96, 'Bk': 97, 'Cf': 98, 'Es': 99, 'Fm': 100, 'Md': 101, 'No': 102, 'Lr': 103, 'Rf': 104, 'Db': 105, 'Sg': 106, 'Bh': 107, 'Hs': 108, 'Mt': 109, 'Ds': 110, 'Rg': 111, 'Cn': 112, 'Nh': 113, 'Fl': 114, 'Mc': 115, 'Lv': 116, 'Ts': 117, 'Og': 118 };
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
        const vals = peaks.map(p => Number(p.intensity) || 0).filter(v => v > 0).sort((a, b) => b - a);
        if (!vals.length) return peaks.forEach(p => p.normInt = 0);
        const anchor = vals[Math.min(2, vals.length - 1)] || vals[0];
        peaks.forEach(p => p.normInt = anchor > 0 ? Math.max(0, Math.min(100, (Number(p.intensity) || 0) / anchor * 100)) : 0);
    };
    const getTolerance = (twoTheta) => Math.max(MIN_TOLERANCE, Math.min(TOLERANCE, 0.18 + ((Number(twoTheta) || 0) * 0.0065)));
    async function getTableSHA() {
        const raw = JSON.stringify({ t: G.state.hot.getData(), c: G.state.colEnabled });
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
    function pickRefColor() {
        const palette = G.config.COLORS || [];
        if (!palette.length) return '#0000FF';
        const used = new Set(Array.from(selectedRefs.values()).map(r => r.color));
        for (const c of palette) if (!used.has(c)) return c;
        return palette[selectedRefs.size % palette.length];
    }
    function syncRefCheckbox(refId, checked) {
        document.querySelectorAll('#xrd-matchedData input.xrd-ref-toggle').forEach(cb => {
            if (cb.dataset.refid === String(refId)) cb.checked = !!checked;
        });
    }
    function getMainLegendCount() {
        const data = G.state.hot?.getData?.();
        if (!data?.[0]) return 0;
        return data[0].filter((h, i) => h === 'Y-axis' && G.state.colEnabled[i] !== false).length;
    }
    function refLegendTransform(idx) {
        const X = G.config.DIM.W - G.config.DIM.MR - 100;
        const Y = G.config.DIM.MT + 25;
        const S = 20;
        return `translate(${X},${Y + (getMainLegendCount() + idx) * S})`;
    }
    function drawRefLegendMarker(g, color) {
        const sw = 20;
        g.selectAll('.legend-marker').remove();
        g.append('line').classed('legend-marker', true).attr('x2', sw)
            .attr('stroke', color).attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4,2');
    }
    function renderRefLegends(svg) {
        const refs = Array.from(selectedRefs.values());
        const legends = svg.selectAll('g.xrd-ref-legend').data(refs, d => d.refId);
        legends.exit().remove();
        legends
            .attr('data-refid', d => d.refId)
            .attr('transform', function (d, idx) { return this.dataset.savedTransform || refLegendTransform(idx); });
        const legendsEnter = legends.enter().append('g')
            .classed('legend-group', 1)
            .classed('xrd-ref-legend', 1)
            .attr('data-refid', d => d.refId)
            .attr('transform', (d, idx) => refLegendTransform(idx))
            .call(G.utils.applyDrag);
        legendsEnter.each(function (d) {
            const g = d3.select(this);
            drawRefLegendMarker(g, d.color);
            const fo = G.utils.editableText(g, { x: 25, y: -10, text: d.label || d.refId });
            fo.fo.attr('width', fo.div.node().scrollWidth + fo.pad);
            const div = fo.div.node();
            div.addEventListener('mousedown', e => {
                e.stopPropagation();
                G.utils.clearActive();
                G.features.activateText(fo.div, fo.fo);
            });
            div.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); div.blur(); } });
            div.addEventListener('blur', () => {
                const ref = selectedRefs.get(d.refId);
                if (!ref) return;
                const text = div.textContent.trim() || d.refId;
                ref.label = text;
                div.textContent = text;
                d3.select(div).attr('contenteditable', false).style('outline', 'none').style('cursor', 'move');
            });
        });
        legends.select('foreignObject div').text(d => d.label || d.refId);
        legends.each(function (d) {
            const g = d3.select(this);
            drawRefLegendMarker(g, d.color);
        });
    }
    function drawRefPeaks(svg, peaks, ints, cls, color, dash = '4,2', width = 1) {
        const xMin = G.config.DIM.ML;
        const xMax = G.config.DIM.W - G.config.DIM.MR;
        for (let i = 0; i < peaks.length; i++) {
            const xp = G.state.lastXScale(peaks[i]);
            if (xp < xMin || xp > xMax) continue;
            const h = 5 + ((ints?.[i] ?? 100) / 100) * 35;
            svg.append('line').attr('class', cls)
                .attr('x1', xp).attr('x2', xp)
                .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                .attr('y2', G.config.DIM.H - G.config.DIM.MB - h)
                .attr('stroke', color).attr('stroke-width', width)
                .attr('stroke-dasharray', dash).style('pointer-events', 'none');
        }
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
        },
        render: () => {
            const svg = d3.select('#chart svg');
            if (svg.empty() || !G.state.lastXScale) return;
            const tab = document.getElementById('icon5');
            const showUserPeaks = !tab || !!tab.checked;
            svg.selectAll('.xrd-ref-peak,.xrd-ref-preview-peak').remove();
            selectedRefs.forEach(ref => drawRefPeaks(svg, ref.peaks, ref.intensities, 'xrd-ref-peak', ref.color));
            if (showUserPeaks && previewRef?.peaks?.length && !selectedRefs.has(previewRef.refId)) {
                drawRefPeaks(svg, previewRef.peaks, previewRef.intensities, 'xrd-ref-preview-peak', '#1f77b4', '4,2', 1);
            }
            renderRefLegends(svg);
            svg.selectAll('.xrd-user-peak').remove();
            if (!showUserPeaks) return;
            const peaks = G.matchXRD.lockActive ? G.matchXRD.lockedPeaks : selectedPeaks;
            const xMin = G.config.DIM.ML, xMax = G.config.DIM.W - G.config.DIM.MR;
            peaks.forEach((p, i) => {
                const xp = G.state.lastXScale(p.x);
                if (xp < xMin || xp > xMax) return;
                const line = svg.append('line').attr('class', 'xrd-user-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 7)
                    .attr('stroke', 'red').attr('stroke-width', 3);
                if (!G.matchXRD.lockActive) {
                    line.style('cursor', 'pointer').on('click', (e) => { e.stopPropagation(); selectedPeaks.splice(i, 1); normalizeIntensity(selectedPeaks); G.matchXRD.render(); });
                } else {
                    line.style('cursor', 'default');
                }
            });
        },
        showRef: (peaks, ints, refId = '') => {
            previewRef = {
                refId: String(refId || ''),
                peaks: Array.isArray(peaks) ? peaks.slice() : [],
                intensities: Array.isArray(ints) ? ints.slice() : []
            };
            G.matchXRD.render();
        },
        setReference: (refId, peaks, ints, checked = true) => {
            const id = String(refId || '').trim();
            if (!id) return false;
            if (!checked) {
                G.matchXRD.removeReference(id);
                return false;
            }
            const curr = selectedRefs.get(id);
            if (curr) {
                if (Array.isArray(peaks) && peaks.length) curr.peaks = peaks.slice();
                if (Array.isArray(ints)) curr.intensities = ints.slice();
                syncRefCheckbox(id, true);
                G.matchXRD.render();
                return true;
            }
            selectedRefs.set(id, {
                refId: id,
                peaks: Array.isArray(peaks) ? peaks.slice() : [],
                intensities: Array.isArray(ints) ? ints.slice() : [],
                color: pickRefColor(),
                label: id
            });
            syncRefCheckbox(id, true);
            G.matchXRD.render();
            return true;
        },
        removeReference: (refId) => {
            const id = String(refId || '').trim();
            if (!id) return false;
            const removed = selectedRefs.delete(id);
            if (previewRef?.refId === id) previewRef = null;
            syncRefCheckbox(id, false);
            G.matchXRD.render();
            return removed;
        },
        isReferenceSelected: (refId) => selectedRefs.has(String(refId || '').trim()),
        hasResultsOnPanel: () => {
            const node = document.getElementById('xrd-matchedData');
            return !!node && node.childElementCount > 0;
        },
        clear: () => {
            selectedPeaks = [];
            previewRef = null;
            selectedRefs.clear();
            d3.selectAll('.xrd-user-peak,.xrd-ref-peak,.xrd-ref-preview-peak,g.xrd-ref-legend').remove();
            document.querySelectorAll('#xrd-matchedData input.xrd-ref-toggle').forEach(cb => { cb.checked = false; });
            if (G.matchXRD.lockActive) { G.matchXRD.render(); return; }
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
            if (!peaks.length) return { matches: [], cols: [] };
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
                    const tol = getTolerance((up.x + rp) * 0.5);
                    if (diff <= tol) {
                        if (!candidates.has(rid)) candidates.set(rid, []);
                        candidates.get(rid).push({ rp, diff, userInt: up.normInt });
                    }
                }
            }
            const sorted = [...candidates.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_RANKED_REFS);
            if (!sorted.length) { setProgress(0); return { matches: [], cols: [] }; }
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
                let posPenalty = 0, intPenalty = 0, matchCount = 0, matchBonus = 0;
                const usedUserPeaks = new Set();
                for (let i = 0; i < totalRefPeaks; i++) {
                    const rp = refPeaks[i], ri = refInts[i] || 50;
                    let bestMatch = null, bestIdx = -1;
                for (let j = 0; j < peaks.length; j++) {
                    if (usedUserPeaks.has(j)) continue;
                    const diff = Math.abs(peaks[j].x - rp);
                    const tol = getTolerance((peaks[j].x + rp) * 0.5);
                    if (diff <= tol && (!bestMatch || (diff / tol) < (bestMatch.diff / bestMatch.tol))) { bestMatch = { diff, tol, userInt: peaks[j].normInt }; bestIdx = j; }
                }
                    if (bestMatch && bestIdx >= 0) {
                        usedUserPeaks.add(bestIdx); matchCount++;
                        matchBonus += 3.5;
                        posPenalty += (bestMatch.diff / bestMatch.tol) * 8;
                        intPenalty += (Math.abs(bestMatch.userInt - ri) / 100) * 2;
                    } else { posPenalty += 6; intPenalty += 1; }
                }
                const score = matchCount ? Math.max(0, Math.min(100, ((100 - posPenalty - intPenalty + matchBonus) / (100 + (3.5 * totalRefPeaks))) * 100)) : 0;
                final.push({ row: [d[0], d[1], score.toFixed(1)], refId: d[0], peaks: refPeaks, intensities: refInts, score });
            }
            final.sort((a, b) => b.score - a.score);
            setProgress('done');
            const locked = !G.matchXRD.lockActive;
            if (locked) {
                const preview = final.slice(0, FREE_PREVIEW_REFS).map(m => ({
                    ...m,
                    peaks: m.peaks.slice(0, FREE_PREVIEW_PEAKS),
                    intensities: m.intensities.slice(0, FREE_PREVIEW_PEAKS)
                }));
                const lockedMatches = final.slice(FREE_PREVIEW_REFS).map(({ row, refId }) => ({ row, refId }));
                return {
                    matches: preview,
                    lockedMatches,
                    cols: ['Ref ID', 'Formula', 'Match (%)'],
                    locked: true
                };
            }

            return { matches: final, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: false };
        },
        getSampleCount,
        getTableSHA,
        checkCredit: async () => { const r = await ajaxPost('instanano_check_credit'); return r?.success ? r.data : null; },
        computeLockHash: async (peaks) => {
            const tableHash = await getTableSHA();
            const peaksHash = await getPeaksHash(peaks);
            const lockRaw = `${LOCK_VERSION}|${tableHash}|${peaksHash}`;
            const lockHash = await sha256Hex(lockRaw);
            return { lock_hash: lockHash, table_hash: tableHash, peaks_hash: peaksHash, lock_version: LOCK_VERSION };
        },
        unlock: async () => {
            if (!selectedPeaks.length) return { ok: false, message: 'No peaks selected.' };
            const n = getSampleCount();
            const lock = await G.matchXRD.computeLockHash(selectedPeaks);
            const r = await ajaxPost('instanano_use_credit', { lock_hash: lock.lock_hash, lock_version: lock.lock_version, sample_count: n });
            if (!r?.success || !r?.data?.signature) return { ok: false, message: r?.data?.message || 'Failed.', remaining: r?.data?.remaining };
            const accountId = Number(r.data.account_id || 0);
            G.matchXRD.lockActive = true;
            G.matchXRD.lockedPeaks = selectedPeaks.map(p => ({ x: p.x, intensity: p.intensity, normInt: p.normInt }));
            G.matchXRD.lockInfo = {
                lock_hash: lock.lock_hash,
                signature: r.data.signature,
                lock_version: lock.lock_version,
                account_id: accountId,
                table_hash: lock.table_hash,
                peaks_hash: lock.peaks_hash,
                fetch_token: r.data.fetch_token || "",
                fetch_token_expires: Number(r.data.fetch_token_expires || 0),
                verified: true
            };
            const full = await G.matchXRD.search();
            return {
                ok: true,
                matches: full.matches || [],
                remaining: Number(r.data.remaining_total ?? r.data.remaining ?? 0),
                current_remaining: Number(r.data.current_remaining ?? 0),
                already_done: false
            };
        },
        refreshFetchToken: async () => {
            const lock = G.matchXRD.lockInfo;
            if (!G.matchXRD.lockActive || !lock?.signature || !lock?.lock_hash || !lock?.account_id) return false;
            const r = await ajaxPost('instanano_verify_lock', {
                lock_hash: lock.lock_hash,
                signature: lock.signature,
                lock_version: lock.lock_version,
                account_id: lock.account_id
            });
            if (!r?.success || !r?.data?.valid || !r?.data?.fetch_token) return false;
            lock.fetch_token = r.data.fetch_token;
            lock.fetch_token_expires = Number(r.data.fetch_token_expires || 0);
            return true;
        },
        fetchRef: async (refId) => {
            const lock = G.matchXRD.lockInfo;
            if (!G.matchXRD.lockActive || !lock?.signature || !lock?.account_id) return null;
            const now = Math.floor(Date.now() / 1000);
            if (!lock.fetch_token || !lock.fetch_token_expires || now >= (lock.fetch_token_expires - 5)) {
                const ok = await G.matchXRD.refreshFetchToken();
                if (!ok) return null;
            }
            let r = await ajaxPost('instanano_xrd_fetch_refs', {
                ref_ids: [refId],
                lock_hash: lock.lock_hash,
                fetch_token: lock.fetch_token,
                account_id: lock.account_id
            });
            if (!r?.success && r?.data?.code === 'fetch_token_expired') {
                const ok = await G.matchXRD.refreshFetchToken();
                if (!ok) return null;
                r = await ajaxPost('instanano_xrd_fetch_refs', {
                    ref_ids: [refId],
                    lock_hash: lock.lock_hash,
                    fetch_token: lock.fetch_token,
                    account_id: lock.account_id
                });
            }
            return r?.success ? r.data[refId] : null;
        },
        isLocked: () => !G.matchXRD.lockActive
    };
})(window.GraphPlotter);
