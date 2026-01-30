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
