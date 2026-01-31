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
