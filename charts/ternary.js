(function(G) {
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
