window.GraphPlotter = window.GraphPlotter || {};
window.minorTickOn = {};
window.useCustomTicksOn = {};
window.overrideScaleformatY = {};

(function (G) {
    G.COLORS = ["#FFFF00", "#000000", "#0000FF", "#FF0000", "#008000", "#00FFFF", "#FF00FF", "#FFA500", "#800080", "#A52A2A"];
    G.DIM = { W: 600, H: 300, MT: 30, MB: 60, ML: 70, MR: 80 };
    G.SYMBOL_TYPES = [d3.symbolCircle, d3.symbolTriangle, d3.symbolSquare, d3.symbolDiamond, d3.symbolStar, d3.symbolCross];
    G.ratioPresets = {
        "4:2.85": { linewidth: 1.4, scalewidth: 1.4, axisTitleFs: 13, legendFs: 13, scaleFs: 12, xticks: 6, yticks: 5, multiygap: 35 },
        "16:9.15": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 11, xticks: 6, yticks: 5, multiygap: 35 },
        "2:1.05": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 11, xticks: 6, yticks: 5, multiygap: 35 },
        "3:1.2": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 10, xticks: 7, yticks: 3, multiygap: 35 },
        "4:1.35": { linewidth: 1.2, scalewidth: 1.2, axisTitleFs: 11, legendFs: 11, scaleFs: 10, xticks: 7, yticks: 2, multiygap: 35 }
    };
    G.colEnabled = {};
    G.hot = null;
    G.tickLabelStyles = { x: {}, y: {}, a: {}, b: {}, c: {} };
    G.activeTicks = null;
    G.activeGroup = null;
    G.activeText = null;
    G.activeDiv = null;
    G.activeFo = null;
    G.shapeMode = "none";
    G.drawing = false;
    G.drawStart = null;
    G.tempShape = null;
    G.arrowCount = 0;

    G.getTitles = function (mode) {
        switch (mode) {
            case "uvvis": return { x: "Wavelength (nm)", y: "Absorbance (a.u.)" };
            case "xrd": return { x: "2θ (°)", y: "Intensity (a.u.)" };
            case "ftir": return { x: "Wavenumber (cm<sup>-1</sup>)", y: "Transmittance (%)" };
            case "raman": return { x: "Raman Shift (cm<sup>-1</sup>)", y: "Intensity (a.u.)" };
            case "pl": return { x: "Wavelength (nm)", y: "Intensity (a.u.)" };
            case "xps": return { x: "Binding Energy (eV)", y: "Intensity (cps)" };
            case "tga": return { x: "Temperature (°C)", y: "Weight (%)" };
            case "dsc": return { x: "Temperature (°C)", y: "Heat Flow (mW)" };
            case "bet": return { x: "Relative Pressure (P/P<sub>0</sub>)", y: "Adsorbed Volume (cm<sup>3</sup>·g<sup>-1</sup>)" };
            case "saxs": return { x: "Scattering Vector q (Å<sup>-1</sup>)", y: "Intensity (a.u.)" };
            case "nmr": return { x: "δ (ppm)", y: "Intensity (a.u.)" };
            case "tauc": return { x: "Energy (eV)", y: "(αhν)<sup>n</sup>" };
            case "tensile": return { x: "Strain", y: "Stress" };
            case "ternary": return { a: "A-axis", b: "B-axis", c: "C-axis" };
            default: return { x: "x-axis", y: "y-axis" };
        }
    };
})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.rgbToHex = function (rgb) {
        return "#" + rgb.match(/\d+/g).map(n => (+n).toString(16).padStart(2, "0")).join("");
    };

    G.clearActive = function () {
        if (G.activeGroup) { G.activeGroup.select(".outline").attr("visibility", "hidden"); G.activeGroup = null; }
        if (G.activeText) { G.activeText.attr("contenteditable", false).style("border", null); G.activeText = null; }
        if (G.activeDiv) { G.activeDiv.attr("contenteditable", false).style("border", null).style("cursor", "move"); G.activeDiv = null; }
        if (G.activeTicks) {
            G.activeTicks.attr('contenteditable', false).style('outline', null).style('cursor', 'pointer');
            G.activeTicks = null;
            document.getElementById("axis-label").textContent = "Axis Settings: Select Axis";
            document.getElementById("scalemin").value = "";
            document.getElementById("scalemax").value = "";
            document.getElementById("customticks").value = "";
        }
        G.activeFo = null;
        d3.select("#boldBtn").classed("active", false);
        d3.select("#italicBtn").classed("active", false);
        d3.select("#removebtn").classed("disabled", true);
        window.getSelection().removeAllRanges();
        ['scalemin', 'scalemax', 'tickcount', 'scaleformat', 'customticks', 'useCustomTicks', 'showMinorTicks'].forEach(id => {
            document.getElementById(id).disabled = true;
        });
    };

    G.editableText = function (container, opts) {
        const pad = 2;
        const fo = container.append("foreignObject").attr("x", opts.x).attr("y", opts.y)
            .attr("transform", opts.rotation ? `rotate(${opts.rotation},${opts.x},${opts.y})` : null).attr("overflow", "visible");
        const div = fo.append("xhtml:div").attr("contenteditable", false).style("display", "inline-block").style("white-space", "nowrap")
            .style("padding", `${pad}px`).style("cursor", "move").style("font-size", "12px").html(opts.text);
        const w = div.node().scrollWidth;
        const h = div.node().scrollHeight;
        fo.attr("width", w + pad).attr("height", h + pad);
        div.on("input", () => {
            const nw = div.node().scrollWidth;
            const nh = div.node().scrollHeight;
            fo.attr("width", nw + pad).attr("height", nh + pad);
        }).on("keydown", e => { if (e.key === "Enter") { e.preventDefault(); div.node().blur(); } })
            .on("blur", () => { d3.select(div.node()).style("cursor", "move"); });
        return { fo, div, pad };
    };

    G.updateInspector = function (selection) {
        const node = selection.node();
        const cs = window.getComputedStyle(node);
        const size = parseFloat(selection.attr("stroke-width")) || parseInt(cs.fontSize, 10);
        const col = node.tagName === "DIV" ? cs.color : (cs.stroke !== "none" ? cs.stroke : cs.fill);
        d3.select("#addedtextsize").property("value", size);
        d3.select("#addedtextcolor").property("value", G.rgbToHex(col));
        const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
        d3.select("#fontfamily").property("value", fam);
        d3.select("#boldBtn").classed("active", cs.fontWeight === "700" || cs.fontWeight === "bold");
        d3.select("#italicBtn").classed("active", cs.fontStyle === "italic");
        d3.select("#removebtn").classed("disabled", false);
    };

    function dragStarted(event) {
        G.hot.deselectCell();
        event.sourceEvent.preventDefault();
        G.clearActive();
        const sel = d3.select(this).raise();
        if (sel.classed("shape-group")) {
            G.activateShape(sel);
        } else {
            const fo = sel.node().tagName === "foreignObject" ? sel : sel.select("foreignObject");
            const div = fo.select("div");
            G.activateText(div, fo);
            setTimeout(() => { window.getSelection().selectAllChildren(div.node()); }, 0);
        }
    }

    function dragged(event) {
        const sel = d3.select(this);
        const t = sel.attr("transform") || "";
        const m = t.match(/translate\(([^,]+),([^)]+)\)/) || [];
        const x = +m[1] || 0, y = +m[2] || 0;
        const rot = (/rotate\(([^)]+)\)/.exec(t) || [])[0] || "";
        sel.attr("transform", `translate(${x + event.dx},${y + event.dy})${rot}`);
    }

    function dragEnded() {
        const sel = d3.select(this);
        if (sel.classed("user-text") || sel.classed("axis-title") || sel.classed("legend-group")) {
            const div = sel.select("foreignObject div");
            if (sel.classed("legend-group")) { this.dataset.savedTransform = sel.attr("transform"); }
            div.on("blur", () => { div.attr("contenteditable", false).style("cursor", "move"); });
        }
    }

    G.applyDrag = d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded);

    G.activateShape = function (g) {
        if (G.activeGroup === g) return;
        g.select(".outline").attr("visibility", "visible");
        G.activeGroup = g;
        G.updateInspector(g.select(".shape"));
    };

    G.activateText = function (div, fo) {
        if (G.activeText === div) return;
        div.attr("contenteditable", true).style("border", "1px solid rgb(74,144,226)").node().focus();
        G.activeText = div;
        G.activeFo = fo;
        G.updateInspector(div);
        const el = div.node();
        setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 0);
    };

    G.disableAreaCal = function () {
        const cb = document.getElementById('enableAreaCalc');
        if (cb && cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        }
    };

    G.checkEmptyColumns = function () {
        const data = G.hot.getData();
        const dm = document.querySelector('label[for="icon1"]');
        if (!dm) return;
        const shouldShow = data[0].some((_, c) => G.colEnabled[c] && data.slice(3).every(r => r[c] == null || r[c] === "" || isNaN(+r[c])));
        const existingBadge = dm.querySelector(".warning-badge");
        if (shouldShow) {
            if (!existingBadge) {
                const b = document.createElement("span");
                b.className = "warning-badge";
                b.textContent = "!";
                dm.appendChild(b);
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }
    };

    G.detectModeFromData = function () {
        const series = G.getSeries();
        if (!series || !series.length) return null;
        const xVals = series[0].x.filter(v => Number.isFinite(v));
        if (!xVals.length) return null;
        const minX = Math.min(...xVals), maxX = Math.max(...xVals);
        if (minX >= 180 && minX <= 200 && maxX === 800) return 'uvvis';
        if (minX >= 398 && minX <= 400 && maxX === 4000) return 'ftir';
        if (minX >= 0 && minX <= 10 && maxX >= 80 && maxX <= 90) return 'xrd';
        return null;
    };

})(window.GraphPlotter);
(function (G) {
    const types = new Map();
    G.ChartRegistry = {
        register: function (def) {
            if (!def.id || typeof def.draw !== "function") {
                throw new Error("Invalid chart registration");
            }
            types.set(def.id, def);
        },
        get: function (id) {
            const chart = types.get(id);
            if (!chart) throw new Error(`Unknown chart type: ${id}`);
            return chart;
        }
    };
})(window.GraphPlotter);
(function (G) {
    const COLORS = G.COLORS;

    G.initTable = function () {
        const container = document.getElementById("table");
        G.hot = new myTable(container, {
            data: [["X-axis", "Y-axis"], ["#FFFF00", "#000000"], ["Sample", "Sample"], [10, 223], [20, 132], [30, 532], [40, 242], [50, 300], [70, 100], [100, 250]],
            colHeaders: colIndex => {
                G.colEnabled[colIndex] = G.colEnabled[colIndex] !== false;
                return `<input type="checkbox" data-col="${colIndex}" ${G.colEnabled[colIndex] ? "checked" : ""}>`;
            },
            rowHeaders: rowIndex => ["Axis", "Color", "Name"][rowIndex] || rowIndex - 2,
            rowHeaderWidth: 60,
            colWidths: 70,
            contextMenu: true,
            afterRemoveRow: () => { G.resetScales(true); G.renderChart(); },
            afterRemoveCol: () => { G.resetScales(true); G.renderChart(); },
            afterCreateCol: (start, count) => {
                for (let c = start; c < start + count; c++) {
                    G.hot.setDataAtCell(0, c, "Y-axis");
                    G.hot.setDataAtCell(1, c, COLORS[c % COLORS.length]);
                    G.hot.setDataAtCell(2, c, "Sample");
                }
            },
            cells: (row, col) => {
                const props = {};
                if (row === 0) {
                    props.type = "dropdown";
                    props.source = ["X-axis", "Y-axis", "Z-axis", "Y-error"];
                    props.className = 'tabledropdown';
                }
                if (row === 1) {
                    props.renderer = (inst, td, r, c, prop, val) => {
                        td.innerHTML = "";
                        if (!["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c))) {
                            const inp = document.createElement("input");
                            inp.type = "color";
                            inp.value = val || COLORS[c % COLORS.length];
                            inp.oninput = e => inst.setDataAtCell(r, c, e.target.value);
                            td.appendChild(inp);
                        }
                    };
                }
                if (row === 2) {
                    props.renderer = (inst, td, r, c, prop, val) => {
                        td.innerHTML = ["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c)) ? "" : (val || "Sample");
                    };
                }
                const base = props.renderer || myTable.renderers.TextRenderer;
                props.renderer = function (inst, td, r, c, prop, val) {
                    base.apply(this, arguments);
                    td.style.background = G.colEnabled[c] ? "" : "lightcoral";
                };
                return props;
            }
        });
        G.hot.addHook("afterCreateCol", G.checkEmptyColumns);
        container.addEventListener("change", e => {
            if (e.target.matches('input[type="checkbox"][data-col]')) {
                const col = +e.target.dataset.col;
                G.colEnabled[col] = e.target.checked;
                G.hot.render();
                G.resetScales(false);
                G.renderChart();
                G.checkEmptyColumns();
            }
        });
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.ChartRegistry.register({
        id: "line",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            series.forEach((sv, i) => {
                const yS = scales.y2 ? scales.y2[i] : scales.y;
                const line = d3.line()
                    .defined((_, j) => Number.isFinite(sv.x[j]) && Number.isFinite(sv.y[j]))
                    .x((_, j) => scales.x(sv.x[j]))
                    .y((_, j) => yS(sv.y[j]));
                g.append("path")
                    .datum(sv.y)
                    .attr("fill", "none")
                    .attr("stroke", sv.color)
                    .attr("stroke-width", s.linewidth)
                    .attr("d", line);
            });
        }
    });

    G.ChartRegistry.register({
        id: "stacked",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            const { H, MT, MB } = DIM,
                total = H - MT - MB,
                gaps = series.length + 1,
                gap = (total * 0.1) / gaps,
                band = (total - gap * gaps) / series.length;
            series.forEach((sv, i) => {
                const ymin = d3.min(sv.y),
                    ymax = d3.max(sv.y),
                    start = MT + gap * (i + 1) + band * i,
                    end = start + band,
                    yInner = d3.scaleLinear().domain([ymin, ymax]).range([end, start]),
                    line = d3.line()
                        .defined((_, i) => Number.isFinite(sv.x[i]) && Number.isFinite(sv.y[i]))
                        .x((_, j) => scales.x(sv.x[j]))
                        .y((_, j) => yInner(sv.y[j]));
                g.append("path").datum(sv.y).attr("fill", "none").attr("stroke", sv.color).attr("stroke-width", s.linewidth).attr("d", line);
            });
        }
    });

    G.ChartRegistry.register({
        id: "scatterline",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            G.ChartRegistry.get("line").draw(g, series, scales, s);
            G.ChartRegistry.get("scatter").draw(g, series, scales, s);
        }
    });

})(window.GraphPlotter);
(function (G) {
    const SYMBOL_TYPES = G.SYMBOL_TYPES;

    G.drawErrorBars = function (g, series, scales, s) {
        const bw = s.type === "bar" && scales.x.bandwidth ? scales.x.bandwidth() : 0,
            barW = bw / series.length,
            cap = s.type === "bar" ? barW * 0.2 : s.symbolsize;
        series.forEach((sv, i) => {
            if (!sv.error) return;
            sv.rawX.forEach((xVal, j) => {
                const err = sv.error[j];
                if (!isFinite(err)) return;
                const x0 = s.type === "bar" ? scales.x(xVal) + i * barW + barW / 2 : scales.x(xVal),
                    yHigh = scales.y(sv.y[j] + err),
                    yLow = scales.y(sv.y[j] - err);
                g.append("line").attr("x1", x0).attr("x2", x0).attr("y1", yHigh).attr("y2", yLow).attr("stroke", sv.errorColor).attr("stroke-width", s.linewidth);
                [yHigh, yLow].forEach(y => g.append("line").attr("x1", x0 - cap).attr("x2", x0 + cap).attr("y1", y).attr("y2", y).attr("stroke", sv.errorColor).attr("stroke-width", s.linewidth));
            });
        });
    };

    G.ChartRegistry.register({
        id: "scatter",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            G.drawErrorBars(g, series, scales, s);
            series.forEach((sv, i) => {
                const yS = scales.y2 ? scales.y2[i] : scales.y;
                const sym = d3.symbol()
                    .type(SYMBOL_TYPES[i % SYMBOL_TYPES.length])
                    .size(Math.PI * Math.pow(s.symbolsize, 2));
                g.selectAll()
                    .data(sv.x)
                    .enter()
                    .append("path")
                    .attr("d", sym)
                    .attr("transform", (d, j) => `translate(${scales.x(d)},${yS(sv.y[j])})`)
                    .attr("fill", sv.color);
            });
        }
    });

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.ChartRegistry.register({
        id: "bar",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleBand, y: d3.scaleLinear },
        bandPadding: 0.1,
        draw: (g, series, scales, s) => {
            const bw = scales.x.bandwidth(), barW = bw / series.length;
            series.forEach((sv, i) => {
                g.selectAll()
                    .data(sv.y)
                    .enter()
                    .append("rect")
                    .attr("x", (_, j) => scales.x(sv.rawX[j]) + i * barW)
                    .attr("y", d => scales.y(d))
                    .attr("width", barW)
                    .attr("height", d => scales.y.range()[0] - scales.y(d))
                    .attr("fill", sv.color);
            });
            G.drawErrorBars(g, series, scales, s);
        }
    });

    G.ChartRegistry.register({
        id: "histogram",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        bandPadding: 0.1,
        draw: (g, series, scales, s) => {
            const xDomain = scales.x.domain();
            const [minV, maxV] = xDomain;
            const step = (maxV - minV) / s.bins;
            const thresholds = d3.range(minV, maxV, step);
            let maxCount = 0;
            const allBins = series.map(sv => {
                const filtered = sv.y.filter(v => Number.isFinite(v) && v >= minV && v <= maxV);
                const bins = d3.histogram().domain([minV, maxV]).thresholds(thresholds)(filtered);
                maxCount = Math.max(maxCount, d3.max(bins, d => d.length));
                return bins;
            });
            series.forEach((sv, idx) => {
                const bins = allBins[idx];
                const bandScale = d3.scaleBand().domain(bins.map(d => d.x0)).range([DIM.ML, DIM.W - DIM.MR]).padding(G.ChartRegistry.get(s.type).bandPadding);
                const bw = bandScale.bandwidth();
                g.selectAll("rect.hist-bin-" + idx).data(bins).enter().append("rect").attr("class", "hist-bin-" + idx)
                    .attr("x", d => bandScale(d.x0)).attr("width", bw).attr("y", d => scales.y(d.length))
                    .attr("height", d => (DIM.H - DIM.MB) - scales.y(d.length)).attr("fill", sv.color).attr("fill-opacity", 0.5 + 0.5 / series.length);
            });
        }
    });

})(window.GraphPlotter);
(function (G) {

    G.ChartRegistry.register({
        id: "area",
        dimensions: ["x", "y"],
        scaleBuilders: { x: d3.scaleLinear, y: d3.scaleLinear },
        draw: (g, series, scales, s) => {
            series.forEach((sv, i) => {
                const yS = scales.y2 ? scales.y2[i] : scales.y;
                const area = d3.area()
                    .defined((_, j) => Number.isFinite(sv.x[j]) && Number.isFinite(sv.y[j]))
                    .x((_, j) => scales.x(sv.x[j]))
                    .y0(() => yS.range()[0])
                    .y1((_, j) => yS(sv.y[j]));
                g.append("path")
                    .datum(sv.y)
                    .attr("fill", sv.color)
                    .attr("fill-opacity", s.opacity)
                    .attr("stroke", sv.color)
                    .attr("stroke-width", 0)
                    .attr("d", area);
            });
        }
    });

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;
    const SYMBOL_TYPES = G.SYMBOL_TYPES;

    function drawTernaryAxis(svg, s) {
        const availW = DIM.W - DIM.ML - DIM.MR;
        const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3));
        const triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2;
        const p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side;
        const p3x = p1x + side / 2;
        const p3y = p1y - triH;
        const domA = window.overrideTernary?.a || [0, 100];
        const domB = window.overrideTernary?.b || [0, 100];
        const domC = window.overrideTernary?.c || [0, 100];
        const scaleA = d3.scaleLinear().domain(domA).range([0, side]);
        const scaleB = d3.scaleLinear().domain(domB).range([side, 0]);
        const scaleC = d3.scaleLinear().domain(domC).range([0, side]);
        const customA = window.overrideCustomTicksTernary?.a;
        const customB = window.overrideCustomTicksTernary?.b;
        const customC = window.overrideCustomTicksTernary?.c;
        const countA = customA ? null : (window.overrideTernaryTicks?.a ?? s.xticks);
        const countB = customB ? null : (window.overrideTernaryTicks?.b ?? s.xticks);
        const countC = customC ? null : (window.overrideTernaryTicks?.c ?? s.xticks);
        window.axisScales = { a: scaleA, b: scaleB, c: scaleC };
        const gA = svg.append("g").attr("data-ai", 0).attr("transform", `translate(${p1x},${p1y})`).attr("stroke-width", s.scalewidth).call(d3.axisBottom(scaleA).tickValues(customA).ticks(countA).tickSize(6).tickPadding(4));
        G.applyTickStyles(gA, 'a', 0, s.scaleFs);
        const gB = svg.append("g").attr("data-bi", 0).attr("transform", `translate(${p1x},${p1y}) rotate(210)`).attr("stroke-width", s.scalewidth).call(d3.axisLeft(scaleB).tickValues(customB).ticks(countB).tickSize(-6).tickPadding(15));
        gB.selectAll("text").attr("transform", "rotate(-210)").style("text-anchor", "middle").attr("dy", "0px");
        G.applyTickStyles(gB, 'b', 0, s.scaleFs);
        const gC = svg.append("g").attr("data-ci", 0).attr("transform", `translate(${p2x},${p1y}) rotate(150)`).attr("stroke-width", s.scalewidth).call(d3.axisRight(scaleC).tickValues(customC).ticks(countC).tickSize(-6).tickPadding(15));
        gC.selectAll("text").attr("transform", "rotate(-150)").style("text-anchor", "middle").attr("dy", "0px");
        G.applyTickStyles(gC, 'c', 0, s.scaleFs);
        G.addMinorTicks(gA, scaleA, d3.axisBottom, countA, 4, s.scalewidth, 'currentColor');
        G.addMinorTicks(gB, scaleB, d3.axisLeft, countB, -4, s.scalewidth, 'currentColor');
        G.addMinorTicks(gC, scaleC, d3.axisRight, countC, -4, s.scalewidth, 'currentColor');
    }

    function drawTernaryGridLines(svg, s) {
        const availW = DIM.W - DIM.ML - DIM.MR, availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)), triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2, p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side, p3x = p1x + side / 2, p3y = p1y - triH;
        const ot = window.overrideTernary || {};
        const domains = [ot.a || [0, 100], ot.b || [0, 100], ot.c || [0, 100]];
        const verts = [[p1x, p1y, p2x, p1y, p3x, p3y], [p2x, p1y, p1x, p1y, p3x, p3y], [p3x, p3y, p1x, p1y, p2x, p1y]];
        [d3.scaleLinear().domain(domains[0]).range([0, side]), d3.scaleLinear().domain(domains[1]).range([side, 0]), d3.scaleLinear().domain(domains[2]).range([0, side])].forEach((scale, i) => scale.ticks(s.xticks).forEach(t => {
            if (t <= domains[i][0] || t >= domains[i][1]) return;
            const tt = (t - domains[i][0]) / (domains[i][1] - domains[i][0]);
            const [x0, y0, x1, y1, x2, y2] = verts[i];
            svg.append("line").attr("x1", x0 + (x1 - x0) * tt).attr("y1", y0 + (y1 - y0) * tt)
                .attr("x2", x0 + (x2 - x0) * tt).attr("y2", y0 + (y2 - y0) * tt)
                .attr("stroke", s.gridcolor || "#ccc").attr("stroke-width", s.gridwidth || 1).attr("stroke-dasharray", "2,2");
        }));
    }

    function drawTernaryPlot(g, series, s, opts) {
        drawTernaryAxis(g, s);
        const availW = DIM.W - DIM.ML - DIM.MR;
        const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3));
        const triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2;
        const p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side, p2y = p1y;
        const p3x = p1x + side / 2, p3y = p1y - triH;
        const domA = window.overrideTernary?.a || [0, 100];
        const domB = window.overrideTernary?.b || [0, 100];
        const domC = window.overrideTernary?.c || [0, 100];
        const norm = (v, r) => (v - r[0]) / (r[1] - r[0]);
        series.forEach((sv, idx) => {
            const points = sv.rawX.map((aVal, i) => {
                const aN = norm(aVal, domA), bN = norm(sv.y[i], domB), cN = norm(sv.z[i], domC);
                const sum = aN + bN + cN;
                if (!sum) return null;
                const px = (aN * p2x + bN * p3x + cN * p1x) / sum;
                const py = (aN * p2y + bN * p3y + cN * p1y) / sum;
                return { x: px, y: py, i };
            }).filter(Boolean);
            if (opts.area) {
                g.append("polygon").attr("points", points.map(d => `${d.x},${d.y}`).join(" "))
                    .attr("fill", sv.color).attr("fill-opacity", s.opacity || 1);
            }
            if (opts.line) {
                const lineGen = d3.line().x(d => d.x).y(d => d.y);
                g.append("path").datum(points).attr("fill", "none").attr("stroke", sv.color).attr("stroke-width", s.linewidth).attr("d", lineGen);
            }
            if (opts.symbol) {
                const sym = d3.symbol().type(SYMBOL_TYPES[idx % SYMBOL_TYPES.length]).size(Math.PI * s.symbolsize ** 2);
                points.forEach(d => g.append("path").attr("d", sym).attr("transform", `translate(${d.x},${d.y})`).attr("fill", sv.color));
            }
        });
    }

    G.renderTernaryAxes = function (svg, s, DIM) {
        drawTernaryAxis(svg, s);
        const availW = DIM.W - DIM.ML - DIM.MR;
        const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3));
        const triH = side * Math.sqrt(3) / 2;
        const pA = [DIM.ML + (availW - side) / 2, DIM.MT + (availH - triH) / 2 + triH];
        const pB = [pA[0] + side, pA[1]];
        const pC = [pA[0] + side / 2, pA[1] - triH];
        const ternaryTitles = [
            { text: "A-axis", x: (pB[0] + pC[0]) / 2 + 50, y: (pB[1] + pC[1]) / 2 - 25, rot: 60, cls: "tern-x" },
            { text: "B-axis", x: (pA[0] + pC[0]) / 2 - 50, y: (pA[1] + pC[1]) / 2 - 25, rot: -60, cls: "tern-y" },
            { text: "C-axis", x: (pA[0] + pB[0]) / 2, y: pA[1] + 25, rot: 0, cls: "tern-z" }
        ];
        ternaryTitles.forEach(({ text, x, y, rot, cls }) => {
            const g = svg.append("g").classed(`axis-title ternary ${cls} user-text`, true).attr("transform", `translate(${x},${y}) rotate(${rot})`);
            const { fo, div } = G.editableText(g, { x: 0, y: 0, text, rotation: 0 });
            const pad = 5;
            fo.attr("width", div.node().scrollWidth + pad).attr("x", -(div.node().scrollWidth + pad) / 2);
        });
    };

    G.ChartRegistry.register({
        id: "ternary",
        dimensions: ["x", "y", "z"],
        draw: (g, series, scales, s) => { drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { symbol: true }); }
    });

    G.ChartRegistry.register({
        id: "ternaryline",
        dimensions: ["x", "y", "z"],
        draw: (g, series, scales, s) => { drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { symbol: true, line: true }); }
    });

    G.ChartRegistry.register({
        id: "ternaryarea",
        dimensions: ["x", "y", "z"],
        draw: (g, series, scales, s) => { drawTernaryGridLines(g, s); drawTernaryPlot(g, series, s, { area: true }); }
    });

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.computeDefaults = function (series) {
        if (!series.length) return null;
        const allX = series.flatMap(s => s.x), allY = series.flatMap(s => s.y),
            [minX, maxX] = d3.extent(allX), [minY, maxY] = d3.extent(allY),
            padX = (maxX - minX) * 0.02, padY = (maxY - minY) * 0.06;
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
    };

    G.resetScales = function (full) {
        if (full) {
            window.overrideX = null;
            window.overrideMultiY = {};
            window.overrideXTicks = null;
            window.overrideYTicks = {};
            window.overrideScaleformatX = null;
            window.overrideScaleformatY = {};
            window.overrideCustomTicksX = null;
            window.overrideCustomTicksY = {};
            window.overrideCustomTicksTernary = null;
            window.overrideTernary = null;
            window.overrideTernaryTicks = null;
            window.minorTickOn = {};
            window.useCustomTicksOn = {};
        }
        const defs = G.computeDefaults(G.getSeries());
        if (!defs) return;
        if (full) {
            document.getElementById("scalemin").value = defs.minX;
            document.getElementById("scalemax").value = defs.maxX;
        }
    };

    G.makeScales = function (s, series) {
        if (s.type === "histogram") {
            const allValues = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minV, maxV] = d3.extent(allValues);
            const step = (maxV - minV) / s.bins;
            const thresholds = d3.range(minV, maxV, step);
            const maxCount = d3.max(series.map(sv => d3.max(d3.histogram().domain([minV, maxV]).thresholds(thresholds)(sv.y), d => d.length)));
            const xDomain = window.overrideX || [minV, maxV];
            const yDomain = window.overrideMultiY?.[0] || [0, maxCount * 1.05];
            return {
                xScale: d3.scaleLinear().domain(xDomain).range([DIM.ML, DIM.W - DIM.MR]),
                yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
        }
        if (s.type === "bar") {
            const allX = series.flatMap(sv => sv.rawX);
            const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minY, maxY] = d3.extent(allY);
            const padY = (maxY - minY) * 0.06;
            const yDomain = window.overrideMultiY?.[0] || [minY - padY, maxY + padY];
            return {
                xScale: d3.scaleBand().domain(allX).range([DIM.ML, DIM.W - DIM.MR]).padding(G.ChartRegistry.get("bar").bandPadding),
                yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
        }
        const allX = series.flatMap(sv => sv.x).filter(v => Number.isFinite(v));
        const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
        const [minX, maxX] = d3.extent(allX);
        const [minY, maxY] = d3.extent(allY);
        const padX = (maxX - minX) * 0.02;
        const padY = (maxY - minY) * 0.06;
        let xDom;
        if (window.overrideX) xDom = window.overrideX;
        else if (s.mode === 'ftir' || s.mode === 'nmr') xDom = [maxX + padX, minX - padX];
        else xDom = [minX - padX, maxX + padX];
        const yDom = window.overrideMultiY?.[0] ? window.overrideMultiY[0] : [minY - padY, maxY + padY];
        return {
            xScale: d3.scaleLinear().domain(xDom).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDom).range([DIM.H - DIM.MB, DIM.MT])
        };
    };

    G.computeMultiYScales = function (scales, s, series) {
        if (s.multiyaxis !== 1 || series.length < 2) return;
        const multiYScales = series.map((sv, i) => {
            const [minY, maxY] = d3.extent(sv.y);
            const padY = (maxY - minY) * 0.06;
            const domain = window.overrideMultiY?.[i] ? window.overrideMultiY[i] : [minY - padY, maxY + padY];
            return d3.scaleLinear().domain(domain).range([DIM.H - DIM.MB, DIM.MT]);
        });
        scales.y2 = multiYScales;
        scales.y = multiYScales[0];
        window.multiYScales = multiYScales;
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.applyTickStyles = function (g, axisType, idx, scaleFs, defaultColor) {
        defaultColor = defaultColor || 'currentColor';
        const styles = (G.tickLabelStyles[axisType] || {})[idx] || {};
        g.selectAll('text').classed('tick-label', true)
            .classed(`tick-${axisType}`, true)
            .style('font-size', styles.fontSize || (scaleFs + 'px'))
            .style('fill', styles.color || defaultColor)
            .style('font-family', styles.fontFamily || 'Arial')
            .style('font-weight', styles.fontWeight || 'normal')
            .style('font-style', styles.fontStyle || 'normal')
            .style('cursor', 'default');
    };

    G.makeTickFormat = function (axisKey, idx) {
        idx = idx || 0;
        const FULL = d3.format("");
        const ABBR = d3.format(".2s");
        const SCI = d3.format(".0e");
        let mode = 0;
        if (axisKey === 'x') {
            mode = window.overrideScaleformatX ?? 0;
        } else if (axisKey === 'y') {
            mode = window.overrideScaleformatY?.[idx] ?? 0;
        } else if (axisKey === 'a' || axisKey === 'b' || axisKey === 'c') {
            mode = window.overrideScaleformatTernary?.[axisKey] ?? 0;
        }
        return mode === 1 ? ABBR : mode === 2 ? SCI : FULL;
    };

    G.addMinorTicks = function (axisGroup, scale, axisCtor, count, size, strokeWidth, strokeColor) {
        count = count || 0;
        size = size || 4;
        strokeWidth = strokeWidth || 1;
        strokeColor = strokeColor || 'currentColor';
        if (typeof scale.ticks !== 'function') return;
        let custom = null, key = null, sel;
        if (axisGroup.attr('data-xi') != null) {
            custom = window.overrideCustomTicksX || null;
            sel = window.selectedAxisName === 'X';
            key = 'X';
        } else if (axisGroup.attr('data-yi') != null) {
            const yi = +axisGroup.attr('data-yi');
            custom = (window.overrideCustomTicksY && window.overrideCustomTicksY[yi]) || null;
            sel = window.selectedAxisName === (yi === 0 ? 'Y' : ('Y' + (yi + 1)));
            key = 'Y' + yi;
        } else if (axisGroup.attr('data-ai') != null) {
            custom = window.overrideCustomTicksTernary?.a || null;
            sel = window.selectedAxisName === 'A';
            key = 'A';
        } else if (axisGroup.attr('data-bi') != null) {
            custom = window.overrideCustomTicksTernary?.b || null;
            sel = window.selectedAxisName === 'B';
            key = 'B';
        } else if (axisGroup.attr('data-ci') != null) {
            custom = window.overrideCustomTicksTernary?.c || null;
            sel = window.selectedAxisName === 'C';
            key = 'C';
        }
        if (window.minorTickOn[key] === false) return;
        const useCustom = window.useCustomTicksOn?.[key] === true;
        const domain = scale.domain();
        let minors = [];
        if (useCustom) {
            if (!Array.isArray(custom) || custom.length < 2) return;
            const t = custom.filter(Number.isFinite).sort((a, b) => a - b);
            for (let i = 0; i < t.length - 1; i++) {
                const mid = (t[i] + t[i + 1]) / 2;
                if (mid >= domain[0] && mid <= domain[1]) minors.push(mid);
            }
        } else {
            if (axisCtor === d3.axisBottom) count = window.overrideXTicks ?? window.overrideTernaryTicks?.a ?? count;
            else if (axisCtor === d3.axisLeft) count = window.overrideYTicks?.[0] ?? window.overrideTernaryTicks?.b ?? count;
            else if (axisCtor === d3.axisRight) count = window.overrideTernaryTicks?.c ?? count;
            if (count == null) return;
            const major = scale.ticks(count);
            if (major.length >= 2) {
                const step = major[1] - major[0];
                minors = major.slice(0, -1).map(v => v + step / 2);
                if (major[0] - step / 2 >= domain[0]) minors.unshift(major[0] - step / 2);
                if (major[major.length - 1] + step / 2 <= domain[1]) minors.push(major[major.length - 1] + step / 2);
            }
        }
        if (!minors.length) return;
        minors = minors.filter(v => v >= Math.min(domain[0], domain[1]) && v <= Math.max(domain[0], domain[1]));
        const mg = axisGroup.append('g').call(axisCtor(scale).tickValues(minors).tickSize(size).tickFormat(''));
        mg.select('path.domain').remove();
        mg.selectAll('line').classed('minor-tick', true).attr('stroke-width', strokeWidth).attr('stroke', strokeColor);
    };

    G.axisTitle = function (svg, axes, modeKey, DIM) {
        const pad = 5;
        axes.forEach(axis => {
            let g = svg.select(`g.axis-title-${axis.key}`);
            if (g.empty()) {
                g = svg.append("g")
                    .classed(`axis-title axis-title-${axis.key} user-text`, true)
                    .attr("data-axis-mode", modeKey)
                    .attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "))
                    .call(G.applyDrag);
                const obj = G.editableText(g, { x: 0, y: 0, text: axis.label, rotation: 0 });
                obj.div.html(axis.label);
                obj.fo.attr("width", obj.div.node().scrollWidth + pad).attr("x", -(obj.div.node().scrollWidth + pad) / 2).attr("y", 0);
                obj.div.style("text-align", axis.anchor || "middle");
            } else if (g.attr("data-axis-mode") !== modeKey) {
                const fo = g.select("foreignObject");
                fo.select("div").html(axis.label);
                const w2 = fo.select("div").node().scrollWidth + pad;
                fo.attr("width", w2).attr("x", -w2 / 2).attr("y", 0);
                g.attr("data-axis-mode", modeKey);
            }
            g.attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "));
        });
    };

    G.multiYaxis = function (svg, scales, s, series) {
        const yScale = scales.y;
        if (s.multiyaxis === 1 && ["line", "area", "scatter", "scatterline"].includes(s.type) && series.length > 1) {
            scales.y2 = series.map((sv, i) => {
                if (i === 0) return yScale;
                const [minY, maxY] = d3.extent(sv.y);
                return d3.scaleLinear().domain([minY - (maxY - minY) * 0.06, maxY + (maxY - minY) * 0.06]).range([DIM.H - DIM.MB, DIM.MT]);
            });
            window.multiYScales = scales.y2;
            if (window.overrideMultiY) {
                for (const [key, range] of Object.entries(window.overrideMultiY)) {
                    const idx = +key;
                    if (window.multiYScales[idx]) {
                        window.multiYScales[idx].domain(range);
                    }
                }
            }
            series.slice(1).forEach((sv, i) => {
                const axisIndex = i + 1;
                const customYi = window.overrideCustomTicksY && window.overrideCustomTicksY[axisIndex];
                const countYi = customYi ? null : (window.overrideYTicks && window.overrideYTicks[axisIndex] != null ? window.overrideYTicks[axisIndex] : s.yticks);
                const gYi = svg.append("g").attr("data-yi", axisIndex).attr("transform", `translate(${DIM.W - DIM.MR + i * s.multiygap},0)`).attr("stroke-width", s.scalewidth).call(d3.axisRight(window.multiYScales[axisIndex]).tickValues(customYi).ticks(countYi).tickFormat(G.makeTickFormat('y', axisIndex)));
                gYi.selectAll("path,line").attr("stroke", sv.color);
                G.addMinorTicks(gYi, window.multiYScales[axisIndex], d3.axisRight, countYi, 4, s.scalewidth, sv.color);
                G.applyTickStyles(gYi, "y", axisIndex, s.scaleFs, sv.color);
            });
        }
    };

    G.drawAxis = function (svg, scales, titles, s, series) {
        if (["ternary", "ternaryline", "ternaryarea"].includes(s.type)) {
            svg.selectAll(".axis-title").remove();
            G.renderTernaryAxes(svg, s, DIM);
            return;
        }
        svg.selectAll(".axis-title.ternary").remove();
        const xScale = scales.x, yScale = scales.y;
        const customX = window.overrideCustomTicksX, countX = customX ? null : (window.overrideXTicks ?? s.xticks);
        const customY0 = window.overrideCustomTicksY && window.overrideCustomTicksY[0];
        const countY0 = customY0 ? null : (window.overrideYTicks && window.overrideYTicks[0] != null ? window.overrideYTicks[0] : s.yticks);
        const gX = svg.append("g").attr("data-xi", 0).attr("transform", "translate(0," + (DIM.H - DIM.MB) + ")").attr("stroke-width", s.scalewidth)
            .call(d3.axisBottom(xScale).tickValues(customX).ticks(countX).tickSize(6).tickPadding(4).tickFormat(s.type === "bar" ? null : G.makeTickFormat('x', 0)));
        G.applyTickStyles(gX, 'x', 0, s.scaleFs);
        const gY = svg.append("g").attr("data-yi", 0).attr("transform", "translate(" + DIM.ML + ",0)").attr("stroke-width", s.scalewidth)
            .call(d3.axisLeft(yScale).tickValues(customY0).ticks(countY0).tickSize(6).tickPadding(4).tickFormat(G.makeTickFormat('y', 0)));
        G.applyTickStyles(gY, 'y', 0, s.scaleFs);
        G.addMinorTicks(gX, xScale, d3.axisBottom, s.xticks, 4, s.scalewidth, 'currentColor');
        G.addMinorTicks(gY, yScale, d3.axisLeft, s.yticks, 4, s.scalewidth, 'currentColor');
        svg.append("line").attr("x1", DIM.ML).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.MT).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        svg.append("line").attr("x1", DIM.W - DIM.MR).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.H - DIM.MB).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        G.multiYaxis(svg, scales, s, series);
        G.axisTitle(svg, [
            { key: "x", label: titles.x, pos: [DIM.W / 2, DIM.H - DIM.MB / 1.7], rotation: 0, anchor: "middle" },
            { key: "y", label: titles.y, pos: [DIM.ML - 60, DIM.H / 2], rotation: -90, anchor: "middle" }
        ], s.mode, DIM);
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.tickEditing = function (svg) {
        svg.selectAll("g.tick,path.domain,text.tick-label,line.minor-tick,g.tick line").style("cursor", "pointer").on("click", event => {
            event.stopPropagation();
            G.clearActive();
            if (!(document.querySelector('input[name="charttype"]:checked').id === 'bar' && d3.select(event.currentTarget).classed('tick-x'))) {
                ['scalemin', 'scalemax', 'tickcount', 'scaleformat', 'customticks', 'useCustomTicks', 'showMinorTicks'].forEach(id => document.getElementById(id).disabled = false);
            }
            const tgt = event.currentTarget;
            const axisGrp = tgt.tagName === "path" ? tgt.parentNode : tgt.tagName === "g" ? tgt : tgt.closest("g[data-xi],g[data-yi],g[data-ai],g[data-bi],g[data-ci]");
            if (!axisGrp) return;
            const xi = axisGrp.getAttribute("data-xi"), yi = axisGrp.getAttribute("data-yi"), ai = axisGrp.getAttribute("data-ai"), bi = axisGrp.getAttribute("data-bi"), ci = axisGrp.getAttribute("data-ci");
            let axisTicks, domain, axisName, key;
            if (xi != null) {
                axisName = "X"; key = "X";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-x");
                domain = window.lastXScale.domain();
            } else if (yi != null) {
                axisName = yi === "0" ? "Y" : `Y${+yi + 1}`;
                key = "Y" + (+yi);
                axisTicks = d3.select(axisGrp).selectAll("text.tick-y");
                domain = (window.multiYScales?.[yi] || window.lastYScale).domain();
                window.activeYi = +yi;
            } else if (ai != null) {
                axisName = "A"; key = "A";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-a");
                domain = window.axisScales.a.domain();
            } else if (bi != null) {
                axisName = "B"; key = "B";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-b");
                domain = window.axisScales.b.domain();
            } else if (ci != null) {
                axisName = "C"; key = "C";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-c");
                domain = window.axisScales.c.domain();
            } else return;
            window.selectedAxisName = axisName;
            axisTicks.attr("contenteditable", true).style("outline", "1px solid #4A90E2").style("cursor", "pointer");
            G.activeTicks = axisTicks;
            const el = id => document.getElementById(id);
            const lbl = el("axis-label"), minI = el("scalemin"), maxI = el("scalemax"), tc = el("tickcount"), sf = el("scaleformat"), chk = el("useCustomTicks"), ctk = el("customticks");
            lbl.textContent = "Axis Settings: " + axisName;
            minI.value = domain[0].toFixed(2);
            maxI.value = domain[1].toFixed(2);
            const isABC = ["A", "B", "C"].includes(axisName);
            const isY = axisName.startsWith("Y");
            const overrides = axisName === "X" ? window.overrideCustomTicksX : isABC ? window.overrideCustomTicksTernary?.[axisName.toLowerCase()] : window.overrideCustomTicksY?.[window.activeYi];
            ctk.value = overrides?.join(",") || "";
            tc.value = (axisName === "X" ? window.overrideXTicks : isABC ? window.overrideTernaryTicks?.[axisName.toLowerCase()] : window.overrideYTicks?.[window.activeYi]) || axisTicks.size();
            sf.value = axisName === "X" ? (window.overrideScaleformatX ?? 0) : axisName.startsWith("Y") ? (window.overrideScaleformatY?.[window.activeYi] ?? 0) : (window.overrideScaleformatTernary?.[axisName.toLowerCase()] ?? 0);
            document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][+sf.value];
            const okA = axisName === "X" || isY || isABC;
            chk.disabled = !okA;
            chk.checked = !!(window.useCustomTicksOn && window.useCustomTicksOn[key]);
            sf.disabled = isABC;
            tc.disabled = chk.checked;
            ctk.disabled = !chk.checked;
            const smt = document.getElementById('showMinorTicks');
            smt.disabled = false;
            smt.checked = window.minorTickOn[key] !== false;
        });
    };

    G.bindScaleInputs = function () {
        function bindScaleInput(id, isMin) {
            document.getElementById(id).addEventListener("input", e => {
                const me = parseFloat(e.target.value),
                    other = parseFloat(document.getElementById(id === "scalemin" ? "scalemax" : "scalemin").value);
                if (isNaN(me) || isNaN(other)) return;
                if (window.selectedAxisName === "X") {
                    window.overrideX = isMin ? [me, other] : [other, me];
                } else if (window.selectedAxisName.startsWith("Y")) {
                    const yi = window.activeYi || 0;
                    window.overrideMultiY = window.overrideMultiY || {};
                    window.overrideMultiY[yi] = isMin ? [me, other] : [other, me];
                } else if (["A", "B", "C"].includes(window.selectedAxisName)) {
                    const letter = window.selectedAxisName.toLowerCase();
                    window.overrideTernary = window.overrideTernary || {};
                    window.overrideTernary[letter] = isMin ? [me, other] : [other, me];
                }
                G.renderChart();
            });
        }
        bindScaleInput("scalemin", true);
        bindScaleInput("scalemax", false);

        document.getElementById('tickcount').addEventListener('input', function () {
            const n = +this.value;
            if (window.selectedAxisName === "X") {
                window.overrideXTicks = n;
            } else if (window.selectedAxisName === "Y" || window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi;
                window.overrideYTicks = window.overrideYTicks || {};
                window.overrideYTicks[yi] = n;
            } else if (["A", "B", "C"].includes(window.selectedAxisName)) {
                window.overrideTernaryTicks = window.overrideTernaryTicks || {};
                window.overrideTernaryTicks[window.selectedAxisName.toLowerCase()] = n;
            }
            G.renderChart();
        });

        document.getElementById('scaleformat').addEventListener('input', function () {
            const v = +this.value;
            document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][v];
            if (window.selectedAxisName === "X") {
                window.overrideScaleformatX = v;
            } else if (window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi || 0;
                window.overrideScaleformatY = window.overrideScaleformatY || {};
                window.overrideScaleformatY[yi] = v;
            }
            G.renderChart();
        });

        document.getElementById('customticks').addEventListener('input', function () {
            const txt = this.value.trim();
            const vals = txt ? txt.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v)) : null;
            if (window.selectedAxisName === "X") {
                window.overrideCustomTicksX = vals;
            } else if (window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi || 0;
                window.overrideCustomTicksY = window.overrideCustomTicksY || {};
                if (vals) window.overrideCustomTicksY[yi] = vals;
                else delete window.overrideCustomTicksY[yi];
            } else {
                const cls = Array.from(G.activeTicks.nodes()[0].classList).find(c => c.startsWith('tick-') && !['tick-label', 'tick-x', 'tick-y'].includes(c));
                if (cls) {
                    const letter = cls.split('-')[1];
                    window.overrideCustomTicksTernary = window.overrideCustomTicksTernary || {};
                    if (vals) window.overrideCustomTicksTernary[letter] = vals;
                    else delete window.overrideCustomTicksTernary[letter];
                }
            }
            G.renderChart();
        });

        document.getElementById('useCustomTicks').addEventListener('change', function () {
            const use = this.checked, ct = document.getElementById('customticks'), tc = document.getElementById('tickcount');
            ct.disabled = !use;
            tc.disabled = use;
            const key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName;
            window.useCustomTicksOn = window.useCustomTicksOn || {};
            window.useCustomTicksOn[key] = use;
            const parse = s => s.trim() ? s.split(',').map(v => +v.trim()).filter(Number.isFinite) : [];
            if (use) {
                const vals = parse(ct.value);
                if (key === 'X') { window.overrideCustomTicksX = vals; }
                else if (key.startsWith('Y')) { const yi = window.activeYi || 0; window.overrideCustomTicksY = window.overrideCustomTicksY || {}; window.overrideCustomTicksY[yi] = vals; }
                else { const l = key.toLowerCase(); window.overrideCustomTicksTernary = window.overrideCustomTicksTernary || {}; window.overrideCustomTicksTernary[l] = vals; }
            } else {
                if (key === 'X') { window.overrideCustomTicksX = null; }
                else if (key.startsWith('Y')) { const yi = window.activeYi || 0; window.overrideCustomTicksY && delete window.overrideCustomTicksY[yi]; }
                else { const l = key.toLowerCase(); window.overrideCustomTicksTernary && delete window.overrideCustomTicksTernary[l]; }
            }
            G.renderChart();
        });

        document.getElementById('showMinorTicks').addEventListener('change', function () {
            if (!window.selectedAxisName) return;
            let key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName;
            window.minorTickOn[key] = this.checked;
            G.renderChart();
        });
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;
    const SYMBOL_TYPES = G.SYMBOL_TYPES;

    function drawLegendMarker(g, type, s, d, i, sw) {
        g.selectAll(".legend-marker").remove();
        switch (type) {
            case "scatter":
            case "ternary": {
                const shape = SYMBOL_TYPES[i % SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
                g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color);
                break;
            }
            case "scatterline":
            case "ternaryline": {
                g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);
                const shape = SYMBOL_TYPES[i % SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
                g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color);
                break;
            }
            case "bar":
            case "histogram": {
                g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color);
                break;
            }
            case "area":
            case "ternaryarea": {
                g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color).attr("fill-opacity", s.opacity);
                break;
            }
            default: {
                g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);
            }
        }
    }

    G.drawLegend = function () {
        const svg = d3.select('#chart svg');
        const data = G.hot.getData(), header = data[0], series = G.getSeries(), s = G.getSettings();
        const cols = header.map((v, i) => v === 'Y-axis' && G.colEnabled[i] ? i : -1).filter(i => i >= 0);
        const X = DIM.W - DIM.MR - 100, Y = DIM.MT + 25, S = 20, M = 20;
        const legends = svg.selectAll('g.legend-group').data(cols, d => d);
        legends.exit().remove();
        legends.attr('transform', function (d, idx) { return this.dataset.savedTransform || `translate(${X},${Y + idx * S})`; });
        const legendsEnter = legends.enter().append('g').classed('legend-group', 1).attr('data-col', d => d).attr('transform', (d, idx) => `translate(${X},${Y + idx * S})`).call(G.applyDrag);
        legendsEnter.each(function (d, idx) {
            drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);
            const fo = G.editableText(d3.select(this), { x: M + 5, y: -10, text: data[2][d] });
            fo.fo.attr('width', fo.div.node().scrollWidth + fo.pad);
            const div = fo.div.node();
            div.addEventListener('click', e => { e.stopPropagation(); div.focus(); });
            div.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); div.blur(); } });
            div.addEventListener('blur', function () {
                G.hot.setDataAtCell(2, d, div.textContent.trim(), 'paste');
                G.hot.render();
                d3.select(div).attr('contenteditable', false).style('outline', 'none').style('cursor', 'move');
            });
        });
        legends.select('foreignObject div').text(d => data[2][d]);
        legends.each(function (d, idx) {
            d3.select(this).selectAll('.legend-marker').remove();
            drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);
        });
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.toolTip = function (svg, opts) {
        const tooltip = d3.select('#tooltip');
        svg.on('mousemove', function (event) {
            const [mx, my] = d3.pointer(event, svg.node());
            if (mx < DIM.ML || mx > DIM.W - DIM.MR || my < DIM.MT || my > DIM.H - DIM.MB) return;
            const xVal = opts.xScale.invert(mx).toFixed(4);
            const yVal = opts.yScale.invert(my).toFixed(4);
            tooltip.html("X-Scale:<b> " + xVal + "</b><br>Y-Scale:<b> " + yVal + "</b>");
        });
    };

    G.areacalculation = function () {
        const svg = d3.select("#chart svg");
        if (svg.empty()) return;
        const brush = d3.brushX().extent([[DIM.ML, DIM.MT], [DIM.W - DIM.MR, DIM.H - DIM.MB]]).on("end", brushed),
            brushG = svg.append("g").attr("class", "area-brush").style("display", "none").call(brush);
        d3.select("#enableAreaCalc").on("change", function () {
            if (this.checked) brushG.style("display", null);
            else {
                brushG.style("display", "none").call(brush.move, null);
                svg.selectAll(".area-highlight").remove();
                d3.select("#areaResults").html("");
            }
        });
        function brushed({ selection }) {
            svg.selectAll(".area-highlight").remove();
            if (!selection) { d3.select("#areaResults").html(""); return; }
            const [x0px, x1px] = selection,
                v0 = window.lastXScale.invert(x0px), v1 = window.lastXScale.invert(x1px),
                xMin = Math.min(v0, v1), xMax = Math.max(v0, v1),
                mode = document.querySelector('input[name="axistitles"]:checked').value,
                baseVal = mode === "ftir" ? 100 : (window.lastYScale.domain()[0] <= 0 && 0 <= window.lastYScale.domain()[1] ? 0 : window.lastYScale.domain()[0]),
                y0px = window.lastYScale(baseVal);
            let html = "";
            G.getSeries().forEach(sv => {
                const pts = sv.x.map((x, i) => ({ x, y: sv.y[i] })).filter(p => p.x >= xMin && p.x <= xMax);
                if (pts.length < 2) return;
                let area = 0;
                for (let i = 0; i < pts.length - 1; i++) {
                    const dx = pts[i + 1].x - pts[i].x,
                        avg = mode === "ftir" ? baseVal - (pts[i].y + pts[i + 1].y) / 2 : (pts[i].y + pts[i + 1].y) / 2;
                    area += dx * avg;
                }
                svg.append("path").datum(pts).attr("class", "area-highlight").attr("d", d3.area().x(d => window.lastXScale(d.x)).y0(() => y0px).y1(d => window.lastYScale(d.y))).attr("fill", sv.color).attr("fill-opacity", mode === "ftir" ? 0.1 : 0.2).lower();
                html += `<div style="color:${sv.color};">${sv.label}: Area = <b>${area.toFixed(4)}</b></div>`;
            });
            d3.select("#areaResults").html(html || "<em>No data in selected range.</em>");
        }
    };

})(window.GraphPlotter);
(function (G) {

    G.updateTickStyle = function (a, b) {
        if (!G.activeTicks) return;
        var c = a == 'color' ? 'fill' : a == 'fontSize' ? 'font-size' : a == 'fontFamily' ? 'font-family' : a == 'fontWeight' ? 'font-weight' : a == 'fontStyle' ? 'font-style' : a,
            d = (G.activeTicks.attr('class') || '').split(/\s+/).find(e => e.startsWith('tick-') && e !== 'tick-label');
        if (!d) return;
        var t = d.slice(5), i = t == 'y' ? window.activeYi || 0 : 0;
        G.tickLabelStyles[t] = G.tickLabelStyles[t] || {};
        G.tickLabelStyles[t][i] = G.tickLabelStyles[t][i] || {};
        G.tickLabelStyles[t][i][a] = b;
        G.activeTicks.style(c, b);
    };

    G.bindInspectorControls = function () {
        d3.select("#addedtextcolor").on('input', function () {
            const v = this.value;
            const txt = G.activeText || G.activeDiv;
            if (txt) txt.style('color', v);
            if (G.activeTicks) { G.updateTickStyle('color', v); }
            if (G.activeGroup) {
                const sh = G.activeGroup.select('.shape');
                const tag = sh.node().tagName.toLowerCase();
                if ((tag === 'rect' || tag === 'ellipse') && sh.attr('fill') !== 'none') {
                    sh.attr('fill', v).attr('stroke', v);
                } else {
                    sh.attr('stroke', v);
                }
                G.updateArrowMarkerColor(sh, v);
            }
        });

        d3.select("#addedtextsize").on('input', e => {
            const v = e.target.value + 'px';
            G.updateTickStyle('fontSize', v);
            if (G.activeText || G.activeDiv) {
                const txt = G.activeText || G.activeDiv;
                txt.style('font-size', v);
                if (G.activeFo) G.activeFo.attr('width', txt.node().scrollWidth + 5);
            }
            if (!G.activeGroup) return;
            const s = +e.target.value, b = 5 + s / 2, sh = G.activeGroup.select('.shape'),
                ol = G.activeGroup.select('.outline'), hit = G.activeGroup.select('.hit');
            sh.attr('stroke-width', s);
            hit.attr('stroke-width', sh.node().tagName == 'rect' ? 2 * b : s + 2 * b);
            if (sh.node().tagName == 'rect') {
                const o = G.bufferOutline(sh, b);
                ol.attr('x', o.x).attr('y', o.y).attr('width', o.w).attr('height', o.h);
            } else {
                const pts = G.bufferOutline(sh, b);
                ol.attr('points', pts.join(' '));
            }
        });

        d3.select("#fontfamily").on('change', e => {
            const v = e.target.value;
            G.updateTickStyle('fontFamily', v);
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-family', v);
            if (G.activeFo) {
                const fo = G.activeFo, div = fo.select('div').node();
                fo.attr('width', div.scrollWidth + 5);
            }
        });

        d3.select("#boldBtn").on('click', () => {
            const now = !d3.select("#boldBtn").classed('active');
            d3.select("#boldBtn").classed('active', now);
            G.updateTickStyle('fontWeight', now ? 'bold' : 'normal');
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-weight', now ? 'bold' : 'normal');
        });

        d3.select("#italicBtn").on('click', () => {
            const now = !d3.select("#italicBtn").classed('active');
            d3.select("#italicBtn").classed('active', now);
            G.updateTickStyle('fontStyle', now ? 'italic' : 'normal');
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-style', now ? 'italic' : 'normal');
        });

        d3.select("#removebtn").on("click", () => {
            if (G.activeGroup) {
                G.activeGroup.style("display", "none");
                G.activeGroup = null;
            } else if (G.activeFo) {
                const parentG = G.activeFo.node().parentNode;
                if (parentG.classList.contains("legend-group")) {
                    d3.select(parentG).style("display", "none");
                } else {
                    d3.select(G.activeFo.node()).style("display", "none");
                }
            }
            G.activeFo = G.activeDiv = null;
            d3.select("#removebtn").classed("disabled", true);
        });
    };

    function getActiveEditableDiv() {
        if (typeof G.activeText !== 'undefined' && G.activeText) return G.activeText.node ? G.activeText.node() : G.activeText;
        if (typeof G.activeDiv !== 'undefined' && G.activeDiv) return G.activeDiv.node ? G.activeDiv.node() : G.activeDiv;
        const sel = window.getSelection && window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        let node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode && sel.anchorNode.parentElement;
        if (!node) return null;
        const editable = node.closest && node.closest('foreignObject > div[contenteditable]');
        return editable || null;
    }

    function resizeFO(ed) {
        const fo = ed && ed.parentNode;
        if (fo && fo.tagName && fo.tagName.toLowerCase() === 'foreignobject') {
            fo.setAttribute('width', ed.scrollWidth + 5);
            fo.setAttribute('height', ed.scrollHeight + 5);
        }
    }

    G.applySupSub = function (which) {
        const ed = getActiveEditableDiv();
        if (!ed) return;
        ed.focus();
        const isSup = document.queryCommandState('superscript');
        const isSub = document.queryCommandState('subscript');
        if (which === 'sup') {
            if (isSup) { document.execCommand('superscript', false, null); }
            else {
                if (isSub) document.execCommand('subscript', false, null);
                document.execCommand('superscript', false, null);
            }
        } else {
            if (isSub) { document.execCommand('subscript', false, null); }
            else {
                if (isSup) document.execCommand('superscript', false, null);
                document.execCommand('subscript', false, null);
            }
        }
        resizeFO(ed);
        G.setActiveButtons();
    };

    G.setActiveButtons = function () {
        const ed = getActiveEditableDiv();
        const supOn = ed ? document.queryCommandState('superscript') : false;
        const subOn = ed ? document.queryCommandState('subscript') : false;
        const supBtn = document.getElementById('supBtn');
        const subBtn = document.getElementById('subBtn');
        if (supOn) { supBtn.classList.add('active'); subBtn.classList.remove('active'); }
        else if (subOn) { subBtn.classList.add('active'); supBtn.classList.remove('active'); }
        else { supBtn.classList.remove('active'); subBtn.classList.remove('active'); }
    };

    G.bindSupSubControls = function () {
        document.getElementById('supBtn').addEventListener('mousedown', e => { e.preventDefault(); G.applySupSub('sup'); });
        document.getElementById('subBtn').addEventListener('mousedown', e => { e.preventDefault(); G.applySupSub('sub'); });
        document.addEventListener('selectionchange', G.setActiveButtons);
        document.addEventListener('mouseup', G.setActiveButtons);
        document.addEventListener('keyup', G.setActiveButtons);
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.bufferOutline = function (sh, b) {
        const tag = sh.node().tagName;
        if (tag === "rect") {
            const x = +sh.attr("x") - b, y = +sh.attr("y") - b, w = +sh.attr("width") + 2 * b, h = +sh.attr("height") + 2 * b;
            return { x, y, w, h };
        } else if (tag === "ellipse") {
            const cx = +sh.attr("cx"), cy = +sh.attr("cy"), rx = +sh.attr("rx"), ry = +sh.attr("ry");
            return { cx, cy, rx: rx + b, ry: ry + b };
        } else {
            const x1 = +sh.attr("x1"), y1 = +sh.attr("y1"), x2 = +sh.attr("x2"), y2 = +sh.attr("y2"),
                dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), px = -dy / L, py = dx / L;
            return [[x1 + px * b, y1 + py * b], [x2 + px * b, y2 + py * b], [x2 - px * b, y2 - py * b], [x1 - px * b, y1 - py * b]];
        }
    };

    G.createArrowMarker = function (svg, color) {
        let id = `arrowhead-${++G.arrowCount}`, defs = svg.select("defs");
        if (defs.empty()) defs = svg.append("defs");
        let marker = defs.append("marker").attr("id", id).attr("viewBox", "0 -5 10 10").attr("refX", 1)
            .attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto");
        marker.append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", color);
        return id;
    };

    G.updateArrowMarkerColor = function (sh, color) {
        let markerUrl = sh.attr("marker-end");
        if (markerUrl && markerUrl.startsWith("url(#arrowhead-")) {
            let id = markerUrl.slice(5, -1);
            d3.select(`#${id} path`).attr("fill", color);
        }
    };

    G.makeShapeInteractive = function (g) {
        g.select(".hit").style("cursor", "move").on("click", e => {
            G.hot.deselectCell();
            e.stopPropagation();
            G.activateShape(d3.select(g.node()));
        });
        g.call(G.applyDrag);
    };

    G.prepareShapeLayer = function () {
        const svg = d3.select("#chart svg");
        svg.on("click.shapeBackground", e => { if (e.target === svg.node()) G.clearActive(); });
        svg.on("mousedown.draw", function (e) {
            if (G.shapeMode === "none") return;
            e.preventDefault();
            G.drawing = true;
            const [mx, my] = d3.pointer(e, svg.node()),
                col = (G.shapeMode === "fillRect" || G.shapeMode === "fillEllipse") ? "#96d35f" : "#000000",
                fs = 1, mode = G.shapeMode,
                isRect = /rect/i.test(mode), isLine = /line|arrow/i.test(mode),
                isArrow = /arrow/i.test(mode), isDashed = /dashed/i.test(mode),
                isFill = mode === "fillRect" || mode === "fillEllipse",
                isEllipse = /ellipse/i.test(mode);
            if (isLine) {
                G.tempShape = svg.append("line").attr("x1", mx).attr("y1", my).attr("x2", mx).attr("y2", my)
                    .attr("stroke", col).attr("stroke-width", fs).attr("fill", "none");
                if (isArrow) G.tempShape.attr("marker-end", `url(#${G.createArrowMarker(svg, col)})`);
                if (isDashed) G.tempShape.attr("stroke-dasharray", "7,5");
            } else if (isRect) {
                G.tempShape = svg.append("rect").attr("x", mx).attr("y", my).attr("width", 0).attr("height", 0);
                if (isFill) G.tempShape.attr("stroke", col).attr("stroke-width", 0.5).attr("fill", col).attr("fill-opacity", 0.2);
                else { G.tempShape.attr("stroke", col).attr("stroke-width", fs).attr("fill", "none"); if (isDashed) G.tempShape.attr("stroke-dasharray", "7,5"); }
            } else if (isEllipse) {
                G.tempShape = svg.append("ellipse").attr("cx", mx).attr("cy", my).attr("rx", 0).attr("ry", 0);
                if (isFill) G.tempShape.attr("stroke", col).attr("stroke-width", 0.5).attr("fill", col).attr("fill-opacity", 0.2);
                else { G.tempShape.attr("stroke", col).attr("stroke-width", fs).attr("fill", "none"); if (isDashed) G.tempShape.attr("stroke-dasharray", "7,5"); }
            }
            G.drawStart = { x: mx, y: my };
        });
        svg.on("mousemove.draw", function (e) {
            if (!G.drawing || !G.tempShape) return;
            const [mx, my] = d3.pointer(e, svg.node()), tag = G.tempShape.node().tagName;
            if (tag === "rect") {
                const x0 = G.drawStart.x, y0 = G.drawStart.y, w = mx - x0, h = my - y0;
                G.tempShape.attr("x", w < 0 ? mx : x0).attr("y", h < 0 ? my : y0).attr("width", Math.abs(w)).attr("height", Math.abs(h));
            } else if (tag === "ellipse") {
                const dx = mx - G.drawStart.x, dy = my - G.drawStart.y,
                    rx = Math.abs(dx) / 2, ry = Math.abs(dy) / 2,
                    cx = G.drawStart.x + (dx < 0 ? -rx : rx), cy = G.drawStart.y + (dy < 0 ? -ry : ry);
                G.tempShape.attr("cx", cx).attr("cy", cy).attr("rx", rx).attr("ry", ry);
            } else G.tempShape.attr("x2", mx).attr("y2", my);
        });
        svg.on("mouseup.draw mouseleave.draw", function () {
            if (!G.drawing || !G.tempShape) return;
            G.drawing = false;
            const tag = G.tempShape.node().tagName, strokeCol = G.tempShape.attr("stroke"),
                baseStroke = +G.tempShape.attr("stroke-width") || 1,
                bbox = G.tempShape.node().getBBox(),
                tooSmall = (bbox.width < 5 && bbox.height < 5) || (tag === "line" && Math.hypot(bbox.width, bbox.height) < 5);
            if (tooSmall) { G.tempShape.remove(); G.tempShape = null; }
            else {
                G.tempShape.remove();
                const g = svg.append("g").classed("shape-group", true), buffer = 5;
                if (tag === "line") {
                    const a = { x1: +G.tempShape.attr("x1"), y1: +G.tempShape.attr("y1"), x2: +G.tempShape.attr("x2"), y2: +G.tempShape.attr("y2") };
                    g.append("line").classed("hit", 1).attr("x1", a.x1).attr("y1", a.y1).attr("x2", a.x2).attr("y2", a.y2)
                        .attr("stroke", "transparent").attr("stroke-width", baseStroke + 2 * buffer).attr("fill", "none");
                    let shapeLine = g.append("line").classed("shape", 1).attr("x1", a.x1).attr("y1", a.y1).attr("x2", a.x2).attr("y2", a.y2)
                        .attr("stroke", strokeCol).attr("stroke-width", baseStroke).attr("fill", "none").attr("pointer-events", "none");
                    if (G.tempShape.attr("marker-end")) shapeLine.attr("marker-end", G.tempShape.attr("marker-end"));
                    if (G.tempShape.attr("stroke-dasharray")) shapeLine.attr("stroke-dasharray", G.tempShape.attr("stroke-dasharray"));
                    const pts = G.bufferOutline(shapeLine, buffer + baseStroke / 2);
                    g.append("polygon").classed("outline", 1).attr("points", pts.join(" ")).attr("stroke", "rgb(74,144,226)")
                        .attr("stroke-width", 1).attr("fill", "none").attr("pointer-events", "none").attr("visibility", "hidden");
                } else if (tag === "rect") {
                    const a = { x: +G.tempShape.attr("x"), y: +G.tempShape.attr("y"), width: +G.tempShape.attr("width"), height: +G.tempShape.attr("height") };
                    g.append("rect").classed("hit", 1).attr("x", a.x).attr("y", a.y).attr("width", a.width).attr("height", a.height)
                        .attr("stroke", "transparent").attr("stroke-width", G.shapeMode === "fillRect" ? 2 * buffer : baseStroke + 2 * buffer).attr("fill", "none");
                    let shapeRect;
                    if (G.shapeMode === "fillRect") shapeRect = g.append("rect").classed("shape", 1).attr("x", a.x).attr("y", a.y)
                        .attr("width", a.width).attr("height", a.height).attr("stroke", strokeCol).attr("stroke-width", 0.5)
                        .attr("fill", strokeCol).attr("fill-opacity", 0.2);
                    else {
                        shapeRect = g.append("rect").classed("shape", 1).attr("x", a.x).attr("y", a.y)
                            .attr("width", a.width).attr("height", a.height).attr("stroke", strokeCol).attr("stroke-width", baseStroke).attr("fill", "none");
                        if (G.tempShape.attr("stroke-dasharray")) shapeRect.attr("stroke-dasharray", G.tempShape.attr("stroke-dasharray"));
                    }
                    const o = G.bufferOutline(shapeRect, buffer);
                    g.append("rect").classed("outline", 1).attr("x", o.x).attr("y", o.y).attr("width", o.w).attr("height", o.h)
                        .attr("stroke", "rgb(74,144,226)").attr("stroke-width", 1).attr("fill", "none").attr("pointer-events", "none").attr("visibility", "hidden");
                } else if (tag === "ellipse") {
                    const cx = +G.tempShape.attr("cx"), cy = +G.tempShape.attr("cy"), rx = +G.tempShape.attr("rx"), ry = +G.tempShape.attr("ry");
                    g.append("ellipse").classed("hit", 1).attr("cx", cx).attr("cy", cy).attr("rx", rx).attr("ry", ry)
                        .attr("stroke", "transparent").attr("stroke-width", G.shapeMode === "fillEllipse" ? 2 * buffer : baseStroke + 2 * buffer).attr("fill", "none");
                    let shapeEllipse;
                    if (G.shapeMode === "fillEllipse") shapeEllipse = g.append("ellipse").classed("shape", 1)
                        .attr("cx", cx).attr("cy", cy).attr("rx", rx).attr("ry", ry).attr("stroke", strokeCol).attr("stroke-width", 0.5)
                        .attr("fill", strokeCol).attr("fill-opacity", 0.2);
                    else {
                        shapeEllipse = g.append("ellipse").classed("shape", 1)
                            .attr("cx", cx).attr("cy", cy).attr("rx", rx).attr("ry", ry).attr("stroke", strokeCol).attr("stroke-width", baseStroke).attr("fill", "none");
                        if (G.tempShape.attr("stroke-dasharray")) shapeEllipse.attr("stroke-dasharray", G.tempShape.attr("stroke-dasharray"));
                    }
                    g.append("ellipse").classed("outline", 1).attr("cx", cx).attr("cy", cy)
                        .attr("rx", rx + buffer).attr("ry", ry + buffer).attr("stroke", "rgb(74,144,226)")
                        .attr("stroke-width", 1).attr("fill", "none").attr("pointer-events", "none").attr("visibility", "hidden");
                }
                G.makeShapeInteractive(g);
                setTimeout(() => G.activateShape(g), 0);
                G.tempShape = null;
            }
            d3.selectAll('input[name="shape"]').property('checked', false);
            G.shapeMode = "none";
        });
    };

    G.bindShapeControls = function () {
        d3.select("#addtext").on("click", function () {
            G.disableAreaCal();
            const svg = d3.select("#chart svg");
            if (svg.empty()) return;
            const { fo, div } = G.editableText(svg, { x: DIM.W / 2 - DIM.MT, y: DIM.H / 2 - DIM.MR, text: "Text", rotation: 0 });
            fo.classed("user-text", 1).call(G.applyDrag);
            G.clearActive();
            G.activateText(div, fo);
        });
        d3.selectAll('input[name="shape"]').on("change", function () {
            G.disableAreaCal();
            G.shapeMode = this.value;
            G.clearActive();
        });
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;

    G.bindZoom = function () {
        $('#zoomBtn').click(function () {
            const btn = $(this);
            if (btn.hasClass('active')) { d3.select(".zoom-brush").remove(); btn.removeClass('active'); return; }
            btn.addClass('active');
            const ac = document.getElementById('enableAreaCalc');
            if (ac.checked) { ac.checked = false; ac.dispatchEvent(new Event('change')); }
            const svg = d3.select("#chart svg");
            if (svg.empty()) return;
            svg.append("g").attr("class", "zoom-brush").style("cursor", "crosshair")
                .call(d3.brush().extent([[DIM.ML, DIM.MT], [DIM.W - DIM.MR, DIM.H - DIM.MB]])
                    .on("end", ({ selection }) => {
                        svg.select(".zoom-brush").remove();
                        btn.removeClass('active');
                        if (!selection) return;
                        const [[x0, y0], [x1, y1]] = selection;
                        const v0 = window.lastXScale.invert(x0);
                        const v1 = window.lastXScale.invert(x1);
                        const domain = window.lastXScale.domain();
                        const isReversed = domain[0] > domain[1];
                        const x = isReversed ? [Math.max(v0, v1), Math.min(v0, v1)] : [Math.min(v0, v1), Math.max(v0, v1)];
                        const y = [window.lastYScale.invert(y0), window.lastYScale.invert(y1)].sort((a, b) => a - b);
                        window.overrideX = x;
                        window.overrideMultiY = window.overrideMultiY || {};
                        window.overrideMultiY[0] = y;
                        document.getElementById('scalemin').value = x[0].toFixed(2);
                        document.getElementById('scalemax').value = x[1].toFixed(2);
                        G.renderChart();
                    }));
        });
        d3.select("#chart").on("dblclick", () => { G.resetScales(true); G.renderChart(); });
    };

})(window.GraphPlotter);
(function (G) {
    const COLORS = G.COLORS;

    G.movingAverage = function (a, w) {
        const h = Math.floor(w / 2), m = [];
        for (let i = 0; i < a.length; i++) {
            let s = 0, c = 0;
            for (let j = i - h; j <= i + h; j++) {
                if (j >= 0 && j < a.length && isFinite(a[j])) { s += a[j]; c++; }
            }
            m[i] = c ? s / c : NaN;
        }
        return m;
    };

    G.rollingBaseline = function (a, w) {
        const h = Math.floor(w / 2), e = [], b = [];
        for (let i = 0; i < a.length; i++) {
            let m = Infinity;
            for (let j = i - h; j <= i + h; j++) {
                if (j >= 0 && j < a.length && isFinite(a[j])) { m = Math.min(m, a[j]); }
            }
            e[i] = m === Infinity ? NaN : m;
        }
        for (let i = 0; i < e.length; i++) {
            let M = -Infinity;
            for (let j = i - h; j <= i + h; j++) {
                if (j >= 0 && j < e.length && isFinite(e[j])) { M = Math.max(M, e[j]); }
            }
            b[i] = M === -Infinity ? NaN : M;
        }
        return b;
    };

    G.processData = function (suffix, fn, w) {
        const tbl = G.hot.getData(), hdr = tbl[0], rows = tbl.slice(3), baseNames = tbl[2].slice();
        hdr.forEach((h, i) => {
            if (h === "Y-axis" && G.colEnabled[i]) {
                if (suffix === "corrected" && baseNames[i].includes("(baseline)")) { return; }
                const raw = rows.map(r => parseFloat(r[i]) || NaN),
                    out = fn(raw, w),
                    newIdx = tbl[1].length;
                hdr.push("Y-axis");
                tbl[1].push(COLORS[newIdx % COLORS.length]);
                tbl[2].push(`${baseNames[i]} (${suffix})`);
                rows.forEach((r, j) => r.push(out[j]));
            }
        });
        G.hot.loadData(tbl);
        G.resetScales(true);
        G.renderChart();
    };

    G.previewSeries = function (fn, w, cssClass) {
        const svg = d3.select("#chart svg");
        svg.selectAll(`g.${cssClass}`).remove();
        if (w <= 0) return;
        const opts = G.getSettings();
        const isFTIR = opts.mode === "ftir" && cssClass === "baseline-preview";
        const data = G.getSeries().map(sv => {
            let yVals;
            if (isFTIR) {
                const inv = sv.y.map(v => -v);
                const baseInv = G.rollingBaseline(inv, w);
                yVals = baseInv.map(b => -b);
            } else {
                yVals = fn(sv.y, w);
            }
            return { rawX: sv.rawX, x: sv.x, y: yVals, color: sv.color };
        });
        const chartDef = G.ChartRegistry.get(opts.type);
        const g = svg.append("g").classed(cssClass, true).attr("clip-path", "url(#clip)");
        chartDef.draw(g, data, { x: window.lastXScale, y: window.lastYScale }, opts);
        g.selectAll("path").attr("stroke", "gray").attr("stroke-width", opts.linewidth);
    };

    G.bindSmoothingControls = function () {
        ['smoothing', 'baseline'].forEach(type => document.getElementById(type + 'slider').addEventListener('input', e => {
            if (type === 'smoothing') G.renderChart();
            G.previewSeries(type === 'smoothing' ? G.movingAverage : G.rollingBaseline, +e.target.value, `${type}-preview`);
        }));
        document.getElementById("applysmoothing").onclick = () => {
            const w = +document.getElementById("smoothingslider").value;
            if (w > 0) {
                G.processData("smoothed", G.movingAverage, w);
                document.getElementById("smoothingslider").value = 0;
            }
        };
        document.getElementById("applybaseline").onclick = () => {
            const w = +document.getElementById("baselineslider").value;
            if (w <= 0) return;
            const s = G.getSettings();
            if (s.mode === "ftir") {
                G.processData("baseline", (signal, win) => {
                    const inv = signal.map(v => -v);
                    const bInv = G.rollingBaseline(inv, win);
                    return bInv.map(b => -b);
                }, w);
                G.processData("corrected", (signal, win) => {
                    const inv = signal.map(v => -v);
                    const bInv = G.rollingBaseline(inv, win);
                    const rawEnv = bInv.map(b => -b);
                    return signal.map((v, i) => isFinite(v) && isFinite(rawEnv[i]) ? (v / rawEnv[i]) * 100 : NaN);
                }, w);
            } else {
                G.processData("baseline", G.rollingBaseline, w);
                G.processData("corrected", (signal, win) => {
                    const env = G.rollingBaseline(signal, win);
                    return signal.map((v, i) => isFinite(v) && isFinite(env[i]) ? v - env[i] : NaN);
                }, w);
            }
            document.getElementById("baselineslider").value = 0;
        };
    };

})(window.GraphPlotter);
(function (G) {
    const COLORS = G.COLORS;
    const DIM = G.DIM;

    function linearFit(xs, ys) {
        const X = [], Y = [];
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) { X.push(x); Y.push(y); }
        }
        const n = X.length;
        if (n < 2) return null;
        let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
        for (let i = 0; i < n; i++) {
            const x = X[i], y = Y[i];
            sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
        }
        const den = n * sxx - sx * sx;
        if (den === 0) return null;
        const m = (n * sxy - sx * sy) / den, b = (sy - m * sx) / n, yb = sy / n;
        let st = 0, sr = 0;
        for (let i = 0; i < n; i++) {
            const yt = Y[i], yf = m * X[i] + b;
            st += (yt - yb) * (yt - yb);
            sr += (yt - yf) * (yt - yf);
        }
        const r2 = st > 0 ? 1 - sr / st : 1;
        return { m, b, r2 };
    }

    function solve3(a, b) {
        let A = a.map(r => r.slice()), B = b.slice();
        for (let i = 0; i < 3; i++) {
            let p = i;
            for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
            [A[i], A[p]] = [A[p], A[i]];
            [B[i], B[p]] = [B[p], B[i]];
            const pv = A[i][i];
            if (pv === 0) return null;
            for (let j = i; j < 3; j++) A[i][j] /= pv;
            B[i] /= pv;
            for (let r = 0; r < 3; r++) if (r !== i) {
                const f = A[r][i];
                for (let j = i; j < 3; j++) A[r][j] -= f * A[i][j];
                B[r] -= f * B[i];
            }
        }
        return B;
    }

    function quadraticFit(xs, ys) {
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0, c = 0;
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const x2 = x * x, x3 = x2 * x, x4 = x3 * x;
                s0 += 1; s1 += x; s2 += x2; s3 += x3; s4 += x4; t0 += y; t1 += x * y; t2 += x2 * y; c++;
            }
        }
        if (c < 3) return null;
        const sol = solve3([[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]], [t2, t1, t0]);
        if (!sol) return null;
        const [a, b, c0] = sol;
        let yb = t0 / s0, st = 0, sr = 0;
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const yf = a * x * x + b * x + c0;
                st += (y - yb) * (y - yb);
                sr += (y - yf) * (y - yf);
            }
        }
        const r2 = st > 0 ? 1 - sr / st : 1;
        return { a, b, c: c0, r2 };
    }

    G.bindFittingControls = function () {
        document.getElementById('applyfit').onclick = function () {
            const btn = d3.select(this);
            if (btn.classed('active')) {
                d3.select(".fit-brush").remove();
                btn.classed('active', false).style("background", null);
                return;
            }
            const tbl = G.hot.getData(), hd = tbl[0], cl = tbl[1], nm = tbl[2], rw = tbl.slice(3);
            const enY = [];
            for (let c = 0; c < hd.length; c++) if (hd[c] === 'Y-axis' && G.colEnabled[c]) enY.push(c);
            if (!enY.length) { alert('No enabled Y series.'); return; }
            const xcs = hd.map((h, i) => h === 'X-axis' && G.colEnabled[i] ? i : -1).filter(i => i >= 0);
            if (!xcs.length) { alert('Missing X-axis.'); return; }
            btn.classed('active', true).style("background", "#c6c6c6");
            const svg = d3.select("#chart svg");
            if (svg.empty()) return;
            svg.append("g").attr("class", "fit-brush").style("cursor", "crosshair")
                .call(d3.brushX().extent([[DIM.ML, DIM.MT], [DIM.W - DIM.MR, DIM.H - DIM.MB]])
                    .on("end", ({ selection }) => {
                        svg.select(".fit-brush").remove();
                        btn.classed('active', false).style("background", null);
                        if (!selection) return;
                        const [x0, x1] = selection.map(window.lastXScale.invert);
                        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
                        const wh = (document.querySelector('input[name="fit"]:checked') || { value: 'linear' }).value;
                        const infos = [];
                        for (const yi of enY) {
                            let xi = -1;
                            for (let k = 0; k < xcs.length; k++) {
                                const xk = xcs[k], nx = xcs[k + 1] ?? hd.length;
                                if (yi > xk && yi < nx) { xi = xk; break; }
                            }
                            if (xi < 0) continue;
                            const lbl = nm[yi];
                            const subX = [], subY = [];
                            rw.forEach(r => {
                                const vX = parseFloat(r[xi]), vY = parseFloat(r[yi]);
                                if (Number.isFinite(vX) && Number.isFinite(vY) && vX >= minX && vX <= maxX) {
                                    subX.push(vX); subY.push(vY);
                                }
                            });
                            if (subX.length < 2) continue;
                            if (wh === 'linear') {
                                const f = linearFit(subX, subY);
                                if (!f) continue;
                                const yh = rw.map(r => {
                                    const vX = parseFloat(r[xi]);
                                    return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? f.m * vX + f.b : '';
                                });
                                hd.push('Y-axis');
                                cl.push(COLORS[cl.length % COLORS.length]);
                                nm.push(lbl + ' (fit)');
                                rw.forEach((r, i) => r.push(yh[i]));
                                infos.push(`${lbl}: m=${f.m.toFixed(6)}, b=${f.b.toFixed(6)}, R<sup>2</sup>=${f.r2.toFixed(5)}`);
                            } else {
                                if (subX.length < 3) continue;
                                const f = quadraticFit(subX, subY);
                                if (!f) continue;
                                const yh = rw.map(r => {
                                    const vX = parseFloat(r[xi]);
                                    return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? f.a * vX * vX + f.b * vX + f.c : '';
                                });
                                hd.push('Y-axis');
                                cl.push(COLORS[cl.length % COLORS.length]);
                                nm.push(lbl + ' (fit)');
                                rw.forEach((r, i) => r.push(yh[i]));
                                infos.push(`${lbl}: a=${f.a.toExponential(3)}, b=${f.b.toExponential(3)}, c=${f.c.toExponential(3)}, R<sup>2</sup>=${f.r2.toFixed(5)}`);
                            }
                        }
                        G.hot.loadData([hd, cl, nm, ...rw]);
                        for (let c = 0; c < hd.length; c++) if (G.colEnabled[c] === undefined) G.colEnabled[c] = true;
                        G.hot.render();
                        G.resetScales(false);
                        G.renderChart();
                        const bx = DIM.ML + 6, by = DIM.MT + 12;
                        const newSvg = d3.select('#chart svg');
                        const st = newSvg.selectAll('foreignObject.user-text').size();
                        infos.forEach((tx, i) => {
                            const obj = G.editableText(newSvg, { x: bx, y: by + (st + i) * 16, text: tx, rotation: 0 });
                            obj.div.html(tx);
                            obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('height', obj.div.node().scrollHeight + obj.pad);
                            obj.fo.classed('user-text', true).call(G.applyDrag);
                        });
                    }));
        };
    };

})(window.GraphPlotter);
(function (G) {
    const COLORS = G.COLORS;

    G.bindTaucControls = function () {
        document.getElementById('generateTauc').addEventListener('click', () => {
            const exp = parseFloat(document.querySelector('input[name="tauc"]:checked').value);
            const raw = G.hot.getData().map(r => r.slice());
            const header = raw[0], colors = raw[1], names = raw[2];
            const origLen = header.length;
            const xIdx = header.indexOf('X-axis');
            const yIdx = header.indexOf('Y-axis', xIdx + 1);
            if (xIdx < 0 || yIdx < 0) return alert('Missing X-axis or Y-axis');
            raw.forEach(r => r.splice(origLen));
            header.splice(origLen);
            colors.splice(origLen);
            names.splice(origLen);
            const hv = [];
            for (let i = 3; i < raw.length; i++) hv[i] = 1240 / parseFloat(raw[i][xIdx]);
            header.push('X-axis');
            colors.push(colors[xIdx]);
            names.push(names[xIdx]);
            header.push('Y-axis');
            colors.push(colors[yIdx]);
            names.push(names[yIdx] + ` (Tauc n=${exp})`);
            for (let i = 3; i < raw.length; i++) {
                raw[i].push(hv[i], Math.pow(2.303 * hv[i] * parseFloat(raw[i][yIdx]), exp));
            }
            G.hot.loadData(raw);
            G.colEnabled = {};
            const total = header.length;
            for (let c = 0; c < total; c++) G.colEnabled[c] = c >= origLen;
            document.getElementById('axis-tauc').checked = true;
            G.hot.render();
            G.resetScales(true);
            G.renderChart();
        });
    };

})(window.GraphPlotter);
(function (G) {

    G.parseTextFile = async function (file) {
        const txt = await file.text();
        const lines = txt.split(/[\r\n]+/).filter(l => l.trim());
        return lines.map(l => l.split(/[\t,;]+/).map(c => {
            const n = parseFloat(c);
            return isNaN(n) ? c.trim() : n;
        }));
    };

    G.parseXLSX = async function (file) {
        if (typeof XLSX === 'undefined') {
            await G.loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
        }
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    };

    G.parseXRDML = async function (file) {
        const txt = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(txt, 'text/xml');
        const ds = doc.querySelector('dataPoints');
        const pos = ds.querySelector('positions');
        const ints = ds.querySelector('intensities');
        if (!pos || !ints) return null;
        const start = parseFloat(pos.querySelector('startPosition')?.textContent || 0);
        const end = parseFloat(pos.querySelector('endPosition')?.textContent || 0);
        const intArr = ints.textContent.trim().split(/\s+/).map(Number);
        const step = (end - start) / (intArr.length - 1);
        return intArr.map((y, i) => [start + i * step, y]);
    };

    G.loadScript = function (src) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    };

})(window.GraphPlotter);
(function (G) {

    G.parseNMR = async function (files) {
        let fidFile = null, acqusFile = null, procFile = null;
        for (const f of files) {
            const n = f.name.toLowerCase();
            if (n === 'fid') fidFile = f;
            else if (n === 'acqus') acqusFile = f;
            else if (n.startsWith('procs')) procFile = f;
        }
        if (!fidFile) return null;
        const ab = await fidFile.arrayBuffer();
        const fidData = new Int32Array(ab);
        const n = fidData.length / 2;
        const real = [], imag = [];
        for (let i = 0; i < n; i++) { real.push(fidData[2 * i]); imag.push(fidData[2 * i + 1]); }
        let sw = 5000, sf = 400, sr = 0;
        if (acqusFile) {
            const t = await acqusFile.text();
            const match_sw = t.match(/##\$SW_h=\s*([\d.]+)/);
            const match_sf = t.match(/##\$SFO1=\s*([\d.]+)/);
            if (match_sw) sw = parseFloat(match_sw[1]);
            if (match_sf) sf = parseFloat(match_sf[1]);
        }
        if (procFile) {
            const t = await procFile.text();
            const m = t.match(/##\$SR=\s*([\-\d.]+)/);
            if (m) sr = parseFloat(m[1]);
        }
        const offset = sr / sf;
        const fftSize = 1 << Math.ceil(Math.log2(n));
        const rePad = new Array(fftSize).fill(0), imPad = new Array(fftSize).fill(0);
        for (let i = 0; i < n; i++) { rePad[i] = real[i]; imPad[i] = imag[i]; }
        function fft(re, im, inv) {
            const N = re.length;
            let j = 0;
            for (let i = 0; i < N; i++) { if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]]; } let m = N >> 1; while (m >= 1 && j >= m) { j -= m; m >>= 1; } j += m; }
            for (let len = 2; len <= N; len <<= 1) {
                const ang = 2 * Math.PI / len * (inv ? -1 : 1), wR = Math.cos(ang), wI = Math.sin(ang);
                for (let i = 0; i < N; i += len) {
                    let wRe = 1, wIm = 0;
                    for (let k = 0; k < len / 2; k++) {
                        const tR = wRe * re[i + k + len / 2] - wIm * im[i + k + len / 2], tI = wRe * im[i + k + len / 2] + wIm * re[i + k + len / 2];
                        re[i + k + len / 2] = re[i + k] - tR; im[i + k + len / 2] = im[i + k] - tI;
                        re[i + k] += tR; im[i + k] += tI;
                        const nwR = wRe * wR - wIm * wI, nwI = wRe * wI + wIm * wR;
                        wRe = nwR; wIm = nwI;
                    }
                }
            }
            if (inv) { for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; } }
        }
        fft(rePad, imPad, false);
        const mag = rePad.map((r, i) => Math.sqrt(r * r + imPad[i] * imPad[i]));
        const half = new Array(fftSize);
        for (let i = 0; i < fftSize; i++) half[i] = mag[(i + fftSize / 2) % fftSize];
        const rows = [];
        for (let i = 0; i < fftSize; i++) {
            const ppm = (sw / 2 - i * sw / fftSize) / sf + offset;
            rows.push([ppm, half[i]]);
        }
        return rows;
    };

})(window.GraphPlotter);
(function (G) {
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph@latest/match';
    let compositions = null;

    G.MatchEngine = {
        materials: null,
        threshold: 50,

        async loadDB(type) {
            const url = `${CDN_BASE}/${type}/match.json`;
            const res = await fetch(url);
            if (!res.ok) return [];
            this.materials = await res.json();
            return this.materials;
        },

        match(peakPositions, options = {}) {
            const { tolerance = 20, limit = 50, mode } = options;
            if (!this.materials || !peakPositions.length) return [];
            const results = [];
            for (const mat of this.materials) {
                const refPeaks = mat.peaks || mat.p || [];
                let matchCount = 0;
                for (const up of peakPositions) {
                    for (const rp of refPeaks) {
                        const refVal = typeof rp === 'number' ? rp : rp.pos || rp[0];
                        if (Math.abs(up - refVal) <= tolerance) { matchCount++; break; }
                    }
                }
                if (matchCount > 0) {
                    results.push({ ref: mat.ref || mat.n || mat.name, formula: mat.formula || mat.f, score: matchCount / peakPositions.length, matches: matchCount });
                }
            }
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        }
    };

    G.XRDMatch = {
        binWidth: 0.5,
        precision: 100,
        indexCache: {},

        async loadCompositions() {
            if (compositions) return compositions;
            const res = await fetch(`${CDN_BASE}/xrd/meta/compositions.json`);
            compositions = await res.json();
            return compositions;
        },

        async loadBin(binId) {
            if (this.indexCache[binId]) return this.indexCache[binId];
            const url = `${CDN_BASE}/xrd/index/${binId}.json`;
            try {
                const res = await fetch(url);
                if (!res.ok) return null;
                const data = await res.json();
                this.indexCache[binId] = data;
                return data;
            } catch (e) { return null; }
        },

        async search(peaks, options = {}) {
            const { tolerance = 0.4, elements = [], limit = 50 } = options;
            await this.loadCompositions();
            const binsNeeded = new Set();
            peaks.forEach(peak => {
                const centerBin = Math.floor(peak / this.binWidth);
                const rangeBins = Math.ceil(tolerance / this.binWidth);
                for (let b = centerBin - rangeBins; b <= centerBin + rangeBins; b++) {
                    if (b >= 0) binsNeeded.add(b);
                }
            });
            const binData = await Promise.all([...binsNeeded].map(b => this.loadBin(b)));
            const scores = {};
            binData.filter(Boolean).forEach(bin => {
                const d = bin.d, c = bin.c;
                for (let i = 0; i < d.length; i++) {
                    const refId = d[i] >> 8, offset = d[i] & 0xFF;
                    const binId = Math.floor(offset / (this.binWidth * this.precision));
                    const peakPos = (binId * this.binWidth) + (offset / this.precision);
                    for (const userPeak of peaks) {
                        if (Math.abs(userPeak - peakPos) <= tolerance) {
                            scores[refId] = (scores[refId] || 0) + 1;
                            break;
                        }
                    }
                }
            });
            const results = Object.entries(scores).map(([refId, count]) => ({ refId: +refId, score: count / peaks.length, matches: count }));
            results.sort((a, b) => b.score - a.score);
            return results.slice(0, limit);
        }
    };

    G.bindMatchControls = function () {
        document.getElementById('matchBtn')?.addEventListener('click', async function () {
            const mode = document.querySelector('input[name="axistitles"]:checked')?.value;
            if (!mode) return alert('Select a chart mode first');
            const series = G.getSeries();
            if (!series.length) return alert('No data to match');
            const peaks = [];
            series.forEach(sv => {
                const maxY = Math.max(...sv.y.filter(Number.isFinite));
                sv.y.forEach((y, i) => { if (y > maxY * 0.1 && Number.isFinite(sv.x[i])) peaks.push(sv.x[i]); });
            });
            peaks.sort((a, b) => a - b);
            const uniquePeaks = peaks.filter((v, i, a) => i === 0 || v - a[i - 1] > 1);
            await G.MatchEngine.loadDB(mode);
            const results = G.MatchEngine.match(uniquePeaks, { tolerance: mode === 'xrd' ? 0.2 : 20 });
            const container = document.getElementById('matchResults');
            if (!results.length) { container.innerHTML = '<p>No matches found</p>'; return; }
            container.innerHTML = results.map((r, i) => `<div class="match-result"><b>${i + 1}. ${r.ref}</b> (${r.formula || 'N/A'}) - Score: ${(r.score * 100).toFixed(1)}%</div>`).join('');
        });
    };

})(window.GraphPlotter);
(function (G) {

    G.saveProject = function () {
        const tbl = G.hot.getData();
        const svg = d3.select('#chart svg');
        const shapes = [], texts = [], legends = [], axisTitles = [];
        svg.selectAll('g.shape-group').each(function () {
            const g = d3.select(this);
            if (g.style('display') === 'none') return;
            const sh = g.select('.shape'), t = g.attr('transform') || '';
            const obj = { type: sh.node().tagName, transform: t, stroke: sh.attr('stroke'), strokeWidth: sh.attr('stroke-width'), fill: sh.attr('fill'), fillOpacity: sh.attr('fill-opacity'), strokeDasharray: sh.attr('stroke-dasharray'), markerEnd: sh.attr('marker-end') };
            if (sh.node().tagName === 'line') { obj.x1 = sh.attr('x1'); obj.y1 = sh.attr('y1'); obj.x2 = sh.attr('x2'); obj.y2 = sh.attr('y2'); }
            else if (sh.node().tagName === 'rect') { obj.x = sh.attr('x'); obj.y = sh.attr('y'); obj.width = sh.attr('width'); obj.height = sh.attr('height'); }
            else if (sh.node().tagName === 'ellipse') { obj.cx = sh.attr('cx'); obj.cy = sh.attr('cy'); obj.rx = sh.attr('rx'); obj.ry = sh.attr('ry'); }
            shapes.push(obj);
        });
        svg.selectAll('foreignObject.user-text').each(function () {
            const fo = d3.select(this);
            if (fo.style('display') === 'none') return;
            const div = fo.select('div');
            texts.push({ x: fo.attr('x'), y: fo.attr('y'), transform: fo.attr('transform'), html: div.html(), style: { fontSize: div.style('font-size'), fontFamily: div.style('font-family'), fontWeight: div.style('font-weight'), fontStyle: div.style('font-style'), color: div.style('color') } });
        });
        svg.selectAll('g.legend-group').each(function () {
            const g = d3.select(this);
            if (g.style('display') === 'none') return;
            legends.push({ col: g.attr('data-col'), transform: g.attr('transform') || this.dataset.savedTransform });
        });
        svg.selectAll('g.axis-title').each(function () {
            const g = d3.select(this), fo = g.select('foreignObject'), div = fo.select('div');
            axisTitles.push({ class: g.attr('class'), transform: g.attr('transform'), html: div.html() });
        });
        const s = G.getSettings();
        const proj = { version: 2, data: tbl, colEnabled: G.colEnabled, settings: s, shapes, texts, legends, axisTitles, overrides: { x: window.overrideX, multiY: window.overrideMultiY, xTicks: window.overrideXTicks, yTicks: window.overrideYTicks, customTicksX: window.overrideCustomTicksX, customTicksY: window.overrideCustomTicksY, ternary: window.overrideTernary, ternaryTicks: window.overrideTernaryTicks, customTicksTernary: window.overrideCustomTicksTernary, scaleformatX: window.overrideScaleformatX, scaleformatY: window.overrideScaleformatY, minorTickOn: window.minorTickOn, useCustomTicksOn: window.useCustomTicksOn }, tickLabelStyles: G.tickLabelStyles };
        const blob = new Blob([JSON.stringify(proj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'graph.instanano'; a.click();
        URL.revokeObjectURL(url);
    };

    G.downloadImage = function () {
        const svg = document.querySelector('#chart svg');
        if (!svg) return;
        const clone = svg.cloneNode(true);
        clone.querySelectorAll('.outline').forEach(el => el.remove());
        clone.querySelectorAll('.area-brush,.fit-brush,.zoom-brush').forEach(el => el.remove());
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clone);
        const canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = svg.viewBox.baseVal.width * scale;
        canvas.height = svg.viewBox.baseVal.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a'); a.href = url; a.download = 'graph.png'; a.click();
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    };

    G.loadProject = function (file) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const proj = JSON.parse(e.target.result);
                G.hot.loadData(proj.data);
                G.colEnabled = proj.colEnabled || {};
                const s = proj.settings || {};
                if (s.mode) document.getElementById('axis-' + s.mode).checked = true;
                if (s.type) document.getElementById(s.type).checked = true;
                if (s.multiyaxis !== undefined) document.getElementById('multiyaxis').checked = s.multiyaxis === 1;
                ['linewidth', 'symbolsize', 'bins', 'opacity'].forEach(k => { if (s[k] !== undefined) document.getElementById(k).value = s[k]; });
                if (proj.overrides) {
                    window.overrideX = proj.overrides.x;
                    window.overrideMultiY = proj.overrides.multiY;
                    window.overrideXTicks = proj.overrides.xTicks;
                    window.overrideYTicks = proj.overrides.yTicks;
                    window.overrideCustomTicksX = proj.overrides.customTicksX;
                    window.overrideCustomTicksY = proj.overrides.customTicksY;
                    window.overrideTernary = proj.overrides.ternary;
                    window.overrideTernaryTicks = proj.overrides.ternaryTicks;
                    window.overrideCustomTicksTernary = proj.overrides.customTicksTernary;
                    window.overrideScaleformatX = proj.overrides.scaleformatX;
                    window.overrideScaleformatY = proj.overrides.scaleformatY;
                    window.minorTickOn = proj.overrides.minorTickOn || {};
                    window.useCustomTicksOn = proj.overrides.useCustomTicksOn || {};
                }
                if (proj.tickLabelStyles) G.tickLabelStyles = proj.tickLabelStyles;
                G.hot.render();
                G.renderChart();
                setTimeout(() => {
                    const svg = d3.select('#chart svg');
                    (proj.shapes || []).forEach(sh => {
                        const g = svg.append('g').classed('shape-group', true).attr('transform', sh.transform);
                        const tag = sh.type.toLowerCase();
                        if (tag === 'line') {
                            g.append('line').classed('hit', true).attr('x1', sh.x1).attr('y1', sh.y1).attr('x2', sh.x2).attr('y2', sh.y2).attr('stroke', 'transparent').attr('stroke-width', 10);
                            const ln = g.append('line').classed('shape', true).attr('x1', sh.x1).attr('y1', sh.y1).attr('x2', sh.x2).attr('y2', sh.y2).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth);
                            if (sh.strokeDasharray) ln.attr('stroke-dasharray', sh.strokeDasharray);
                            if (sh.markerEnd) { const id = G.createArrowMarker(svg, sh.stroke); ln.attr('marker-end', `url(#${id})`); }
                            const pts = G.bufferOutline(ln, 5);
                            g.append('polygon').classed('outline', true).attr('points', pts.join(' ')).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        } else if (tag === 'rect') {
                            g.append('rect').classed('hit', true).attr('x', sh.x).attr('y', sh.y).attr('width', sh.width).attr('height', sh.height).attr('stroke', 'transparent').attr('stroke-width', 10).attr('fill', 'none');
                            const rc = g.append('rect').classed('shape', true).attr('x', sh.x).attr('y', sh.y).attr('width', sh.width).attr('height', sh.height).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth).attr('fill', sh.fill || 'none');
                            if (sh.fillOpacity) rc.attr('fill-opacity', sh.fillOpacity);
                            if (sh.strokeDasharray) rc.attr('stroke-dasharray', sh.strokeDasharray);
                            const o = G.bufferOutline(rc, 5);
                            g.append('rect').classed('outline', true).attr('x', o.x).attr('y', o.y).attr('width', o.w).attr('height', o.h).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        } else if (tag === 'ellipse') {
                            g.append('ellipse').classed('hit', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', sh.rx).attr('ry', sh.ry).attr('stroke', 'transparent').attr('stroke-width', 10).attr('fill', 'none');
                            const el = g.append('ellipse').classed('shape', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', sh.rx).attr('ry', sh.ry).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth).attr('fill', sh.fill || 'none');
                            if (sh.fillOpacity) el.attr('fill-opacity', sh.fillOpacity);
                            g.append('ellipse').classed('outline', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', +sh.rx + 5).attr('ry', +sh.ry + 5).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        }
                        G.makeShapeInteractive(g);
                    });
                    (proj.texts || []).forEach(t => {
                        const obj = G.editableText(svg, { x: t.x, y: t.y, text: '', rotation: 0 });
                        obj.div.html(t.html);
                        if (t.style) { obj.div.style('font-size', t.style.fontSize).style('font-family', t.style.fontFamily).style('font-weight', t.style.fontWeight).style('font-style', t.style.fontStyle).style('color', t.style.color); }
                        obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('transform', t.transform);
                        obj.fo.classed('user-text', true).call(G.applyDrag);
                    });
                    (proj.legends || []).forEach(l => {
                        const g = svg.select(`g.legend-group[data-col="${l.col}"]`);
                        if (!g.empty() && l.transform) { g.attr('transform', l.transform); g.node().dataset.savedTransform = l.transform; }
                    });
                    (proj.axisTitles || []).forEach(at => {
                        const g = svg.select(`g.${at.class.split(' ').join('.')}`);
                        if (!g.empty()) { g.attr('transform', at.transform); g.select('foreignObject div').html(at.html); }
                    });
                }, 100);
            } catch (err) { console.error(err); }
        };
        reader.readAsText(file);
    };

    G.bindExportControls = function () {
        document.getElementById('save').addEventListener('click', G.saveProject);
        document.getElementById('download').addEventListener('click', G.downloadImage);
    };

})(window.GraphPlotter);
(function (G) {
    const DIM = G.DIM;
    const COLORS = G.COLORS;

    G.getSeries = function () {
        const data = G.hot.getData(), header = data[0], series = [], rows = data.slice(3);
        let xCol = -1, zCol = -1;
        for (let c = 0; c < header.length; c++) {
            if (header[c] === 'X-axis' && G.colEnabled[c] !== false) { xCol = c; zCol = -1; }
            else if (header[c] === 'Z-axis' && G.colEnabled[c] !== false) { zCol = c; }
            else if (header[c] === 'Y-axis' && G.colEnabled[c] !== false) {
                let errorCol = -1;
                for (let ec = c + 1; ec < header.length && header[ec] !== 'X-axis' && header[ec] !== 'Y-axis'; ec++) {
                    if (header[ec] === 'Y-error' && G.colEnabled[ec] !== false) { errorCol = ec; break; }
                }
                const sv = { rawX: [], x: [], y: [], z: zCol >= 0 ? [] : undefined, color: data[1][c], label: data[2][c], error: errorCol >= 0 ? [] : undefined, errorColor: errorCol >= 0 ? data[1][errorCol] : undefined };
                for (const row of rows) {
                    const xv = parseFloat(row[xCol]), yv = parseFloat(row[c]);
                    sv.rawX.push(row[xCol]);
                    sv.x.push(xv);
                    sv.y.push(yv);
                    if (zCol >= 0) sv.z.push(parseFloat(row[zCol]));
                    if (errorCol >= 0) sv.error.push(parseFloat(row[errorCol]));
                }
                series.push(sv);
            }
        }
        return series;
    };

    G.getSettings = function () {
        const ratio = document.querySelector('input[name="aspectratio"]:checked')?.value || '4:2.85';
        const preset = G.ratioPresets[ratio] || G.ratioPresets['4:2.85'];
        const chartRadio = document.querySelector('input[name="charttype"]:checked');
        const s = {
            type: chartRadio?.id || 'line',
            mode: document.querySelector('input[name="axistitles"]:checked')?.value || 'default',
            symbolsize: +document.getElementById('symbolsize')?.value || preset.symbolsize || 5,
            xticks: preset.xticks,
            yticks: preset.yticks,
            scaleformat: +document.getElementById('scaleformat')?.value || 0,
            bins: +document.getElementById('bins')?.value || 10,
            multiygap: +document.getElementById('multiygap')?.value || preset.multiygap,
            scalewidth: +document.getElementById('scalewidth')?.value || preset.scalewidth,
            linewidth: +document.getElementById('linewidth')?.value || preset.linewidth,
            multiyaxis: +document.getElementById('multiyaxis')?.value || 0,
            opacity: +document.getElementById('opacity')?.value || 0.5,
            scaleFs: preset.scaleFs,
            axisTitleFs: preset.axisTitleFs,
            legendFs: preset.legendFs,
            ratio: ratio
        };
        if (chartRadio?.dataset) {
            Object.entries(chartRadio.dataset).forEach(([key, val]) => {
                if (/^-?\d+(\.\d+)?$/.test(val)) s[key] = +val;
                else if (val.includes(',')) s[key] = val.split(',').map(v => v.trim());
                else s[key] = val;
            });
        }
        return s;
    };

    G.renderChart = function () {
        try {
            const svg = d3.select('#chart svg');
            if (svg.empty()) return;
            const savedShapes = [], savedTexts = [], savedLegends = [], savedAxisTitles = [];
            svg.selectAll('g.shape-group').each(function () { savedShapes.push(this.cloneNode(true)); });
            svg.selectAll('foreignObject.user-text').each(function () { savedTexts.push(this.cloneNode(true)); });
            svg.selectAll('g.legend-group').each(function () { savedLegends.push({ col: d3.select(this).attr('data-col'), transform: this.dataset.savedTransform || d3.select(this).attr('transform') }); });
            svg.selectAll('g.axis-title').each(function () { savedAxisTitles.push({ class: d3.select(this).attr('class'), transform: d3.select(this).attr('transform'), html: d3.select(this).select('foreignObject div').html() }); });
            svg.selectAll('g:not(.defs), path.series-path, foreignObject, line, rect:not(#chart-bg)').remove();
            const series = G.getSeries();
            const s = G.getSettings();
            const titles = G.getTitles(s.mode);
            const { xScale, yScale } = G.makeScales(s, series);
            const scales = { x: xScale, y: yScale };
            G.computeMultiYScales(scales, s, series);
            window.lastXScale = xScale;
            window.lastYScale = yScale;
            G.drawAxis(svg, scales, titles, s, series);
            const chartDef = G.ChartRegistry.get(s.type);
            const clipId = 'clip';
            let defs = svg.select('defs');
            if (defs.empty()) defs = svg.append('defs');
            if (defs.select('#' + clipId).empty()) {
                defs.append('clipPath').attr('id', clipId).append('rect').attr('x', DIM.ML).attr('y', DIM.MT).attr('width', DIM.W - DIM.ML - DIM.MR).attr('height', DIM.H - DIM.MT - DIM.MB);
            }
            const g = svg.append('g').attr('clip-path', `url(#${clipId})`);
            chartDef.draw(g, series, scales, s);
            G.drawLegend();
            G.tickEditing(svg);
            G.toolTip(svg, { xScale, yScale });
            savedShapes.forEach(el => svg.node().appendChild(el));
            savedTexts.forEach(el => svg.node().appendChild(el));
            savedLegends.forEach(l => {
                const lg = svg.select(`g.legend-group[data-col="${l.col}"]`);
                if (!lg.empty() && l.transform) { lg.attr('transform', l.transform); lg.node().dataset.savedTransform = l.transform; }
            });
            savedAxisTitles.forEach(at => {
                const ag = svg.select(`g.${at.class.split(' ').join('.')}`);
                if (!ag.empty()) { ag.attr('transform', at.transform); ag.select('foreignObject div').html(at.html); }
            });
            svg.selectAll('g.shape-group').each(function () { G.makeShapeInteractive(d3.select(this)); });
            svg.selectAll('foreignObject.user-text').each(function () { d3.select(this).call(G.applyDrag); });
            const w = +document.getElementById('smoothingslider')?.value || 0;
            if (w > 0) G.previewSeries(G.movingAverage, w, 'smooth-preview');
            const bw = +document.getElementById('baselineslider')?.value || 0;
            if (bw > 0) G.previewSeries(G.rollingBaseline, bw, 'baseline-preview');
        } catch (err) {
            console.error('renderChart error:', err);
        }
    };

    const fileHandlers = { instanano: null, csv: 'text', txt: 'text', xls: 'xlsx', xlsx: 'xlsx', xrdml: 'xrdml' };
    const fileModes = { xrdml: 'xrd', raw: 'xrd', spc: 'uvvis' };

    G.handleFileList = async function (src) {
        try {
            const items = src && src.items;
            const files = items && items.length ? await (async () => {
                const out = [];
                const readAll = r => new Promise(res => { const a = []; (function n() { r.readEntries(es => { if (!es.length) res(a); else { a.push(...es); n(); } }); })(); });
                const walk = async (en, p = '') => en.isFile ? await new Promise(r => en.file(f => { f.relativePath = p + f.name; out.push(f); r(); })) : await Promise.all((await readAll(en.createReader())).map(e => walk(e, p + en.name + '/')));
                for (const it of items) { const en = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (en) await walk(en); }
                return out;
            })() : [...(src?.files || src || [])];
            if (!files.length) return;

            const nmrFiles = files.filter(f => ['fid', 'acqus', 'procs', 'proc2s'].includes(f.name.toLowerCase()));
            if (nmrFiles.length && await G.parseNMR(nmrFiles)) return;

            const file = files[0];
            const ext = file.name.split('.').pop().toLowerCase();

            if (ext === 'instanano') {
                const text = await file.text();
                G.importState(JSON.parse(text));
                return;
            }

            const handlerType = fileHandlers[ext];
            if (!handlerType) { alert('Unsupported file type: .' + ext); return; }

            if (fileModes[ext]) {
                const radio = document.querySelector(`input[name="axistitles"][value="${fileModes[ext]}"]`);
                if (radio) radio.checked = true;
            }

            let rows;
            if (handlerType === 'xlsx') {
                rows = await G.parseXLSX(file);
            } else if (handlerType === 'xrdml') {
                rows = await G.parseXRDML(file);
            } else {
                rows = await G.parseTextFile(file);
            }

            if (!rows || !rows.length) return;

            const n = Math.max(...rows.map(r => r.length));
            const header = Array(n).fill().map((_, i) => i === 0 ? 'X-axis' : 'Y-axis');
            const color = Array(n).fill().map((_, i) => COLORS[i % COLORS.length]);
            const name = Array(n).fill('Sample');

            G.hot.loadData([header, color, name, ...rows]);
            G.colEnabled = {};
            G.hot.getData()[0].forEach((_, c) => { G.colEnabled[c] = true; });
            G.hot.render();

            const mode = G.detectModeFromData();
            if (mode) {
                const radio = document.querySelector(`input[name="axistitles"][value="${mode}"]`);
                if (radio) radio.checked = true;
            }

            d3.select('#chart').selectAll("g.axis-title, g.legend-group, g.shape-group, defs, foreignObject.user-text").remove();
            G.disableAreaCal();
            G.tickLabelStyles = { x: { fontSize: null, color: null }, y: { fontSize: null, color: null } };
            G.resetScales(true);
            G.renderChart();
            G.checkEmptyColumns();
        } catch (err) {
            console.error('handleFileList error:', err);
        }
    };

    G.bindFileHandlers = function () {
        const fileinput = document.getElementById('fileinput');
        const dropzone = document.getElementById('dropzone');
        if (!fileinput || !dropzone) return;

        fileinput.accept = Object.keys(fileHandlers).map(ext => '.' + ext).join(',');

        dropzone.addEventListener('click', () => fileinput.click());
        ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('hover'); }));
        ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('hover'); }));
        dropzone.addEventListener('drop', async e => { e.preventDefault(); dropzone.classList.remove('hover'); await G.handleFileList(e.dataTransfer); });
        fileinput.addEventListener('change', async () => { await G.handleFileList(fileinput); fileinput.value = ''; });
    };

    G.bindChartTypeControls = function () {
        const controls = document.querySelectorAll('input[id]');
        const showEls = document.querySelectorAll('[data-show]');
        const radios = document.querySelectorAll('input[name="charttype"]');

        radios.forEach(radio => radio.addEventListener('change', () => {
            controls.forEach(ctl => {
                const newVal = radio.dataset[ctl.id] ?? ctl.dataset.defaultValue ?? ctl.defaultValue;
                if (newVal !== undefined && newVal !== null && newVal !== '') {
                    ctl.value = newVal;
                    ctl.dispatchEvent(new Event('input'));
                }
            });

            showEls.forEach(el => {
                el.style.display = el.dataset.show.split(/\s+/).includes(radio.id) ? '' : 'none';
            });

            const specs = radio.dataset.axis?.split(/\s*,\s*/).map(s => s.trim());
            if (specs) {
                const d = G.hot.getData();
                while (d[0].length < specs.length) {
                    d.forEach((r, i) => r.push(i === 0 ? specs[r.length].replace('*', '') : i === 1 ? COLORS[r.length % COLORS.length] : i === 2 ? "Sample" : ""));
                }
                G.hot.loadData(d);

                let p = specs.findIndex(s => s.endsWith('*'));
                if (p < 0) p = specs.length;
                const patterns = specs.map(s => s.replace(/\*$/, ''));
                const wild = patterns.slice(p);

                G.hot.getData()[0].forEach((orig, i) => {
                    const lbl = i < p ? patterns[i] : (wild.length ? wild[(i - p) % wild.length] : orig);
                    G.hot.setDataAtCell(0, i, lbl);
                    G.colEnabled[i] = G.colEnabled[i] && patterns.includes(lbl);
                });
                G.hot.render();
            }

            G.resetScales(false);
            G.renderChart();
            G.checkEmptyColumns();
        }));

        const checkedRadio = document.querySelector('input[name="charttype"]:checked');
        if (checkedRadio) checkedRadio.dispatchEvent(new Event('change'));
    };

    G.bindSliderControls = function () {
        ['smoothingslider', 'baselineslider', 'multiyaxis'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            function updateThumbColor() { input.classList.toggle('zero', input.value === '0'); }
            input.addEventListener('input', updateThumbColor);
            updateThumbColor();
        });

        document.querySelectorAll('span[data-current-value]').forEach(span => {
            const slider = document.getElementById(span.dataset.currentValue);
            if (!slider || slider.type !== 'range') return;
            span.textContent = slider.value;
            slider.oninput = () => { span.textContent = slider.value; };
        });
    };

    G.bindKeyboardShortcuts = function () {
        const modKey = navigator.platform.match(/Mac/) ? 'Meta' : 'Control';
        function keyBinder(combo, fn) {
            const parts = combo.split('+'), key = parts.pop().toLowerCase();
            document.addEventListener('keydown', e => {
                if (document.activeElement.isContentEditable) return;
                const mods = { meta: e.metaKey, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey };
                const match = parts.every(m => mods[m.toLowerCase()]) && e.key.toLowerCase() === key;
                if (match) { e.preventDefault(); fn(); }
            });
        }
        keyBinder(`${modKey}+s`, () => document.getElementById('save')?.click());
        keyBinder(`${modKey}+d`, () => document.getElementById('download')?.click());
        keyBinder(`${modKey}+z`, () => { G.resetScales(true); G.renderChart(); });
        keyBinder('Escape', () => G.clearActive());
        keyBinder('Delete', () => { if (G.activeGroup || G.activeFo) document.getElementById('removebtn')?.click(); });
        keyBinder('Backspace', () => { if (G.activeGroup || G.activeFo) document.getElementById('removebtn')?.click(); });
    };

    G.init = function () {
        try {
            const ratio = document.querySelector('input[name="aspectratio"]:checked')?.value || '4:2.85';
            const [w, h] = ratio.split(':').map(Number);
            const W = 600, H = W * h / w;
            G.DIM.W = W; G.DIM.H = H;
            const svg = d3.select('#chart').append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet').style('background', 'white');
            svg.append('rect').attr('id', 'chart-bg').attr('width', W).attr('height', H).attr('fill', 'white');
            G.initTable();
            G.hot.getData()[0].forEach((_, c) => { G.colEnabled[c] = true; });
            G.bindScaleInputs();
            G.bindInspectorControls();
            G.bindSupSubControls();
            G.bindShapeControls();
            G.bindSmoothingControls();
            G.bindFittingControls();
            G.bindTaucControls();
            G.bindZoom();
            G.bindFileHandlers();
            G.bindExportControls();
            G.bindKeyboardShortcuts();
            G.bindSliderControls();
            G.prepareShapeLayer();
            G.areacalculation();

            document.querySelectorAll('input[name="axistitles"], #multiyaxis, #linewidth, #symbolsize, #bins, #opacity').forEach(el => el.addEventListener('change', () => G.renderChart()));
            document.querySelectorAll('input[name="charttype"]').forEach(el => el.addEventListener('change', () => G.renderChart()));
            document.querySelectorAll('input[name="aspectratio"]').forEach(el => el.addEventListener('change', function () {
                const [nw, nh] = this.value.split(':').map(Number);
                const W2 = 600, H2 = W2 * nh / nw;
                G.DIM.W = W2; G.DIM.H = H2;
                d3.select('#chart svg').attr('viewBox', `0 0 ${W2} ${H2}`).select('#chart-bg').attr('width', W2).attr('height', H2);
                G.resetScales(true);
                G.renderChart();
            }));
            svg.on('click', e => { if (e.target === svg.node() || e.target.id === 'chart-bg') G.clearActive(); });

            G.bindChartTypeControls();
            G.resetScales(true);
            G.renderChart();
        } catch (err) {
            console.error('init error:', err);
        }
    };

    document.addEventListener('DOMContentLoaded', G.init);

})(window.GraphPlotter);
