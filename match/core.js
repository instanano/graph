(function (G) {
    "use strict";

    function renderMatches(matches, cols) {
        if (!matches.length) return '<p>No matching peaks found.</p>';

        return matches.map(item => {
            const rowData = item.row || item;
            const peakDataAttr = item.peaks ? ` data-peaks='${JSON.stringify(item.peaks)}' data-intensities='${JSON.stringify(item.intensities || [])}'` : '';

            return `<div class="matchedrow"${peakDataAttr} style="cursor:pointer;">` +
                rowData.map((val, i) => `<div><b>${cols[i]}:</b> ${val}</div>`).join('') +
                `</div>`;
        }).join('');
    }

    // 1. Handle Instrument Selection Change
    document.querySelectorAll('input[name="matchinstrument"]').forEach(input => {
        input.addEventListener('change', function () {
            if (G.matchXRD) {
                G.matchXRD.clear();
                G.matchXRD.clearElementFilter();
            }
            d3.select('#matchedData').html('<p>Please click any peak.</p>');

            const filterSection = document.getElementById('xrd-filter-section');
            if (filterSection) {
                filterSection.style.display = this.id === 'xrdmatch' ? 'block' : 'none';
            }

            if (this.id === 'xrdmatch') {
                document.getElementById('xrd-match-label').textContent = "Select Peak";
            }
        });
    });

    // 2. Handle Graph Clicks (Adding Peaks)
    d3.select('#chart').on('click.match', async function (event) {
        const isMatchEnabled = document.getElementById('icon5').checked;
        if (!isMatchEnabled) return;

        const svgNode = d3.select('#chart svg').node();
        const [mx, my] = d3.pointer(event, svgNode);

        if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR ||
            my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;

        const xVal = G.state.lastXScale.invert(mx);
        const sel = document.querySelector('input[name="matchinstrument"]:checked').id;

        if (sel === 'xrdmatch') {
            G.matchXRD.addPeak(xVal);
        } else if (G.matchStandard && G.matchStandard.isStandard(sel)) {
            const { matches, cols } = await G.matchStandard.search(sel, xVal);
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });

    // 3. Handle "Search Database" Button Click
    document.getElementById('xrd-match-label')?.addEventListener('click', async function (e) {
        const radio = document.getElementById('xrdmatch');
        if (radio?.checked && this.textContent === "Search Database") {
            const elementsInput = document.getElementById('xrd-elements');
            const logicMode = document.getElementById('xrd-logic-mode');
            const elementCount = document.getElementById('xrd-element-count');

            if (elementsInput && logicMode && elementCount && G.matchXRD) {
                const els = elementsInput.value.split(',').map(e => e.trim()).filter(e => e);
                G.matchXRD.setElementFilter(els, logicMode.value, parseInt(elementCount.value) || 0);
            }

            const { matches, cols } = await G.matchXRD.search();
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });

    // 3b. Also handle Search Database button click
    document.getElementById('xrd-search-btn')?.addEventListener('click', async function () {
        const elementsInput = document.getElementById('xrd-elements');
        const logicMode = document.getElementById('xrd-logic-mode');
        const elementCount = document.getElementById('xrd-element-count');

        if (elementsInput && logicMode && elementCount && G.matchXRD) {
            const els = elementsInput.value.split(',').map(e => e.trim()).filter(e => e);
            G.matchXRD.setElementFilter(els, logicMode.value, parseInt(elementCount.value) || 0);
        }

        const { matches, cols } = await G.matchXRD.search();
        d3.select('#matchedData').html(renderMatches(matches, cols));
    });

    // 4. Handle Clear All button
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        if (G.matchXRD) G.matchXRD.clear();
        d3.select('#matchedData').html('<p>Please click any peak.</p>');
    });

    // 5. Handle Click on Result Row (Visualize Reference Peaks with Intensity)
    d3.select('#matchedData').on('click', function (e) {
        const target = e.target.closest('.matchedrow');
        if (target && target.dataset.peaks) {
            d3.selectAll('.matchedrow').style('background', '');
            target.style.background = '#f0f8ff';

            const peaks = JSON.parse(target.dataset.peaks);
            const intensities = target.dataset.intensities ? JSON.parse(target.dataset.intensities) : [];
            G.matchXRD.showReferencePeaks(peaks, intensities);
        }
    });

})(window.GraphPlotter);
