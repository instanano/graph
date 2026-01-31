(function(G) {
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
