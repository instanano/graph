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

    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { G.matchXRD?.render(); }));
    icon5?.addEventListener('change', async () => {
        if (!icon5.checked) return;
        await G.matchXRD?.verifyImportedLockIfNeeded?.();
        if (!G.matchXRD?.hasResultsOnPanel?.()) setPanelMessage($xrd, XRD_MSG);
        G.matchXRD?.render();
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
            $xrd.node()?.querySelectorAll('input.xrd-ref-toggle:checked').forEach(cb => { cb.click(); cb.click(); });
            if (G.state) G.state.nextSavePromptMessage = 'Change unlimited filters upto 30 days using project file.';
            requestAnimationFrame(() => document.getElementById('save')?.click());
        } finally {
            unlockBtn.style.pointerEvents = '';
        }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear();
        setUnlockVisible(false);
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('click', async function (e) {
        const ck = e.target.closest('input.xrd-ref-toggle');
        if (ck) {
            const row = ck.closest('.matchedrow');
            if (!row || row.dataset.tag === 'locked' || !row.dataset.refid) return;
            const { peaks, ints } = await resolveRowData(row);
            if (ck.checked && (!Array.isArray(peaks) || !peaks.length)) { ck.checked = false; return; }
            G.matchXRD?.setReference?.(row.dataset.refid, peaks, ints, ck.checked);
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
    setUnlockVisible(false);
    setPanelMessage($xrd, XRD_MSG);
    setPanelMessage($std, STD_MSG);
})(window.GraphPlotter);
