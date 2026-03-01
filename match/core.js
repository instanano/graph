(function (G) {
    "use strict";
    const XRD_MSG = "Please click any peak to add.";
    const STD_MSG = "Please click any peak.";
    const $xrd = d3.select('#xrd-matchedData');
    const $std = d3.select('#standard-matchedData');
    const icon5 = document.getElementById('icon5');
    const icon6 = document.getElementById('icon6');
    const fs = document.getElementById('xrd-filter-section');
    const ei = document.getElementById('xrd-elements');
    const unlockBtn = document.getElementById('xrd-unlock-btn');
    const rirBtn = document.getElementById('xrd-rir-btn');
    const unlockSection = document.getElementById('xrd-unlock-section');
    const plansSection = document.getElementById('xrd-credit-plans');

    function setUnlockVisible(show, n) {
        if (unlockSection) unlockSection.style.display = show ? '' : 'none';
        if (!show && plansSection) plansSection.style.display = 'none';
        if (!unlockBtn) return;
        unlockBtn.style.display = show ? '' : 'none';
        if (!show) return;
        const needed = n || G.matchXRD?.getSampleCount?.() || 1;
        unlockBtn.textContent = `Unlock Full XRD Match (${needed} Credit${needed > 1 ? 's' : ''})`;
    }
    function showPlansInline() {
        if (!plansSection) return false;
        plansSection.style.display = '';
        plansSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
    }

    function setPanelMessage(panel, message) {
        const node = panel?.node();
        if (!node) return;
        const p = document.createElement("p");
        p.textContent = message;
        node.replaceChildren(p);
    }
    function refreshRirButtonState() {
        if (!rirBtn) return;
        const unlocked = !!(G.matchXRD && !G.matchXRD.isLocked?.());
        rirBtn.style.display = unlocked ? '' : 'none';
    }

    function renderMatches(panel, matches, cols, lockedMatches = []) {
        const node = panel?.node();
        if (!node) return;
        node.replaceChildren();
        if (!matches.length && !lockedMatches.length) {
            const p = document.createElement("p");
            p.textContent = "No matching peaks found.";
            node.appendChild(p);
            return;
        }
        const frag = document.createDocumentFragment();
        const limitedTag = lockedMatches.length ? 'limited' : '';
        const rows = matches.map(m => [m, limitedTag]).concat(lockedMatches.map(m => [m, 'locked']));
        rows.forEach(([item, tag]) => {
            const row = item.row || item;
            const rowDiv = document.createElement("div");
            rowDiv.className = "matchedrow";
            if (tag) rowDiv.dataset.tag = tag;
            if (item.refId) rowDiv.dataset.refid = item.refId;
            if (tag !== 'locked') {
                rowDiv.dataset.row = JSON.stringify(Array.isArray(row) ? row : []);
                const fd = item.fullData?.data;
                const peaks = fd?.Peaks ? fd.Peaks.map(p => p.T) : item.peaks;
                const ints = fd?.Peaks ? fd.Peaks.map(p => p.I) : item.intensities;
                if (peaks) rowDiv.dataset.peaks = JSON.stringify(peaks);
                if (ints) rowDiv.dataset.ints = JSON.stringify(ints);
                if (fd) rowDiv.dataset.fulldata = JSON.stringify(fd);
            }
            if (tag !== 'locked' && item.refId) {
                const ckCell = document.createElement("div");
                const ck = document.createElement("input");
                ck.type = 'checkbox';
                ck.className = 'xrd-ref-toggle';
                ck.dataset.refid = item.refId;
                ck.checked = !!G.matchXRD?.isReferenceSelected?.(item.refId);
                ckCell.append(ck, document.createTextNode(' Add to graph'));
                rowDiv.appendChild(ckCell);
            }
            row.forEach((val, idx) => {
                const cell = document.createElement("div");
                const label = document.createElement("b");
                label.textContent = `${cols[idx]}:`;
                cell.append(label, document.createTextNode(` ${val}`));
                rowDiv.appendChild(cell);
            });
            if (tag !== 'locked' && item.fullData?.mineral) {
                const mn = document.createElement("div");
                mn.className = 'xrd-row-mineral';
                mn.textContent = `Mineral: ${item.fullData.mineral}`;
                rowDiv.appendChild(mn);
            }
            frag.appendChild(rowDiv);
        });
        node.appendChild(frag);
    }
    function parseJsonData(raw, fallback) {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_) { return fallback; }
    }
    async function resolveRowData(row) {
        let peaks = parseJsonData(row.dataset.peaks, []);
        let ints = parseJsonData(row.dataset.ints, []);
        let fulldata = parseJsonData(row.dataset.fulldata, null);
        if (!fulldata && !G.matchXRD.isLocked() && row.dataset.refid) {
            try {
                const rd = await G.matchXRD.fetchRef(row.dataset.refid);
                if (rd?.data) {
                    fulldata = rd.data;
                    row.dataset.fulldata = JSON.stringify(fulldata);
                }
            } catch (_) { }
        }
        if (fulldata?.Peaks?.length) {
            peaks = fulldata.Peaks.map(p => p.T);
            ints = fulldata.Peaks.map(p => p.I);
            row.dataset.peaks = JSON.stringify(peaks);
            row.dataset.ints = JSON.stringify(ints);
        }
        return { peaks, ints, fulldata };
    }
    const getMatchTolerance = (twoTheta) => Math.max(0.25, Math.min(0.5, 0.18 + ((Number(twoTheta) || 0) * 0.0065)));
    function getUnlockedSamplePeaks() {
        return (Array.isArray(G.matchXRD?.lockedPeaks) ? G.matchXRD.lockedPeaks : [])
            .map(p => ({ x: Number(p?.x), intensity: Number(p?.intensity) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.intensity) && p.intensity >= 0);
    }
    function getRIRValue(data) {
        if (!data || typeof data !== 'object') return null;
        const direct = [data.RIR, data.rir, data.Rir, data.Icor, data.ICOR, data.iCor, data.IIC, data.iic];
        for (const v of direct) {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) return n;
        }
        for (const [k, v] of Object.entries(data)) {
            if (!/rir|i\/?ic|icor|iic/i.test(String(k))) continue;
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) return n;
        }
        return null;
    }
    function getTopMatchedRatios(samplePeaks, refPeaks) {
        const refs = (Array.isArray(refPeaks) ? refPeaks : [])
            .map(p => ({ x: Number(p?.T), intensity: Number(p?.I) }))
            .filter(p => Number.isFinite(p.x) && Number.isFinite(p.intensity) && p.intensity > 0);
        if (!refs.length || !samplePeaks.length) return [];
        const maxRef = Math.max(...refs.map(p => p.intensity));
        if (!(maxRef > 0)) return [];
        const usedSample = new Set();
        const matches = [];
        for (const rp of refs) {
            const refNorm = (rp.intensity / maxRef) * 100;
            if (!(refNorm > 0)) continue;
            let best = null;
            let bestIdx = -1;
            for (let i = 0; i < samplePeaks.length; i++) {
                if (usedSample.has(i)) continue;
                const sp = samplePeaks[i];
                const diff = Math.abs(sp.x - rp.x);
                const tol = getMatchTolerance((sp.x + rp.x) * 0.5);
                if (diff > tol) continue;
                const q = diff / tol;
                if (!best || q < best.q) { best = { q, sampleInt: sp.intensity, refNorm }; bestIdx = i; }
            }
            if (best && bestIdx >= 0) {
                usedSample.add(bestIdx);
                matches.push(best);
            }
        }
        matches.sort((a, b) => a.q - b.q);
        return matches.slice(0, Math.min(3, matches.length));
    }
    async function getFullRefData(refId) {
        const node = $xrd.node();
        const rows = node ? Array.from(node.querySelectorAll('.matchedrow[data-refid]')) : [];
        const row = rows.find(r => String(r.dataset.refid || '').trim() === refId && r.dataset.tag !== 'locked');
        if (row) {
            const cached = parseJsonData(row.dataset.fulldata, null);
            if (cached?.Peaks?.length) return cached;
            const resolved = await resolveRowData(row);
            if (resolved.fulldata?.Peaks?.length) return resolved.fulldata;
        }
        try {
            const rd = await G.matchXRD?.fetchRef?.(refId);
            if (rd?.data?.Peaks?.length) return rd.data;
        } catch (_) { }
        return null;
    }
    function addRIRTextBox(lines) {
        const svg = d3.select('#chart svg');
        if (svg.empty()) return;
        const bx = G.config.DIM.ML + 6;
        const by = G.config.DIM.MT + 12;
        const st = svg.selectAll('foreignObject.user-text').size();
        lines.forEach((tx, i) => {
            const obj = G.utils.editableText(svg, { x: bx, y: by + (st + i) * 16, text: tx, rotation: 0 });
            obj.div.text(tx);
            obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('height', obj.div.node().scrollHeight + obj.pad);
            obj.fo.classed('user-text', true).call(G.utils.applyDrag);
        });
    }
    async function runRIRComposition() {
        if (!G.matchXRD) return;
        await G.matchXRD.verifyImportedLockIfNeeded?.();
        refreshRirButtonState();
        if (G.matchXRD.isLocked()) { alert('Unlock full XRD match first.'); return; }
        const refs = G.matchXRD.getSelectedReferences?.() || [];
        if (!refs.length) { alert('Please select at least one reference checkbox.'); return; }
        const samplePeaks = getUnlockedSamplePeaks();
        if (!samplePeaks.length) { alert('No unlocked peaks found for composition calculation.'); return; }
        const tokenOk = await G.matchXRD.refreshFetchToken?.();
        if (!tokenOk) { alert('Unlock session expired. Please unlock again.'); return; }
        const phases = [];
        const skipped = [];
        for (const ref of refs) {
            const refId = String(ref?.refId || '').trim();
            if (!refId) continue;
            const fullData = await getFullRefData(refId);
            if (!fullData?.Peaks?.length) { skipped.push(`${refId}: no ref peaks`); continue; }
            const rir = getRIRValue(fullData);
            if (!(rir > 0)) { skipped.push(`${refId}: missing RIR`); continue; }
            const topMatches = getTopMatchedRatios(samplePeaks, fullData.Peaks);
            if (!topMatches.length) { skipped.push(`${refId}: no matched peaks`); continue; }
            const avgRatio = topMatches.reduce((s, m) => s + (m.sampleInt / m.refNorm), 0) / topMatches.length;
            const raw = avgRatio / rir;
            if (!Number.isFinite(raw) || raw <= 0) { skipped.push(`${refId}: invalid ratio`); continue; }
            phases.push({ refId, label: String(ref?.label || refId), rir, raw, used: topMatches.length });
        }
        if (!phases.length) {
            alert('Unable to calculate composition. Ensure selected references have RIR and matched peaks.');
            return;
        }
        const totalRaw = phases.reduce((s, p) => s + p.raw, 0);
        if (!Number.isFinite(totalRaw) || totalRaw <= 0) { alert('Composition calculation failed.'); return; }
        phases.forEach(p => p.wt = (p.raw / totalRaw) * 100);
        phases.sort((a, b) => b.wt - a.wt);
        const lines = ['RIR composition estimate (top matched peaks):']
            .concat(phases.map(p => `${p.label} (${p.refId}): ${p.wt.toFixed(2)} wt% [RIR=${p.rir.toFixed(3)}, peaks=${p.used}]`));
        if (skipped.length) lines.push(`Skipped: ${skipped.join('; ')}`);
        addRIRTextBox(lines);
    }
    async function syncCheckedReferenceData() {
        const node = $xrd.node();
        if (!node) return;
        const allRows = Array.from(node.querySelectorAll('.matchedrow[data-refid]'));
        const selected = G.matchXRD?.getSelectedReferences?.() || [];
        for (const ref of selected) {
            const refId = String(ref?.refId || '').trim();
            if (!refId) continue;
            const row = allRows.find(r => String(r.dataset.refid || '').trim() === refId && r.dataset.tag !== 'locked');
            let peaks = [];
            let ints = [];
            let rowData = Array.isArray(ref?.row) ? ref.row : null;
            if (row) {
                const resolved = await resolveRowData(row);
                peaks = resolved.peaks;
                ints = resolved.ints;
                rowData = parseJsonData(row.dataset.row, rowData);
            } else {
                try {
                    const rd = await G.matchXRD.fetchRef(refId);
                    if (rd?.data?.Peaks?.length) {
                        peaks = rd.data.Peaks.map(p => p.T);
                        ints = rd.data.Peaks.map(p => p.I);
                    }
                } catch (_) { }
            }
            if ((!Array.isArray(peaks) || !peaks.length) && Array.isArray(ref?.peaks) && ref.peaks.length) {
                peaks = ref.peaks;
                ints = Array.isArray(ref?.intensities) ? ref.intensities : [];
            }
            if (Array.isArray(peaks) && peaks.length) {
                G.matchXRD?.setReference?.(refId, peaks, ints, true, rowData);
            }
        }
    }
    function restoreSavedReferenceRows(refs) {
        const list = Array.isArray(refs) ? refs : [];
        const matches = list.map(r => {
            const refId = String(r?.refId || '').trim();
            if (!refId) return null;
            const peaks = Array.isArray(r.peaks) ? r.peaks.map(v => Number(v)).filter(Number.isFinite) : [];
            if (!peaks.length) return null;
            const intensitiesRaw = Array.isArray(r.intensities) ? r.intensities : [];
            const intensities = peaks.map((_, i) => {
                const n = Number(intensitiesRaw[i]);
                return Number.isFinite(n) ? n : 0;
            });
            const row = Array.isArray(r.row) && r.row.length >= 3 ? r.row.slice(0, 3) : [refId, String(r?.label || ''), 'Saved'];
            return { row, refId, peaks, intensities };
        }).filter(Boolean);
        if (!matches.length) { setPanelMessage($xrd, XRD_MSG); return; }
        setUnlockVisible(false);
        renderMatches($xrd, matches, ['Reference ID', 'Empirical Formula', 'Match Score (%)']);
    }

    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { G.matchXRD?.render(); }));
    icon5?.addEventListener('change', async () => {
        if (!icon5.checked) return;
        await G.matchXRD?.verifyImportedLockIfNeeded?.();
        if (!G.matchXRD?.hasResultsOnPanel?.()) setPanelMessage($xrd, XRD_MSG);
        G.matchXRD?.render();
        refreshRirButtonState();
    });
    icon6?.addEventListener('change', () => { G.matchXRD?.render(); setPanelMessage($std, STD_MSG); });
    ['click', 'mousedown', 'pointerdown', 'focusin', 'input', 'keydown', 'keyup'].forEach(ev => fs?.addEventListener(ev, e => { e.stopPropagation(); setTimeout(() => G.matchXRD?.render(), 10); }));
    ei?.addEventListener('input', () => {
        if (!G.matchXRD) return;
        const v = G.matchXRD.validate(ei.value);
        ei.style.outline = v.valid ? '' : '2px solid red';
        ei.title = v.valid ? '' : 'Invalid: ' + v.invalid.join(', ');
    });
    d3.select('#chart').on('click.match', async function (e) {
        if (!icon5?.checked && !icon6?.checked) return;
        const svg = d3.select('#chart svg').node();
        const [mx, my] = d3.pointer(e, svg);
        if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR || my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;
        const x = G.state.lastXScale.invert(mx);
        if (icon5.checked) {
            let intensity = G.state.lastYScale.invert(my);
            if (intensity < 0) intensity = 0;
            G.matchXRD.addPeak(x, intensity);
        } else {
            const sel = document.querySelector('input[name="matchinstrument"]:checked')?.id;
            if (!sel || !G.matchStandard?.isStandard(sel)) return;
            const { matches, cols } = await G.matchStandard.search(sel, x);
            renderMatches($std, matches, cols);
        }
    });
    document.getElementById('xrd-search-btn')?.addEventListener('click', async function () {
        const el = ei;
        const lm = document.getElementById('xrd-logic-mode');
        const ec = document.getElementById('xrd-element-count');
        if (!G.matchXRD) return;
        const val = el?.value || '';
        const v = G.matchXRD.validate(val);
        if (!v.valid) { el.style.outline = '2px solid red'; el.title = 'Invalid: ' + v.invalid.join(', '); return; }
        G.matchXRD.setFilter(val.split(',').filter(e => e.trim()), lm?.value, parseInt(ec?.value) || 0);
        setUnlockVisible(false);
        const result = await G.matchXRD.search();
        renderMatches($xrd, result.matches, result.cols, result.lockedMatches || []);
        refreshRirButtonState();
        if (!result.matches.length && !(result.lockedMatches || []).length) return;
        if (result.locked) {
            setUnlockVisible(true, G.matchXRD.getSampleCount());
        }
    });
    unlockBtn?.addEventListener('click', async function () {
        if (typeof instananoCredits === 'undefined') {
            showPlansInline();
            return;
        }
        unlockBtn.style.pointerEvents = 'none';
        try {
            const result = await G.matchXRD.unlock();
            if (!result.ok) {
                if (result.code === 'email_not_verified') {
                    alert('Please verify your email to use shared pool credits.');
                    showPlansInline();
                    return;
                }
                showPlansInline();
                return;
            }
            setUnlockVisible(false);
            renderMatches($xrd, result.matches, ['Reference ID', 'Empirical Formula', 'Match Score (%)']);
            await syncCheckedReferenceData();
            refreshRirButtonState();
            if (G.state) G.state.nextSavePromptMessage = 'Change unlimited filters upto 30 days using saved project file.';
            requestAnimationFrame(() => document.getElementById('save')?.click());
        } finally {
            unlockBtn.style.pointerEvents = '';
        }
    });
    rirBtn?.addEventListener('click', async function () {
        this.style.pointerEvents = 'none';
        try { await runRIRComposition(); } finally { this.style.pointerEvents = ''; }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear();
        setUnlockVisible(false);
        refreshRirButtonState();
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('click', async function (e) {
        const ck = e.target.closest('input.xrd-ref-toggle');
        if (ck) {
            const row = ck.closest('.matchedrow');
            if (!row || row.dataset.tag === 'locked' || !row.dataset.refid) return;
            const { peaks, ints } = await resolveRowData(row);
            if (ck.checked && (!Array.isArray(peaks) || !peaks.length)) { ck.checked = false; return; }
            const rowData = parseJsonData(row.dataset.row, null);
            G.matchXRD?.setReference?.(row.dataset.refid, peaks, ints, ck.checked, rowData);
            return;
        }
        const t = e.target.closest('.matchedrow');
        if (!t) return;
        if (t.dataset.tag === 'locked') return;
        const box = $xrd.node();
        if (t.classList.contains('xrd-preview-active')) {
            t.classList.remove('xrd-preview-active');
            t.style.background = '';
            const d = t.querySelector('.xrd-ref-detail');
            if (d) d.remove();
            try { G.matchXRD.showRef([], [], ''); } catch (_) { }
            return;
        }
        box?.querySelectorAll('.matchedrow').forEach(r => { if (r !== t) { r.classList.remove('xrd-preview-active'); r.style.background = ''; const d = r.querySelector('.xrd-ref-detail'); if (d) d.remove(); } });
        t.classList.add('xrd-preview-active');
        t.style.background = '#f0f8ff';

        const { peaks, ints, fulldata } = await resolveRowData(t);
        if (!t.classList.contains('xrd-preview-active')) return;
        try { G.matchXRD.showRef(peaks, ints, t.dataset.refid || ''); } catch (_) { }
        if (!fulldata) return;

        let det = t.querySelector('.xrd-ref-detail');
        if (det) { det.remove(); return; }
        try {
            det = document.createElement('div');
            det.className = 'xrd-ref-detail';
            det.style.cssText = 'font-size:11px;color:#444;margin-top:6px;border-top:1px solid #eee;padding-top:4px;max-height:200px;overflow-y:auto;line-height:1.5';
            const esc = G.utils?.escapeHTML || (v => String(v == null ? "" : v));
            const info = [];
            const d = fulldata;
            if (d.CS) info.push(`<b>Crystal:</b> ${esc(d.CS)}`);
            if (d.SG) info.push(`<b>SG:</b> ${esc(d.SG)}`);
            if (d.A) info.push(`<b>a=</b>${esc(d.A)}`);
            if (d.B) info.push(`<b>b=</b>${esc(d.B)}`);
            if (d.C) info.push(`<b>c=</b>${esc(d.C)}`);
            if (d.Al) info.push(`<b>α=</b>${esc(d.Al)}°`);
            if (d.Be) info.push(`<b>β=</b>${esc(d.Be)}°`);
            if (d.Ga) info.push(`<b>γ=</b>${esc(d.Ga)}°`);
            if (d.MW) info.push(`<b>MW:</b> ${esc(d.MW)}`);
            let html = '<div style="word-break:break-word">' + info.join(' | ') + '</div>';
            if (d.Peaks?.length) {
                html += '<table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:10px;text-align:center"><tr style="background:#f5f5f5;font-weight:600"><td>2θ</td><td>d(Å)</td><td>I</td><td>hkl</td></tr>';
                d.Peaks.forEach(p => { html += `<tr style="border-bottom:1px solid #f0f0f0"><td>${esc(p.T)}</td><td>${esc(p.D)}</td><td>${esc(p.I)}</td><td>(${esc(p.H)},${esc(p.K)},${esc(p.L)})</td></tr>`; });
                html += '</table>';
            }
            det.innerHTML = html;
            t.appendChild(det);
        } catch (_) { }
    });
    if (G.matchXRD) {
        G.matchXRD.restoreSavedReferenceRows = restoreSavedReferenceRows;
    }
    refreshRirButtonState();
    setUnlockVisible(false);
    setPanelMessage($xrd, XRD_MSG);
    setPanelMessage($std, STD_MSG);
})(window.GraphPlotter);
