window.GraphPlotter = window.GraphPlotter || {
    state: {
        hot: null, colEnabled: {}, activeGroup: null, activeText: null, activeDiv: null, activeFo: null, activeTicks: null,
        tickLabelStyles: {x:{},y:{},a:{},b:{},c:{}}, lastXScale: null, lastYScale: null, multiYScales: null, axisScales: null,
        overrideX: null, overrideMultiY: {}, overrideXTicks: null, overrideYTicks: {}, overrideTernary: {}, overrideTernaryTicks: {},
        overrideScaleformatX: null, overrideScaleformatY: {}, overrideCustomTicksX: null, overrideCustomTicksY: {}, overrideCustomTicksTernary: {},
        minorTickOn: {}, useCustomTicksOn: {}, shapeMode: "none", drawing: false, drawStart: null, tempShape: null, arrowCount: 0
    },
    config: {}, utils: {}, ChartRegistry: null, parsers: {}, ui: { refs: {} }, axis: {}, features: {}, init: null, renderChart: null, getSeries: null, getSettings: null
};
(function(G) {
    "use strict";
    G.config.COLORS = ["#FFFF00","#000000","#0000FF","#FF0000","#008000","#00FFFF","#FF00FF","#FFA500","#800080","#A52A2A"];
    G.config.DIM = { W: 600, H: 300, MT: 30, MB: 60, ML: 70, MR: 80 };
    G.config.SYMBOL_TYPES = [d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare, d3.symbolDiamond, d3.symbolStar, d3.symbolCross];
    G.config.ratioPresets = {
        "4:2.85":{linewidth:1.4,scalewidth:1.4,axisTitleFs:13,legendFs:13,scaleFs:12,xticks:6,yticks:5,multiygap:35},
        "16:9.15": { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:11, xticks:6, yticks:5, multiygap:35 },
        "2:1.05":  { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:11, xticks:6, yticks:5, multiygap:35 },
        "3:1.2":   { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:10, xticks:7, yticks:3, multiygap:35 },
        "4:1.35":  { linewidth:1.2, scalewidth:1.2, axisTitleFs:11, legendFs:11, scaleFs:10, xticks:7, yticks:2, multiygap:35 }
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.utils.escapeHTML = function(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, ch => (
            ch === "&" ? "&amp;" :
            ch === "<" ? "&lt;" :
            ch === ">" ? "&gt;" :
            ch === '"' ? "&quot;" : "&#39;"
        ));
    };
    G.utils.clearActive = function() { 
        const S = G.state;
        if (S.activeGroup) { S.activeGroup.select(".outline").attr("visibility", "hidden"); S.activeGroup = null;}
        if (S.activeText) { S.activeText.attr("contenteditable", false).style("border", null); S.activeText = null;}
        if (S.activeDiv) { S.activeDiv.attr("contenteditable", false).style("border", null).style("cursor", "move"); S.activeDiv = null;}
        if (S.activeTicks) { S.activeTicks.attr('contenteditable', false).style('outline', null).style('cursor', 'pointer'); S.activeTicks = null; document.getElementById("axis-label").textContent = "Axis Settings: Select Axis"; document.getElementById("scalemin").value = ""; document.getElementById("scalemax").value = ""; document.getElementById("customticks").value = "";} S.activeFo = null; 
        if(G.ui.refs.boldBtn) G.ui.refs.boldBtn.classed("active", false); 
        if(G.ui.refs.italicBtn) G.ui.refs.italicBtn.classed("active", false); 
        if(G.ui.refs.rmBtn) G.ui.refs.rmBtn.classed("disabled", true); 
        window.getSelection().removeAllRanges();
        ['scalemin','scalemax','tickcount','scaleformat','customticks','useCustomTicks','showMinorTicks'].forEach(id => { document.getElementById(id).disabled = true;});
    };
    G.utils.rgbToHex = function(rgb) { return "#"+rgb.match(/\d+/g).map(n=>(+n).toString(16).padStart(2,"0")).join(""); };
    function dragStarted(event) {
        G.state.hot.deselectCell(); event.sourceEvent.preventDefault(); G.utils.clearActive(); const sel = d3.select(this).raise(); 
        if (sel.classed("shape-group")) { G.features.activateShape(sel);} else { const fo  = sel.node().tagName === "foreignObject" ? sel : sel.select("foreignObject"); const div = fo.select("div"); G.features.activateText(div, fo); setTimeout(() => { window.getSelection().selectAllChildren(div.node());}, 0);}
    }
    function dragged(event) {
        const sel = d3.select(this); const t = sel.attr("transform") || ""; const m = t.match(/translate\(([^,]+),([^)]+)\)/) || [];
        const x = +m[1] || 0, y = +m[2] || 0; const rot = (/rotate\(([^)]+)\)/.exec(t) || [])[0] || "";
        sel.attr("transform", `translate(${x + event.dx},${y + event.dy})${rot}`);
    }
    function dragEnded() {
        const sel = d3.select(this); if (sel.classed("user-text") || sel.classed("axis-title") || sel.classed("legend-group")) {
        const div = sel.select("foreignObject div"); if (sel.classed("legend-group")) { this.dataset.savedTransform = sel.attr("transform");} div.on("blur", () => { div.attr("contenteditable", false).style("cursor", "move");});}
    }
    G.utils.applyDrag = d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded);
    G.utils.updateInspector = function(selection) {
        const node = selection.node(); const cs = window.getComputedStyle(node);
        const size = parseFloat(selection.attr("stroke-width")) || parseInt(cs.fontSize, 10);
        const col  = node.tagName === "DIV" ? cs.color : (cs.stroke !== "none" ? cs.stroke : cs.fill);
        G.ui.refs.sizeCtrl.property("value", size);
        G.ui.refs.colorCtrl.property("value", G.utils.rgbToHex(col));
        const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
        G.ui.refs.fontCtrl.property("value", fam);
        const isBold = cs.fontWeight === "700" || cs.fontWeight === "bold";
        G.ui.refs.boldBtn.classed("active", isBold);
        const isItalic = cs.fontStyle === "italic";
        G.ui.refs.italicBtn.classed("active", isItalic);    
        G.ui.refs.rmBtn.classed("disabled", false);
    };
    G.utils.editableText = function(container, { x, y, text, rotation }) {
        const pad = 2; const fo = container.append("foreignObject").attr("x", x).attr("y", y)
        .attr("transform", rotation ? `rotate(${rotation},${x},${y})` : null).attr("overflow", "visible");
        const div = fo.append("xhtml:div").attr("contenteditable", false).style("display", "inline-block").style("white-space", "nowrap")
        .style("padding", `${pad}px`).style("cursor", "move").style("font-size", "12px").text(String(text == null ? "" : text)); const w = div.node().scrollWidth;
        const h = div.node().scrollHeight; fo.attr("width",  w + pad).attr("height", h + pad); div.on("input", () => {
        const nw = div.node().scrollWidth; const nh = div.node().scrollHeight; fo.attr("width",  nw + pad).attr("height", nh + pad);})
        .on("paste", function(e) {
            e.preventDefault();
            const plain = (e.clipboardData || window.clipboardData).getData("text/plain");
            const usedExec = typeof document.execCommand === "function" && document.execCommand("insertText", false, plain);
            if (usedExec) return;
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) { this.textContent += plain; return; }
            sel.deleteFromDocument();
            const tn = document.createTextNode(plain);
            const range = sel.getRangeAt(0);
            range.insertNode(tn);
            range.setStartAfter(tn);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        })
        .on("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); this.blur();}}).on("blur", () => {
        d3.select(div.node()).style("cursor", "move");}); return { fo, div, pad };
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    const types = new Map();
    G.ChartRegistry = {
        register(def) {
            if (!def.id || typeof def.draw !== "function") { throw new Error("Invalid chart registration"); }
            types.set(def.id, def);
        },
        get(id) {
            const chart = types.get(id);
            if (!chart) throw new Error(`Unknown chart type: ${id}`);
            return chart;
        }
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.initTable = function() {
        const container = document.getElementById("table");
        G.state.hot = new myTable(container, {
            data: [["X-axis","Y-axis"],["#FFFF00","#000000"],["Sample","Sample"],[10,223],[20,132],[30,532],[40,242],[50,300],[70,100],[100,250]],
            colHeaders: colIndex => {
                G.state.colEnabled[colIndex] = G.state.colEnabled[colIndex] !== false;
                return `<input type="checkbox" data-col="${colIndex}" ${G.state.colEnabled[colIndex] ? "checked" : ""}>`;},
            rowHeaders: rowIndex => ["Axis", "Color", "Name"][rowIndex] || rowIndex - 2,
            rowHeaderWidth:60, colWidths:70,
            contextMenu: true, 
            afterRemoveRow: () => { G.axis.resetScales(true); G.renderChart(); },
            afterRemoveCol: () => { G.axis.resetScales(true); G.renderChart(); },
            afterChange: (changes) => {
                if (!changes) return;
                if (G.matchXRD) { G.matchXRD.lockActive = false; G.matchXRD.lockedPeaks = []; G.matchXRD.lockInfo = null; G.matchXRD.render(); }
            },
            afterCreateCol: (start, count) => {
                for (let c = start; c < start + count; c++) {
                    G.state.hot.setDataAtCell(0, c, "Y-axis");
                    G.state.hot.setDataAtCell(1, c, G.config.COLORS[c % G.config.COLORS.length]);
                    G.state.hot.setDataAtCell(2, c, "Sample");}},
            cells: (row, col) => {
                const props = {};
                if (row === 0) { props.type = "dropdown"; props.source = ["X-axis", "Y-axis", "Z-axis", "Y-error"]; props.className = 'tabledropdown';}
                if (row === 1) { props.renderer = (inst, td, r, c, prop, val) => { td.innerHTML = ""; if (!["X-axis", "Z-axis"]
                .includes(inst.getDataAtCell(0, c))) { const inp = document.createElement("input"); inp.type = "color"; 
                inp.value = val || G.config.COLORS[c % G.config.COLORS.length]; inp.oninput = e => inst.setDataAtCell(r, c, e.target.value); td.appendChild(inp);}};}
                if (row === 2) { props.renderer = (inst, td, r, c, prop, val) => { 
                td.textContent = ["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c)) ? "" : (val || "Sample");};}
                const base = props.renderer || myTable.renderers.TextRenderer;
                props.renderer = function(inst, td, r, c, prop, val) {
                    base.apply(this, arguments);
                    td.style.background = G.state.colEnabled[c] ? "" : "lightcoral";};
                return props;}
        });
        G.state.hot.addHook("afterCreateCol", checkEmptyColumns);
        container.addEventListener("change", e => {
            if (e.target.matches('input[type="checkbox"][data-col]')) {
                const col = +e.target.dataset.col;
                G.state.colEnabled[col] = e.target.checked;
                if (G.matchXRD) { G.matchXRD.lockActive = false; G.matchXRD.lockedPeaks = []; G.matchXRD.lockInfo = null; G.matchXRD.render(); }
                G.state.hot.render();
                G.axis.resetScales(false);
                G.renderChart(); checkEmptyColumns();}});
    };
    function checkEmptyColumns() {
        const data = G.state.hot.getData(); const dm = document.querySelector('label[for="icon1"]'); if (!dm) return;
        const shouldShow = data[0].some((_, c) => G.state.colEnabled[c] && data.slice(3).every(r => r[c] == null || r[c] === "" || isNaN(+r[c])));
        const existingBadge = dm.querySelector(".warning-badge"); if (shouldShow) { if (!existingBadge) { const b = document.createElement("span");
        b.className = "warning-badge"; b.textContent = "!"; dm.appendChild(b);}} else if (existingBadge) { existingBadge.remove();}
    }
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.ChartRegistry.register({
        id: "line",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
        series.forEach((sv, i) => {
            const yS = scales.y2 ? scales.y2[i] : scales.y;
            const line = d3.line()
                .defined((_, j) => Number.isFinite(sv.x[j]) && Number.isFinite(sv.y[j]))
                .x((_, j) => scales.x(sv.x[j]))
                .y((_, j) => yS(sv.y[j]));
            g.append("path").datum(sv.y).attr("fill","none").attr("stroke", sv.color).attr("stroke-width", s.linewidth).attr("d", line);
        });}
    });
    G.ChartRegistry.register({
        id: "stacked",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
        const { H, MT, MB } = G.config.DIM, total = H - MT - MB, gaps = series.length + 1, gap = (total * 0.1) / gaps, band = (total - gap * gaps) / series.length;
        series.forEach((sv, i) => {
            const ymin = d3.min(sv.y), ymax = d3.max(sv.y), start = MT + gap * (i + 1) + band * i, end = start + band, yInner = d3.scaleLinear().domain([ymin, ymax]).range([end, start]);
            const line = d3.line().defined((_, i) => Number.isFinite(sv.x[i]) && Number.isFinite(sv.y[i])).x((_, j) => scales.x(sv.x[j])).y((_, j) => yInner(sv.y[j]));
            g.append("path").datum(sv.y).attr("fill", "none").attr("stroke", sv.color).attr("stroke-width", s.linewidth).attr("d", line);
        });}
    });
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.ChartRegistry.register({
        id: "scatter",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
        G.ui.drawErrorBars(g, series, scales, s);
        series.forEach((sv, i) => {
            const yS = scales.y2 ? scales.y2[i] : scales.y;
            const sym = d3.symbol().type(G.config.SYMBOL_TYPES[i % G.config.SYMBOL_TYPES.length]).size(Math.PI * Math.pow(s.symbolsize, 2));
            g.selectAll().data(sv.x).enter().append("path").attr("d", sym).attr("transform", (d, j) => `translate(${scales.x(d)},${yS(sv.y[j])})`).attr("fill", sv.color);
        });}
    });
    G.ChartRegistry.register({
        id: "scatterline",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            G.ChartRegistry.get("line").draw(g, series, scales, s); G.ChartRegistry.get("scatter").draw(g, series, scales, s);}
    });
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.ChartRegistry.register({
        id: "bar",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleBand, y: d3.scaleLinear }, bandPadding: 0.1,
        draw: (g, series, scales, s) => {
        const bw   = scales.x.bandwidth(), barW = bw / series.length;
        series.forEach((sv, i) => {
            g.selectAll().data(sv.y).enter().append("rect").attr("x", (_, j) => scales.x(sv.rawX[j]) + i * barW).attr("y", d => scales.y(d))
            .attr("width",  barW).attr("height", d  => scales.y.range()[0] - scales.y(d)).attr("fill", sv.color);
        }); G.ui.drawErrorBars(g, series, scales, s);}
    });
    G.ChartRegistry.register({
        id: "histogram", dimensions: ["x","y"], scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear }, bandPadding: 0.1,
        draw: (g, series, scales, s) => { const xDomain = scales.x.domain(); const [minV, maxV] = xDomain;
        const step = (maxV - minV) / s.bins; const thresholds = d3.range(minV, maxV, step); let maxCount = 0;
        const allBins = series.map(sv => { const filtered = sv.y.filter(v => Number.isFinite(v) && v >= minV && v <= maxV);
        const bins = d3.histogram().domain([minV, maxV]).thresholds(thresholds)(filtered);
        maxCount = Math.max(maxCount, d3.max(bins, d => d.length)); return bins;});
        series.forEach((sv, idx) => { const bins = allBins[idx];
        const bandScale = d3.scaleBand().domain(bins.map(d => d.x0)).range([G.config.DIM.ML, G.config.DIM.W - G.config.DIM.MR]).padding(G.ChartRegistry.get(s.type).bandPadding); const bw = bandScale.bandwidth();
        g.selectAll("rect.hist-bin-" + idx).data(bins).enter().append("rect").attr("class", "hist-bin-" + idx).attr("x", d => bandScale(d.x0)).attr("width", bw).attr("y", d => scales.y(d.length)).attr("height", d => (G.config.DIM.H - G.config.DIM.MB) - scales.y(d.length)).attr("fill", sv.color).attr("fill-opacity", 0.5 + 0.5 / series.length);});}
    });
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.ChartRegistry.register({
        id: "area",
        dimensions: ["x","y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
        series.forEach((sv, i) => {
            const yS = scales.y2 ? scales.y2[i] : scales.y;
            const area = d3.area().defined((_, j) => Number.isFinite(sv.x[j]) && Number.isFinite(sv.y[j])).x((_, j) => scales.x(sv.x[j])).y0(() => yS.range()[0]).y1((_, j) => yS(sv.y[j]));
            g.append("path").datum(sv.y).attr("fill", sv.color).attr("fill-opacity", s.opacity).attr("stroke", sv.color).attr("stroke-width", 0).attr("d", area);
        });}
    });
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function drawTernaryPlot(g, series, s, opts = {}) {
        G.axis.drawTernaryAxis(g, s); const DIM = G.config.DIM; const availW = DIM.W - DIM.ML - DIM.MR; const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2; const p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side, p2y = p1y; const p3x = p1x + side / 2, p3y = p1y - triH;
        const domA = G.state.overrideTernary?.a || [0, 100]; const domB = G.state.overrideTernary?.b || [0, 100];
        const domC = G.state.overrideTernary?.c || [0, 100]; const norm = (v, r) => (v - r[0]) / (r[1] - r[0]);
        series.forEach((sv, idx) => { const points = sv.rawX.map((aVal, i) => {
        const aN = norm(aVal, domA), bN = norm(sv.y[i], domB), cN = norm(sv.z[i], domC);
        const sum = aN + bN + cN; if (!sum) return null; const px = (aN * p2x + bN * p3x + cN * p1x) / sum;
        const py = (aN * p2y + bN * p3y + cN * p1y) / sum; return { x: px, y: py, i };}).filter(Boolean);
        if (opts.area) { g.append("polygon").attr("points", points.map(d => `${d.x},${d.y}`).join(" "))
        .attr("fill", sv.color).attr("fill-opacity", s.opacity || 1);}
        if (opts.line) { const lineGen = d3.line().x(d => d.x).y(d => d.y);g.append("path").datum(points)
        .attr("fill", "none").attr("stroke", sv.color).attr("stroke-width", s.linewidth).attr("d", lineGen);}
        if (opts.symbol) { const sym = d3.symbol().type(G.config.SYMBOL_TYPES[idx % G.config.SYMBOL_TYPES.length]).size(Math.PI * s.symbolsize ** 2);
        points.forEach(d => g.append("path").attr("d", sym).attr("transform", `translate(${d.x},${d.y})`).attr("fill", sv.color));}}); }
    G.ChartRegistry.register({id: "ternary", dimensions: ["x", "y", "z"], draw: (g, series, scales, s) => { G.axis.drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { symbol: true });}});
    G.ChartRegistry.register({id: "ternaryline", dimensions: ["x", "y", "z"], draw: (g, series, scales, s) => { G.axis.drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { symbol: true, line: true });}});
    G.ChartRegistry.register({id: "ternaryarea", dimensions: ["x", "y", "z"], draw: (g, series, scales, s) => { G.axis.drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { area: true });}});
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.axis.prepareChartContext = function() {
        const s = G.getSettings(); const series = G.getSeries(); 
        const [rw, rh] = s.ratio.split(':').map(Number); 
        G.config.DIM.H = Math.round(G.config.DIM.W * rh / rw); 
        G.config.DIM.MR = 80 + (s.multiyaxis === 1 && series.length > 1 ? (series.length - 2) * s.multiygap : 0);
        const titles = G.axis.getTitles(s.mode); const { xScale, yScale } = G.axis.makeScales(s, series); 
        G.state.lastXScale = xScale;
        G.state.lastYScale = yScale;
        return { s, series, xScale, yScale, W: G.config.DIM.W, H: G.config.DIM.H, MT: G.config.DIM.MT, MB: G.config.DIM.MB, ML: G.config.DIM.ML, MR: G.config.DIM.MR, titles};
    }
    G.axis.makeScales = function(s, series) {
        const DIM = G.config.DIM;
        if (s.type === "histogram") {
          const allValues = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
          const [minV,maxV] = d3.extent(allValues);
          const step = (maxV - minV) / s.bins;
          const thresholds = d3.range(minV, maxV, step);
          const maxCount = d3.max(series.map(sv => d3.max(d3.histogram().domain([minV, maxV]).thresholds(thresholds)(sv.y), d => d.length)));
          const xDomain = G.state.overrideX || [minV, maxV];
          const yDomain = G.state.overrideMultiY?.[0] || [0, maxCount * 1.05];
          return {
            xScale: d3.scaleLinear().domain(xDomain).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
          };
        }
          if (s.type === "bar") {
            const allX = series.flatMap(sv => sv.rawX);
            const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minY,maxY] = d3.extent(allY);
            const padY = (maxY - minY) * 0.06;
            const yDomain = G.state.overrideMultiY?.[0] || [minY - padY, maxY + padY];
            return {
              xScale: d3.scaleBand().domain(allX).range([DIM.ML, DIM.W - DIM.MR]).padding(G.ChartRegistry.get("bar").bandPadding),
              yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
          }
          const allX = series.flatMap(sv => sv.x).filter(v => Number.isFinite(v));
          const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
          const [minX,maxX] = d3.extent(allX);
          const [minY,maxY] = d3.extent(allY);
          const padX = (maxX - minX) * 0.02;
          const padY = (maxY - minY) * 0.06;
          let xDom; if (G.state.overrideX) xDom = G.state.overrideX; else if (s.mode === 'ftir' || s.mode === 'nmr') xDom = [maxX + padX, minX - padX];     else xDom = [minX - padX, maxX + padX];
          const yDom = G.state.overrideMultiY?.[0] ? G.state.overrideMultiY[0] : [minY - padY, maxY + padY];
          return {
            xScale: d3.scaleLinear().domain(xDom).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDom).range([DIM.H - DIM.MB, DIM.MT])
          };
    };
    function computeDefaults(series) {
        if (!series.length) return null; const allX = series.flatMap((s) => s.x), allY = series.flatMap((s) => s.y),
        [minX, maxX] = d3.extent(allX), [minY, maxY] = d3.extent(allY), padX = (maxX - minX) * 0.02, padY = (maxY - minY) * 0.06;
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY,};
    }
    G.axis.applyGraphRatio = function(r) {
        const c = G.config.ratioPresets[r] || G.config.ratioPresets['4:2.85'];
        const [w, h] = r.split(':').map(Number);
        const m = G.state.multiYScales?.length > 1 ? (G.state.multiYScales.length - 2) * c.multiygap : 0;
        G.config.DIM.H = Math.round(G.config.DIM.W * h / w);
        G.config.DIM.MR = 80 + m;
        d3.selectAll('#chart svg g.axis-title foreignObject div').style('font-size', c.axisTitleFs + 'px').each(function() {
            const w2 = this.scrollWidth + 5;
            d3.select(this.parentNode).attr('width', w2).attr('x', -w2 / 2);
        });
        d3.selectAll('#chart svg g.legend-group foreignObject div').style('font-size', c.legendFs + 'px').each(function() {
            d3.select(this.parentNode).attr('width', this.scrollWidth + 5);
        });
    };
    G.axis.resetScales = function(full = true) {
        const S = G.state;
        if(full){S.overrideX=null; S.overrideMultiY={};S.overrideXTicks=null; S.overrideYTicks={}; 
        S.overrideScaleformatX=null; S.overrideScaleformatY={}; S.overrideCustomTicksX=null; 
        S.overrideCustomTicksY={}; S.overrideCustomTicksTernary=null; S.overrideTernary=null; 
        S.overrideTernaryTicks=null;S.minorTickOn ={}; S.useCustomTicksOn={};} const defs = computeDefaults(G.getSeries()); if (!defs) return;
        if (full) { document.getElementById("scalemin").value = defs.minX; document.getElementById("scalemax").value = defs.maxX;}
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.axis.getTitles = function(mode) {
        switch (mode) { case "uvvis":return { x: "Wavelength (nm)", y: "Absorbance (a.u.)" }; 
        case "tauc":return { x: "Energy (eV)", y: "Intensity (a.u.)" }; case "xrd":return { x: "2θ (°)", y: "Intensity (a.u.)" }; 
        case "ftir":return { x: "Wavenumber (cm⁻¹)", y: "Transmittance (%)" }; 
        case "raman":return { x: "Raman Shift (cm⁻¹)", y: "Intensity (a.u.)" }; 
        case "pl":return { x: "Wavelength (nm)", y: "Intensity (a.u.)" }; case "xps":return { x: "Binding Energy (eV)", y: "Intensity (cps)" }; 
        case "tga":return { x: "Temperature (°C)", y: "Weight (%)" }; case "dsc":return { x: "Temperature (°C)", y: "Heat Flow (mW)" }; 
        case "bet":return { x: "Relative Pressure (P/P₀)", y: "Adsorbed Volume (cm³·g⁻¹)" };
        case "saxs":return { x: "Scattering Vector q (Å⁻¹)", y: "Intensity (a.u.)" }; 
        case "nmr":return { x: "δ (ppm)", y: "Intensity (a.u.)" }; case "ternary": return { a: "A-axis", b: "B-axis", c: "C-axis" }; 
        case "tensile": return { x: "Strain", y: "Stress" }; default:return { x: "x-axis", y: "y-axis" };}
    };
    function axisTitle(svg, axes, modeKey, DIM) {
        const pad = 5; axes.forEach(axis => { let g = svg.select(`g.axis-title-${axis.key}`); if (g.empty()) { g = svg.append("g")
        .classed(`axis-title axis-title-${axis.key} user-text`, true).attr("data-axis-mode", modeKey)
        .attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "))
        .call(G.utils.applyDrag); const obj = G.utils.editableText(g, { x: 0, y: 0, text: axis.label, rotation: 0 }); obj.div.text(axis.label); obj.fo
        .attr("width", obj.div.node().scrollWidth + pad).attr("x", -(obj.div.node().scrollWidth + pad) / 2).attr("y", 0);
        obj.div.style("text-align", axis.anchor || "middle"); } else if (g.attr("data-axis-mode") !== modeKey) {
        const fo = g.select("foreignObject"); fo.select("div").text(axis.label); const w2 = fo.select("div").node().scrollWidth + pad;
        fo.attr("width", w2).attr("x", -w2 / 2).attr("y", 0); g.attr("data-axis-mode", modeKey);}
        g.attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "));});
    }
    G.axis.applyTickStyles = function(g, axisType, idx, scaleFs, defaultColor = 'currentColor') {
        const styles = (G.state.tickLabelStyles[axisType] || {})[idx] || {}; g.selectAll('text').classed('tick-label', true)
        .classed(`tick-${axisType}`, true).style('font-size', styles.fontSize || (scaleFs + 'px'))
        .style('fill', styles.color || defaultColor).style('font-family', styles.fontFamily || 'Arial')
        .style('font-weight', styles.fontWeight || 'normal').style('font-style', styles.fontStyle || 'normal').style('cursor', 'default');
    };
    function makeTickFormat(axisKey, idx = 0) {
        const FULL = d3.format(""); const ABBR = d3.format(".2s"); const SCI  = d3.format(".0e"); const S = G.state;
        let mode = 0; if (axisKey === 'x') {mode = S.overrideScaleformatX ?? 0;} else if (axisKey === 'y') {
        mode = S.overrideScaleformatY?.[idx] ?? 0;} else if (axisKey === 'a' || axisKey === 'b' || axisKey === 'c') {
        mode = S.overrideScaleformatTernary?.[axisKey] ?? 0;} return mode === 1 ? ABBR : mode === 2 ? SCI : FULL;
    }
    G.axis.addMinorTicks = function(axisGroup, scale, axisCtor, count = 0, size = 4, strokeWidth = 1, strokeColor = 'currentColor') {
        if (typeof scale.ticks !== 'function') return; let custom = null, key = null, sel = false; // FIXED: Added 'sel' declaration
        if (axisGroup.attr('data-xi') != null) { custom = G.state.overrideCustomTicksX || null; sel = window.selectedAxisName === 'X'; key = 'X'; }
        else if (axisGroup.attr('data-yi') != null) { const yi = +axisGroup.attr('data-yi'); custom = (G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[yi]) || null; sel = window.selectedAxisName === (yi === 0 ? 'Y' : ('Y' + (yi + 1))); key = 'Y'+yi;}
        else if (axisGroup.attr('data-ai') != null) { custom = G.state.overrideCustomTicksTernary?.a || null; sel = window.selectedAxisName === 'A'; key = 'A';}
        else if (axisGroup.attr('data-bi') != null) { custom = G.state.overrideCustomTicksTernary?.b || null; sel = window.selectedAxisName === 'B'; key = 'B';}
        else if (axisGroup.attr('data-ci') != null) { custom = G.state.overrideCustomTicksTernary?.c || null; sel = window.selectedAxisName === 'C'; key = 'C';}
        if (G.state.minorTickOn[key] === false) return; const useCustom = G.state.useCustomTicksOn?.[key] === true;
        const domain = scale.domain(); let minors = []; if (useCustom) { if (!Array.isArray(custom) || custom.length < 2) return; 
        const t = custom.filter(Number.isFinite).sort((a,b) => a - b); for (let i = 0; i < t.length - 1; i++) { const mid = (t[i] + t[i + 1]) / 2; 
        if (mid >= domain[0] && mid <= domain[1]) minors.push(mid);}}
        else { if (axisCtor === d3.axisBottom) count = (G.state.overrideXTicks ?? G.state.overrideTernaryTicks?.a ?? count);
        else if (axisCtor === d3.axisLeft) count = (G.state.overrideYTicks?.[0] ?? G.state.overrideTernaryTicks?.b ?? count);
        else if (axisCtor === d3.axisRight) count = (G.state.overrideTernaryTicks?.c ?? count);
        if (count == null) return; const major = scale.ticks(count); if (major.length >= 2) { const step = major[1] - major[0];
        minors = major.slice(0, -1).map(v => v + step / 2); if (major[0] - step / 2 >= domain[0]) minors.unshift(major[0] - step / 2);
        if (major[major.length - 1] + step / 2 <= domain[1]) minors.push(major[major.length - 1] + step / 2);}} if (!minors.length) return;
        minors = minors.filter(v => v >= Math.min(domain[0], domain[1]) && v <= Math.max(domain[0], domain[1]));
        const mg = axisGroup.append('g').call(axisCtor(scale).tickValues(minors).tickSize(size).tickFormat('')); mg.select('path.domain').remove(); mg.selectAll('line').classed('minor-tick', true).attr('stroke-width', strokeWidth).attr('stroke', strokeColor);
    }
    function multiYaxis(svg, scales, s, series){
        const yScale = scales.y; const DIM = G.config.DIM;
        if (s.multiyaxis === 1 && ["line","area","scatter","scatterline"].includes(s.type) && series.length > 1) { scales.y2 = series.map((sv,i) => {
        if (i===0) return yScale; const [minY,maxY] = d3.extent(sv.y); return d3.scaleLinear().domain([minY - (maxY-minY)*0.06,
        maxY + (maxY-minY)*0.06]).range([DIM.H - DIM.MB, DIM.MT]);}); G.state.multiYScales = scales.y2; 
        if (G.state.overrideMultiY) { for (const [key, range] of Object.entries(G.state.overrideMultiY)) { const idx = +key;
        if (G.state.multiYScales[idx]) { G.state.multiYScales[idx].domain(range);}}} series.slice(1).forEach((sv,i) => { const axisIndex = i + 1;
        const customYi = G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[axisIndex];
        const countYi  = customYi ? null : (G.state.overrideYTicks && G.state.overrideYTicks[axisIndex] != null ? G.state.overrideYTicks[axisIndex] : s.yticks);
        const gYi=svg.append("g").attr("data-yi",axisIndex).attr("transform",`translate(${DIM.W-DIM.MR+i*s.multiygap},0)`).attr("stroke-width",s.scalewidth).call(d3.axisRight(G.state.multiYScales[axisIndex]).tickValues(customYi).ticks(countYi).tickFormat(makeTickFormat('y', axisIndex)));
        gYi.selectAll("path,line").attr("stroke",sv.color); G.axis.addMinorTicks(gYi,G.state.multiYScales[axisIndex],d3.axisRight,countYi,4,s.scalewidth,sv.color);
        G.axis.applyTickStyles(gYi,"y",axisIndex,s.scaleFs,sv.color);});}
    }
    G.axis.drawAxis = function(svg, scales, titles, s, series) {
        const DIM = G.config.DIM;
        if (["ternary","ternaryline","ternaryarea"].includes(s.type)) { svg.selectAll(".axis-title").remove(); G.axis.renderTernaryAxes(svg, s, DIM); return;}
        svg.selectAll(".axis-title.ternary").remove();  
        const xScale = scales.x, yScale = scales.y;
        const customX = G.state.overrideCustomTicksX, countX  = customX ? null : (G.state.overrideXTicks ?? s.xticks);
        const customY0 = G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[0];
        const countY0  = customY0 ? null : (G.state.overrideYTicks && G.state.overrideYTicks[0] != null ? G.state.overrideYTicks[0] : s.yticks);
        const gX=svg.append("g").attr("data-xi",0).attr("transform","translate(0,"+(DIM.H-DIM.MB)+")").attr("stroke-width",s.scalewidth)
        .call(d3.axisBottom(xScale).tickValues(customX).ticks(countX).tickSize(6).tickPadding(4).tickFormat(s.type==="bar"?null:makeTickFormat('x', 0))); G.axis.applyTickStyles(gX,'x',0,s.scaleFs);
        const gY=svg.append("g").attr("data-yi",0).attr("transform","translate("+DIM.ML+",0)").attr("stroke-width",s.scalewidth)
        .call(d3.axisLeft(yScale).tickValues(customY0).ticks(countY0).tickSize(6).tickPadding(4).tickFormat(makeTickFormat('y', 0)));
        G.axis.applyTickStyles(gY,'y',0,s.scaleFs);
        G.axis.addMinorTicks(gX, xScale, d3.axisBottom, s.xticks, 4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gY, yScale, d3.axisLeft,  s.yticks, 4, s.scalewidth, 'currentColor');
        svg.append("line").attr("x1", DIM.ML).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.MT).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        svg.append("line").attr("x1", DIM.W - DIM.MR).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.H - DIM.MB).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth); multiYaxis(svg, scales, s, series);
        axisTitle(svg, [{ key: "x", label: titles.x, pos: [DIM.W / 2, DIM.H - DIM.MB / 1.7], rotation: 0, anchor: "middle" }, { key: "y", label: titles.y, pos: [DIM.ML - 60, DIM.H / 2], rotation: -90, anchor: "middle" }], s.mode, DIM);
    };
    G.axis.renderTernaryAxes = function(svg, s, DIM) {
        G.axis.drawTernaryAxis(svg, s); const availW = DIM.W - DIM.ML - DIM.MR; const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH   = side * Math.sqrt(3) / 2;
        const pA = [ DIM.ML + (availW - side) / 2, DIM.MT + (availH - triH) / 2 + triH ];
        const pB = [ pA[0] + side, pA[1] ]; const pC = [ pA[0] + side / 2, pA[1] - triH ];
        const ternaryTitles = [{ text: "A-axis", x: (pB[0] + pC[0]) / 2 + 50, y: (pB[1] + pC[1]) / 2 - 25, rot: 60, cls: "tern-x" },
        { text: "B-axis", x: (pA[0] + pC[0]) / 2 - 50, y: (pA[1] + pC[1]) / 2 - 25, rot: -60, cls: "tern-y" },
        { text: "C-axis", x: (pA[0] + pB[0]) / 2, y: pA[1] + 25, rot: 0,   cls: "tern-z" }];
        ternaryTitles.forEach(({ text, x, y, rot, cls }) => { const g = svg.append("g")
        .classed(`axis-title ternary ${cls} user-text`, true).attr("transform", `translate(${x},${y}) rotate(${rot})`);
        const { fo, div } = G.utils.editableText(g, { x: 0, y: 0, text, rotation: 0 }); const pad = 5;
        fo.attr("width", div.node().scrollWidth + pad).attr("x", - (div.node().scrollWidth + pad) / 2);});
    };
    G.axis.drawTernaryAxis = function(svg,s) {
        const DIM = G.config.DIM; const availW = DIM.W - DIM.ML - DIM.MR; const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2; const p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side; const p2y = p1y; const p3x = p1x + side / 2; const p3y = p1y - triH;
        const domA = G.state.overrideTernary?.a || [0, 100]; const domB = G.state.overrideTernary?.b || [0, 100];
        const domC = G.state.overrideTernary?.c || [0, 100]; const scaleA = d3.scaleLinear().domain(domA).range([0, side]);
        const scaleB = d3.scaleLinear().domain(domB).range([side, 0]); const scaleC = d3.scaleLinear().domain(domC).range([0, side]);
        const customA = G.state.overrideCustomTicksTernary?.a;
        const customB = G.state.overrideCustomTicksTernary?.b;
        const customC = G.state.overrideCustomTicksTernary?.c;
        const countA = customA ? null : (G.state.overrideTernaryTicks?.a ?? s.xticks);
        const countB = customB ? null : (G.state.overrideTernaryTicks?.b ?? s.xticks);
        const countC = customC ? null : (G.state.overrideTernaryTicks?.c ?? s.xticks);
        G.state.axisScales = { a: scaleA, b: scaleB, c: scaleC };    
        const gA=svg.append("g").attr("data-ai",0).attr("transform",`translate(${p1x},${p1y})`).attr("stroke-width",s.scalewidth).call(d3.axisBottom(scaleA).tickValues(customA).ticks(countA).tickSize(6).tickPadding(4));
        G.axis.applyTickStyles(gA,'a',0,s.scaleFs);
        const gB=svg.append("g").attr("data-bi",0).attr("transform",`translate(${p1x},${p1y}) rotate(210)`).attr("stroke-width",s.scalewidth).call(d3.axisLeft(scaleB).tickValues(customB).ticks(countB).tickSize(-6).tickPadding(15));
        gB.selectAll("text").attr("transform","rotate(-210)").style("text-anchor","middle").attr("dy","0px");
        G.axis.applyTickStyles(gB,'b',0,s.scaleFs);
        const gC=svg.append("g").attr("data-ci",0).attr("transform",`translate(${p2x},${p1y}) rotate(150)`).attr("stroke-width",s.scalewidth).call(d3.axisRight(scaleC).tickValues(customC).ticks(countC).tickSize(-6).tickPadding(15));
        gC.selectAll("text").attr("transform","rotate(-150)").style("text-anchor","middle").attr("dy","0px");
        G.axis.applyTickStyles(gC,'c',0,s.scaleFs);
        G.axis.addMinorTicks(gA, scaleA, d3.axisBottom, countA, 4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gB, scaleB, d3.axisLeft, countB, -4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gC, scaleC, d3.axisRight, countC, -4, s.scalewidth, 'currentColor');
    };
    G.axis.drawTernaryGridLines = function(svg, s) {
        const DIM = G.config.DIM; const availW = DIM.W - DIM.ML - DIM.MR, availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)), triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2, p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side, p2y = p1y, p3x = p1x + side / 2, p3y = p1y - triH;
        const ot = G.state.overrideTernary || {}; const domains = [ot.a || [0, 100], ot.b || [0, 100], ot.c || [0, 100]];
        const verts = [[p1x, p1y, p2x, p2y, p3x, p3y],[p2x, p2y, p1x, p1y, p3x, p3y],[p3x, p3y, p1x, p1y, p2x, p2y]];
        [d3.scaleLinear().domain(domains[0]).range([0, side]), d3.scaleLinear().domain(domains[1]).range([side, 0]), d3.scaleLinear().domain(domains[2]).range([0, side])].forEach((scale, i) => scale.ticks(s.xticks).forEach(t => {
        if (t <= domains[i][0] || t >= domains[i][1]) return;const tt = (t - domains[i][0]) / (domains[i][1] - domains[i][0]);
        const [x0, y0, x1, y1, x2, y2] = verts[i]; svg.append("line").attr("x1", x0 + (x1 - x0) * tt).attr("y1", y0 + (y1 - y0) * tt)
        .attr("x2", x0 + (x2 - x0) * tt).attr("y2", y0 + (y2 - y0) * tt)
        .attr("stroke", s.gridcolor || "#ccc").attr("stroke-width", s.gridwidth || 1).attr("stroke-dasharray", "2,2");}));
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function getSelectedAxisName() {
        return typeof window.selectedAxisName === "string" ? window.selectedAxisName : "";
    }
    G.axis.tickEditing = function(svg) {
        svg.selectAll("g.tick,path.domain,text.tick-label,line.minor-tick,g.tick line").style("cursor","pointer").on("click",event=>{
        event.stopPropagation(); G.utils.clearActive();
        if (!(document.querySelector('input[name="charttype"]:checked').id === 'bar' && d3.select(event.currentTarget).classed('tick-x'))) {
        ['scalemin','scalemax','tickcount','scaleformat','customticks','useCustomTicks','showMinorTicks'].forEach(id => document.getElementById(id).disabled = false);}
        const tgt=event.currentTarget; const axisGrp=tgt.tagName==="path"?tgt.parentNode:tgt.tagName==="g"?tgt:tgt.closest("g[data-xi],g[data-yi],g[data-ai],g[data-bi],g[data-ci]"); if(!axisGrp) return; 
        const xi=axisGrp.getAttribute("data-xi"), yi=axisGrp.getAttribute("data-yi"), ai=axisGrp.getAttribute("data-ai"), bi=axisGrp.getAttribute("data-bi"), ci=axisGrp.getAttribute("data-ci"); let axisTicks,domain,axisName,key; 
        if(xi!=null){ axisName="X"; key="X"; axisTicks=d3.select(axisGrp).selectAll("text.tick-x"); domain=G.state.lastXScale.domain();}
        else if(yi!=null){ axisName=yi==="0"?"Y":`Y${+yi+1}`; key="Y"+(+yi); axisTicks=d3.select(axisGrp).selectAll("text.tick-y"); domain=(G.state.multiYScales?.[yi]||G.state.lastYScale).domain(); window.activeYi=+yi;}
        else if(ai!=null){ axisName="A"; key="A"; axisTicks=d3.select(axisGrp).selectAll("text.tick-a"); domain=G.state.axisScales.a.domain();}
        else if(bi!=null){ axisName="B"; key="B"; axisTicks=d3.select(axisGrp).selectAll("text.tick-b"); domain=G.state.axisScales.b.domain();}
        else if(ci!=null){ axisName="C"; key="C"; axisTicks=d3.select(axisGrp).selectAll("text.tick-c"); domain=G.state.axisScales.c.domain();}
        else return; window.selectedAxisName=axisName;
        G.ui.openSidebarPanel?.('icon3');
        axisTicks.attr("contenteditable",true).style("outline","1px solid #4A90E2").style("cursor","pointer"); G.state.activeTicks=axisTicks;
        const el=id=>document.getElementById(id); const lbl=el("axis-label"); const minI=el("scalemin"); const maxI=el("scalemax");
        const tc=el("tickcount"); const sf=el("scaleformat"); const chk=el("useCustomTicks"); const ctk=el("customticks");
        lbl.textContent="Axis Settings: "+axisName; minI.value=domain[0].toFixed(2); maxI.value=domain[1].toFixed(2);
        const isABC=["A","B","C"].includes(axisName); const isY=axisName.startsWith("Y");
        const overrides=axisName==="X"?G.state.overrideCustomTicksX:isABC?G.state.overrideCustomTicksTernary?.[axisName.toLowerCase()]:G.state.overrideCustomTicksY?.[window.activeYi]; ctk.value=overrides?.join(",")||"";
        tc.value=(axisName==="X"?G.state.overrideXTicks:isABC?G.state.overrideTernaryTicks?.[axisName.toLowerCase()]:G.state.overrideYTicks?.[window.activeYi])||axisTicks.size(); 
        sf.value = axisName === "X" ? (G.state.overrideScaleformatX ?? 0) : axisName.startsWith("Y") ? (G.state.overrideScaleformatY?.[window.activeYi] ?? 0) : (G.state.overrideScaleformatTernary?.[axisName.toLowerCase()] ?? 0); document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00","Format: K","Format: e"][+sf.value];
        const okA=axisName==="X"||isY||isABC; chk.disabled=!okA; chk.checked=!!(G.state.useCustomTicksOn&&G.state.useCustomTicksOn[key]); sf.disabled = isABC;
        tc.disabled=chk.checked;ctk.disabled=!chk.checked; const smt = document.getElementById('showMinorTicks'); smt.disabled = false; smt.checked = G.state.minorTickOn[key] !== false; });
    };
    function bindScaleInput(id, isMin) {
        document.getElementById(id).addEventListener("input", e => { const me = parseFloat(e.target.value),
        other = parseFloat( document.getElementById(id === "scalemin" ? "scalemax" : "scalemin").value);
        const axisName = getSelectedAxisName();
        if (isNaN(me) || isNaN(other) || !axisName) return; if (axisName === "X") { G.state.overrideX = isMin ? [me, other] : [other, me];}
        else if (axisName.startsWith("Y")) { const yi = window.activeYi || 0; G.state.overrideMultiY = G.state.overrideMultiY || {};
        G.state.overrideMultiY[yi] = isMin ? [me, other] : [other, me];} else if (["A","B","C"].includes(axisName)) { const letter = axisName.toLowerCase(); G.state.overrideTernary = G.state.overrideTernary || {}; G.state.overrideTernary[letter] = isMin ? [me, other] : [other, me];} G.renderChart();});
    } bindScaleInput("scalemin", true); bindScaleInput("scalemax", false);
    document.getElementById('tickcount').addEventListener('input', function(){
        const axisName = getSelectedAxisName();
        if (!axisName) return;
        const n = +this.value; if (axisName === "X") { G.state.overrideXTicks = n;}
        else if (axisName === "Y" || axisName.startsWith("Y")) {
        const yi = window.activeYi; G.state.overrideYTicks = G.state.overrideYTicks||{}; G.state.overrideYTicks[yi] = n;}
        else if (["A","B","C"].includes(axisName)) { G.state.overrideTernaryTicks = G.state.overrideTernaryTicks||{};
        G.state.overrideTernaryTicks[ axisName.toLowerCase() ] = n;} G.renderChart();});
    document.getElementById('scaleformat').addEventListener('input', function() {
        const v = +this.value; document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00","Format: K","Format: e"][v]; 
        const axisName = getSelectedAxisName();
        if (!axisName) return;
        if (axisName === "X") { G.state.overrideScaleformatX = v;}
        else if (axisName.startsWith("Y")) { const yi = window.activeYi || 0;
        G.state.overrideScaleformatY = G.state.overrideScaleformatY || {};
        G.state.overrideScaleformatY[yi] = v;} G.renderChart();});
    document.getElementById('customticks').addEventListener('input', function() {
        const axisName = getSelectedAxisName();
        if (!axisName) return;
        const txt = this.value.trim(); const vals = txt ? txt.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v)) : null;
        if (axisName === "X") { G.state.overrideCustomTicksX = vals;} else if (axisName.startsWith("Y")) 
        { const yi = window.activeYi || 0; G.state.overrideCustomTicksY = G.state.overrideCustomTicksY || {};
        if (vals) G.state.overrideCustomTicksY[yi] = vals; else delete G.state.overrideCustomTicksY[yi];} 
        else { const cls = G.state.activeTicks ? Array.from(G.state.activeTicks.nodes()[0].classList).find(c => c.startsWith('tick-')
        && !['tick-label','tick-x','tick-y'].includes(c) ) : null; if (cls) { const letter = cls.split('-')[1]; 
        G.state.overrideCustomTicksTernary = G.state.overrideCustomTicksTernary || {};
        if (vals) G.state.overrideCustomTicksTernary[letter] = vals; else delete G.state.overrideCustomTicksTernary[letter];}} G.renderChart();});
    document.getElementById('useCustomTicks').addEventListener('change',function(){
        const axisName = getSelectedAxisName();
        if (!axisName) return;
        const use=this.checked,ct=document.getElementById('customticks'),tc=document.getElementById('tickcount'); ct.disabled=!use;tc.disabled=use;
        const key=axisName==='X'?'X':axisName.startsWith('Y')?('Y'+(window.activeYi||0)):axisName;
        G.state.useCustomTicksOn=G.state.useCustomTicksOn||{};G.state.useCustomTicksOn[key]=use;
        const parse=s=>s.trim()?s.split(',').map(v=>+v.trim()).filter(Number.isFinite):[];
        if(use){ const vals=parse(ct.value); if(key==='X'){G.state.overrideCustomTicksX=vals;}
        else if(key.startsWith('Y')){const yi=window.activeYi||0;G.state.overrideCustomTicksY=G.state.overrideCustomTicksY||{};
        G.state.overrideCustomTicksY[yi]=vals;} else{const l=key.toLowerCase(); G.state.overrideCustomTicksTernary=G.state.overrideCustomTicksTernary||{};G.state.overrideCustomTicksTernary[l]=vals;} }else{ if(key==='X'){G.state.overrideCustomTicksX=null;}
        else if(key.startsWith('Y')){const yi=window.activeYi||0;G.state.overrideCustomTicksY&&delete G.state.overrideCustomTicksY[yi];}
        else{const l=key.toLowerCase();G.state.overrideCustomTicksTernary&&delete G.state.overrideCustomTicksTernary[l];}} G.renderChart();});
    document.getElementById('showMinorTicks').addEventListener('change', function(){
        if (!window.selectedAxisName) return; let key = window.selectedAxisName==='X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y'+(window.activeYi||0)) : window.selectedAxisName; G.state.minorTickOn[key] = this.checked; G.renderChart();});
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function drawLegendMarker(g, type, s, d, i, sw) {
        g.selectAll(".legend-marker").remove(); switch (type) { case "scatter": case "ternary": { const shape = G.config.SYMBOL_TYPES[i % G.config.SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
        g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color); break;}
        case "scatterline": case "ternaryline": { g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);
        const shape = G.config.SYMBOL_TYPES[i % G.config.SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
        g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color); break;}
        case "bar": case "histogram": { g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color); break;}
        case "area": case "ternaryarea": { g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color).attr("fill-opacity", s.opacity); break;}
        default: { g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);}}
    }
    G.ui.drawLegend = function() {
        const svg = d3.select('#chart svg'); const data = G.state.hot.getData(), header = data[0], series = G.getSeries(), s = G.getSettings();
        const cols = header.map((v,i) => v === 'Y-axis' && G.state.colEnabled[i] ? i : -1).filter(i => i >= 0);
        const X = G.config.DIM.W - G.config.DIM.MR - 100, Y = G.config.DIM.MT + 25, S = 20, M = 20; const legends = svg.selectAll('g.legend-group').data(cols, d => d);
        legends.exit().remove(); legends.attr('transform', function(d, idx) { return this.dataset.savedTransform || `translate(${X},${Y + idx * S})`;}); const legendsEnter = legends.enter().append('g').classed('legend-group', 1).attr('data-col', d => d).attr('transform', (d, idx) => `translate(${X},${Y + idx * S})`).call(G.utils.applyDrag);
        legendsEnter.each(function (d, idx) { drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);
        const fo = G.utils.editableText(d3.select(this), { x: M + 5, y: -10, text: data[2][d]});
        fo.fo.attr('width', fo.div.node().scrollWidth + fo.pad); const div = fo.div.node();
        div.addEventListener('click', e => { e.stopPropagation(); div.focus(); });
        div.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); div.blur(); } });
        div.addEventListener('blur', function() { G.state.hot.setDataAtCell(2, d, div.textContent.trim(), 'paste'); G.state.hot.render();
        d3.select(div).attr('contenteditable', false).style('outline', 'none').style('cursor', 'move');});});
        legends.select('foreignObject div').text(d => data[2][d]); legends.each(function (d, idx) {
        d3.select(this).selectAll('.legend-marker').remove(); drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);});
    }
    G.ui.drawErrorBars = function(g, series, scales, s) {
        const bw = s.type==="bar" && scales.x.bandwidth ? scales.x.bandwidth() : 0, barW = bw/series.length, cap = s.type==="bar" ? barW*0.2 : s.symbolsize;
        series.forEach((sv,i) => { if (!sv.error) return; sv.rawX.forEach((xVal,j) => { const err = sv.error[j]; if (!isFinite(err)) return;
        const x0 = s.type==="bar" ? scales.x(xVal) + i*barW + barW/2 : scales.x(xVal), yHigh = scales.y(sv.y[j]+err), yLow  = scales.y(sv.y[j]-err);
        g.append("line").attr("x1", x0).attr("x2", x0).attr("y1", yHigh).attr("y2", yLow).attr("stroke", sv.errorColor).attr("stroke-width", s.linewidth);
        [yHigh,yLow].forEach(y => g.append("line").attr("x1", x0-cap).attr("x2", x0+cap).attr("y1", y).attr("y2", y).attr("stroke", sv.errorColor)
        .attr("stroke-width", s.linewidth));});});
    }
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function setTooltipContent(node, xVal, yVal) {
        if (!node) return;
        const xb = document.createElement("b");
        xb.textContent = ` ${xVal}`;
        const yb = document.createElement("b");
        yb.textContent = ` ${yVal}`;
        node.replaceChildren(
            document.createTextNode("X-Scale:"),
            xb,
            document.createElement("br"),
            document.createTextNode("Y-Scale:"),
            yb
        );
    }
    function renderAreaResults(node, rows) {
        if (!node) return;
        if (!rows.length) {
            const empty = document.createElement("em");
            empty.textContent = "No data in selected range.";
            node.replaceChildren(empty);
            return;
        }
        const frag = document.createDocumentFragment();
        rows.forEach(({ label, color, area }) => {
            const line = document.createElement("div");
            line.style.color = color;
            const strong = document.createElement("b");
            strong.textContent = area.toFixed(4);
            line.append(document.createTextNode(`${label}: Area = `), strong);
            frag.appendChild(line);
        });
        node.replaceChildren(frag);
    }
    G.ui.toolTip = function(svg, opts) {
        const tooltipNode = d3.select('#tooltip').node();
        let rafPending = false;
        let lastPointer = null;
        svg.on('mousemove', function(event) {
            lastPointer = d3.pointer(event, svg.node());
            if (rafPending) return;
            rafPending = true;
            requestAnimationFrame(() => {
                rafPending = false;
                if (!lastPointer) return;
                const [mx, my] = lastPointer;
                if (mx < G.config.DIM.ML || mx > G.config.DIM.W - G.config.DIM.MR || my < G.config.DIM.MT || my > G.config.DIM.H - G.config.DIM.MB) return;
                const xVal = opts.xScale.invert(mx).toFixed(4);
                const yVal = opts.yScale.invert(my).toFixed(4);
                setTooltipContent(tooltipNode, xVal, yVal);
            });
        });
    }
    G.ui.areacalculation = function(){
        const svg = d3.select("#chart svg"); if(svg.empty()) return;
        const areaResults = document.getElementById("areaResults");
        const brush = d3.brushX().extent([[G.config.DIM.ML,G.config.DIM.MT],[G.config.DIM.W-G.config.DIM.MR,G.config.DIM.H-G.config.DIM.MB]]).on("end", brushed),
        brushG = svg.append("g").attr("class","area-brush").style("display","none").call(brush);
        d3.select("#enableAreaCalc").on("change", function(){ if(this.checked) brushG.style("display", null);
        else { brushG.style("display","none").call(brush.move, null); svg.selectAll(".area-highlight").remove(); 
        if (areaResults) areaResults.replaceChildren(); }});
        function brushed({selection}){ svg.selectAll(".area-highlight").remove();
        if(!selection){ if (areaResults) areaResults.replaceChildren(); return; } const [x0px,x1px] = selection,
        v0 = G.state.lastXScale.invert(x0px), v1 = G.state.lastXScale.invert(x1px), xMin = Math.min(v0,v1), xMax = Math.max(v0,v1),
        mode = document.querySelector('input[name="axistitles"]:checked').value,
        baseVal = mode==="ftir"?100:(G.state.lastYScale.domain()[0]<=0&&0<=G.state.lastYScale.domain()[1]?0:G.state.lastYScale.domain()[0]),
        y0px = G.state.lastYScale(baseVal); const resultRows = []; G.getSeries().forEach(sv => {
        const pts = sv.x.map((x,i)=>({x,y:sv.y[i]})).filter(p=>p.x>=xMin&&p.x<=xMax); if(pts.length<2) return;
        let area = 0; for(let i=0; i<pts.length-1; i++){ const dx = pts[i+1].x - pts[i].x,
        avg = mode==="ftir" ? baseVal - (pts[i].y + pts[i+1].y)/2 : (pts[i].y + pts[i+1].y)/2; area += dx * avg;}
        svg.append("path").datum(pts).attr("class","area-highlight").attr("d", d3.area().x(d=>G.state.lastXScale(d.x)).y0(()=>y0px)
        .y1(d=>G.state.lastYScale(d.y))).attr("fill", sv.color).attr("fill-opacity", mode==="ftir"?0.1:0.2).lower();
        resultRows.push({ label: sv.label, color: sv.color, area });});
        renderAreaResults(areaResults, resultRows);}
    }
    G.ui.disableAreaCal = function() {const cb = document.getElementById('enableAreaCalc'); if (cb.checked) {cb.checked = false; cb.dispatchEvent(new Event('change'));}};
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.ui.refs.colorCtrl = d3.select("#addedtextcolor");
    G.ui.refs.sizeCtrl = d3.select("#addedtextsize");
    G.ui.refs.addTextBtn = d3.select("#addtext");
    G.ui.refs.rmBtn = d3.select("#removebtn");
    G.ui.refs.fontCtrl = d3.select("#fontfamily");
    G.ui.refs.boldBtn = d3.select("#boldBtn");
    G.ui.refs.italicBtn = d3.select("#italicBtn");
    function updateTickStyle(a,b){
        if(!G.state.activeTicks)return;var c=a=='color'?'fill':a=='fontSize'?'font-size':a=='fontFamily'?'font-family':a=='fontWeight'?'font-weight':a=='fontStyle'?'font-style':a,d=(G.state.activeTicks.attr('class')||'').split(/\s+/).find(e=>e.startsWith('tick-')&&e!=='tick-label');if(!d)return;var t=d.slice(5),i=t=='y'?window.activeYi||0:0;G.state.tickLabelStyles[t]=G.state.tickLabelStyles[t]||{};G.state.tickLabelStyles[t][i]=G.state.tickLabelStyles[t][i]||{};G.state.tickLabelStyles[t][i][a]=b;G.state.activeTicks.style(c,b);
    }
    G.ui.refs.colorCtrl.on('input', function() {
        const v = this.value; const txt = G.state.activeText || G.state.activeDiv; if (txt) txt.style('color', v); if (G.state.activeTicks) {updateTickStyle('color', v);}
        if (G.state.activeGroup) {const sh = G.state.activeGroup.select('.shape'); const tag = sh.node().tagName.toLowerCase();
        if ((tag === 'rect' || tag === 'ellipse') && sh.attr('fill') !== 'none') { sh.attr('fill', v).attr('stroke', v);} 
        else { sh.attr('stroke', v);} G.features.updateArrowMarkerColor(sh, v);}});
    G.ui.refs.sizeCtrl.on('input',e=>{
        const v=e.target.value+'px'; updateTickStyle('fontSize',v); if(G.state.activeText||G.state.activeDiv){
        const txt=G.state.activeText||G.state.activeDiv;txt.style('font-size',v); if(G.state.activeFo)G.state.activeFo.attr('width',txt.node().scrollWidth+5);}
        if(!G.state.activeGroup)return; const s=+e.target.value,b=5+s/2,sh=G.state.activeGroup.select('.shape'),
        ol=G.state.activeGroup.select('.outline'),hit=G.state.activeGroup.select('.hit'); sh.attr('stroke-width',s); 
        hit.attr('stroke-width',sh.node().tagName=='rect'?2*b:s+2*b); if(sh.node().tagName=='rect'){
        const o=G.features.bufferOutline(sh,b);ol.attr('x',o.x).attr('y',o.y).attr('width',o.w).attr('height',o.h);}
        else{const pts=G.features.bufferOutline(sh,b);ol.attr('points',pts.join(' '));}});
    G.ui.refs.fontCtrl.on('change',e=>{
        const v=e.target.value; updateTickStyle('fontFamily',v); const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks;
        if(tgt)tgt.style('font-family',v); if(G.state.activeFo){const fo=G.state.activeFo,div=fo.select('div').node();fo.attr('width',div.scrollWidth+5);}});
    G.ui.refs.boldBtn.on('click',()=>{
        const now=!G.ui.refs.boldBtn.classed('active'); G.ui.refs.boldBtn.classed('active',now); updateTickStyle('fontWeight',now?'bold':'normal');
        const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks; if(tgt)tgt.style('font-weight',now?'bold':'normal');});
    G.ui.refs.italicBtn.on('click',()=>{
        const now=!G.ui.refs.italicBtn.classed('active'); G.ui.refs.italicBtn.classed('active',now); updateTickStyle('fontStyle',now?'italic':'normal');
        const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks; if(tgt)tgt.style('font-style',now?'italic':'normal');});
    function getActiveEditableDiv(){
        if(typeof G.state.activeText!=='undefined'&&G.state.activeText)return G.state.activeText.node?G.state.activeText.node():G.state.activeText;
        if(typeof G.state.activeDiv!=='undefined'&&G.state.activeDiv)return G.state.activeDiv.node?G.state.activeDiv.node():G.state.activeDiv;
        const sel=window.getSelection&&window.getSelection(); if(!sel||sel.rangeCount===0)return null;
        let node=sel.anchorNode instanceof Element?sel.anchorNode:sel.anchorNode&&sel.anchorNode.parentElement;
        if(!node)return null; const editable=node.closest&&node.closest('foreignObject > div[contenteditable]'); return editable||null;
    }
    function resizeFO(ed){
        const fo=ed&&ed.parentNode; if(fo&&fo.tagName&&fo.tagName.toLowerCase()==='foreignobject'){
        fo.setAttribute('width',ed.scrollWidth+5); fo.setAttribute('height',ed.scrollHeight+5);}
    }
    G.ui.applySupSub = function(which){
        const ed=getActiveEditableDiv(); if(!ed)return; ed.focus(); const isSup=document.queryCommandState('superscript');
        const isSub=document.queryCommandState('subscript'); if(which==='sup'){ if(isSup){document.execCommand('superscript',false,null);}
        else{ if(isSub) document.execCommand('subscript',false,null); document.execCommand('superscript',false,null);}
        }else{ if(isSub){document.execCommand('subscript',false,null);} else{ if(isSup) document.execCommand('superscript',false,null); document.execCommand('subscript',false,null);}} resizeFO(ed); setActiveButtons();
    }
    function setActiveButtons(){
        const ed=getActiveEditableDiv(); const supOn=ed?document.queryCommandState('superscript'):false;
        const subOn=ed?document.queryCommandState('subscript'):false; const supBtn=document.getElementById('supBtn');
        const subBtn=document.getElementById('subBtn'); if(supOn){supBtn.classList.add('active'); subBtn.classList.remove('active');}
        else if(subOn){subBtn.classList.add('active'); supBtn.classList.remove('active');}
        else{supBtn.classList.remove('active'); subBtn.classList.remove('active');}
    }
    document.getElementById('supBtn').addEventListener('mousedown',e=>{e.preventDefault();G.ui.applySupSub('sup');});
    document.getElementById('subBtn').addEventListener('mousedown',e=>{e.preventDefault();G.ui.applySupSub('sub');});
    document.addEventListener('selectionchange',setActiveButtons);
    document.addEventListener('mouseup',setActiveButtons);
    document.addEventListener('keyup',setActiveButtons);
    G.ui.refs.rmBtn.on("click", () => { if (G.state.activeGroup) { G.state.activeGroup.style("display", "none"); G.state.activeGroup = null;}
        else if (G.state.activeFo) { const parentG = G.state.activeFo.node().parentNode; if (parentG.classList.contains("legend-group")) { d3.select(parentG).style("display", "none"); } else { d3.select(G.state.activeFo.node()).style("display", "none");}} 
        G.state.activeFo = G.state.activeDiv = null; G.ui.refs.rmBtn.classed("disabled", true);}); 
})(window.GraphPlotter);
(function(G) {
    "use strict";
    let bound = false;
    G.ui.openSidebarPanel = function(panelId) {
        const panel = document.getElementById(panelId);
        if (!panel || panel.name !== 'sidebar') return false;
        panel.checked = true;
        return true;
    };
    G.ui.bindShellEvents = function() {
        if (bound) return;
        bound = true;
        const helpIcon = document.getElementById('help-icon');
        const helpOverlay = document.getElementById('help-prompt-overlay');
        const helpClose = document.getElementById('help-close');
        helpIcon?.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
        helpClose?.addEventListener('click', () => { helpOverlay.style.display = 'none'; });
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modKey = isMac ? 'meta' : 'ctrl';
        const keyBinder = (() => {
            const map = new Map();
            const normalize = combo => combo.toLowerCase().split('+').map(s => s.trim()).sort().join('+');
            addEventListener('keydown', e => {
                const parts = [];
                if (isMac ? e.metaKey : e.ctrlKey) parts.push(modKey);
                parts.push(e.key.toLowerCase());
                const combo = parts.sort().join('+');
                if (map.has(combo)) {
                    e.preventDefault();
                    map.get(combo)(e);
                }
            });
            return (combo, handler) => map.set(normalize(combo), handler);
        })();
        keyBinder(`${modKey}+s`, () => document.getElementById('save')?.click());
        keyBinder(`${modKey}+d`, () => document.getElementById('download')?.click());
        keyBinder(`${modKey}+z`, () => document.getElementById('zoomBtn')?.click());
        keyBinder(`${modKey}+backspace`, () => document.getElementById('removebtn')?.click());
        keyBinder('delete', () => document.getElementById('removebtn')?.click());
        keyBinder('escape', () => {
            G.utils.clearActive();
            const popup = document.getElementById('popup-prompt-overlay');
            const help = document.getElementById('help-prompt-overlay');
            if (popup) popup.style.display = 'none';
            if (help) help.style.display = 'none';
            G.ui.disableAreaCal();
        });
        keyBinder(`${modKey}+f`, () => {
            const c = document.querySelector('.container');
            if (!c) return;
            if (!document.fullscreenElement) c.requestFullscreen().then(() => { c.style.background = '#f4eee2'; });
            else document.exitFullscreen().then(() => { c.style.background = ''; });
        });
        keyBinder(`${modKey}+i`, () => document.getElementById('enableAreaCalc')?.click());
        keyBinder(`${modKey}+.`, () => G.ui.applySupSub('sup'));
        keyBinder(`${modKey}+,`, () => G.ui.applySupSub('sub'));
        const gLink = 'https://instanano.com/online-graph-plotter/';
        const mWP = document.getElementById('mWP');
        const mEM = document.getElementById('mEM');
        const mCP = document.getElementById('mCP');
        if (mWP) mWP.href = 'https://wa.me/919467826266?text=' + encodeURIComponent('Link to open InstaNANO Graph Plotter on your laptop:\n' + gLink);
        if (mEM) mEM.href = 'mailto:?subject=' + encodeURIComponent('InstaNANO Graph Plotter Link') + '&body=' + encodeURIComponent("Link to open InstaNANO Graph Plotter on your laptop:\n\n" + gLink);
        if (mCP) mCP.onclick = e => (e.preventDefault(), navigator.clipboard.writeText(gLink).then(() => { mCP.textContent = 'Copied'; }));
        if (matchMedia('(max-width:600px)').matches) {
            document.querySelectorAll('input[name=sidebar]').forEach(i => { i.checked = false; });
            document.querySelector('.icon-strip')?.addEventListener('click', e => {
                const label = e.target.closest('label');
                const i = document.getElementById(label?.htmlFor);
                if (i?.checked) {
                    e.preventDefault();
                    i.checked = false;
                }
            });
        }
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    const isFillRect=sh=>sh.node().tagName==="rect"&&sh.attr("fill")!=="none";
    G.features.activateShape = function(g){if(G.state.activeGroup===g)return;
        g.select(".outline").attr("visibility","visible"); G.state.activeGroup=g; const sh=g.select(".shape"); G.utils.updateInspector(g.select(".shape"));
    }
    G.features.activateText = function(div, fo) {
        if (G.state.activeText === div) return; div.attr("contenteditable", true).style("border", "1px solid rgb(74,144,226)").node().focus();
        G.state.activeText = div; G.state.activeFo = fo; G.utils.updateInspector(div); const el = div.node(); setTimeout(() => { const range = document.createRange();
        range.selectNodeContents(el); const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);}, 0);
    }
    function makeShapeInteractive(g){
        g.select(".hit").style("cursor","move").on("click",e=>{G.state.hot.deselectCell();e.stopPropagation();
        G.features.activateShape(d3.select(g.node()));}); g.call(G.utils.applyDrag);
    }
    function createArrowMarker(svg,color){
        let id=`arrowhead-${++G.state.arrowCount}`,defs=svg.select("defs");if(defs.empty())defs=svg.append("defs");
        let marker=defs.append("marker").attr("id",id).attr("viewBox","0 -5 10 10").attr("refX",1)
            .attr("refY",0).attr("markerWidth",6).attr("markerHeight",6).attr("orient","auto");
        marker.append("path").attr("d","M0,-5L10,0L0,5").attr("fill",color);return id;
    }
    G.features.updateArrowMarkerColor = function(sh,color){
        let markerUrl=sh.attr("marker-end");if(markerUrl&&markerUrl.startsWith("url(#arrowhead-")){
            let id=markerUrl.slice(5,-1);d3.select(`#${id} path`).attr("fill",color);}
    }
    G.features.bufferOutline = function(sh,b){
        const tag=sh.node().tagName;
        if(tag==="rect"){
            const x=+sh.attr("x")-b,y=+sh.attr("y")-b,w=+sh.attr("width")+2*b,h=+sh.attr("height")+2*b; return {x,y,w,h};}
        else if(tag==="ellipse"){ const cx=+sh.attr("cx"),cy=+sh.attr("cy"),rx=+sh.attr("rx"),ry=+sh.attr("ry");
            return {cx,cy,rx:rx+b,ry:ry+b};}
        else{ const x1=+sh.attr("x1"),y1=+sh.attr("y1"),x2=+sh.attr("x2"),y2=+sh.attr("y2"),
                dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy),px=-dy/L,py=dx/L;
            return [[x1+px*b,y1+py*b],[x2+px*b,y2+py*b],[x2-px*b,y2-py*b],[x1-px*b,y1-py*b]];}
    }
    G.features.prepareShapeLayer = function(){
        const svg=d3.select("#chart svg");
        svg.on("click.shapeBackground",e=>{ if(e.target===svg.node()) G.utils.clearActive();});
        svg.on("mousedown.draw",function(e){
            if(G.state.shapeMode==="none")return;
            e.preventDefault();G.state.drawing=true;
            const [mx,my]=d3.pointer(e,svg.node()),
                col=(G.state.shapeMode==="fillRect"||G.state.shapeMode==="fillEllipse")?"#96d35f":"#000000",
                fs=1,mode=G.state.shapeMode,
                isRect=/rect/i.test(mode),isLine=/line|arrow/i.test(mode),
                isArrow=/arrow/i.test(mode),isDashed=/dashed/i.test(mode),
                isFill=mode==="fillRect"||mode==="fillEllipse",
                isEllipse=/ellipse/i.test(mode);
            if(isLine){
            G.state.tempShape=svg.append("line").attr("x1",mx).attr("y1",my).attr("x2",mx).attr("y2",my)
                .attr("stroke",col).attr("stroke-width",fs).attr("fill","none");
            if(isArrow)G.state.tempShape.attr("marker-end",`url(#${createArrowMarker(svg,col)})`);
            if(isDashed)G.state.tempShape.attr("stroke-dasharray","7,5");
            }else if(isRect){
            G.state.tempShape=svg.append("rect").attr("x",mx).attr("y",my).attr("width",0).attr("height",0);
            if(isFill)G.state.tempShape.attr("stroke",col).attr("stroke-width",0.5).attr("fill",col).attr("fill-opacity",0.2);
            else G.state.tempShape.attr("stroke",col).attr("stroke-width",fs).attr("fill","none"),isDashed&&G.state.tempShape.attr("stroke-dasharray","7,5");
            }else if(isEllipse){
            G.state.tempShape=svg.append("ellipse").attr("cx",mx).attr("cy",my).attr("rx",0).attr("ry",0);
            if(isFill)G.state.tempShape.attr("stroke",col).attr("stroke-width",0.5).attr("fill",col).attr("fill-opacity",0.2);
            else G.state.tempShape.attr("stroke",col).attr("stroke-width",fs).attr("fill","none"),isDashed&&G.state.tempShape.attr("stroke-dasharray","7,5");}
            G.state.drawStart={x:mx,y:my};});
        svg.on("mousemove.draw",function(e){
            if(!G.state.drawing||!G.state.tempShape)return;
            const [mx,my]=d3.pointer(e,svg.node()),tag=G.state.tempShape.node().tagName;
            if(tag==="rect"){
            const x0=G.state.drawStart.x,y0=G.state.drawStart.y,w=mx-x0,h=my-y0;
            G.state.tempShape.attr("x",w<0?mx:x0).attr("y",h<0?my:y0).attr("width",Math.abs(w)).attr("height",Math.abs(h));
            }else if(tag==="ellipse"){
            const dx=mx-G.state.drawStart.x,dy=my-G.state.drawStart.y,
                    rx = Math.abs(dx) / 2,ry = Math.abs(dy) / 2,
                    cx = G.state.drawStart.x + (dx < 0 ? -rx : rx),cy = G.state.drawStart.y + (dy < 0 ? -ry : ry);
            G.state.tempShape.attr("cx",cx).attr("cy",cy).attr("rx",rx).attr("ry",ry);
            }else G.state.tempShape.attr("x2",mx).attr("y2",my);});
        svg.on("mouseup.draw mouseleave.draw",function(){
            if(!G.state.drawing||!G.state.tempShape)return;G.state.drawing=false;
            const tag=G.state.tempShape.node().tagName,strokeCol=G.state.tempShape.attr("stroke"),
                baseStroke=+G.state.tempShape.attr("stroke-width")||1,
                bbox=G.state.tempShape.node().getBBox(),
                tooSmall=(bbox.width<5&&bbox.height<5)||(tag==="line"&&Math.hypot(bbox.width,bbox.height)<5);
            if(tooSmall){G.state.tempShape.remove();G.state.tempShape=null;}
            else{ G.state.tempShape.remove();const g=svg.append("g").classed("shape-group", true),buffer=5;
            if(tag==="line"){
                const a={x1:+G.state.tempShape.attr("x1"),y1:+G.state.tempShape.attr("y1"),x2:+G.state.tempShape.attr("x2"),y2:+G.state.tempShape.attr("y2")};
                g.append("line").classed("hit",1).attr("x1",a.x1).attr("y1",a.y1).attr("x2",a.x2).attr("y2",a.y2)
                .attr("stroke","transparent").attr("stroke-width",baseStroke+2*buffer).attr("fill","none");
                let shapeLine=g.append("line").classed("shape",1).attr("x1",a.x1).attr("y1",a.y1).attr("x2",a.x2).attr("y2",a.y2)
                .attr("stroke",strokeCol).attr("stroke-width",baseStroke).attr("fill","none").attr("pointer-events","none");
                if(G.state.tempShape.attr("marker-end"))shapeLine.attr("marker-end",G.state.tempShape.attr("marker-end"));
                if(G.state.tempShape.attr("stroke-dasharray"))shapeLine.attr("stroke-dasharray",G.state.tempShape.attr("stroke-dasharray"));
                const pts=G.features.bufferOutline(shapeLine,buffer+baseStroke/2);
                g.append("polygon").classed("outline",1).attr("points",pts.join(" ")).attr("stroke","rgb(74,144,226)")
                .attr("stroke-width",1).attr("fill","none").attr("pointer-events","none").attr("visibility","hidden");
            }else if(tag==="rect"){
                const a={x:+G.state.tempShape.attr("x"),y:+G.state.tempShape.attr("y"),width:+G.state.tempShape.attr("width"),height:+G.state.tempShape.attr("height")};
                g.append("rect").classed("hit",1).attr("x",a.x).attr("y",a.y).attr("width",a.width).attr("height",a.height)
                .attr("stroke","transparent").attr("stroke-width",G.state.shapeMode==="fillRect"?2*buffer:baseStroke+2*buffer).attr("fill","none");
                let shapeRect;
                if(G.state.shapeMode==="fillRect")shapeRect=g.append("rect").classed("shape",1).attr("x",a.x).attr("y",a.y)
                .attr("width",a.width).attr("height",a.height).attr("stroke",strokeCol).attr("stroke-width",0.5)
                .attr("fill",strokeCol).attr("fill-opacity",0.2);
                else shapeRect=g.append("rect").classed("shape",1).attr("x",a.x).attr("y",a.y)
                .attr("width",a.width).attr("height",a.height).attr("stroke",strokeCol).attr("stroke-width",baseStroke)
                .attr("fill","none"),G.state.tempShape.attr("stroke-dasharray")&&shapeRect.attr("stroke-dasharray",G.state.tempShape.attr("stroke-dasharray"));
                const o=G.features.bufferOutline(shapeRect,buffer);
                g.append("rect").classed("outline",1).attr("x",o.x).attr("y",o.y).attr("width",o.w).attr("height",o.h)
                .attr("stroke","rgb(74,144,226)").attr("stroke-width",1).attr("fill","none")
                .attr("pointer-events","none").attr("visibility","hidden");
            }else if(tag==="ellipse"){
                const cx=+G.state.tempShape.attr("cx"),cy=+G.state.tempShape.attr("cy"),rx=+G.state.tempShape.attr("rx"),ry=+G.state.tempShape.attr("ry");
                g.append("ellipse").classed("hit",1).attr("cx",cx).attr("cy",cy).attr("rx",rx).attr("ry",ry)
                .attr("stroke","transparent").attr("stroke-width",G.state.shapeMode==="fillEllipse"?2*buffer:baseStroke+2*buffer).attr("fill","none");
                let shapeEllipse;
                if(G.state.shapeMode==="fillEllipse")shapeEllipse=g.append("ellipse").classed("shape",1)
                .attr("cx",cx).attr("cy",cy).attr("rx",rx).attr("ry",ry).attr("stroke",strokeCol).attr("stroke-width",0.5)
                .attr("fill",strokeCol).attr("fill-opacity",0.2);
                else shapeEllipse=g.append("ellipse").classed("shape",1)
                .attr("cx",cx).attr("cy",cy).attr("rx",rx).attr("ry",ry).attr("stroke",strokeCol).attr("stroke-width",baseStroke)
                .attr("fill","none"),G.state.tempShape.attr("stroke-dasharray")&&shapeEllipse.attr("stroke-dasharray",G.state.tempShape.attr("stroke-dasharray"));
                g.append("ellipse").classed("outline",1).attr("cx",cx).attr("cy",cy)
                .attr("rx",rx+buffer).attr("ry",ry+buffer).attr("stroke","rgb(74,144,226)")
                .attr("stroke-width",1).attr("fill","none").attr("pointer-events","none").attr("visibility","hidden");
            } makeShapeInteractive(g); setTimeout(() => G.features.activateShape(g), 0); G.state.tempShape=null;
            } d3.selectAll('input[name="shape"]').property('checked', false);G.state.shapeMode = "none"; });
    }
    G.ui.refs.addTextBtn.on("click",function(){ G.ui.disableAreaCal();
        const svg=d3.select("#chart svg");if(svg.empty())return;
        const {fo,div} = G.utils.editableText(svg,{x:G.config.DIM.W/2-G.config.DIM.MT,y:G.config.DIM.H/2-G.config.DIM.MR,text:"Text",rotation:0});
        fo.classed("user-text",1).call(G.utils.applyDrag); G.utils.clearActive(); G.features.activateText(div, fo);});
    d3.selectAll('input[name="shape"]').on("change", function(){ G.ui.disableAreaCal(); G.state.shapeMode = this.value; G.utils.clearActive();});
    G.features.makeShapeInteractive = makeShapeInteractive; 
})(window.GraphPlotter);
(function(G) {
    "use strict";
    $('#zoomBtn').click(function(){
        const btn=$(this);
        if(btn.hasClass('active')){d3.select(".zoom-brush").remove();btn.removeClass('active');return}
        btn.addClass('active');
        const ac=document.getElementById('enableAreaCalc');
        if(ac.checked){ac.checked=false;ac.dispatchEvent(new Event('change'))}
        const svg=d3.select("#chart svg");
        if(svg.empty())return;
        svg.append("g").attr("class","zoom-brush").style("cursor","crosshair")
        .call(d3.brush().extent([[G.config.DIM.ML,G.config.DIM.MT],[G.config.DIM.W-G.config.DIM.MR,G.config.DIM.H-G.config.DIM.MB]])
        .on("end",({selection})=>{
            svg.select(".zoom-brush").remove();
            btn.removeClass('active');
            if(!selection)return;
            const [[x0,y0],[x1,y1]]=selection;
            const v0=G.state.lastXScale.invert(x0);
            const v1=G.state.lastXScale.invert(x1);
            const domain=G.state.lastXScale.domain();
            const isReversed=domain[0]>domain[1];
            const x=isReversed ? [Math.max(v0,v1), Math.min(v0,v1)] : [Math.min(v0,v1), Math.max(v0,v1)];  
            const y=[G.state.lastYScale.invert(y0),G.state.lastYScale.invert(y1)].sort((a,b)=>a-b);
            G.state.overrideX=x;
            G.state.overrideMultiY=G.state.overrideMultiY||{};
            G.state.overrideMultiY[0]=y;
            document.getElementById('scalemin').value=x[0].toFixed(2);
            document.getElementById('scalemax').value=x[1].toFixed(2);
            G.renderChart();}));});
    d3.select("#chart").on("contextmenu",(e)=>{e.preventDefault();G.axis.resetScales(true);G.renderChart();G.matchXRD?.render()});
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function movingAverage(a,w){
        const h=Math.floor(w/2),m=[];
        for(let i=0;i<a.length;i++){
          let s=0,c=0;
          for(let j=i-h;j<=i+h;j++){
            if(j>=0&&j<a.length&&isFinite(a[j])){ s+=a[j]; c++; }}
          m[i]=c?s/c:NaN;}
        return m;}
    function rollingBaseline(a, w) {
      const h = Math.floor(w / 2), e = [], b = [];
      for (let i = 0; i < a.length; i++) {
        let m = Infinity;
        for (let j = i - h; j <= i + h; j++) {
          if (j >= 0 && j < a.length && isFinite(a[j])) {
            m = Math.min(m, a[j]);}}
        e[i] = m === Infinity ? NaN : m;}
      for (let i = 0; i < e.length; i++) {
        let M = -Infinity;
        for (let j = i - h; j <= i + h; j++) {
          if (j >= 0 && j < e.length && isFinite(e[j])) {
            M = Math.max(M, e[j]);}}
        b[i] = M === -Infinity ? NaN : M;}
      return b;} 
    function process(suffix, fn, w){
        const tbl = G.state.hot.getData(), hdr = tbl[0], rows = tbl.slice(3), baseNames = tbl[2].slice();
        hdr.forEach((h,i)=>{
          if(h==="Y-axis" && G.state.colEnabled[i]){
            if (suffix === "corrected" && baseNames[i].includes("(baseline)")) { return;}
            const raw = rows.map(r=>parseFloat(r[i])||NaN), out = fn(raw, w), newIdx = tbl[1].length;
            hdr.push("Y-axis");                         
            tbl[1].push(G.config.COLORS[newIdx % G.config.COLORS.length]);   
            tbl[2].push(`${baseNames[i]} (${suffix})`);   
            rows.forEach((r,j)=> r.push(out[j]));  }});
        G.state.hot.loadData(tbl);
        G.axis.resetScales(true);
        G.renderChart();}
    function previewSeries(fn, w, cssClass) {
        const svg = d3.select("#chart svg"); svg.selectAll(`g.${cssClass}`).remove(); if (w <= 0) return;
        const opts = G.getSettings(); const isFTIR = opts.mode === "ftir" && cssClass === "baseline-preview";
        const data = G.getSeries().map(sv => { let yVals; if (isFTIR) { const inv = sv.y.map(v => -v);
        const baseInv = rollingBaseline(inv, w); const rawEnv = baseInv.map(b => -b); yVals = rawEnv;} 
        else { yVals = fn(sv.y, w);} return { rawX: sv.rawX, x: sv.x, y: yVals, color: sv.color};});
        const chartDef = G.ChartRegistry.get(opts.type); const g  = svg.append("g").classed(cssClass, true)
        .attr("clip-path", "url(#clip)"); chartDef.draw(g, data, { x: G.state.lastXScale, y: G.state.lastYScale }, opts);
        g.selectAll("path").attr("stroke", "gray").attr("stroke-width", opts.linewidth);
    }
    document.getElementById("applysmoothing").onclick = () => {
        const w = +document.getElementById("smoothingslider").value; if (w > 0) {
        process("smoothed", movingAverage, w); document.getElementById("smoothingslider").value = 0;}};
    document.getElementById("applybaseline").onclick = () => {
        const w = +document.getElementById("baselineslider").value; if (w <= 0) return; const s = G.getSettings();
        if (s.mode === "ftir") { process("baseline", (signal, win) => { const inv = signal.map(v => -v);
        const bInv = rollingBaseline(inv, win); const rawEnv = bInv.map(b => -b); return rawEnv;}, w);
        process("corrected", (signal, win) => { const inv = signal.map(v => -v); const bInv = rollingBaseline(inv, win);
        const rawEnv = bInv.map(b => -b); 
        return signal.map((v, i) => isFinite(v) && isFinite(rawEnv[i]) ? (v / rawEnv[i]) * 100 : NaN);}, w);} 
        else { process("baseline", rollingBaseline, w); process("corrected", (signal, win) => {
        const env = rollingBaseline(signal, win);
        return signal.map((v, i) => isFinite(v) && isFinite(env[i]) ? v - env[i] : NaN);}, w);}
        document.getElementById("baselineslider").value = 0;};
    ['smoothing','baseline'].forEach(type=> document.getElementById(type+'slider').addEventListener('input',e=>{
        if(type==='smoothing') G.renderChart(); previewSeries(type==='smoothing'?movingAverage:rollingBaseline, +e.target.value, `${type}-preview`);}));
})(window.GraphPlotter);
(function(G) {
    "use strict";
    function linearFit(xs,ys){const X=[],Y=[];for(let i=0;i<xs.length;i++){const x=+xs[i],y=+ys[i];if(Number.isFinite(x)&&Number.isFinite(y)){X.push(x);Y.push(y)}}const n=X.length;if(n<2)return null;let sx=0,sy=0,sxx=0,sxy=0,syy=0;for(let i=0;i<n;i++){const x=X[i],y=Y[i];sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;syy+=y*y}const den=n*sxx-sx*sx;if(den===0)return null;const m=(n*sxy-sx*sy)/den,b=(sy-m*sx)/n,yb=sy/n;let st=0,sr=0;for(let i=0;i<n;i++){const yt=Y[i],yf=m*X[i]+b;st+=(yt-yb)*(yt-yb);sr+=(yt-yf)*(yt-yf)}const r2=st>0?1-sr/st:1;return{m,b,r2}}
    function solve3(a,b){let A=a.map(r=>r.slice()),B=b.slice();for(let i=0;i<3;i++){let p=i;for(let r=i+1;r<3;r++)if(Math.abs(A[r][i])>Math.abs(A[p][i]))p=r;[A[i],A[p]]=[A[p],A[i]];[B[i],B[p]]=[B[p],B[i]];const pv=A[i][i];if(pv===0)return null;for(let j=i;j<3;j++)A[i][j]/=pv;B[i]/=pv;for(let r=0;r<3;r++)if(r!==i){const f=A[r][i];for(let j=i;j<3;j++)A[r][j]-=f*A[i][j];B[r]-=f*B[i]}}return B}
    function quadraticFit(xs,ys){let s0=0,s1=0,s2=0,s3=0,s4=0,t0=0,t1=0,t2=0,c=0;for(let i=0;i<xs.length;i++){const x=+xs[i],y=+ys[i];if(Number.isFinite(x)&&Number.isFinite(y)){const x2=x*x,x3=x2*x,x4=x3*x;s0+=1;s1+=x;s2+=x2;s3+=x3;s4+=x4;t0+=y;t1+=x*y;t2+=x2*y;c++}}if(c<3)return null;const sol=solve3([[s4,s3,s2],[s3,s2,s1],[s2,s1,s0]],[t2,t1,t0]);if(!sol)return null;const [a,b,c0]=sol;let yb=t0/s0,st=0,sr=0;for(let i=0;i<xs.length;i++){const x=+xs[i],y=+ys[i];if(Number.isFinite(x)&&Number.isFinite(y)){const yf=a*x*x+b*x+c0;st+=(y-yb)*(y-yb);sr+=(y-yf)*(y-yf)}}const r2=st>0?1-sr/st:1;return{a,b,c:c0,r2}}
    function predictLinear(m,b,x){return m*x+b}
    function predictQuadratic(a,b,c,x){return a*x*x+b*x+c}
    document.getElementById('applyfit').onclick = function() { const btn = d3.select(this);
        if (btn.classed('active')) { d3.select(".fit-brush").remove();
        btn.classed('active', false).style("background", null); return;}
        const tbl = G.state.hot.getData(), hd = tbl[0], cl = tbl[1], nm = tbl[2], rw = tbl.slice(3); const enY = [];
        for (let c = 0; c < hd.length; c++) if (hd[c] === 'Y-axis' && G.state.colEnabled[c]) enY.push(c);
        if (!enY.length) { alert('No enabled Y series.'); return; }
        const xcs = hd.map((h, i) => h === 'X-axis' && G.state.colEnabled[i] ? i : -1).filter(i => i >= 0);
        if (!xcs.length) { alert('Missing X-axis.'); return; }
        btn.classed('active', true).style("background", "#c6c6c6");
        const svg = d3.select("#chart svg"); if (svg.empty()) return;
        svg.append("g").attr("class", "fit-brush").style("cursor", "crosshair")
        .call(d3.brushX().extent([[G.config.DIM.ML, G.config.DIM.MT], [G.config.DIM.W - G.config.DIM.MR, G.config.DIM.H - G.config.DIM.MB]])
        .on("end", ({ selection }) => { svg.select(".fit-brush").remove();
        btn.classed('active', false).style("background", null); if (!selection) return;
        const [x0, x1] = selection.map(G.state.lastXScale.invert);
        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
        const wh = (document.querySelector('input[name="fit"]:checked') || { value: 'linear' }).value;
        const infos = []; for (const yi of enY) { let xi = -1;
        for (let k = 0; k < xcs.length; k++) { const xk = xcs[k], nx = xcs[k + 1] ?? hd.length;
        if (yi > xk && yi < nx) { xi = xk; break; }} if (xi < 0) continue; const lbl = nm[yi];
        const subX = [], subY = []; rw.forEach(r => { const vX = parseFloat(r[xi]), vY = parseFloat(r[yi]);
        if (Number.isFinite(vX) && Number.isFinite(vY) && vX >= minX && vX <= maxX) {
        subX.push(vX); subY.push(vY);}}); if (subX.length < 2) continue; if (wh === 'linear') {
        const f = linearFit(subX, subY); if (!f) continue; const yh = rw.map(r => { const vX = parseFloat(r[xi]);
        return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? predictLinear(f.m, f.b, vX) : '';});
        hd.push('Y-axis'); cl.push(G.config.COLORS[cl.length % G.config.COLORS.length]); nm.push(lbl + ' (fit)'); rw.forEach((r, i) => r.push(yh[i]));
        infos.push(`${lbl}: m=${f.m.toFixed(6)}, b=${f.b.toFixed(6)}, R²=${f.r2.toFixed(5)}`);} 
        else { if (subX.length < 3) continue; const f = quadraticFit(subX, subY);
        if (!f) continue; const yh = rw.map(r => { const vX = parseFloat(r[xi]);
        return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? predictQuadratic(f.a, f.b, f.c, vX) : '';});
        hd.push('Y-axis'); cl.push(G.config.COLORS[cl.length % G.config.COLORS.length]); nm.push(lbl + ' (fit)');
        rw.forEach((r, i) => r.push(yh[i]));
        infos.push(`${lbl}: a=${f.a.toExponential(3)}, b=${f.b.toExponential(3)}, c=${f.c.toExponential(3)}, R²=${f.r2.toFixed(5)}`);}}
        G.state.hot.loadData([hd, cl, nm, ...rw]); for (let c = 0; c < hd.length; c++) if (G.state.colEnabled[c] === undefined) G.state.colEnabled[c] = true;
        G.state.hot.render(); G.axis.resetScales(false); G.renderChart();
        const bx = G.config.DIM.ML + 6, by = G.config.DIM.MT + 12; const newSvg = d3.select('#chart svg');
        const st = newSvg.selectAll('foreignObject.user-text').size(); infos.forEach((tx, i) => {
        const obj = G.utils.editableText(newSvg, { x: bx, y: by + (st + i) * 16, text: tx, rotation: 0 });
        obj.div.text(tx); obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('height', obj.div.node().scrollHeight + obj.pad);
        obj.fo.classed('user-text', true).call(G.utils.applyDrag);});}));};
})(window.GraphPlotter);
(function(G) {
    "use strict";
    document.getElementById('generateTauc').addEventListener('click', () => {
        const exp = parseFloat(document.querySelector('input[name="tauc"]:checked').value); const raw = G.state.hot.getData().map(r => r.slice());
        const header = raw[0], colors = raw[1], names = raw[2]; const origLen = header.length; const xIdx = header.indexOf('X-axis');
        const yIdx = header.indexOf('Y-axis', xIdx + 1); if (xIdx < 0 || yIdx < 0) return alert('Missing X-axis or Y-axis');
        raw.forEach(r => r.splice(origLen)); header.splice(origLen); colors.splice(origLen); names.splice(origLen); const hv = [];
        for (let i = 3; i < raw.length; i++) hv[i] = 1240 / parseFloat(raw[i][xIdx]); header.push('X-axis'); colors.push(colors[xIdx]);
        names.push(names[xIdx]); header.push('Y-axis'); colors.push(colors[yIdx]); names.push(names[yIdx] + ` (Tauc n=${exp})`);
        for (let i = 3; i < raw.length; i++) {
        raw[i].push( hv[i], Math.pow(2.303 * hv[i] * parseFloat(raw[i][yIdx]), exp));} G.state.hot.loadData(raw);
        G.state.colEnabled = {}; const total = header.length; for (let c = 0; c < total; c++) G.state.colEnabled[c] = c >= origLen;
        document.getElementById('axis-tauc').checked = true; G.state.hot.render(); G.axis.resetScales(true); G.renderChart();}); 
})(window.GraphPlotter);
(function(G) {
    "use strict";
    const GRAPH_UPSELL = {
        xrd: {paid: "product/xrd-data-matching-online/", msg: ["Plotting XRD data? Get expert phase matching against verified reference databases.", "XRD peaks plotted! Need accurate compound identification for your materials?", "Beautiful XRD graph! Reviewers often ask for proper phase matching with reference cards.", "Need more than a plot? Get professional phase identification and peak assignment.", "XRD data ready! Our experts can match your peaks to thousands of known compounds."]},
        ftir: {paid: "product/ftir-data-matching-online/", msg: ["FTIR spectrum looks great! Need automated compound identification?", "Plotting FTIR? Get your peaks matched against 10,000+ reference materials.", "Beautiful transmittance plot! Want to identify functional groups automatically?", "FTIR graph ready! Our experts can match your peaks to known compounds.", "Nice FTIR spectrum! Reviewers love seeing compound matches with similarity scores."]},
        xps: {paid: "product/xps-analysis-online/", msg: ["Plotting XPS data? Get professional peak deconvolution and fitting.", "XPS spectrum ready! Need atomic percentages and oxidation state analysis?", "Great binding energy plot! Our experts can deconvolute overlapping peaks.", "XPS graph looks good! Want publication-ready peak assignments?", "Need more than a plot? Get full XPS analysis with chemical state identification."]},
        raman: {paid: "product/raman-crystallite-size-calculator/", msg: ["Raman spectrum plotted! Need ID/IG ratio and crystallite size analysis?", "Working with carbon materials? Get expert D and G band deconvolution.", "Nice Raman plot! Reviewers often ask for proper peak fitting.", "Raman data ready! Our experts can calculate defect density and crystallite size.", "Beautiful Raman spectrum! Want Tuinstra-Koenig analysis for your publication?"]},
        uvvis: {paid: "product/band-gap-calculation-from-tauc-plot/", msg: ["UV-Vis spectrum ready! Need accurate band gap from Tauc plot?", "Plotting absorbance data? Get publication-ready Tauc plot analysis.", "Nice UV-Vis spectrum! Reviewers expect proper band gap determination.", "UV-Vis data plotted! Our experts can calculate direct/indirect band gaps.", "Absorbance graph looks good! Want professional Tauc plot fitting?"]},
        tauc: {paid: "product/band-gap-calculation-from-tauc-plot/", msg: ["Generating Tauc plot? Let our experts ensure accurate band gap values.", "Tauc analysis started! Get professionally fitted linear region extraction.", "Band gap calculation in progress! Reviewers appreciate expert Tauc analysis.", "Need reviewer-ready band gap values? Our experts ensure proper fitting.", "Tauc plot ready! Get verified band gap calculation for your publication."]},
        nmr: {paid: "product/nmr-data-analysis/", msg: ["Plotting NMR spectrum? Get full structural elucidation from your data.", "NMR data loaded! Need peak assignments and purity assessment?", "Nice NMR plot! Our experts can provide complete spectral interpretation.", "Chemical shifts visible! Want professional structure confirmation?", "NMR spectrum ready! Get publication-quality peak assignments."]},
        pl: {paid: "product/custom-analysis/", msg: ["Plotting PL data? Need quantum yield or peak fitting analysis?", "Photoluminescence spectrum ready! Get expert emission peak analysis.", "Nice PL plot! Our analysis team can extract valuable optical properties.", "PL data loaded! Want professional peak deconvolution?", "Beautiful emission spectrum! Get expert analysis for your publication."]},
        dsc: {paid: "product/dsc-percent-crystallinity-calculation-by-our-expert-team/", msg: ["DSC thermogram plotted! Need accurate crystallinity calculation?", "Plotting DSC data? Get professional enthalpy of fusion analysis.", "DSC curve ready! Our experts can calculate percent crystallinity.", "Nice thermal data! Reviewers expect proper baseline integration.", "DSC plot looks good! Get publication-ready crystallinity values."]},
        tga: {paid: "product/custom-analysis/", msg: ["Plotting TGA data? Need thermal stability analysis?", "TGA curve ready! Our experts can analyze decomposition profiles.", "Nice weight loss curve! Get detailed thermal analysis.", "TGA data loaded! Want professional derivative thermogravimetric analysis?", "Thermal data plotted! Get expert interpretation for your manuscript."]},
        bet: {paid: "product/bet-analsysis-online/", msg: ["Plotting BET isotherm? Get surface area and pore analysis.", "BET data loaded! Our experts calculate surface area and pore distribution.", "Nice adsorption plot! Want complete BET analysis with pore shape?", "BET curve ready! Get publication-ready surface area values.", "Isotherm plotted! Need BJH pore size distribution analysis."]},
        saxs: {paid: "product/custom-analysis/", msg: ["Plotting SAXS data? Need particle size distribution analysis?", "SAXS pattern ready! Our experts can extract structural parameters.", "Nice scattering plot! Want professional data fitting?"]},
        tensile: {paid: "product/custom-analysis/", msg: ["Plotting stress-strain curve? Need mechanical property calculations?", "Tensile data ready! Our experts can analyze modulus and yield strength."]},
        default: {paid: "product/scientific-graph-plotting/", msg: ["Great graph! Need publication-quality formatting for journals?", "Nice plot! Our experts create journal-ready 2D/3D scientific figures.", "Data plotted! Want professionally formatted graphs for your paper?", "Graph looks good! We also offer complete data analysis services.", "Beautiful visualization! Need more analysis? Check our expert services."]}
    };
    const GRAPH_UPSELL_STORAGE = "instanano_graph_upsell";
    function storeGraphUpsell() {
        const axisRadio = document.querySelector('input[name="axistitles"]:checked');
        const axisType = axisRadio ? axisRadio.value : "default"; 
        const upsellData = GRAPH_UPSELL[axisType] || GRAPH_UPSELL.default;
        const randomMsg = upsellData.msg[Math.floor(Math.random() * upsellData.msg.length)];
        const payload = { axis: axisType, paid: upsellData.paid, message: randomMsg, timestamp: Date.now() };
        sessionStorage.removeItem("instanano_graph_upsell_shown");
        sessionStorage.setItem(GRAPH_UPSELL_STORAGE, JSON.stringify(payload));
    }
    document.addEventListener("click", function(e) {
        if (e.target && (e.target.id === "download" || e.target.closest("#download"))) {
            storeGraphUpsell();
        }
        if (e.target && (e.target.id === "save" || e.target.closest("#save"))) {
            storeGraphUpsell();
        }
    });
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.parsers.parseText = function(text){
        const splitRow = line => {
            const t = line.trim();
            if (t.includes(",")) return t.split(",").map(s => s.trim());
            if (t.includes("\t")) return t.split("\t").map(s => s.trim());
            return t.split(/\s+/);
        };
        const rows = String(text || "")
            .trim()
            .split(/\r?\n/)
            .filter(Boolean)
            .map(splitRow);
        return rows.length ? rows : [[""]];
    }
    G.parsers.parseXLSX = function(buffer){const wb=XLSX.read(new Uint8Array(buffer),{type:'array'});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1})}
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.parsers.parseXRDASCII = function(text) {
        const rows = [];
        String(text || "").split(/\r?\n/).forEach(line => {
            const t = line.trim();
            if (!t || t.startsWith("#") || t.startsWith(";") || /^[_A-Za-z]+\s*=/.test(t)) return;
            const nums = t.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
            if (!nums || nums.length < 2) return;
            const x = Number(nums[0]);
            const y = Number(nums[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) rows.push([x, y]);
        });
        return rows.length ? rows : G.parsers.parseText(text);
    };
    function includesAscii(bytes, text) {
        for (let i = 0, n = bytes.length - text.length; i <= n; i++) {
            let ok = true;
            for (let j = 0; j < text.length; j++) {
                if (bytes[i + j] !== text.charCodeAt(j)) { ok = false; break; }
            }
            if (ok) return true;
        }
        return false;
    }
    function parseRAWRigakuUltima(buffer) {
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 0x0c5a) return null;
        const bytes = new Uint8Array(buffer);
        if (bytes[0] !== 0x46 || bytes[1] !== 0x49 || !includesAscii(bytes, "Ultima IV")) return null;
        const dv = new DataView(buffer);
        const n = dv.getUint16(0x0c52, true);
        const dataOff = 0x0c56;
        if (n < 2 || dataOff + n * 4 > buffer.byteLength) return null;
        const start = dv.getFloat32(0x0b92, true);
        const end = dv.getFloat32(0x0b96, true);
        const step = dv.getFloat32(0x0b9a, true);
        const metaOk = Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(step) && step > 0;
        if (metaOk) {
            const expected = Math.round((end - start) / step) + 1;
            if (Math.abs(expected - n) > 3) return null;
        }
        const x0 = Number.isFinite(start) ? start : 0;
        const xStep = metaOk ? step : (Number.isFinite(start) && Number.isFinite(end) ? (end - start) / (n - 1) : 1);
        if (!(Number.isFinite(xStep) && xStep > 0)) return null;
        const rows = new Array(n);
        for (let i = 0; i < n; i++) {
            const y = dv.getFloat32(dataOff + i * 4, true);
            if (!Number.isFinite(y)) return null;
            rows[i] = [x0 + i * xStep, y];
        }
        return rows;
    }
    const rawVariants = [{ id: "rigaku-ultima", parse: parseRAWRigakuUltima }];
    G.parsers.parseRAW = function(buffer) {
        for (const variant of rawVariants) {
            const rows = variant.parse(buffer);
            if (rows && rows.length) return rows;
        }
        return [];
    };
    G.parsers.parseXRDML = function(text) {
        const xml = new DOMParser().parseFromString(text, "application/xml");
        const scan = xml.getElementsByTagName("scan")[0] || xml.getElementsByTagNameNS("*", "scan")[0];
        if (!scan) return [];
        let pos = scan.getElementsByTagName("positions");
        if (!pos.length) {
            const dp = scan.getElementsByTagName("dataPoints")[0];
            pos = dp ? dp.getElementsByTagName("positions") : pos;
        }
        const twoTheta = Array.from(pos).find(p => (p.getAttribute("axis") || "").toLowerCase().includes("2theta"));
        if (!twoTheta) return [];
        const start = parseFloat((twoTheta.getElementsByTagName("startPosition")[0] || twoTheta.getElementsByTagNameNS("*", "startPosition")[0]).textContent);
        const end = parseFloat((twoTheta.getElementsByTagName("endPosition")[0] || twoTheta.getElementsByTagNameNS("*", "endPosition")[0]).textContent);
        let intens = scan.getElementsByTagName("counts");
        if (!intens.length) {
            intens = scan.getElementsByTagName("intensities");
            if (!intens.length) {
                const dp = scan.getElementsByTagName("dataPoints")[0];
                intens = dp ? dp.getElementsByTagName("intensities") : intens;
            }
        }
        if (!intens.length || !intens[0] || !Number.isFinite(start) || !Number.isFinite(end)) return [];
        const arr = intens[0].textContent.trim().split(/\s+/).map(Number).filter(Number.isFinite);
        const n = arr.length;
        if (n < 2) return [];
        const step = (end - start) / (n - 1);
        return Array.from({ length: n }, (_, i) => [start + step * i, arr[i]]);
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.parsers.parseNMR = async function(files){
        const pathOf = f => (f.webkitRelativePath||f.relativePath||f.name).replace(/\\/g,'/');
        if (!files || !files.length) return false; const M = new Map(files.map(f => [pathOf(f), f]));
        const F=files.filter(f=>/\/fid$/i.test(pathOf(f))); if(!F.length) return false
        function kv(t){return (t.match(/^\#\#\$(\w+)=([\s\S]*?)(?=\n\#\#|\s*$)/mg)||[]).reduce((o,s)=>{const m=/^\#\#\$(\w+)=([\s\S]*)$/m.exec(s);if(!m)return o;const v=m[2].replace(/[()]/g,' ').trim().split(/\s+/)[0];o[m[1]]=isNaN(+v)?v:+v;return o},{})}
        const specs=[]; for(const fid of F){
        const base=pathOf(fid).replace(/\/fid$/i,''); const aq=M.get(base+'/acqus')||M.get(base+'/ACQUS'); if(!aq) continue
        const A=kv(await aq.text()); const SFO1=+A.SFO1, SWh=+A.SW_h; if(!isFinite(SFO1)||!isFinite(SWh)) continue
        const O1P=isFinite(+A.O1P)?+A.O1P:(isFinite(+A.O1)?(+A.O1/SFO1):0), BY=+A.BYTORDA||0, DT=+A.DTYPA||0, NC=+A.NC||0, GRP=Math.max(0,Math.round(+A.GRPDLY||0))
        const buf=await fid.arrayBuffer(), dv=new DataView(buf), le=(BY===0); let bps=4,get
        if(DT===2){bps=2;get=i=>dv.getInt16(i*2,le)} else if(DT===3){bps=4;get=i=>dv.getFloat32(i*4,le)} else if(DT===5){bps=8;get=i=>dv.getFloat64(i*8,le)} else {bps=4;get=i=>dv.getInt32(i*4,le)}
        const nS=(buf.byteLength/bps)|0, nC=(nS/2)|0, sc=Math.pow(2,NC), re=new Float64Array(nC), im=new Float64Array(nC)
        for(let i=0;i<nC;i++){re[i]=get(2*i)*sc;im[i]=get(2*i+1)*sc}
        const off=Math.min(GRP,nC-1), R=re.subarray(off), I=im.subarray(off); let N=1; while(N<R.length) N<<=1
        const xr=new Float64Array(N), xi=new Float64Array(N); xr.set(R); xi.set(I)
        for(let i=1,j=0;i<N;i++){let b=N>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[xr[i],xr[j]]=[xr[j],xr[i]];[xi[i],xi[j]]=[xi[j],xi[i]]}}
        for(let len=2;len<=N;len<<=1){const ang=-2*Math.PI/len,wpr=Math.cos(ang),wpi=Math.sin(ang);for(let i=0;i<N;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=wr*xr[l]-wi*xi[l],ti=wr*xi[l]+wi*xr[l];xr[l]=xr[k]-tr;xi[l]=xi[k]-ti;xr[k]+=tr;xi[k]+=ti;const t=wr;wr=t*wpr-wi*wpi;wi=t*wpi+wi*wpr}}}
        const half=N>>1, mag=new Float64Array(N); for(let i=0;i<N;i++) mag[i]=Math.hypot(xr[i],xi[i])
        const ms=new Float64Array(N); ms.set(mag.subarray(half)); ms.set(mag.subarray(0,half),N-half)
        const df=SWh/N, start=-SWh/2, ppm=new Float64Array(N); for(let i=0;i<N;i++) ppm[i]=O1P+(start+i*df)/SFO1
        specs.push({name:base.split('/').pop(),x:Array.from(ppm).reverse(),y:Array.from(ms).reverse()})} if(!specs.length) return false
        const n=specs.length*2, header=Array.from({length:n},(_,i)=>i%2?'Y-axis':'X-axis'), color=Array.from({length:n},(_,i)=>G.config.COLORS[i%G.config.COLORS.length])
        const names=[]; specs.forEach(s=>{names.push('ppm');names.push(s.name)})
        const L=Math.max(...specs.map(s=>s.x.length)), rows=Array.from({length:L},(_,r)=>specs.flatMap(s=>[s.x[r]??'',s.y[r]??'']))
        G.state.hot.loadData([header,color,names,...rows]); document.getElementById('axis-nmr').checked=true; G.axis.resetScales(true); G.renderChart(); return true
    }
})(window.GraphPlotter);
(function(G) {
    "use strict";
    G.io = G.io || {};
    let bound = false;
    G.io.initFileLoader = function({ detectModeFromData, openPanelForMode } = {}) {
        if (bound) return;
        bound = true;
        const fileHandlers={ instanano:null, csv:G.parsers.parseText, txt:G.parsers.parseText, xls:G.parsers.parseXLSX, xlsx:G.parsers.parseXLSX, xrdml:G.parsers.parseXRDML, raw:G.parsers.parseRAW, xy:G.parsers.parseXRDASCII, xye:G.parsers.parseXRDASCII, asc:G.parsers.parseXRDASCII, dat:G.parsers.parseXRDASCII, uxd:G.parsers.parseXRDASCII};
        const fileModes = {xrdml:'xrd',xy:'xrd',xye:'xrd',asc:'xrd',dat:'xrd',uxd:'xrd',raw:'xrd',spc:'uvvis'};
        const fileinput=document.getElementById('fileinput');
        const dropzone=document.getElementById('dropzone');
        if (!fileinput || !dropzone) return;
        fileinput.accept=Object.keys(fileHandlers).map(ext=>'.'+ext).join(',');
        const setMode = mode => {
            if (!mode) return;
            const radio = document.querySelector(`input[name="axistitles"][value="${mode}"]`);
            if (radio) radio.checked = true;
            openPanelForMode?.(mode);
        };
        async function handleFileList(src){
            const items = src && src.items; const files = items && items.length ? await (async()=>{const out=[];
            const readAll=r=>new Promise(res=>{const a=[];(function n(){r.readEntries(es=>{if(!es.length)res(a);else{a.push(...es);n()}})})()});
            const walk=async (en,p='')=>en.isFile ? await new Promise(r=>en.file(f=>{f.relativePath=p+f.name;out.push(f);r()})) : await Promise.all((await readAll(en.createReader())).map(e=>walk(e,p+en.name+'/')));
            for (const it of items){const en=it.webkitGetAsEntry&&it.webkitGetAsEntry(); if(en) await walk(en)} return out})() : [...(src?.files||src||[])];
            if(!files.length) return;
            if (await G.parsers.parseNMR(files)) return;
            const file=files[0]; const ext=file.name.split('.').pop().toLowerCase();
            if (ext === 'instanano') {
                const text = await file.text();
                try { G.importState(JSON.parse(text)); }
                catch (_) { alert('Invalid .instanano file'); }
                return;
            }
            const parser=fileHandlers[ext]; if(!parser) return alert('Unsupported file type: .'+ext);
            if (fileModes[ext]) setMode(fileModes[ext]);
            let rows;
            if(ext==='xls'||ext==='xlsx'||ext==='raw'){ const buffer=await file.arrayBuffer(); rows=parser(buffer);}
            else { const text=await file.text(); rows=parser(text);}
            const n=Math.max(...rows.map(r=>r.length)), header=Array(n).fill().map((_,i)=>i===0?'X-axis':'Y-axis'),
            color=Array(n).fill().map((_,i)=>G.config.COLORS[i%G.config.COLORS.length]), name=Array(n).fill('Sample');
            G.state.hot.loadData([header,color,name,...rows]); G.state.colEnabled = {}; G.state.hot.getData()[0].forEach((_, c) => { G.state.colEnabled[c] = true; });
            G.state.hot.render();
            setMode(detectModeFromData?.());
            d3.select('#chart').selectAll("g.axis-title, g.legend-group, g.shape-group, defs, foreignObject.user-text").remove();
            G.ui.disableAreaCal(); G.state.tickLabelStyles={x:{fontSize:null,color:null},y:{fontSize:null,color:null}};
            G.axis.resetScales(true); G.renderChart();
        }
        ['dragenter','dragover'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add('hover')}));
        ['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove('hover')}));
        dropzone.addEventListener('drop', async e=>{ e.preventDefault(); dropzone.classList.remove('hover'); await handleFileList(e.dataTransfer);});
        fileinput.addEventListener('change', async ()=>{ await handleFileList(fileinput.files); });
        dropzone.addEventListener('click',()=>fileinput.click());
    };
})(window.GraphPlotter);
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
    const lockedCountLabel = document.getElementById('xrd-locked-count');
    const creditBar = document.getElementById('xrd-credit-bar');
    const creditCount = document.getElementById('xrd-credit-count');
    let currentCredits = 0;
    let creditsLoaded = false;

    function updateCreditDisplay(data) {
        const total = Number(typeof data === 'object' && data ? (data.remaining_total ?? data.remaining ?? 0) : (data ?? 0));
        const current = Number(typeof data === 'object' && data ? (data.current_remaining ?? total) : total);
        currentCredits = Number.isFinite(total) ? Math.max(0, total) : 0;
        creditsLoaded = true;
        if (creditBar) creditBar.style.display = '';
        if (creditCount) {
            const currentSafe = Number.isFinite(current) ? Math.max(0, current) : 0;
            const other = Math.max(0, currentCredits - currentSafe);
            creditCount.textContent = other > 0 ? `${currentCredits} (Current: ${currentSafe}, Other: ${other})` : `${currentCredits}`;
        }
    }

    function hideUnlockSection() {
        if (unlockSection) unlockSection.style.display = 'none';
        if (unlockBtn) unlockBtn.style.display = 'none';
        if (lockedCountLabel) lockedCountLabel.textContent = '';
    }

    function showUnlockSection(meta = {}) {
        if (unlockSection) unlockSection.style.display = '';
        if (unlockBtn) {
            unlockBtn.style.display = '';
            const n = G.matchXRD?.getSampleCount?.() || 1;
            unlockBtn.textContent = `🔓 Unlock Full XRD Match (${n} credit${n > 1 ? 's' : ''})`;
        }
        if (lockedCountLabel) {
            const lockedCount = Number(meta.lockedCount || 0);
            const totalMatches = Number(meta.totalMatches || 0);
            lockedCountLabel.textContent = lockedCount > 0 ? `${lockedCount} more ranked references are locked${totalMatches > 0 ? ` (total ${totalMatches})` : ''}.` : '';
        }
    }

    function setPanelMessage(panel, message) {
        const node = panel?.node();
        if (!node) return;
        const p = document.createElement("p");
        p.textContent = message;
        node.replaceChildren(p);
    }

    function renderMatches(panel, matches, cols, meta = {}) {
        const node = panel?.node();
        if (!node) return;
        node.replaceChildren();
        const lockedMatches = Array.isArray(meta.lockedMatches) ? meta.lockedMatches : [];
        if (!matches.length && !lockedMatches.length) {
            const p = document.createElement("p");
            p.textContent = "No matching peaks found.";
            node.appendChild(p);
            return;
        }
        const frag = document.createDocumentFragment();
        const appendRow = (item, teaser = false) => {
            const row = item.row || item;
            const rowDiv = document.createElement("div");
            rowDiv.className = "matchedrow";
            if (item.refId) rowDiv.dataset.refid = item.refId;
            if (teaser) {
                rowDiv.dataset.locked = '1';
                rowDiv.style.pointerEvents = 'none';
                rowDiv.style.opacity = '0.82';
            } else {
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
            }
            row.forEach((val, idx) => {
                const cell = document.createElement("div");
                const label = document.createElement("b");
                label.textContent = `${cols[idx]}:`;
                cell.append(label, document.createTextNode(` ${val}`));
                if (teaser) cell.style.filter = 'blur(1px)';
                rowDiv.appendChild(cell);
            });
            if (!teaser && item.fullData?.mineral) {
                const mn = document.createElement("div");
                mn.style.cssText = 'font-size:11px;color:#555;margin-top:2px';
                mn.textContent = `Mineral: ${item.fullData.mineral}`;
                rowDiv.appendChild(mn);
            }
            if (teaser) {
                const badge = document.createElement("div");
                badge.style.cssText = 'position:absolute;top:5px;right:6px;background:rgba(255,255,255,0.94);border:1px solid #ddd;border-radius:10px;padding:1px 7px;font-size:10px;color:#a16207;pointer-events:none';
                badge.textContent = 'Locked';
                rowDiv.style.position = 'relative';
                rowDiv.appendChild(badge);
            }
            frag.appendChild(rowDiv);
        };
        matches.forEach(item => appendRow(item, false));
        if (lockedMatches.length) {
            const sep = document.createElement("div");
            sep.style.cssText = 'font-size:11px;font-weight:600;color:#666;margin:8px 0 4px';
            sep.textContent = 'More references (locked)';
            frag.appendChild(sep);
            lockedMatches.forEach(item => appendRow(item, true));
        }
        node.appendChild(frag);
    }

    document.querySelectorAll('input[name="matchinstrument"]').forEach(inp => inp.addEventListener('change', () => setPanelMessage($std, STD_MSG)));
    ['icon1', 'icon2', 'icon3', 'icon4'].forEach(id => document.getElementById(id)?.addEventListener('change', () => { G.matchXRD?.clear(); hideUnlockSection(); }));
    icon5?.addEventListener('change', async () => {
        setPanelMessage($xrd, XRD_MSG);
        hideUnlockSection();
        G.matchXRD?.render();
    });
    icon6?.addEventListener('change', () => { G.matchXRD?.clear(); hideUnlockSection(); setPanelMessage($std, STD_MSG); });
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
        hideUnlockSection();
        const result = await G.matchXRD.search();
        renderMatches($xrd, result.matches, result.cols, { lockedMatches: result.lockedMatches });
        if (!result.matches.length && !(result.lockedMatches || []).length) return;
        if (result.locked) {
            showUnlockSection(result);
        }
    });
    unlockBtn?.addEventListener('click', async function () {
        if (typeof instananoCredits === 'undefined') {
            window.open(PRICING_URL, '_blank');
            return;
        }
        unlockBtn.style.pointerEvents = 'none';
        try {
            if (!creditsLoaded || currentCredits <= 0) {
                unlockBtn.textContent = '⏳ Checking credits...';
                const cr = await G.matchXRD?.checkCredit?.();
                updateCreditDisplay(cr || 0);
            }
            if (currentCredits <= 0) {
                unlockBtn.textContent = '🔓 Unlock Full XRD Match';
                window.open(PRICING_URL, '_blank');
                return;
            }
            unlockBtn.textContent = '⏳ Unlocking...';
            const result = await G.matchXRD.unlock();
            if (result.ok) {
                hideUnlockSection();
                updateCreditDisplay({ remaining_total: result.remaining, current_remaining: result.current_remaining });
                renderMatches($xrd, result.matches, ['Ref ID', 'Formula', 'Match (%)']);
            } else {
                unlockBtn.textContent = '🔓 Unlock Full XRD Match';
            }
        } finally {
            unlockBtn.style.pointerEvents = '';
        }
    });
    document.getElementById('xrd-clear-peaks')?.addEventListener('click', function () {
        G.matchXRD?.clear();
        hideUnlockSection();
        setPanelMessage($xrd, XRD_MSG);
    });
    $xrd.on('click', async function (e) {
        const t = e.target.closest('.matchedrow');
        if (!t) return;
        if (t.dataset.locked === '1') return;
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
    hideUnlockSection();
    setPanelMessage($xrd, XRD_MSG);
    setPanelMessage($std, STD_MSG);
})(window.GraphPlotter);
(function (G) {
    "use strict";
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@latest/match/';
    const cache = {};
    const config = {
        ftirmatch: { buf: { range: 20, single: 50 }, cols: ['Peak Position', 'Group', 'Class', 'Intensity'] },
        xpsmatch: { buf: { range: 1, single: 0.5 }, cols: ['Peak Position', 'Group', 'Material', 'Notes'] },
        ramanmatch: { buf: { range: 10, single: 30 }, cols: ['Raman Shift (cm⁻¹)', 'Material', 'Mode', 'Notes'] },
        uvvismatch: { buf: { range: 20, single: 40 }, cols: ['λmax (nm)', 'Material', 'Characteristic', 'Description'] },
        hnmrmatch: { buf: { range: 0.2, single: 0.5 }, cols: ['Chemical Shift (ppm)', 'Type', 'Assignment', 'Description'] },
        cnmrmatch: { buf: { range: 10, single: 20 }, cols: ['Chemical Shift (ppm)', 'Type', 'Assignment', 'Description'] }
    };
    async function fetchData(id) {
        if (cache[id]) return cache[id];
        const folder = id.replace('match', '');
        const res = await fetch(`${CDN_BASE}${folder}/match.json`);
        if (!res.ok) throw new Error(`Failed to load ${id} match data`);
        const parsed = await res.json();
        cache[id] = Array.isArray(parsed) ? parsed : [];
        return cache[id];
    }
    G.matchStandard = {
        isStandard: (id) => !!config[id],
        search: async (id, xVal) => {
            let data;
            try { data = await fetchData(id); } catch (_) { return { matches: [], cols: config[id]?.cols || [] }; }
            const { buf, cols } = config[id];
            const matches = data.filter(r => {
                const p = r[0].split('-').map(Number);
                return p.length > 1
                    ? (xVal >= p[0] - buf.range && xVal <= p[1] + buf.range)
                    : Math.abs(xVal - p[0]) <= buf.single;
            });
            return { matches: matches.map(row => ({ row })), cols };
        }
    };
})(window.GraphPlotter);
(function (G) {
    "use strict";
    const XRD_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@v1.0.0/match/xrd/';
    const BIN_WIDTH = 0.5;
    const LOCK_VERSION = 1;
    const PRECISION = 100;
    const TOLERANCE = 0.5;
    const MIN_TOLERANCE = 0.25;
    const FETCH_CONCURRENCY = 8;
    const FREE_PREVIEW_REFS = 3;
    const FREE_PREVIEW_PEAKS = 3;
    const MAX_RANKED_REFS = 25;
    let selectedPeaks = [];
    let compositions = null;
    let elementFilter = { elements: [], mode: 'and', count: 0 };
    const metaCache = new Map();
    const indexCache = new Map();
    const chunkCache = new Map();
    const PERIODIC_TABLE = { 'H': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8, 'F': 9, 'Ne': 10, 'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16, 'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20, 'Sc': 21, 'Ti': 22, 'V': 23, 'Cr': 24, 'Mn': 25, 'Fe': 26, 'Co': 27, 'Ni': 28, 'Cu': 29, 'Zn': 30, 'Ga': 31, 'Ge': 32, 'As': 33, 'Se': 34, 'Br': 35, 'Kr': 36, 'Rb': 37, 'Sr': 38, 'Y': 39, 'Zr': 40, 'Nb': 41, 'Mo': 42, 'Tc': 43, 'Ru': 44, 'Rh': 45, 'Pd': 46, 'Ag': 47, 'Cd': 48, 'In': 49, 'Sn': 50, 'Sb': 51, 'Te': 52, 'I': 53, 'Xe': 54, 'Cs': 55, 'Ba': 56, 'La': 57, 'Ce': 58, 'Pr': 59, 'Nd': 60, 'Pm': 61, 'Sm': 62, 'Eu': 63, 'Gd': 64, 'Tb': 65, 'Dy': 66, 'Ho': 67, 'Er': 68, 'Tm': 69, 'Yb': 70, 'Lu': 71, 'Hf': 72, 'Ta': 73, 'W': 74, 'Re': 75, 'Os': 76, 'Ir': 77, 'Pt': 78, 'Au': 79, 'Hg': 80, 'Tl': 81, 'Pb': 82, 'Bi': 83, 'Po': 84, 'At': 85, 'Rn': 86, 'Fr': 87, 'Ra': 88, 'Ac': 89, 'Th': 90, 'Pa': 91, 'U': 92, 'Np': 93, 'Pu': 94, 'Am': 95, 'Cm': 96, 'Bk': 97, 'Cf': 98, 'Es': 99, 'Fm': 100, 'Md': 101, 'No': 102, 'Lr': 103, 'Rf': 104, 'Db': 105, 'Sg': 106, 'Bh': 107, 'Hs': 108, 'Mt': 109, 'Ds': 110, 'Rg': 111, 'Cn': 112, 'Nh': 113, 'Fl': 114, 'Mc': 115, 'Lv': 116, 'Ts': 117, 'Og': 118 };
    const setProgress = (p) => { const b = document.getElementById('xrd-search-btn'); if (!b) return; if (p === 'done') b.classList.add('progress-done'); else { b.classList.contains('progress-done') && (b.classList.add('no-anim'), void b.offsetHeight); b.classList.remove('progress-done', 'no-anim'); b.style.setProperty('--progress', p + '%'); } };
    const setStatusMessage = (msg) => {
        const box = document.getElementById('xrd-matchedData');
        if (!box) return;
        const p = document.createElement('p');
        p.textContent = msg;
        box.replaceChildren(p);
    };
    async function mapLimit(items, limit, worker) {
        if (!items.length) return [];
        const out = new Array(items.length);
        let next = 0;
        async function run() { while (next < items.length) { const idx = next++; out[idx] = await worker(items[idx], idx); } }
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
        return out;
    }
    async function fetchJsonWithCache(cache, url) {
        if (cache.has(url)) return cache.get(url);
        const req = fetch(url).then(r => (r.ok ? r.json() : null)).catch(() => null).then(data => { if (data == null) cache.delete(url); return data; });
        cache.set(url, req);
        return req;
    }
    const passesFilter = (cid) => {
        if (!compositions) return true;
        const ca = compositions[cid];
        if (!ca) return true;
        const { elements, mode, count } = elementFilter;
        if (count > 0 && ca.length !== count) return false;
        if (!elements.length) return true;
        const cs = new Set(ca);
        if (mode === 'and') { for (const e of elements) if (!cs.has(e)) return false; return true; }
        if (mode === 'or') { for (const e of elements) if (cs.has(e)) return true; return false; }
        if (mode === 'only') { if (ca.length !== elements.length) return false; for (const e of elements) if (!cs.has(e)) return false; return true; }
        return true;
    };
    const normalizeIntensity = (peaks) => {
        if (!peaks.length) return;
        const vals = peaks.map(p => Number(p.intensity) || 0).filter(v => v > 0).sort((a, b) => b - a);
        if (!vals.length) return peaks.forEach(p => p.normInt = 0);
        const anchor = vals[Math.min(2, vals.length - 1)] || vals[0];
        peaks.forEach(p => p.normInt = anchor > 0 ? Math.max(0, Math.min(100, (Number(p.intensity) || 0) / anchor * 100)) : 0);
    };
    const getTolerance = (twoTheta) => Math.max(MIN_TOLERANCE, Math.min(TOLERANCE, 0.18 + ((Number(twoTheta) || 0) * 0.0065)));
    async function getTableSHA() {
        const raw = JSON.stringify({ t: G.state.hot.getData(), c: G.state.colEnabled });
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    async function sha256Hex(raw) {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
        return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function canonicalizePeaks(peaks) {
        return peaks.map(p => [Number(p.x).toFixed(4), Number(p.intensity ?? 0).toFixed(4)])
            .sort((a, b) => a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1);
    }
    async function getPeaksHash(peaks) {
        const raw = JSON.stringify(canonicalizePeaks(peaks));
        return sha256Hex(raw);
    }
    function getSampleCount() {
        const data = G.state.hot.getData();
        return data[0].filter((h, i) => h === 'Y-axis' && G.state.colEnabled[i] !== false).length || 1;
    }
    async function ajaxPost(action, extra = {}) {
        if (typeof instananoCredits === 'undefined') return null;
        const fd = new FormData();
        fd.append('action', action);
        fd.append('nonce', instananoCredits.nonce);
        for (const [k, v] of Object.entries(extra)) {
            if (Array.isArray(v)) v.forEach(i => fd.append(k + '[]', i));
            else fd.append(k, v);
        }
        const r = await fetch(instananoCredits.ajaxUrl, { method: 'POST', body: fd });
        return r.json();
    }

    G.matchXRD = {
        lockActive: false,
        lockInfo: null,
        lockedPeaks: [],
        addPeak: (x, intensity) => {
            if (G.matchXRD.lockActive) return;
            selectedPeaks.push({ x, intensity, normInt: 0 });
            normalizeIntensity(selectedPeaks);
            G.matchXRD.render();
        },
        render: () => {
            const svg = d3.select('#chart svg');
            const tab = document.getElementById('icon5');
            if (tab && !tab.checked) { svg.selectAll('.xrd-user-peak,.xrd-ref-peak').remove(); return; }
            svg.selectAll('.xrd-user-peak').remove();
            const peaks = G.matchXRD.lockActive ? G.matchXRD.lockedPeaks : selectedPeaks;
            peaks.forEach((p, i) => {
                const xp = G.state.lastXScale(p.x);
                const line = svg.append('line').attr('class', 'xrd-user-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - 7)
                    .attr('stroke', 'red').attr('stroke-width', 3);
                if (!G.matchXRD.lockActive) {
                    line.style('cursor', 'pointer').on('click', (e) => { e.stopPropagation(); selectedPeaks.splice(i, 1); normalizeIntensity(selectedPeaks); G.matchXRD.render(); });
                } else {
                    line.style('cursor', 'default');
                }
            });
        },
        showRef: (peaks, ints) => {
            const svg = d3.select('#chart svg');
            svg.selectAll('.xrd-ref-peak').remove();
            peaks.forEach((x, i) => {
                const xp = G.state.lastXScale(x);
                if (xp < G.config.DIM.ML || xp > G.config.DIM.W - G.config.DIM.MR) return;
                const h = 5 + ((ints?.[i] ?? 100) / 100) * 35;
                svg.append('line').attr('class', 'xrd-ref-peak')
                    .attr('x1', xp).attr('x2', xp)
                    .attr('y1', G.config.DIM.H - G.config.DIM.MB)
                    .attr('y2', G.config.DIM.H - G.config.DIM.MB - h)
                    .attr('stroke', 'blue').attr('stroke-width', 1)
                    .attr('stroke-dasharray', '4,2').style('pointer-events', 'none');
            });
        },
        clear: () => {
            selectedPeaks = [];
            d3.selectAll('.xrd-user-peak,.xrd-ref-peak').remove();
            if (G.matchXRD.lockActive) { G.matchXRD.render(); return; }
        },
        validate: (input) => {
            if (!input.trim()) return { valid: true, invalid: [] };
            const parts = input.split(',').map(e => e.trim()).filter(e => e);
            const invalid = parts.filter(e => !PERIODIC_TABLE[e]);
            return { valid: invalid.length === 0, invalid };
        },
        setFilter: (els, mode, count) => {
            const nums = [];
            for (const e of els) { const t = e.trim(); if (PERIODIC_TABLE[t]) nums.push(PERIODIC_TABLE[t]); }
            elementFilter = { elements: nums, mode: mode || 'and', count: count || 0 };
        },
        clearFilter: () => { elementFilter = { elements: [], mode: 'and', count: 0 }; },
        search: async () => {
            const peaks = G.matchXRD.lockActive ? G.matchXRD.lockedPeaks : selectedPeaks;
            if (!peaks.length) return { matches: [], cols: [] };
            normalizeIntensity(peaks);
            setProgress(0);
            setStatusMessage('Searching and matching from ~1 million references...');
            if (!compositions) {
                compositions = await fetchJsonWithCache(metaCache, `${XRD_BASE}meta/compositions.json`);
                if (!compositions) { setProgress(0); setStatusMessage('Error loading.'); return { matches: [], cols: [] }; }
            }
            setProgress(10);
            const candidates = new Map();
            const binSet = new Set();
            for (const p of peaks) binSet.add(Math.floor(p.x / BIN_WIDTH));
            const binArr = [...binSet];
            let binDone = 0;
            const fetches = await mapLimit(binArr, FETCH_CONCURRENCY, async b => {
                const data = await fetchJsonWithCache(indexCache, `${XRD_BASE}index/${b}.json`);
                binDone++;
                setProgress(10 + (binDone / Math.max(1, binArr.length)) * 40);
                return data;
            });
            const binData = {};
            binArr.forEach((b, i) => { if (fetches[i]) binData[b] = fetches[i]; });
            for (const up of peaks) {
                const bid = Math.floor(up.x / BIN_WIDTH);
                const idx = binData[bid];
                if (!idx) continue;
                for (let j = 0; j < idx.d.length; j++) {
                    const p = idx.d[j], cid = idx.c[j];
                    if (!passesFilter(cid)) continue;
                    const rid = p >> 8, off = p & 0xFF;
                    const rp = (bid * BIN_WIDTH) + (off / PRECISION);
                    const diff = Math.abs(up.x - rp);
                    const tol = getTolerance((up.x + rp) * 0.5);
                    if (diff <= tol) {
                        if (!candidates.has(rid)) candidates.set(rid, []);
                        candidates.get(rid).push({ rp, diff, userInt: up.normInt });
                    }
                }
            }
            const sorted = [...candidates.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, MAX_RANKED_REFS);
            if (!sorted.length) { setProgress(0); return { matches: [], cols: [] }; }
            const chunks = {};
            const cids = [...new Set(sorted.map(([r]) => Math.floor(r / 1000)))];
            let chunkDone = 0;
            await mapLimit(cids, FETCH_CONCURRENCY, async c => {
                chunks[c] = await fetchJsonWithCache(chunkCache, `${XRD_BASE}data/${c}.json`);
                chunkDone++;
                setProgress(50 + (chunkDone / Math.max(1, cids.length)) * 40);
            });
            setProgress(95);
            const final = [];
            for (const [rid] of sorted) {
                const c = chunks[Math.floor(rid / 1000)];
                const d = c?.[rid % 1000];
                if (!d) continue;
                const refPeaks = d[2].map(p => p / PRECISION);
                const refInts = d[3] || [];
                const totalRefPeaks = refPeaks.length;
                let posPenalty = 0, intPenalty = 0, matchCount = 0, matchBonus = 0;
                const usedUserPeaks = new Set();
                for (let i = 0; i < totalRefPeaks; i++) {
                    const rp = refPeaks[i], ri = refInts[i] || 50;
                    let bestMatch = null, bestIdx = -1;
                for (let j = 0; j < peaks.length; j++) {
                    if (usedUserPeaks.has(j)) continue;
                    const diff = Math.abs(peaks[j].x - rp);
                    const tol = getTolerance((peaks[j].x + rp) * 0.5);
                    if (diff <= tol && (!bestMatch || (diff / tol) < (bestMatch.diff / bestMatch.tol))) { bestMatch = { diff, tol, userInt: peaks[j].normInt }; bestIdx = j; }
                }
                    if (bestMatch && bestIdx >= 0) {
                        usedUserPeaks.add(bestIdx); matchCount++;
                        matchBonus += 3.5;
                        posPenalty += (bestMatch.diff / bestMatch.tol) * 8;
                        intPenalty += (Math.abs(bestMatch.userInt - ri) / 100) * 2;
                    } else { posPenalty += 6; intPenalty += 1; }
                }
                const score = matchCount ? Math.max(0, Math.min(100, ((100 - posPenalty - intPenalty + matchBonus) / (100 + (3.5 * totalRefPeaks))) * 100)) : 0;
                final.push({ row: [d[0], d[1], score.toFixed(1)], refId: d[0], peaks: refPeaks, intensities: refInts, score });
            }
            final.sort((a, b) => b.score - a.score);
            setProgress('done');
            const locked = !G.matchXRD.lockActive;
            if (locked) {
                const preview = final.slice(0, FREE_PREVIEW_REFS).map(m => ({
                    ...m,
                    peaks: m.peaks.slice(0, FREE_PREVIEW_PEAKS),
                    intensities: m.intensities.slice(0, FREE_PREVIEW_PEAKS)
                }));
                const lockedMatches = final.slice(FREE_PREVIEW_REFS).map(({ row, refId, score }) => ({ row, refId, score, teaser: true }));
                return {
                    matches: preview,
                    lockedMatches,
                    lockedCount: lockedMatches.length,
                    totalMatches: final.length,
                    previewRefs: FREE_PREVIEW_REFS,
                    previewPeaks: FREE_PREVIEW_PEAKS,
                    cols: ['Ref ID', 'Formula', 'Match (%)'],
                    locked: true
                };
            }

            return { matches: final, cols: ['Ref ID', 'Formula', 'Match (%)'], locked: false };
        },
        getSampleCount,
        getTableSHA,
        checkCredit: async () => { const r = await ajaxPost('instanano_check_credit'); return r?.success ? r.data : null; },
        computeLockHash: async (peaks) => {
            const tableHash = await getTableSHA();
            const peaksHash = await getPeaksHash(peaks);
            const lockRaw = `${LOCK_VERSION}|${tableHash}|${peaksHash}`;
            const lockHash = await sha256Hex(lockRaw);
            return { lock_hash: lockHash, table_hash: tableHash, peaks_hash: peaksHash, lock_version: LOCK_VERSION };
        },
        unlock: async () => {
            if (!selectedPeaks.length) return { ok: false, message: 'No peaks selected.' };
            const n = getSampleCount();
            const lock = await G.matchXRD.computeLockHash(selectedPeaks);
            const r = await ajaxPost('instanano_use_credit', { lock_hash: lock.lock_hash, lock_version: lock.lock_version, sample_count: n });
            if (!r?.success || !r?.data?.signature) return { ok: false, message: r?.data?.message || 'Failed.', remaining: r?.data?.remaining };
            const accountId = Number(r.data.account_id || 0);
            G.matchXRD.lockActive = true;
            G.matchXRD.lockedPeaks = selectedPeaks.map(p => ({ x: p.x, intensity: p.intensity, normInt: p.normInt }));
            G.matchXRD.lockInfo = {
                lock_hash: lock.lock_hash,
                signature: r.data.signature,
                lock_version: lock.lock_version,
                account_id: accountId,
                table_hash: lock.table_hash,
                peaks_hash: lock.peaks_hash,
                fetch_token: r.data.fetch_token || "",
                fetch_token_expires: Number(r.data.fetch_token_expires || 0),
                verified: true
            };
            const full = await G.matchXRD.search();
            return {
                ok: true,
                matches: full.matches || [],
                remaining: Number(r.data.remaining_total ?? r.data.remaining ?? 0),
                current_remaining: Number(r.data.current_remaining ?? 0),
                already_done: false
            };
        },
        refreshFetchToken: async () => {
            const lock = G.matchXRD.lockInfo;
            if (!G.matchXRD.lockActive || !lock?.signature || !lock?.lock_hash || !lock?.account_id) return false;
            const r = await ajaxPost('instanano_verify_lock', {
                lock_hash: lock.lock_hash,
                signature: lock.signature,
                lock_version: lock.lock_version,
                account_id: lock.account_id
            });
            if (!r?.success || !r?.data?.valid || !r?.data?.fetch_token) return false;
            lock.fetch_token = r.data.fetch_token;
            lock.fetch_token_expires = Number(r.data.fetch_token_expires || 0);
            return true;
        },
        fetchRef: async (refId) => {
            const lock = G.matchXRD.lockInfo;
            if (!G.matchXRD.lockActive || !lock?.signature || !lock?.account_id) return null;
            const now = Math.floor(Date.now() / 1000);
            if (!lock.fetch_token || !lock.fetch_token_expires || now >= (lock.fetch_token_expires - 5)) {
                const ok = await G.matchXRD.refreshFetchToken();
                if (!ok) return null;
            }
            let r = await ajaxPost('instanano_xrd_fetch_refs', {
                ref_ids: [refId],
                lock_hash: lock.lock_hash,
                fetch_token: lock.fetch_token,
                account_id: lock.account_id
            });
            if (!r?.success && r?.data?.code === 'fetch_token_expired') {
                const ok = await G.matchXRD.refreshFetchToken();
                if (!ok) return null;
                r = await ajaxPost('instanano_xrd_fetch_refs', {
                    ref_ids: [refId],
                    lock_hash: lock.lock_hash,
                    fetch_token: lock.fetch_token,
                    account_id: lock.account_id
                });
            }
            return r?.success ? r.data[refId] : null;
        },
        isLocked: () => !G.matchXRD.lockActive
    };
})(window.GraphPlotter);
(function(G) {
    "use strict";
    const MAX_CHART_HTML_LENGTH = 2_000_000;
    async function htmlPrompt(message, defaultValue) {
        return new Promise(res => { $('#html-prompt-message').text(message); $('#html-prompt-input').val(defaultValue); 
        $('#popup-prompt-overlay').css('display','flex').fadeIn(150); $('#html-prompt-input').focus().off('keydown').on('keydown', e => {
        if (e.key === 'Enter')   $('#html-prompt-ok').click();});
        $('#html-prompt-ok').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res($('#html-prompt-input').val());});
        $('#html-prompt-cancel').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res(null);});});
    }
    function sanitizeChartHTML(raw) {
        if (typeof raw !== "string") return "";
        if (raw.length > MAX_CHART_HTML_LENGTH) return "";
        const template = document.createElement("template");
        template.innerHTML = raw;
        const blockedTags = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "META", "LINK", "STYLE"]);
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        const remove = [];
        let node = walker.nextNode();
        while (node) {
            if (blockedTags.has(node.tagName)) {
                remove.push(node);
                node = walker.nextNode();
                continue;
            }
            Array.from(node.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || "").toLowerCase();
                if (name.startsWith("on") || value.includes("javascript:")) node.removeAttribute(attr.name);
            });
            node = walker.nextNode();
        }
        remove.forEach(n => n.remove());
        return template.innerHTML;
    }
    function normalizeImportState(raw) {
        if (!raw || typeof raw !== "object") return null;
        const table = raw.table;
        if (!Array.isArray(table) || table.length < 3 || !Array.isArray(table[0]) || !Array.isArray(table[1]) || !Array.isArray(table[2])) return null;
        return {
            table,
            col: raw.col && typeof raw.col === "object" ? raw.col : {},
            settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
            html: sanitizeChartHTML(raw.html || ""),
            xrd_lock_version: raw.xrd_lock_version ?? null,
            xrd_account_id: Number(raw.xrd_account_id || 0),
            xrd_lock_hash: typeof raw.xrd_lock_hash === "string" ? raw.xrd_lock_hash : "",
            xrd_signature: typeof raw.xrd_signature === "string" ? raw.xrd_signature : "",
            xrd_table_hash: typeof raw.xrd_table_hash === "string" ? raw.xrd_table_hash : "",
            xrd_peaks_hash: typeof raw.xrd_peaks_hash === "string" ? raw.xrd_peaks_hash : "",
            xrd_peaks: Array.isArray(raw.xrd_peaks) ? raw.xrd_peaks : null,
            overrideX: raw.overrideX || null,
            overrideMultiY: raw.overrideMultiY && typeof raw.overrideMultiY === "object" ? raw.overrideMultiY : {},
            overrideXTicks: raw.overrideXTicks ?? null,
            overrideYTicks: raw.overrideYTicks && typeof raw.overrideYTicks === "object" ? raw.overrideYTicks : {},
            overrideTernaryTicks: raw.overrideTernaryTicks && typeof raw.overrideTernaryTicks === "object" ? raw.overrideTernaryTicks : {},
            overrideScaleformatX: raw.overrideScaleformatX ?? null,
            overrideScaleformatY: raw.overrideScaleformatY && typeof raw.overrideScaleformatY === "object" ? raw.overrideScaleformatY : {},
            overrideCustomTicksX: raw.overrideCustomTicksX ?? null,
            overrideCustomTicksY: raw.overrideCustomTicksY && typeof raw.overrideCustomTicksY === "object" ? raw.overrideCustomTicksY : {},
            overrideCustomTicksTernary: raw.overrideCustomTicksTernary && typeof raw.overrideCustomTicksTernary === "object" ? raw.overrideCustomTicksTernary : {},
            overrideTernary: raw.overrideTernary && typeof raw.overrideTernary === "object" ? raw.overrideTernary : {},
            minorTickOn: raw.minorTickOn && typeof raw.minorTickOn === "object" ? raw.minorTickOn : {},
            useCustomTicksOn: raw.useCustomTicksOn && typeof raw.useCustomTicksOn === "object" ? raw.useCustomTicksOn : {}
        };
    }
    $('#download').click(async function(e){
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return}     
        $('#transparent-option').show();
        const input = await htmlPrompt( "Enter DPI  (e.g. 150, 300, or 600 etc.)", "600");
        if(input===null)return;
        const dpi=parseFloat(input);
        if(isNaN(dpi)||dpi<=0)return alert("Invalid DPI");
        const transparent = document.getElementById('html-prompt-transparent').checked;
        const scale=dpi/96;
        const svg=document.querySelector("#chart svg");
        if(!svg)return;
        const clone=svg.cloneNode(true);
        clone.querySelectorAll("foreignObject div[contenteditable]").forEach(d=>d.style.border="none");
        clone.querySelectorAll(".outline[visibility='visible']").forEach(e=>e.setAttribute("visibility","hidden"));
        clone.querySelectorAll("text[contenteditable='true']").forEach(t => { t.removeAttribute("contenteditable"); t.style.outline = "none";});
        clone.setAttribute("style",`background:${transparent ? 'transparent' : '#fff'};font-family:Arial,sans-serif;`);
        const data="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(clone));
        const img=new Image();
        img.onload=()=>{
            const c=document.createElement("canvas");
            c.width=img.width*scale; c.height=img.height*scale;
            const ctx=c.getContext("2d");
            if (!transparent) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);}
            ctx.drawImage(img,0,0,c.width,c.height);
            c.toBlob(b=>{
                if (!b) return;
                const a=document.createElement("a");
                const url = URL.createObjectURL(b);
                a.href=url;
                a.download = `chart@${dpi}dpi${transparent ? '_transparent' : ''}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            },"image/png");
        };
        img.src=data;
    })
    $('#save').click(async function(e){  
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return} 
        $('#transparent-option').hide();
        G.utils.clearActive(); const d=new Date(), z=n=>('0'+n).slice(-2), ts=[z(d.getDate()), z(d.getMonth()+1), d.getFullYear()].join('-')+'_'+[z(d.getHours()),z(d.getMinutes()),z(d.getSeconds())].join('-'); 
        const rawHtml = d3.select('#chart').html();
        const tmpl = document.createElement('template');
        tmpl.innerHTML = rawHtml;
        tmpl.content.querySelectorAll('.xrd-user-peak,.xrd-ref-peak').forEach(n => n.remove());
        const cleanedHtml = sanitizeChartHTML(tmpl.innerHTML);
        const payload={v:'v1.0', ts, table:G.state.hot.getData(), settings:G.getSettings(), col:G.state.colEnabled, html:cleanedHtml,
        overrideX:G.state.overrideX||null, overrideMultiY:G.state.overrideMultiY||{}, overrideXTicks:G.state.overrideXTicks||null,
        overrideYTicks:G.state.overrideYTicks||{}, overrideTernaryTicks:G.state.overrideTernaryTicks||{}, 
        overrideScaleformatX:G.state.overrideScaleformatX||null, overrideScaleformatY:G.state.overrideScaleformatY||{},
        overrideCustomTicksX:G.state.overrideCustomTicksX||null, overrideCustomTicksY:G.state.overrideCustomTicksY||{},
        overrideCustomTicksTernary:G.state.overrideCustomTicksTernary||{}, overrideTernary:G.state.overrideTernary||{}, 
        minorTickOn: G.state.minorTickOn || {}, useCustomTicksOn:G.state.useCustomTicksOn||{}};
        const lock = G.matchXRD?.lockInfo;
        const lpeaks = G.matchXRD?.lockedPeaks;
        if (lock?.verified && Array.isArray(lpeaks) && lpeaks.length) {
            payload.xrd_lock_version = lock.lock_version ?? null;
            payload.xrd_account_id = Number(lock.account_id || 0);
            payload.xrd_lock_hash = lock.lock_hash || "";
            payload.xrd_signature = lock.signature || "";
            if (lock.table_hash) payload.xrd_table_hash = lock.table_hash;
            if (lock.peaks_hash) payload.xrd_peaks_hash = lock.peaks_hash;
            payload.xrd_peaks = lpeaks.map(p => ({ x: p.x, intensity: p.intensity }));
        }
        const u=URL.createObjectURL(new Blob([JSON.stringify(payload)])), a=document.createElement('a'), name = await htmlPrompt( "Enter file name", `Project_${ts}`); if(!name) return; a.href=u; a.download=`${name}.instanano`; 
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);})
    G.importState = function(raw){ 
        const s = normalizeImportState(raw);
        if (!s) { alert("Invalid .instanano file."); return; }
        G.state.hot.loadData(s.table); G.state.colEnabled=s.col; G.state.overrideX = s.overrideX; G.state.overrideMultiY = s.overrideMultiY;
        G.state.overrideXTicks= s.overrideXTicks; G.state.overrideYTicks = s.overrideYTicks; G.state.overrideTernaryTicks = s.overrideTernaryTicks;
        G.state.overrideScaleformatX = s.overrideScaleformatX; G.state.overrideScaleformatY = s.overrideScaleformatY;
        G.state.overrideCustomTicksX = s.overrideCustomTicksX; G.state.overrideCustomTicksY = s.overrideCustomTicksY;
        G.state.overrideCustomTicksTernary = s.overrideCustomTicksTernary; G.state.overrideTernary = s.overrideTernary; 
        G.state.minorTickOn = s.minorTickOn || {}; G.state.useCustomTicksOn=s.useCustomTicksOn||{};
        d3.selectAll('input[type="checkbox"][data-col]').each(function(){this.checked=G.state.colEnabled[this.dataset.col]});
        const typeRadio = s.settings.type ? document.getElementById(s.settings.type) : null;
        if (typeRadio) typeRadio.checked = true;
        if (s.settings.mode) { const axisRadio = document.querySelector(`input[name="axistitles"][value="${s.settings.mode}"]`); 
        if (axisRadio) axisRadio.checked = true;}
        G.state.hot.render(); G.axis.resetScales(false); G.renderChart();
        const ratioRadio = s.settings.ratio ? document.querySelector(`[name="aspectratio"][value="${s.settings.ratio}"]`) : null;
        if (ratioRadio) ratioRadio.checked = true;
        const modeRadio = s.settings.mode ? document.querySelector(`[name="axistitles"][value="${s.settings.mode}"]`) : null;
        if (modeRadio) modeRadio.checked = true;
        Object.entries(s.settings).forEach(([k,v]) => {
            if (/^(type|ratio|mode)$/.test(k) || v == null) return;
            const input = document.getElementById(k);
            if (input) input.value = v;
        });
        d3.select('#chart').html(s.html); d3.selectAll('.xrd-user-peak,.xrd-ref-peak').remove(); G.features.prepareShapeLayer(); d3.selectAll('.shape-group').each(function(){G.features.makeShapeInteractive(d3.select(this))});
        d3.selectAll('foreignObject.user-text,g.legend-group,g.axis-title').call(G.utils.applyDrag); G.axis.tickEditing(d3.select('#chart svg'));
        if (G.matchXRD) { G.matchXRD.lockActive = false; G.matchXRD.lockedPeaks = []; G.matchXRD.lockInfo = null; }
        if (s.xrd_lock_hash && s.xrd_signature && Array.isArray(s.xrd_peaks) && s.xrd_account_id > 0 && typeof instananoCredits !== 'undefined') {
            const peaks = s.xrd_peaks.map(p => ({ x: Number(p.x), intensity: Number(p.intensity ?? 0), normInt: 0 }));
            const maxInt = peaks.length ? Math.max(...peaks.map(p => p.intensity)) : 0;
            if (maxInt > 0) peaks.forEach(p => p.normInt = (p.intensity / maxInt) * 100);
            const compute = G.matchXRD?.computeLockHash;
            if (compute) {
                compute(peaks).then(lock => {
                    if (!lock || lock.lock_hash !== s.xrd_lock_hash) {
                        if (!G.matchXRD) return;
                        G.matchXRD.lockActive = false;
                        G.matchXRD.lockedPeaks = [];
                        G.matchXRD.lockInfo = null;
                        G.matchXRD.render();
                        return;
                    }
                    const fd = new FormData();
                    fd.append('action', 'instanano_verify_lock');
                    fd.append('nonce', instananoCredits.nonce);
                    fd.append('lock_hash', s.xrd_lock_hash);
                    fd.append('signature', s.xrd_signature);
                    fd.append('account_id', s.xrd_account_id);
                    if (s.xrd_lock_version != null) fd.append('lock_version', s.xrd_lock_version);
                    fetch(instananoCredits.ajaxUrl, { method: 'POST', body: fd })
                        .then(r => r.json())
                        .then(res => {
                            if (!G.matchXRD) return;
                            if (res?.success && res.data?.valid) {
                                G.matchXRD.lockActive = true;
                                G.matchXRD.lockedPeaks = peaks;
                                G.matchXRD.lockInfo = {
                                    lock_hash: s.xrd_lock_hash,
                                    signature: s.xrd_signature,
                                    lock_version: s.xrd_lock_version ?? null,
                                    account_id: Number(res.data.account_id || s.xrd_account_id || 0),
                                    table_hash: lock.table_hash,
                                    peaks_hash: lock.peaks_hash,
                                    fetch_token: res.data.fetch_token || "",
                                    fetch_token_expires: Number(res.data.fetch_token_expires || 0),
                                    verified: true
                                };
                                G.matchXRD.render();
                            } else {
                                G.matchXRD.lockActive = false;
                                G.matchXRD.lockedPeaks = [];
                                G.matchXRD.lockInfo = null;
                                G.matchXRD.render();
                            }
                        })
                        .catch(() => {
                            if (!G.matchXRD) return;
                            G.matchXRD.lockActive = false;
                            G.matchXRD.lockedPeaks = [];
                            G.matchXRD.lockInfo = null;
                            G.matchXRD.render();
                        });
                }).catch(() => {
                    if (!G.matchXRD) return;
                    G.matchXRD.lockActive = false;
                    G.matchXRD.lockedPeaks = [];
                    G.matchXRD.lockInfo = null;
                    G.matchXRD.render();
                });
            }
        }
    }
})(window.GraphPlotter);
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
