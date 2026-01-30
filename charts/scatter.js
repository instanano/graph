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
