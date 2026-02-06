(function (G) {
    "use strict";
    function renderMatches(m, c) {
        if (!m.length) return '<p>No matching peaks found.</p>';
        return m.map(i => {
            const r = i.row || i;
            const pa = i.peaks ? ` data-peaks='${JSON.stringify(i.peaks)}' data-ints='${JSON.stringify(i.intensities || [])}'` : '';
            return `<div class="matchedrow"${pa} style="cursor:pointer;">` + r.map((v, j) => `<div><b>${c[j]}:</b> ${v}</div>`).join('') + `</div>`;
        }).join('');
    }
    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => {
        inp.addEventListener('change', function () {
            if (G.matchXRD) { G.matchXRD.clear(); G.matchXRD.clearFilter(); }
            d3.select('#matchedData').html('<p>Please click any peak.</p>');
            const fs = document.getElementById('xrd-filter-section');
            if (fs) fs.style.display = this.id === 'xrdmatch' ? 'block' : 'none';
            if (this.id === 'xrdmatch') document.getElementById('xrd-match-label').textContent = "Select Peak";
        });
    });
    const fs = document.getElementById('xrd-filter-section');
    ['click', 'mousedown', 'pointerdown', 'focusin'].forEach(ev => fs?.addEventListener(ev, e => { e.stopPropagation(); if (ev === 'click' || ev === 'focusin') setTimeout(() => G.matchXRD?.render(), 10); }));
    d3.select('#chart').on('click.match', async function (e) {
        if (!document.getElementById('icon5').checked) return;
        const svg = d3.select('#chart svg').node();
        const [mx, my] = d3.pointer(e, svg);
        if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR || my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;
        const x = G.state.lastXScale.invert(mx);
        const sel = document.querySelector('input[name="matchinstrument"]:checked').id;
        if (sel === 'xrdmatch') {
            G.matchXRD.addPeak(x);
        } else if (G.matchStandard && G.matchStandard.isStandard(sel)) {
            const { matches, cols } = await G.matchStandard.search(sel, x);
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });
    document.getElementById('xrd-match-label')?.addEventListener('click', async function () {
        const r = document.getElementById('xrdmatch');
        if (r?.checked && this.textContent === "Search Database") {
            const ei = document.getElementById('xrd-elements');
            const lm = document.getElementById('xrd-logic-mode');
            const ec = document.getElementById('xrd-element-count');
            if (ei && lm && ec && G.matchXRD) G.matchXRD.setFilter(ei.value.split(',').filter(e => e.trim()), lm.value, parseInt(ec.value) || 0);
            const { matches, cols } = await G.matchXRD.search();
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });
    document.getElementById('xrd-search-btn')?.addEventListener('click', async function () {
        const ei = document.getElementById('xrd-elements');
        const lm = document.getElementById('xrd-logic-mode');
        const ec = document.getElementById('xrd-element-count');
        if (ei && lm && ec && G.matchXRD) G.matchXRD.setFilter(ei.value.split(',').filter(e => e.trim()), lm.value, parseInt(ec.value) || 0);
        const { matches, cols } = await G.matchXRD.search();
        d3.select('#matchedData').html(renderMatches(matches, cols));
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        if (G.matchXRD) G.matchXRD.clear();
        d3.select('#matchedData').html('<p>Please click any peak.</p>');
    });
    d3.select('#matchedData').on('click', function (e) {
        const t = e.target.closest('.matchedrow');
        if (t && t.dataset.peaks) {
            d3.selectAll('.matchedrow').style('background', '');
            t.style.background = '#f0f8ff';
            G.matchXRD.showRef(JSON.parse(t.dataset.peaks), t.dataset.ints ? JSON.parse(t.dataset.ints) : []);
        }
    });
})(window.GraphPlotter);
