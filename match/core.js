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
    const creditBar = document.getElementById('xrd-credit-bar');
    const creditCount = document.getElementById('xrd-credit-count');

    function updateCreditDisplay(n) {
        if (creditBar && creditCount) {
            creditBar.style.display = n != null ? '' : 'none';
            creditCount.textContent = n != null ? n : '—';
        }
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
            if (item.peaks) rowDiv.dataset.peaks = JSON.stringify(item.peaks);
            if (item.intensities) rowDiv.dataset.ints = JSON.stringify(item.intensities);
            row.forEach((val, idx) => {
                const cell = document.createElement("div");
                const label = document.createElement("b");
                label.textContent = `${cols[idx]}:`;
                cell.append(label, document.createTextNode(` ${val}`));
                rowDiv.appendChild(cell);
            });
            if (item.fullData?.data) {
                const d = item.fullData.data;
                const detDiv = document.createElement("div");
                detDiv.style.cssText = 'font-size:11px;color:#555;margin-top:4px;line-height:1.5';
                const parts = [];
                if (d.CS) parts.push(`CS: ${d.CS}`);
                if (d.SG) parts.push(`SG: ${d.SG}`);
                if (d.A) parts.push(`a=${d.A}`);
                if (d.B) parts.push(`b=${d.B}`);
                if (d.C) parts.push(`c=${d.C}`);
                if (item.fullData.mineral) parts.push(`Min: ${item.fullData.mineral}`);
                detDiv.textContent = parts.join(' | ');
                rowDiv.appendChild(detDiv);
            }
            frag.appendChild(rowDiv);
        });
        node.appendChild(frag);
    }

    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => G.matchXRD?.clear()));
    icon5?.addEventListener('change', async () => {
        setPanelMessage($xrd, XRD_MSG);
        if (G.matchXRD?.checkCredit) {
            const cr = await G.matchXRD.checkCredit();
            updateCreditDisplay(cr ? cr.remaining : null);
        }
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
        const { matches, cols, locked } = await G.matchXRD.search();
        renderMatches($xrd, matches, cols);
        if (locked && matches.length && unlockBtn) {
            unlockBtn.style.display = '';
            const n = G.matchXRD.getSampleCount();
            unlockBtn.textContent = `🔓 Unlock (${n} credit${n > 1 ? 's' : ''})`;
        }
    });
    unlockBtn?.addEventListener('click', async function () {
        if (!G.matchXRD?.unlock) return;
        unlockBtn.textContent = '⏳ Unlocking...';
        unlockBtn.style.pointerEvents = 'none';
        const result = await G.matchXRD.unlock();
        unlockBtn.style.pointerEvents = '';
        if (result.ok) {
            unlockBtn.style.display = 'none';
            updateCreditDisplay(result.remaining);
            if (result.already_done) {
                updateLabel('Already analyzed — no credits deducted');
            } else {
                updateLabel(`Unlocked! ${result.remaining} credits left`);
            }
            renderMatches($xrd, result.matches, ['Ref ID', 'Formula', 'Match (%)']);
        } else {
            unlockBtn.textContent = '🔓 Unlock';
            updateLabel(result.message || 'Unlock failed');
        }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear();
        if (unlockBtn) unlockBtn.style.display = 'none';
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('click', function (e) {
        const t = e.target.closest('.matchedrow');
        if (t && t.dataset.peaks) {
            d3.selectAll('.matchedrow').style('background', '');
            t.style.background = '#f0f8ff';
            try {
                G.matchXRD.showRef(JSON.parse(t.dataset.peaks), t.dataset.ints ? JSON.parse(t.dataset.ints) : []);
            } catch (_) { }
        }
    });
    setPanelMessage($xrd, XRD_MSG);
    setPanelMessage($std, STD_MSG);
})(window.GraphPlotter);
