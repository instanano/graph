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
