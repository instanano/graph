(function (G) {
    "use strict";

    function renderXRDMatches(results) {
        if (!results || results.length === 0) {
            return '<p>No matching peaks found.</p>';
        }

        return results.map((item, idx) => {
            return `<div class="matchedrow xrd-result" data-idx="${idx}" style="cursor:pointer;padding:8px;margin:4px 0;border:1px solid #ddd;border-radius:4px;">
                <div style="display:flex;justify-content:space-between">
                    <strong>${item.formula}</strong>
                    <span style="color:#2196F3">${item.score}%</span>
                </div>
                <div style="font-size:11px;color:#666">Ref: ${item.refCode}</div>
            </div>`;
        }).join('');
    }

    function renderStandardMatches(matches, cols) {
        if (!matches.length) return '<p>No matching peaks found.</p>';

        return matches.map(item => {
            const rowData = item.row || item;
            return `<div class="matchedrow" style="cursor:pointer;">` +
                rowData.map((val, i) => `<div><b>${cols[i]}:</b> ${val}</div>`).join('') +
                `</div>`;
        }).join('');
    }

    let xrdResults = [];

    document.querySelectorAll('input[name="matchinstrument"]').forEach(input => {
        input.addEventListener('change', function () {
            if (G.matchXRD) {
                G.matchXRD.clearPeaks();
                G.matchXRD.clearReferencePreview();
                G.matchXRD.clearElementFilter();
            }
            xrdResults = [];
            document.getElementById('matchedData').innerHTML = '<p>Click on chart to select peaks.</p>';

            const filterSection = document.getElementById('xrd-filter-section');
            if (filterSection) {
                filterSection.style.display = this.id === 'xrdmatch' ? 'block' : 'none';
            }

            const label = document.getElementById('xrd-match-label');
            if (label) {
                label.textContent = this.id === 'xrdmatch' ? 'XRD Data Match' : 'XRD Data Match';
            }
        });
    });

    d3.select('#chart-area').on('click.match', async function (event) {
        const isMatchEnabled = document.getElementById('icon5')?.checked;
        if (!isMatchEnabled) return;

        const svgNode = d3.select('#chart-area svg').node();
        if (!svgNode) return;

        const [mx, my] = d3.pointer(event, svgNode);

        if (!G.currentScales || !G.currentScales.x) return;

        const xVal = G.currentScales.x.invert(mx);
        const sel = document.querySelector('input[name="matchinstrument"]:checked')?.id;

        if (sel === 'xrdmatch' && G.matchXRD) {
            G.matchXRD.addPeak(xVal);
            G.matchXRD.updatePeakList();
            document.getElementById('xrd-match-label').textContent = 'Search Database';
        } else if (G.matchStandard && G.matchStandard.isStandard(sel)) {
            const { matches, cols } = await G.matchStandard.search(sel, xVal);
            document.getElementById('matchedData').innerHTML = renderStandardMatches(matches, cols);
        }
    });

    document.getElementById('xrd-match-label')?.addEventListener('click', async function (e) {
        const radio = document.getElementById('xrdmatch');
        if (radio?.checked && this.textContent === 'Search Database' && G.matchXRD) {
            const elementsInput = document.getElementById('xrd-elements');
            const logicMode = document.getElementById('xrd-logic-mode');
            const elementCount = document.getElementById('xrd-element-count');

            if (elementsInput && logicMode && elementCount) {
                const els = elementsInput.value.split(',').map(e => e.trim()).filter(e => e);
                G.matchXRD.setElementFilter(els, logicMode.value, parseInt(elementCount.value) || 0);
            }

            xrdResults = await G.matchXRD.search();
            document.getElementById('matchedData').innerHTML = renderXRDMatches(xrdResults);

            document.querySelectorAll('.xrd-result').forEach(el => {
                el.addEventListener('mouseenter', function () {
                    const idx = parseInt(this.dataset.idx);
                    if (xrdResults[idx]) {
                        G.matchXRD.renderReferencePreview(xrdResults[idx]);
                    }
                });
                el.addEventListener('click', function () {
                    const idx = parseInt(this.dataset.idx);
                    document.querySelectorAll('.xrd-result').forEach(r => r.style.borderColor = '#ddd');
                    this.style.borderColor = '#2196F3';
                    if (xrdResults[idx]) {
                        G.matchXRD.renderReferencePreview(xrdResults[idx]);
                    }
                });
            });
        }
    });

    document.getElementById('xrd-clear-filter')?.addEventListener('click', function () {
        const elementsInput = document.getElementById('xrd-elements');
        const logicMode = document.getElementById('xrd-logic-mode');
        const elementCount = document.getElementById('xrd-element-count');
        if (elementsInput) elementsInput.value = '';
        if (logicMode) logicMode.value = 'and';
        if (elementCount) elementCount.value = '0';
        if (G.matchXRD) G.matchXRD.clearElementFilter();
    });

    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        if (G.matchXRD) {
            G.matchXRD.clearPeaks();
            G.matchXRD.updatePeakList();
            G.matchXRD.clearReferencePreview();
        }
        xrdResults = [];
        document.getElementById('matchedData').innerHTML = '<p>Click on chart to select peaks.</p>';
        document.getElementById('xrd-match-label').textContent = 'XRD Data Match';
    });

    document.getElementById('xrd-search-btn')?.addEventListener('click', function () {
        document.getElementById('xrd-match-label')?.click();
    });

})(window.G = window.G || {});
