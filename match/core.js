(function(G) {
    "use strict";
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph@latest/match/';
    const matchDataCache = {};
    const buffers = {ftirmatch:{range:20,single:50},xpsmatch:{range:1,single:0.5},ramanmatch:{range:10,single:30},uvvismatch:{range:20,single:40},hnmrmatch:{range:0.2,single:0.5},cnmrmatch:{range:10,single:20}};
    const headers = {ftirmatch:['Peak Position','Group','Class','Intensity'],xpsmatch:['Peak Position','Group','Material','Notes'],ramanmatch:['Raman Shift (cm⁻¹)','Material','Mode','Notes'],uvvismatch:['λmax (nm)','Material','Characteristic','Description'],hnmrmatch:['Chemical Shift (ppm)','Type','Assignment','Description'],cnmrmatch:['Chemical Shift (ppm)','Type','Assignment','Description']};
    async function loadMatchData(id) {
        if (matchDataCache[id]) return matchDataCache[id];
        try {
        const folder = id.replace('match', '');
        const res = await fetch(CDN_BASE + folder + '/match.json');
        if (!res.ok) throw new Error(res.status);
        const data = await res.json();
        matchDataCache[id] = data;
        return data;
        } catch (e) { console.error('Load failed:', id, e); return []; }
    }
    function renderMatches(matches, cols) {
        return matches.map(row => `<div class="matchedrow">` + row.map((val, i) => `<div class="matchedrow-h${i+1}"><b>${cols[i]}:</b> ${val}</div>`).join('') + `</div>`).join('');
    }
    async function updateMatchTable(xVal) {
        const sel = document.querySelector('input[name="matchinstrument"]:checked').id;
        const buf = buffers[sel] || {range:0,single:0};
        const cols = headers[sel] || [];
        const dataArr = await loadMatchData(sel);
        const matches = dataArr.filter(r => {
        const parts = r[0].split('-').map(Number);
        return parts.length > 1 ? (xVal >= parts[0] - buf.range && xVal <= parts[1] + buf.range) : Math.abs(xVal - parts[0]) <= buf.single;});
        d3.select('#matchedData').html(matches.length ? renderMatches(matches, cols) : '<p>No matching peaks found.</p>');
    }
    d3.select('#matchedData').html('<p>Please click any peak.</p>');
    document.getElementById('icon5').addEventListener('change', function() {
    if (this.checked) loadMatchData(document.querySelector('input[name="matchinstrument"]:checked').id);});
    document.querySelector('label[for="icon5"]').addEventListener('mouseenter', () => {
    loadMatchData(document.querySelector('input[name="matchinstrument"]:checked').id);});
    document.querySelectorAll('input[name="matchinstrument"]').forEach(input => {
    input.addEventListener('change', async function() {
    d3.select('#matchedData').html('<p>Loading...</p>');
    await loadMatchData(this.id);
    d3.select('#matchedData').html('<p>Please click any peak.</p>');});});
    d3.select('#chart').on('click.match', async function(event) {
    if (!document.getElementById('icon5').checked) return;
    const svgNode = d3.select('#chart svg').node(), [mx, my] = d3.pointer(event, svgNode);
    if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR || my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;
    await updateMatchTable(G.state.lastXScale.invert(mx));});
})(window.GraphPlotter);
