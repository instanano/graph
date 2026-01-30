(function (G) {
    const DIM = G.DIM;

    G.applyTickStyles = function (g, axisType, idx, scaleFs, defaultColor) {
        defaultColor = defaultColor || 'currentColor';
        const styles = (G.tickLabelStyles[axisType] || {})[idx] || {};
        g.selectAll('text').classed('tick-label', true)
            .classed(`tick-${axisType}`, true)
            .style('font-size', styles.fontSize || (scaleFs + 'px'))
            .style('fill', styles.color || defaultColor)
            .style('font-family', styles.fontFamily || 'Arial')
            .style('font-weight', styles.fontWeight || 'normal')
            .style('font-style', styles.fontStyle || 'normal')
            .style('cursor', 'default');
    };

    G.makeTickFormat = function (axisKey, idx) {
        idx = idx || 0;
        const FULL = d3.format("");
        const ABBR = d3.format(".2s");
        const SCI = d3.format(".0e");
        let mode = 0;
        if (axisKey === 'x') {
            mode = window.overrideScaleformatX ?? 0;
        } else if (axisKey === 'y') {
            mode = window.overrideScaleformatY?.[idx] ?? 0;
        } else if (axisKey === 'a' || axisKey === 'b' || axisKey === 'c') {
            mode = window.overrideScaleformatTernary?.[axisKey] ?? 0;
        }
        return mode === 1 ? ABBR : mode === 2 ? SCI : FULL;
    };

    G.addMinorTicks = function (axisGroup, scale, axisCtor, count, size, strokeWidth, strokeColor) {
        count = count || 0;
        size = size || 4;
        strokeWidth = strokeWidth || 1;
        strokeColor = strokeColor || 'currentColor';
        if (typeof scale.ticks !== 'function') return;
        let custom = null, key = null, sel;
        if (axisGroup.attr('data-xi') != null) {
            custom = window.overrideCustomTicksX || null;
            sel = window.selectedAxisName === 'X';
            key = 'X';
        } else if (axisGroup.attr('data-yi') != null) {
            const yi = +axisGroup.attr('data-yi');
            custom = (window.overrideCustomTicksY && window.overrideCustomTicksY[yi]) || null;
            sel = window.selectedAxisName === (yi === 0 ? 'Y' : ('Y' + (yi + 1)));
            key = 'Y' + yi;
        } else if (axisGroup.attr('data-ai') != null) {
            custom = window.overrideCustomTicksTernary?.a || null;
            sel = window.selectedAxisName === 'A';
            key = 'A';
        } else if (axisGroup.attr('data-bi') != null) {
            custom = window.overrideCustomTicksTernary?.b || null;
            sel = window.selectedAxisName === 'B';
            key = 'B';
        } else if (axisGroup.attr('data-ci') != null) {
            custom = window.overrideCustomTicksTernary?.c || null;
            sel = window.selectedAxisName === 'C';
            key = 'C';
        }
        if (window.minorTickOn[key] === false) return;
        const useCustom = window.useCustomTicksOn?.[key] === true;
        const domain = scale.domain();
        let minors = [];
        if (useCustom) {
            if (!Array.isArray(custom) || custom.length < 2) return;
            const t = custom.filter(Number.isFinite).sort((a, b) => a - b);
            for (let i = 0; i < t.length - 1; i++) {
                const mid = (t[i] + t[i + 1]) / 2;
                if (mid >= domain[0] && mid <= domain[1]) minors.push(mid);
            }
        } else {
            if (axisCtor === d3.axisBottom) count = window.overrideXTicks ?? window.overrideTernaryTicks?.a ?? count;
            else if (axisCtor === d3.axisLeft) count = window.overrideYTicks?.[0] ?? window.overrideTernaryTicks?.b ?? count;
            else if (axisCtor === d3.axisRight) count = window.overrideTernaryTicks?.c ?? count;
            if (count == null) return;
            const major = scale.ticks(count);
            if (major.length >= 2) {
                const step = major[1] - major[0];
                minors = major.slice(0, -1).map(v => v + step / 2);
                if (major[0] - step / 2 >= domain[0]) minors.unshift(major[0] - step / 2);
                if (major[major.length - 1] + step / 2 <= domain[1]) minors.push(major[major.length - 1] + step / 2);
            }
        }
        if (!minors.length) return;
        minors = minors.filter(v => v >= Math.min(domain[0], domain[1]) && v <= Math.max(domain[0], domain[1]));
        const mg = axisGroup.append('g').call(axisCtor(scale).tickValues(minors).tickSize(size).tickFormat(''));
        mg.select('path.domain').remove();
        mg.selectAll('line').classed('minor-tick', true).attr('stroke-width', strokeWidth).attr('stroke', strokeColor);
    };

    G.axisTitle = function (svg, axes, modeKey, DIM) {
        const pad = 5;
        axes.forEach(axis => {
            let g = svg.select(`g.axis-title-${axis.key}`);
            if (g.empty()) {
                g = svg.append("g")
                    .classed(`axis-title axis-title-${axis.key} user-text`, true)
                    .attr("data-axis-mode", modeKey)
                    .attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "))
                    .call(G.applyDrag);
                const obj = G.editableText(g, { x: 0, y: 0, text: axis.label, rotation: 0 });
                obj.div.html(axis.label);
                obj.fo.attr("width", obj.div.node().scrollWidth + pad).attr("x", -(obj.div.node().scrollWidth + pad) / 2).attr("y", 0);
                obj.div.style("text-align", axis.anchor || "middle");
            } else if (g.attr("data-axis-mode") !== modeKey) {
                const fo = g.select("foreignObject");
                fo.select("div").html(axis.label);
                const w2 = fo.select("div").node().scrollWidth + pad;
                fo.attr("width", w2).attr("x", -w2 / 2).attr("y", 0);
                g.attr("data-axis-mode", modeKey);
            }
            g.attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "));
        });
    };

    G.multiYaxis = function (svg, scales, s, series) {
        const yScale = scales.y;
        if (s.multiyaxis === 1 && ["line", "area", "scatter", "scatterline"].includes(s.type) && series.length > 1) {
            scales.y2 = series.map((sv, i) => {
                if (i === 0) return yScale;
                const [minY, maxY] = d3.extent(sv.y);
                return d3.scaleLinear().domain([minY - (maxY - minY) * 0.06, maxY + (maxY - minY) * 0.06]).range([DIM.H - DIM.MB, DIM.MT]);
            });
            window.multiYScales = scales.y2;
            if (window.overrideMultiY) {
                for (const [key, range] of Object.entries(window.overrideMultiY)) {
                    const idx = +key;
                    if (window.multiYScales[idx]) {
                        window.multiYScales[idx].domain(range);
                    }
                }
            }
            series.slice(1).forEach((sv, i) => {
                const axisIndex = i + 1;
                const customYi = window.overrideCustomTicksY && window.overrideCustomTicksY[axisIndex];
                const countYi = customYi ? null : (window.overrideYTicks && window.overrideYTicks[axisIndex] != null ? window.overrideYTicks[axisIndex] : s.yticks);
                const gYi = svg.append("g").attr("data-yi", axisIndex).attr("transform", `translate(${DIM.W - DIM.MR + i * s.multiygap},0)`).attr("stroke-width", s.scalewidth).call(d3.axisRight(window.multiYScales[axisIndex]).tickValues(customYi).ticks(countYi).tickFormat(G.makeTickFormat('y', axisIndex)));
                gYi.selectAll("path,line").attr("stroke", sv.color);
                G.addMinorTicks(gYi, window.multiYScales[axisIndex], d3.axisRight, countYi, 4, s.scalewidth, sv.color);
                G.applyTickStyles(gYi, "y", axisIndex, s.scaleFs, sv.color);
            });
        }
    };

    G.drawAxis = function (svg, scales, titles, s, series) {
        if (["ternary", "ternaryline", "ternaryarea"].includes(s.type)) {
            svg.selectAll(".axis-title").remove();
            G.renderTernaryAxes(svg, s, DIM);
            return;
        }
        svg.selectAll(".axis-title.ternary").remove();
        const xScale = scales.x, yScale = scales.y;
        const customX = window.overrideCustomTicksX, countX = customX ? null : (window.overrideXTicks ?? s.xticks);
        const customY0 = window.overrideCustomTicksY && window.overrideCustomTicksY[0];
        const countY0 = customY0 ? null : (window.overrideYTicks && window.overrideYTicks[0] != null ? window.overrideYTicks[0] : s.yticks);
        const gX = svg.append("g").attr("data-xi", 0).attr("transform", "translate(0," + (DIM.H - DIM.MB) + ")").attr("stroke-width", s.scalewidth)
            .call(d3.axisBottom(xScale).tickValues(customX).ticks(countX).tickSize(6).tickPadding(4).tickFormat(s.type === "bar" ? null : G.makeTickFormat('x', 0)));
        G.applyTickStyles(gX, 'x', 0, s.scaleFs);
        const gY = svg.append("g").attr("data-yi", 0).attr("transform", "translate(" + DIM.ML + ",0)").attr("stroke-width", s.scalewidth)
            .call(d3.axisLeft(yScale).tickValues(customY0).ticks(countY0).tickSize(6).tickPadding(4).tickFormat(G.makeTickFormat('y', 0)));
        G.applyTickStyles(gY, 'y', 0, s.scaleFs);
        G.addMinorTicks(gX, xScale, d3.axisBottom, s.xticks, 4, s.scalewidth, 'currentColor');
        G.addMinorTicks(gY, yScale, d3.axisLeft, s.yticks, 4, s.scalewidth, 'currentColor');
        svg.append("line").attr("x1", DIM.ML).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.MT).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        svg.append("line").attr("x1", DIM.W - DIM.MR).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.H - DIM.MB).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        G.multiYaxis(svg, scales, s, series);
        G.axisTitle(svg, [
            { key: "x", label: titles.x, pos: [DIM.W / 2, DIM.H - DIM.MB / 1.7], rotation: 0, anchor: "middle" },
            { key: "y", label: titles.y, pos: [DIM.ML - 60, DIM.H / 2], rotation: -90, anchor: "middle" }
        ], s.mode, DIM);
    };

})(window.GraphPlotter);


// test
