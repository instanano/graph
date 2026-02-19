(function(G) {
    "use strict";
    function getSeries() {
        const s = G.getSettings(), data = G.state.hot.getData(), header = data[0], rows = data.slice(3), enabled = G.state.colEnabled, series = [];
        if (s.type === "ternary" || s.type === "ternaryline" || s.type === "ternaryarea") {
        const header = G.state.hot.getData()[0]; const rows = G.state.hot.getData().slice(3);
        const xIdx = header.indexOf("X-axis"); const yIdx = header.indexOf("Y-axis"); const zIdx = header.indexOf("Z-axis");
        return [{ rawX: rows.map(r => +r[xIdx]), y: rows.map(r => +r[yIdx]), z: rows.map(r => +r[zIdx]), color: G.state.hot.getData()[1][yIdx]}];}
        if (s.type === "histogram") { header.forEach((h,i) => { if (h === "Y-axis" && enabled[i]) {
        const rawY = rows.map(r => parseFloat(r[i])).filter(v => Number.isFinite(v));
        series.push({ y: rawY, color: data[1][i], label: data[2][i] });}}); return series;}
        const xCols = header.map((h,i) => h === "X-axis" && enabled[i] ? i : -1).filter(i => i >= 0);
        xCols.forEach((xIdx, bi) => { const nextX = xCols[bi+1] != null ? xCols[bi+1] : header.length;
        for (let yIdx = xIdx + 1; yIdx < nextX; yIdx++) { if (header[yIdx] === "Y-axis" && enabled[yIdx]) {
        const rawX = rows.map(r => s.type === "bar" ? r[xIdx] : parseFloat(r[xIdx])); const rawY = rows.map(r => parseFloat(r[yIdx]));
        const errIdx = header[yIdx+1] === "Y-error" && enabled[yIdx+1] ? yIdx+1 : -1;
        const error = errIdx >= 0 ? rows.map(r => parseFloat(r[errIdx])||NaN) : null;
        const errorColor = errIdx >= 0 ? data[1][errIdx] : null; series.push({ 
        rawX, x: rawX, y: rawY, color: data[1][yIdx], label: data[2][yIdx], error, errorColor});}}}); return series;
    }
    function getSettings() {
        const ratio = document.querySelector('input[name="aspectratio"]:checked').value; const preset = G.config.ratioPresets[ratio];
        const s = { type: document.querySelector('input[name="charttype"]:checked').id, symbolsize: +document.getElementById("symbolsize").value, 
        xticks: preset.xticks, yticks: preset.yticks,
        scaleformat: +document.getElementById("scaleformat").value, 
        bins: +document.getElementById("bins").value, 
        multiygap: +document.getElementById("multiygap").value,
        scalewidth: +document.getElementById("scalewidth").value, linewidth: +document.getElementById("linewidth").value,
        multiyaxis: +document.getElementById("multiyaxis").value, opacity: +document.getElementById("opacity").value, 
        mode: document.querySelector('input[name="axistitles"]:checked').value, 
        scaleFs: preset.scaleFs, axisTitleFs: preset.axisTitleFs, legendFs: preset.legendFs,
        ratio: document.querySelector('input[name="aspectratio"]:checked').value,};
        const chartData = document.querySelector('input[name="charttype"]:checked').dataset; Object.entries(chartData).forEach(([key, val]) => {
        if (/^-?\d+(\.\d+)?$/.test(val)) { s[key] = +val;} else if (val.includes(',')) { s[key] = val.split(',').map(v => v.trim());}
        else { s[key] = val;}}); return s;
    }
    function computeMultiYScales(scales, s, series) {
        if (s.multiyaxis !== 1 || series.length < 2) return; const multiYScales = series.map((sv, i) => {
        const [minY, maxY] = d3.extent(sv.y); const padY = (maxY - minY) * 0.06;
        const domain = (G.state.overrideMultiY?.[i]) ? G.state.overrideMultiY[i] : [minY - padY, maxY + padY];
        return d3.scaleLinear().domain(domain).range([G.config.DIM.H - G.config.DIM.MB, G.config.DIM.MT]);});
        scales.y2 = multiYScales; scales.y  = multiYScales[0]; G.state.multiYScales = multiYScales;
    }
    function initSvgCanvas(container, { W, H, ML, MR, MT, MB }, clipId = "clip", s = {}) {
        const svg = container.append("svg").attr("viewBox", `0 0 ${W} ${H}`).on("click", event => { if (event.defaultPrevented || event.target !== svg.node()) return; G.utils.clearActive();}); const cp = svg.append("defs").append("clipPath").attr("id", clipId); 
        if (s.type === "ternary" || s.type === "ternaryline" || s.type === "ternaryarea") { const availW = W - ML - MR; const availH = H - MT - MB; const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH = side * Math.sqrt(3) / 2; const p1x = ML + (availW - side) / 2; const p1y = MT + (availH - triH) / 2 + triH; const p2x = p1x + side; const p3x = p1x + side / 2; const p3y = p1y - triH; 
        cp.append("polygon").attr("points", `${p1x},${p1y} ${p2x},${p1y} ${p3x},${p3y}`);} 
        else { cp.append("rect").attr("x", ML).attr("y", MT).attr("width", W - ML - MR).attr("height", H - MT - MB);} return svg;
    }
    function renderChart() {
        const container = d3.select("#chart");
        const preserved = container.select("svg").selectAll("g.axis-title, g.legend-group, g.shape-group, foreignObject.user-text").remove(); container.html(""); 
        const { s, series, xScale, yScale, W, H, MT, MB, ML, MR, titles } = G.axis.prepareChartContext();
        const svg = initSvgCanvas(container, { W, H, ML, MR, MT, MB }, "clip", s); G.ui.areacalculation();
        preserved.each(function() {svg.node().appendChild(this);});
        const scales = { x: xScale, y: yScale }; computeMultiYScales(scales, s, series); const seriesG = svg.append("g").attr("clip-path","url(#clip)");
        const chartDef = G.ChartRegistry.get(s.type); chartDef.draw(seriesG, series, scales, s);
        G.axis.drawAxis(svg, scales, titles, s, series); G.ui.drawLegend(); G.ui.toolTip(svg, { xScale, yScale });
        G.features.prepareShapeLayer(); 
        G.axis.tickEditing(d3.select('#chart svg'));
        G.matchXRD?.render();
    }
    function detectModeFromData() {
        const series = G.getSeries();
        if (!series || series.length === 0) return null;
        const xVals = series[0].x.filter(v => Number.isFinite(v));
        if (xVals.length === 0) return null;
        const minX = Math.min(...xVals); const maxX = Math.max(...xVals);
        if (minX >= 180 && minX <= 200 && maxX === 800) return 'uvvis';
        if (minX >= 398 && minX <= 400 && maxX === 4000) return 'ftir';
        if (minX >= 0 && minX <= 10 && maxX >= 80 && maxX <= 90) return 'xrd';
        return null;
    }
    function openPanelForMode(mode) {
        const panelByMode = { xrd: 'icon5' };
        const panelId = panelByMode[mode];
        if (panelId) G.ui.openSidebarPanel?.(panelId);
    }
    let renderQueued = false;
    function scheduleRender() {
        if (renderQueued) return;
        renderQueued = true;
        requestAnimationFrame(() => {
            renderQueued = false;
            G.renderChart();
        });
    }
    function bindEvents(){
        G.state.hot.addHook('afterPaste', () => { setTimeout(() => { G.state.colEnabled = {}; G.state.hot.getData()[0].forEach((_, c) => { G.state.colEnabled[c] = true; }); G.state.hot.render(); const mode = detectModeFromData(); if (mode) { 
        const radio = document.querySelector(`input[name="axistitles"][value="${mode}"]`); if (radio) radio.checked = true; openPanelForMode(mode);} G.axis.resetScales(true);
        const svg = d3.select("#chart svg"); if (!svg.empty()) { svg.selectAll(".shape-group").remove(); svg.selectAll("foreignObject.user-text").remove(); G.state.tickLabelStyles={x:{fontSize:null,color:null},y:{fontSize:null,color:null}};} G.renderChart();}, 0);});
        G.state.hot.addHook('afterChange', (changes, src)=>{ if(!changes) return; let h=false, d=false; for(const [r,,o,n] of changes){
        if(r===0 && o!==n) h=true; if(r>=3 && o!==n) d=true;} d? G.axis.resetScales(true): h&& G.axis.resetScales(false); if(src!=='paste') scheduleRender(); 
        }); G.state.hot.addHook('beforeKeyDown', e => {const s=G.state.hot.getSelectedLast();if (s && s[0] === 0) {e.stopImmediatePropagation(); e.preventDefault();}});
        document.addEventListener('input', e => {
        if (e.target.id !== 'enableAreaCalc' && e.target.name !== 'sidebar') G.ui.disableAreaCal();
        const t=e.target; if(!t.matches('.control input')) return;
        if(t.name==='axistitles'|| t.name==='aspectratio') G.axis.resetScales(false); if(t.name==='aspectratio'){G.axis.applyGraphRatio(t.value);} scheduleRender();});
    }
    const controls = document.querySelectorAll('input[id]'); const showEls  = document.querySelectorAll('[data-show]');
    const radios   = document.querySelectorAll('input[name="charttype"]');
    radios.forEach(radio => radio.addEventListener('change', () => { if (!G.state.hot || typeof G.renderChart !== "function") return; controls.forEach(ctl => {
    ctl.value = radio.dataset[ctl.id]  ?? ctl.dataset.defaultValue  ?? ctl.defaultValue; ctl.dispatchEvent(new Event('input'));});
    showEls.forEach(el => { el.style.display = el.dataset.show.split(/\s+/).includes(radio.id) ? '' : 'none'; });
    const specs = radio.dataset.axis ?.split(/\s*,\s*/).map(s => s.trim()); if (specs) { const d = G.state.hot.getData(); 
    while (d[0].length < specs.length) d.forEach((r, i) => r.push(i === 0 ? specs[r.length].replace('*', '') : i === 1 
    ? G.config.COLORS[r.length % G.config.COLORS.length] : i === 2 ? "Sample" : "")); G.state.hot.loadData(d);} if (specs) { let p = specs.findIndex(s => s.endsWith('*'));
    if (p < 0) p = specs.length; const patterns = specs.map(s => s.replace(/\*$/, '')); const wild     = patterns.slice(p);
    G.state.hot.getData()[0].forEach((orig, i) => { const lbl = i < p ? patterns[i] : (wild.length ? wild[(i - p) % wild.length] : orig);
    G.state.hot.setDataAtCell(0, i, lbl); G.state.colEnabled[i] = (G.state.colEnabled[i] !== false) && patterns.includes(lbl); }); G.state.hot.render();} 
    G.axis.resetScales(false); scheduleRender(); }));
    ['smoothingslider','baselineslider','multiyaxis'].forEach(id => { const input = document.getElementById(id);
    function updateThumbColor() { input.classList.toggle('zero', input.value === '0');}
    input.addEventListener('input', updateThumbColor); updateThumbColor();});
    document.querySelectorAll('span[data-current-value]').forEach(span => {
    const slider = document.getElementById(span.dataset.currentValue); if (!slider || slider.type !== 'range') return;
    span.textContent = slider.value; slider.oninput = () => { span.textContent = slider.value;};});
    G.getSeries = getSeries;
    G.getSettings = getSettings;
    G.renderChart = renderChart;
    G.init = function() {
        G.ui.bindShellEvents?.();
        G.initTable(); 
        bindEvents(); 
        G.io.initFileLoader?.({ detectModeFromData, openPanelForMode });
        G.axis.resetScales(true);
        const selectedType = document.querySelector('input[name="charttype"]:checked');
        if (selectedType) selectedType.dispatchEvent(new Event('change'));
        else G.renderChart();
    };
    document.addEventListener('DOMContentLoaded', () => {
        window.GraphPlotter.init();
    });
})(window.GraphPlotter);
