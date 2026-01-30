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
