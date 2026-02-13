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
    const creditBar = document.getElementById('xrd-credit-bar');
    const creditCount = document.getElementById('xrd-credit-count');
    const matchLabel = document.getElementById('xrd-match-label');
    let currentCredits = 0;

    function updateCreditDisplay(n) {
        currentCredits = n != null ? n : 0;
        if (creditBar) creditBar.style.display = '';
        if (creditCount) creditCount.textContent = currentCredits;
    }

    function setPanelMessage(panel, message) {
        const node = panel?.node();
        if (!node) return;
        const p = document.createElement("p");
        p.textContent = message;
        node.replaceChildren(p);
    }

    function renderMatches(panel, matches, cols) {
        const node = panel?.node();
        if (!node) return;
        node.replaceChildren();
        if (!matches.length) {
            const p = document.createElement("p");
            p.textContent = "No matching peaks found.";
            node.appendChild(p);
            return;
        }
        const frag = document.createDocumentFragment();
        matches.forEach(item => {
            const row = item.row || item;
            const rowDiv = document.createElement("div");
            rowDiv.className = "matchedrow";
            if (item.refId) rowDiv.dataset.refid = item.refId;
            const fd = item.fullData?.data;
            if (fd?.Peaks) {
                rowDiv.dataset.peaks = JSON.stringify(fd.Peaks.map(p => p.T));
                rowDiv.dataset.ints = JSON.stringify(fd.Peaks.map(p => p.I));
                rowDiv.dataset.fulldata = JSON.stringify(fd);
            } else {
                if (item.peaks) rowDiv.dataset.peaks = JSON.stringify(item.peaks);
                if (item.intensities) rowDiv.dataset.ints = JSON.stringify(item.intensities);
            }
            if (item.fullData?.mineral) rowDiv.dataset.mineral = item.fullData.mineral;
            if (item.fullData?.formula) rowDiv.dataset.formula = item.fullData.formula;
            row.forEach((val, idx) => {
                const cell = document.createElement("div");
                const label = document.createElement("b");
                label.textContent = `${cols[idx]}:`;
                cell.append(label, document.createTextNode(` ${val}`));
                rowDiv.appendChild(cell);
            });
            if (item.fullData?.mineral) {
                const mn = document.createElement("div");
                mn.style.cssText = 'font-size:11px;color:#555;margin-top:2px';
                mn.textContent = `Mineral: ${item.fullData.mineral}`;
                rowDiv.appendChild(mn);
            }
            frag.appendChild(rowDiv);
        });
        node.appendChild(frag);
    }

    async function refreshCredits() {
        if (typeof instananoCredits !== 'undefined' && G.matchXRD?.checkCredit) {
            const cr = await G.matchXRD.checkCredit();
            updateCreditDisplay(cr ? cr.remaining : 0);
        } else {
            updateCreditDisplay(0);
        }
    }

    window.addEventListener('focus', refreshCredits);

    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => G.matchXRD?.clear()));
    icon5?.addEventListener('change', async () => {
        setPanelMessage($xrd, XRD_MSG);
        refreshCredits();
        G.matchXRD?.render();
    });
    icon6?.addEventListener('change', () => { G.matchXRD?.clear(); setPanelMessage($std, STD_MSG); });
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
        if (unlockBtn) unlockBtn.style.display = 'none';
        const { matches, cols, locked } = await G.matchXRD.search();
        renderMatches($xrd, matches, cols);
        if (!matches.length) return;
        if (locked && unlockBtn) {
            unlockBtn.style.display = '';
            const n = G.matchXRD.getSampleCount();
            unlockBtn.textContent = `🔓 Unlock (${n} credit${n > 1 ? 's' : ''})`;
        }
    });
    unlockBtn?.addEventListener('click', async function () {
        if (currentCredits <= 0 || typeof instananoCredits === 'undefined') {
            window.open(PRICING_URL, '_blank');
            return;
        }
        unlockBtn.textContent = '⏳ Unlocking...';
        unlockBtn.style.pointerEvents = 'none';
        const result = await G.matchXRD.unlock();
        unlockBtn.style.pointerEvents = '';
        if (result.ok) {
            unlockBtn.style.display = 'none';
            updateCreditDisplay(result.remaining);
            if (matchLabel) matchLabel.textContent = result.already_done ? 'Already analyzed — no credit deducted' : `Unlocked! ${result.remaining} credits left`;
            renderMatches($xrd, result.matches, result.matches.length > 0 && result.matches[0].fullData ? ['Ref ID', 'Formula', 'Match (%)'] : ['Ref ID', 'Formula', 'Match (%)']);
        } else {
            unlockBtn.textContent = '🔓 Unlock';
            if (matchLabel) matchLabel.textContent = result.message || 'Unlock failed';
        }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear();
        if (unlockBtn) unlockBtn.style.display = 'none';
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('click', async function (e) {
        const t = e.target.closest('.matchedrow');
        if (!t) return;
        const box = $xrd.node();
        box?.querySelectorAll('.matchedrow').forEach(r => { if (r !== t) { r.style.background = ''; const d = r.querySelector('.xrd-ref-detail'); if (d) d.remove(); } });
        t.style.background = '#f0f8ff';

        let peaks = t.dataset.peaks ? JSON.parse(t.dataset.peaks) : [];
        let ints = t.dataset.ints ? JSON.parse(t.dataset.ints) : [];
        let fulldata = t.dataset.fulldata ? JSON.parse(t.dataset.fulldata) : null;

        if (!fulldata && !G.matchXRD.isLocked() && t.dataset.refid) {
            // Lazy load ONLY if unlocked
            try {
                const rd = await G.matchXRD.fetchRef(t.dataset.refid);
                if (rd) {
                    fulldata = rd.data; // The JSON blob from DB
                    t.dataset.fulldata = JSON.stringify(fulldata);
                    if (fulldata.mineral) t.dataset.mineral = fulldata.mineral;
                    if (fulldata.Peaks) {
                        peaks = fulldata.Peaks.map(p => p.T);
                        ints = fulldata.Peaks.map(p => p.I);
                        t.dataset.peaks = JSON.stringify(peaks);
                        t.dataset.ints = JSON.stringify(ints);
                    }
                }
            } catch (err) { console.error('Ref fetch failed', err); }
        }

        try { G.matchXRD.showRef(peaks, ints); } catch (_) { }
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
    setPanelMessage($xrd, XRD_MSG);
    setPanelMessage($std, STD_MSG);
})(window.GraphPlotter);
