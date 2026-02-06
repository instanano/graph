(function (G) {
    "use strict";

    let xrdResults = [];

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

    function updatePeaksList() {
        const list = document.getElementById('xrd-peaks-list');
        if (!list || !G.matchXRD) return;

        const peaks = G.matchXRD.getPeaks();
        list.innerHTML = peaks.map((p, i) =>
            `<span style="background:#e3f2fd;padding:2px 8px;border-radius:12px;font-size:12px;display:inline-flex;align-items:center;gap:4px">
                ${p.toFixed(2)}°
                <span data-idx="${i}" style="cursor:pointer;color:#f44336;font-weight:bold">×</span>
            </span>`
        ).join('');

        list.querySelectorAll('[data-idx]').forEach(btn => {
            btn.addEventListener('click', function () {
                G.matchXRD.removePeak(parseInt(this.dataset.idx));
                updatePeaksList();
            });
        });
    }

    document.addEventListener('DOMContentLoaded', function () {

        document.querySelectorAll('input[name="matchinstrument"]').forEach(input => {
            input.addEventListener('change', function () {
                if (G.matchXRD) {
                    G.matchXRD.clearPeaks();
                    G.matchXRD.clearReferencePreview();
                    G.matchXRD.clearElementFilter();
                }
                xrdResults = [];
                const matchedData = document.getElementById('matchedData');
                if (matchedData) matchedData.innerHTML = '<p>Select peaks to search.</p>';

                const filterSection = document.getElementById('xrd-filter-section');
                if (filterSection) {
                    filterSection.style.display = this.id === 'xrdmatch' ? 'block' : 'none';
                }

                updatePeaksList();
            });
        });

        document.getElementById('xrd-add-peak')?.addEventListener('click', function () {
            const input = document.getElementById('xrd-peak-input');
            if (!input || !G.matchXRD) return;

            const val = parseFloat(input.value);
            if (!isNaN(val) && val >= 0 && val <= 180) {
                G.matchXRD.addPeak(val);
                updatePeaksList();
                input.value = '';
                input.focus();
            }
        });

        document.getElementById('xrd-peak-input')?.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                document.getElementById('xrd-add-peak')?.click();
            }
        });

        document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
            if (G.matchXRD) {
                G.matchXRD.clearPeaks();
                G.matchXRD.clearReferencePreview();
            }
            xrdResults = [];
            updatePeaksList();
            const matchedData = document.getElementById('matchedData');
            if (matchedData) matchedData.innerHTML = '<p>Select peaks to search.</p>';
        });

        document.getElementById('xrd-search-btn')?.addEventListener('click', async function () {
            if (!G.matchXRD) return;

            const elementsInput = document.getElementById('xrd-elements');
            const logicMode = document.getElementById('xrd-logic-mode');
            const elementCount = document.getElementById('xrd-element-count');

            if (elementsInput && logicMode && elementCount) {
                const els = elementsInput.value.split(',').map(e => e.trim()).filter(e => e);
                G.matchXRD.setElementFilter(els, logicMode.value, parseInt(elementCount.value) || 0);
            }

            xrdResults = await G.matchXRD.search();
            const matchedData = document.getElementById('matchedData');
            if (matchedData) matchedData.innerHTML = renderXRDMatches(xrdResults);

            document.querySelectorAll('.xrd-result').forEach(el => {
                el.addEventListener('mouseenter', function () {
                    const idx = parseInt(this.dataset.idx);
                    if (xrdResults[idx] && G.matchXRD) {
                        G.matchXRD.renderReferencePreview(xrdResults[idx]);
                    }
                });
                el.addEventListener('click', function () {
                    const idx = parseInt(this.dataset.idx);
                    document.querySelectorAll('.xrd-result').forEach(r => r.style.borderColor = '#ddd');
                    this.style.borderColor = '#2196F3';
                    if (xrdResults[idx] && G.matchXRD) {
                        G.matchXRD.renderReferencePreview(xrdResults[idx]);
                    }
                });
            });
        });

        d3.select('#chart-area').on('click.match', async function (event) {
            const isMatchEnabled = document.getElementById('icon5')?.checked;
            if (!isMatchEnabled) return;

            const sel = document.querySelector('input[name="matchinstrument"]:checked')?.id;
            if (sel === 'xrdmatch') return;

            const svgNode = d3.select('#chart-area svg').node();
            if (!svgNode || !G.currentScales?.x) return;

            const [mx] = d3.pointer(event, svgNode);
            const xVal = G.currentScales.x.invert(mx);

            if (G.matchStandard && G.matchStandard.isStandard(sel)) {
                const { matches, cols } = await G.matchStandard.search(sel, xVal);
                const matchedData = document.getElementById('matchedData');
                if (matchedData) matchedData.innerHTML = renderStandardMatches(matches, cols);
            }
        });
    });

})(window.G = window.G || {});
