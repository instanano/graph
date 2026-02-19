(function (G) {
    "use strict";
    const XRD_MSG = "Please click any peak to add.";
    const STD_MSG = "Please click any peak.";
    const PRICING_URL = 'https://instanano.com/xrd-data-match-pricing/';
    const $xrd = d3.select('#xrd-matchedData');
    const $std = d3.select('#standard-matchedData');
    const icon5 = document.getElementById('icon5');
    const icon6 = document.getElementById('icon6');
    const fs = document.getElementById('xrd-filter-section');
    const ei = document.getElementById('xrd-elements');
    const unlockBtn = document.getElementById('xrd-unlock-btn');
    const unlockSection = document.getElementById('xrd-unlock-section');
    const creditBar = document.getElementById('xrd-credit-bar');
    const creditCount = document.getElementById('xrd-credit-count');
    let currentCredits = 0;

    function updateCreditDisplay(data) {
        const total = Number(typeof data === 'object' && data ? (data.remaining_total ?? data.remaining ?? 0) : (data ?? 0));
        const current = Number(typeof data === 'object' && data ? (data.current_remaining ?? total) : total);
        currentCredits = Number.isFinite(total) ? Math.max(0, total) : 0;
        if (creditBar) creditBar.style.display = '';
        if (creditCount) {
            const currentSafe = Number.isFinite(current) ? Math.max(0, current) : 0;
            const other = Math.max(0, currentCredits - currentSafe);
            if (currentCredits <= 0) {
                creditCount.innerHTML = `0 (<a href="${PRICING_URL}" target="_blank" rel="noopener noreferrer">Click to buy credits</a>)`;
            } else {
                creditCount.textContent = other > 0 ? `${currentCredits} (Current: ${currentSafe}, Other: ${other})` : `${currentCredits}`;
            }
        }
    }

    function setUnlockVisible(show, n) {
        if (unlockSection) unlockSection.style.display = show ? '' : 'none';
        if (!unlockBtn) return;
        unlockBtn.style.display = show ? '' : 'none';
        if (!show) return;
        const needed = n || G.matchXRD?.getSampleCount?.() || 1;
        unlockBtn.textContent = `Unlock Full XRD Match (${needed} Credit${needed > 1 ? 's' : ''})`;
    }

    function setPanelMessage(panel, message) {
        const node = panel?.node();
        if (!node) return;
        const p = document.createElement("p");
        p.textContent = message;
        node.replaceChildren(p);
    }

    async function refreshCredits() {
        if (typeof instananoCredits !== 'undefined' && G.matchXRD?.checkCredit) {
            const cr = await G.matchXRD.checkCredit();
            updateCreditDisplay(cr || 0);
        } else {
            updateCreditDisplay(0);
        }
    }
    const parseJson = (raw, fallback) => {
        if (!raw) return fallback;
        try { return JSON.parse(raw); } catch (_) { return fallback; }
    };
    async function getRowData(rowEl, syncChecked = true) {
        let peaks = parseJson(rowEl.dataset.peaks, []);
        let ints = parseJson(rowEl.dataset.ints, []);
        let fulldata = parseJson(rowEl.dataset.fulldata, null);
        if (!fulldata && !G.matchXRD.isLocked() && rowEl.dataset.refid) {
            try {
                const rd = await G.matchXRD.fetchRef(rowEl.dataset.refid);
                if (rd) {
                    fulldata = rd.data;
                    rowEl.dataset.fulldata = JSON.stringify(fulldata);
                    if (fulldata.Peaks) {
                        peaks = fulldata.Peaks.map(p => p.T);
                        ints = fulldata.Peaks.map(p => p.I);
                        rowEl.dataset.peaks = JSON.stringify(peaks);
                        rowEl.dataset.ints = JSON.stringify(ints);
                    }
                }
            } catch (err) { console.error('Ref fetch failed', err); }
        }
        if (syncChecked && rowEl.dataset.refid && G.matchXRD?.isRefChecked?.(rowEl.dataset.refid)) {
            G.matchXRD.updateCheckedRef?.(rowEl.dataset.refid, peaks, ints);
        }
        return { peaks, ints, fulldata };
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
                const toggle = document.createElement("label");
                toggle.className = 'xrd-ref-toggle';
                toggle.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px;color:#333';
                const check = document.createElement("input");
                check.type = 'checkbox';
                check.className = 'xrd-ref-check';
                check.dataset.refid = item.refId;
                check.checked = !!G.matchXRD?.isRefChecked?.(item.refId);
                const color = G.matchXRD?.getRefColor?.(item.refId) || '#666';
                const swatch = document.createElement("span");
                swatch.className = 'xrd-ref-color';
                swatch.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;border:1px solid #aaa;background:${check.checked ? color : 'transparent'}`;
                const text = document.createElement("span");
                text.textContent = 'Compare';
                toggle.append(check, swatch, text);
                rowDiv.appendChild(toggle);
                rowDiv.style.borderLeft = check.checked ? `3px solid ${color}` : '';
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

    window.addEventListener('focus', refreshCredits);
    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { G.matchXRD?.clear({ keepChecked: true }); setUnlockVisible(false); }));
    icon5?.addEventListener('change', () => {
        setPanelMessage($xrd, XRD_MSG);
        refreshCredits();
        setUnlockVisible(false);
        G.matchXRD?.render();
    });
    icon6?.addEventListener('change', () => { G.matchXRD?.clear({ keepChecked: true }); setUnlockVisible(false); setPanelMessage($std, STD_MSG); });
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
            window.open(PRICING_URL, '_blank');
            return;
        }
        unlockBtn.style.pointerEvents = 'none';
        try {
            await refreshCredits();
            if (currentCredits <= 0) {
                window.open(PRICING_URL, '_blank');
                return;
            }
            const result = await G.matchXRD.unlock();
            if (result.ok) {
                setUnlockVisible(false);
                updateCreditDisplay({ remaining_total: result.remaining, current_remaining: result.current_remaining });
                renderMatches($xrd, result.matches, ['Ref ID', 'Formula', 'Match (%)']);
            }
        } finally {
            unlockBtn.style.pointerEvents = '';
        }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear({ keepChecked: false });
        setUnlockVisible(false);
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('change', async function (e) {
        const check = e.target.closest('.xrd-ref-check');
        if (!check) return;
        const row = check.closest('.matchedrow');
        if (!row || row.dataset.tag === 'locked') return;
        const { peaks, ints } = await getRowData(row, false);
        const ok = G.matchXRD?.toggleCheckedRef?.(row.dataset.refid, peaks, ints, check.checked);
        if (!ok) check.checked = false;
        const color = G.matchXRD?.getRefColor?.(row.dataset.refid) || '#666';
        const swatch = row.querySelector('.xrd-ref-color');
        if (swatch) swatch.style.background = check.checked ? color : 'transparent';
        row.style.borderLeft = check.checked ? `3px solid ${color}` : '';
    });
    $xrd.on('click', async function (e) {
        if (e.target.closest('.xrd-ref-toggle')) return;
        const t = e.target.closest('.matchedrow');
        if (!t) return;
        if (t.dataset.tag === 'locked') return;
        const box = $xrd.node();
        box?.querySelectorAll('.matchedrow').forEach(r => { if (r !== t) { r.style.background = ''; const d = r.querySelector('.xrd-ref-detail'); if (d) d.remove(); } });
        t.style.background = '#f0f8ff';

        const { peaks, ints, fulldata } = await getRowData(t);
        try { G.matchXRD.showRef(peaks, ints, t.dataset.refid || 'preview'); } catch (_) { }
        if (!fulldata) return;

        let det = t.querySelector('.xrd-ref-detail');
        if (det) { det.remove(); return; }
        try {
            det = document.createElement('div');
            det.className = 'xrd-ref-detail';
            det.style.cssText = 'font-size:11px;color:#444;margin-top:6px;border-top:1px solid #eee;padding-top:4px;max-height:200px;overflow-y:auto;line-height:1.5';
            const info = [];
            const d = fulldata;
            if (d.CS) info.push(`<b>Crystal:</b> ${d.CS}`);
            if (d.SG) info.push(`<b>SG:</b> ${d.SG}`);
            if (d.A) info.push(`<b>a=</b>${d.A}`);
            if (d.B) info.push(`<b>b=</b>${d.B}`);
            if (d.C) info.push(`<b>c=</b>${d.C}`);
            if (d.Al) info.push(`<b>α=</b>${d.Al}°`);
            if (d.Be) info.push(`<b>β=</b>${d.Be}°`);
            if (d.Ga) info.push(`<b>γ=</b>${d.Ga}°`);
            if (d.MW) info.push(`<b>MW:</b> ${d.MW}`);
            let html = '<div style="word-break:break-word">' + info.join(' | ') + '</div>';
            if (d.Peaks?.length) {
                html += '<table style="width:100%;border-collapse:collapse;margin-top:4px;font-size:10px;text-align:center"><tr style="background:#f5f5f5;font-weight:600"><td>2θ</td><td>d(Å)</td><td>I</td><td>hkl</td></tr>';
                d.Peaks.forEach(p => { html += `<tr style="border-bottom:1px solid #f0f0f0"><td>${p.T}</td><td>${p.D}</td><td>${p.I}</td><td>(${p.H},${p.K},${p.L})</td></tr>`; });
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
