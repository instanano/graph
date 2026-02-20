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
