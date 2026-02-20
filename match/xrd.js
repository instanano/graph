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
    const checkedRefs = new Map();
    let compositions = null;
    let elementFilter = { elements: [], mode: 'and', count: 0 };
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
    function normalizeRefPayload(refId, peaks, intensities, color, label) {
        const rid = String(refId ?? '').trim();
        if (!rid || !Array.isArray(peaks)) return null;
        const outPeaks = [];
        const outInts = [];
        peaks.forEach((x, i) => {
            const xv = Number(x);
            if (!Number.isFinite(xv)) return;
            outPeaks.push(xv);
            const iv = Number(intensities?.[i]);
            outInts.push(Number.isFinite(iv) && iv >= 0 ? iv : 100);
        });
        if (!outPeaks.length) return null;
        return { refId: rid, peaks: outPeaks, intensities: outInts, color: color || '', label: String(label ?? rid).trim() || rid };
    }
    function pickRefColor(preferred = '') {
        const palette = Array.isArray(G.config.COLORS) && G.config.COLORS.length ? G.config.COLORS : ['#0000FF'];
        if (typeof preferred === 'string' && /^#[0-9a-f]{3,8}$/i.test(preferred)) return preferred;
        const used = new Set(Array.from(checkedRefs.values(), r => r.color));
        const free = palette.find(c => !used.has(c));
        return free || palette[checkedRefs.size % palette.length];
    }
    function drawRefPeaks(svg, refs, className, { color, strokeWidth, dash } = {}) {
        const xMin = G.config.DIM.ML;
        const xMax = G.config.DIM.W - G.config.DIM.MR;
        refs.forEach(ref => {
            const col = typeof color === 'function' ? color(ref) : (color || '#1f77b4');
            ref.peaks.forEach((x, i) => {
                const xp = G.state.lastXScale(x);
                if (!Number.isFinite(xp) || xp < xMin || xp > xMax) return;
                const h = 5 + ((ref.intensities?.[i] ?? 100) / 100) * 35;
                const line = svg.append('line').attr('class', className).attr('data-refid', ref.refId)
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - h)
                    .attr('stroke', col).attr('stroke-width', strokeWidth || 1)
                    .style('pointer-events', 'none');
                if (dash) line.attr('stroke-dasharray', dash);
            });
        });
    }
    function drawCheckedLegend(svg, refs) {
        svg.selectAll('g.xrd-ref-legend-group').remove();
        if (!refs.length) return;
        const header = G.state.hot?.getData?.()?.[0] || [];
        const baseCount = header.reduce((n, h, i) => n + (h === 'Y-axis' && G.state.colEnabled[i] !== false ? 1 : 0), 0);
        const x = G.config.DIM.W - G.config.DIM.MR - 100;
        const y = G.config.DIM.MT + 25 + (baseCount * 20);
        const marker = 20;
        refs.forEach((ref, i) => {
            const g = svg.append('g').attr('class', 'xrd-ref-legend-group').attr('transform', `translate(${x},${y + (i * 20)})`);
            g.append('line').attr('x1', 0).attr('x2', marker).attr('y1', 0).attr('y2', 0)
                .attr('stroke', ref.color).attr('stroke-width', 2).attr('stroke-dasharray', '4,2');
            const fo = G.utils.editableText(g, { x: marker + 5, y: -10, text: ref.label || ref.refId });
            fo.fo.attr('width', fo.div.node().scrollWidth + fo.pad);
            const div = fo.div.node();
            div.addEventListener('click', e => {
                e.stopPropagation();
                G.features.activateText?.(d3.select(div), fo.fo);
            });
            div.addEventListener('keydown', e => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                div.blur();
            });
            div.addEventListener('blur', () => {
                const next = div.textContent.trim() || ref.refId;
                div.textContent = next;
                fo.fo.attr('width', div.scrollWidth + fo.pad);
                G.matchXRD.setRefLabel?.(ref.refId, next);
                d3.select(div).attr('contenteditable', false).style('outline', 'none').style('cursor', 'move');
            });
        });
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
            const panelOpen = !!(tab && tab.checked);
            const pinned = Array.from(checkedRefs.values());
            svg.selectAll('.xrd-ref-preview-peak,.xrd-ref-checked-peak,.xrd-ref-legend-group').remove();
            if (pinned.length) {
                drawRefPeaks(svg, pinned, 'xrd-ref-checked-peak', { color: r => r.color, strokeWidth: 1.2, dash: '4,2' });
                drawCheckedLegend(svg, pinned);
            }
            if (!panelOpen) { svg.selectAll('.xrd-user-peak').remove(); return; }
            if (previewRef) drawRefPeaks(svg, [previewRef], 'xrd-ref-preview-peak', { color: '#1f77b4', strokeWidth: 1, dash: '4,2' });
            svg.selectAll('.xrd-user-peak').remove();
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
        showRef: (peaks, ints, refId = 'preview') => {
            const parsed = normalizeRefPayload(refId, peaks, ints);
            previewRef = parsed ? { refId: parsed.refId, peaks: parsed.peaks, intensities: parsed.intensities } : null;
            G.matchXRD.render();
        },
        clear: (opts = {}) => {
            const keepChecked = !!opts.keepChecked;
            const keepSelected = !!opts.keepSelected;
            if (!keepSelected) selectedPeaks = [];
            previewRef = null;
            d3.selectAll('.xrd-user-peak,.xrd-ref-preview-peak').remove();
            if (!keepChecked) {
                checkedRefs.clear();
                d3.selectAll('.xrd-ref-checked-peak,.xrd-ref-legend-group').remove();
            }
            G.matchXRD.render();
        },
        toggleCheckedRef: (refId, peaks, ints, checked = true) => {
            const rid = String(refId ?? '').trim();
            if (!rid) return false;
            if (!checked) {
                checkedRefs.delete(rid);
                G.matchXRD.render();
                return true;
            }
            const parsed = normalizeRefPayload(rid, peaks, ints);
            if (!parsed) return false;
            const prev = checkedRefs.get(rid);
            parsed.color = prev?.color || pickRefColor(parsed.color);
            parsed.label = prev?.label || parsed.label;
            checkedRefs.set(rid, parsed);
            G.matchXRD.render();
            return true;
        },
        updateCheckedRef: (refId, peaks, ints) => {
            const rid = String(refId ?? '').trim();
            const prev = checkedRefs.get(rid);
            if (!prev) return false;
            const parsed = normalizeRefPayload(rid, peaks, ints, prev.color, prev.label);
            if (!parsed) return false;
            parsed.color = prev.color;
            parsed.label = prev.label || parsed.refId;
            checkedRefs.set(rid, parsed);
            G.matchXRD.render();
            return true;
        },
        isRefChecked: (refId) => checkedRefs.has(String(refId ?? '').trim()),
        getCheckedRefs: () => Array.from(checkedRefs.values()).map(r => ({
            refId: r.refId,
            peaks: r.peaks.slice(),
            intensities: r.intensities.slice(),
            color: r.color,
            label: r.label || r.refId
        })),
        getSelectedPeaks: () => selectedPeaks.map(p => ({ x: Number(p.x), intensity: Number(p.intensity) || 0 })),
        setSelectedPeaks: (peaks) => {
            const next = [];
            if (Array.isArray(peaks)) {
                peaks.forEach(p => {
                    const x = Number(p?.x);
                    if (!Number.isFinite(x)) return;
                    const intensity = Number(p?.intensity) || 0;
                    next.push({ x, intensity, normInt: 0 });
                });
            }
            selectedPeaks = next;
            normalizeIntensity(selectedPeaks);
            G.matchXRD.render();
        },
        setCheckedRefs: (refs) => {
            checkedRefs.clear();
            if (Array.isArray(refs)) {
                refs.forEach(r => {
                    const parsed = normalizeRefPayload(r?.refId ?? r?.id ?? r?.ref, r?.peaks, r?.intensities, r?.color, r?.label);
                    if (!parsed) return;
                    parsed.color = pickRefColor(parsed.color);
                    parsed.label = parsed.label || parsed.refId;
                    checkedRefs.set(parsed.refId, parsed);
                });
            }
            G.matchXRD.render();
        },
        setRefLabel: (refId, label) => {
            const rid = String(refId ?? '').trim();
            const item = checkedRefs.get(rid);
            if (!item) return false;
            item.label = String(label ?? '').trim() || rid;
            checkedRefs.set(rid, item);
            return true;
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
