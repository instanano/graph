(function(G) {
    "use strict";

    // Helper to render matched rows
    function renderMatches(matches, cols) {
        if (!matches.length) return '<p>No matching peaks found.</p>';
        
        return matches.map(item => {
            // Check if item has 'row' property (XRD) or is direct array (Standard)
            const rowData = item.row || item.row || item; 
            // Store reference peaks in data attribute for click handling
            const peakDataAttr = item.peaks ? ` data-peaks='${JSON.stringify(item.peaks)}'` : '';
            
            return `<div class="matchedrow"${peakDataAttr} style="cursor:pointer;">` + 
                rowData.map((val, i) => `<div><b>${cols[i]}:</b> ${val}</div>`).join('') + 
                `</div>`;
        }).join('');
    }

    // 1. Handle Instrument Selection Change
    document.querySelectorAll('input[name="matchinstrument"]').forEach(input => {
        input.addEventListener('change', function() {
            G.matchXRD.clear(); // Clear all peaks (User + Ref)
            d3.select('#matchedData').html('<p>Please click any peak.</p>');
            if (this.id === 'xrdmatch') {
                document.getElementById('xrd-match-label').textContent = "Select Peak";
            } else {
                // Reset label if switching away
                document.getElementById('xrd-match-label').textContent = "XRD Data Match"; 
            }
        });
    });

    // 2. Handle Graph Clicks (Adding Peaks)
    d3.select('#chart').on('click.match', async function(event) {
        const isMatchEnabled = document.getElementById('icon5').checked;
        if (!isMatchEnabled) return;

        const svgNode = d3.select('#chart svg').node();
        const [mx, my] = d3.pointer(event, svgNode);
        
        // Bounds Check
        if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR || 
            my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;

        const xVal = G.state.lastXScale.invert(mx);
        const sel = document.querySelector('input[name="matchinstrument"]:checked').id;

        if (sel === 'xrdmatch') {
            G.matchXRD.addPeak(xVal);
        } else if (G.matchStandard.isStandard(sel)) {
            const { matches, cols } = await G.matchStandard.search(sel, xVal);
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });

    // 3. Handle "Search Database" Button Click
    document.getElementById('xrd-match-label').addEventListener('click', async function(e) {
        const radio = document.getElementById('xrdmatch');
        if (radio.checked && this.textContent === "Search Database") {
            const { matches, cols } = await G.matchXRD.search();
            d3.select('#matchedData').html(renderMatches(matches, cols));
        }
    });

    // 4. Handle Click on Result Row (Visualize Reference Peaks)
    d3.select('#matchedData').on('click', function(e) {
        const target = e.target.closest('.matchedrow');
        if (target && target.dataset.peaks) {
            // Remove active class from others and add to current
            d3.selectAll('.matchedrow').style('background', ''); 
            target.style.background = '#f0f8ff'; 

            const peaks = JSON.parse(target.dataset.peaks);
            G.matchXRD.showReferencePeaks(peaks);
        }
    });

})(window.GraphPlotter);
