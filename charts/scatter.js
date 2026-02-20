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
