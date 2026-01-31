(function(G) {
    function drawLegendMarker(g, type, s, d, i, sw) {
        g.selectAll(".legend-marker").remove(); switch (type) { case "scatter": case "ternary": { const shape = G.config.SYMBOL_TYPES[i % G.config.SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
        g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color); break;}
        case "scatterline": case "ternaryline": { g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);
        const shape = G.config.SYMBOL_TYPES[i % G.config.SYMBOL_TYPES.length], sym = d3.symbol().type(shape).size(Math.PI * s.symbolsize ** 2);
        g.append("path").classed("legend-marker", true).attr("d", sym).attr("transform", `translate(${sw / 2},0)`).attr("fill", d.color); break;}
        case "bar": case "histogram": { g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color); break;}
        case "area": case "ternaryarea": { g.append("rect").classed("legend-marker", true).attr("width", sw).attr("height", 8).attr("y", -4).attr("fill", d.color).attr("fill-opacity", s.opacity); break;}
        default: { g.append("line").classed("legend-marker", true).attr("x2", sw).attr("stroke", d.color).attr("stroke-width", s.linewidth);}}
    }

    G.ui.drawLegend = function() {
        const svg = d3.select('#chart svg'); const data = G.state.hot.getData(), header = data[0], series = G.getSeries(), s = G.getSettings();
        const cols = header.map((v,i) => v === 'Y-axis' && G.state.colEnabled[i] ? i : -1).filter(i => i >= 0);
        const X = G.config.DIM.W - G.config.DIM.MR - 100, Y = G.config.DIM.MT + 25, S = 20, M = 20; const legends = svg.selectAll('g.legend-group').data(cols, d => d);
        legends.exit().remove(); legends.attr('transform', function(d, idx) { return this.dataset.savedTransform || `translate(${X},${Y + idx * S})`;}); const legendsEnter = legends.enter().append('g').classed('legend-group', 1).attr('data-col', d => d).attr('transform', (d, idx) => `translate(${X},${Y + idx * S})`).call(G.utils.applyDrag);
        legendsEnter.each(function (d, idx) { drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);
        const fo = G.utils.editableText(d3.select(this), { x: M + 5, y: -10, text: data[2][d]});
        fo.fo.attr('width', fo.div.node().scrollWidth + fo.pad); const div = fo.div.node();
        div.addEventListener('click', e => { e.stopPropagation(); div.focus(); });
        div.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); div.blur(); } });
        div.addEventListener('blur', function() { G.state.hot.setDataAtCell(2, d, div.textContent.trim(), 'paste'); G.state.hot.render();
        d3.select(div).attr('contenteditable', false).style('outline', 'none').style('cursor', 'move');});});
        legends.select('foreignObject div').text(d => data[2][d]); legends.each(function (d, idx) {
        d3.select(this).selectAll('.legend-marker').remove(); drawLegendMarker(d3.select(this), s.type, s, series[idx], idx, M);});
    }

    G.ui.drawErrorBars = function(g, series, scales, s) {
        const bw = s.type==="bar" && scales.x.bandwidth ? scales.x.bandwidth() : 0, barW = bw/series.length, cap = s.type==="bar" ? barW*0.2 : s.symbolsize;
        series.forEach((sv,i) => { if (!sv.error) return; sv.rawX.forEach((xVal,j) => { const err = sv.error[j]; if (!isFinite(err)) return;
        const x0 = s.type==="bar" ? scales.x(xVal) + i*barW + barW/2 : scales.x(xVal), yHigh = scales.y(sv.y[j]+err), yLow  = scales.y(sv.y[j]-err);
        g.append("line").attr("x1", x0).attr("x2", x0).attr("y1", yHigh).attr("y2", yLow).attr("stroke", sv.errorColor).attr("stroke-width", s.linewidth);
        [yHigh,yLow].forEach(y => g.append("line").attr("x1", x0-cap).attr("x2", x0+cap).attr("y1", y).attr("y2", y).attr("stroke", sv.errorColor)
        .attr("stroke-width", s.linewidth));});});
    }
})(window.GraphPlotter);
