(function(G) {
    G.axis.getTitles = function(mode) {
        switch (mode) { case "uvvis":return { x: "Wavelength (nm)", y: "Absorbance (a.u.)" }; 
        case "tauc":return { x: "Energy (eV)", y: "Intensity (a.u.)" }; case "xrd":return { x: "2θ (°)", y: "Intensity (a.u.)" }; 
        case "ftir":return { x: "Wavenumber (cm<sup>-1</sup>)", y: "Transmittance (%)" }; 
        case "raman":return { x: "Raman Shift (cm<sup>-1</sup>)", y: "Intensity (a.u.)" }; 
        case "pl":return { x: "Wavelength (nm)", y: "Intensity (a.u.)" }; case "xps":return { x: "Binding Energy (eV)", y: "Intensity (cps)" }; 
        case "tga":return { x: "Temperature (°C)", y: "Weight (%)" }; case "dsc":return { x: "Temperature (°C)", y: "Heat Flow (mW)" }; 
        case "bet":return { x: "Relative Pressure (P/P<sub>0</sub>)", y: "Adsorbed Volume (cm<sup>3</sup>·g<sup>-1</sup>)" };
        case "saxs":return { x: "Scattering Vector q (Å<sup>-1</sup>)", y: "Intensity (a.u.)" }; 
        case "nmr":return { x: "δ (ppm)", y: "Intensity (a.u.)" }; case "ternary": return { a: "A-axis", b: "B-axis", c: "C-axis" }; 
        case "tensile": return { x: "Strain", y: "Stress" }; default:return { x: "x-axis", y: "y-axis" };}
    };

    function axisTitle(svg, axes, modeKey, DIM) {
        const pad = 5; axes.forEach(axis => { let g = svg.select(`g.axis-title-${axis.key}`); if (g.empty()) { g = svg.append("g")
        .classed(`axis-title axis-title-${axis.key} user-text`, true).attr("data-axis-mode", modeKey)
        .attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "))
        .call(G.utils.applyDrag); const obj = G.utils.editableText(g, { x: 0, y: 0, text: axis.label, rotation: 0 }); obj.div.html(axis.label); obj.fo
        .attr("width", obj.div.node().scrollWidth + pad).attr("x", -(obj.div.node().scrollWidth + pad) / 2).attr("y", 0);
        obj.div.style("text-align", axis.anchor || "middle"); } else if (g.attr("data-axis-mode") !== modeKey) {
        const fo = g.select("foreignObject"); fo.select("div").html(axis.label); const w2 = fo.select("div").node().scrollWidth + pad;
        fo.attr("width", w2).attr("x", -w2 / 2).attr("y", 0); g.attr("data-axis-mode", modeKey);}
        g.attr("transform", `translate(${axis.pos[0]},${axis.pos[1]}) ${axis.rotation ? `rotate(${axis.rotation})` : ""}`.replace(/\s+/g, " "));});
    }

    G.axis.applyTickStyles = function(g, axisType, idx, scaleFs, defaultColor = 'currentColor') {
        const styles = (G.state.tickLabelStyles[axisType] || {})[idx] || {}; g.selectAll('text').classed('tick-label', true)
        .classed(`tick-${axisType}`, true).style('font-size', styles.fontSize || (scaleFs + 'px'))
        .style('fill', styles.color || defaultColor).style('font-family', styles.fontFamily || 'Arial')
        .style('font-weight', styles.fontWeight || 'normal').style('font-style', styles.fontStyle || 'normal').style('cursor', 'default');
    };

    function makeTickFormat(axisKey, idx = 0) {
        const FULL = d3.format(""); const ABBR = d3.format(".2s"); const SCI  = d3.format(".0e"); const S = G.state;
        let mode = 0; if (axisKey === 'x') {mode = S.overrideScaleformatX ?? 0;} else if (axisKey === 'y') {
        mode = S.overrideScaleformatY?.[idx] ?? 0;} else if (axisKey === 'a' || axisKey === 'b' || axisKey === 'c') {
        mode = S.overrideScaleformatTernary?.[axisKey] ?? 0;} return mode === 1 ? ABBR : mode === 2 ? SCI : FULL;
    }

    G.axis.addMinorTicks = function(axisGroup, scale, axisCtor, count = 0, size = 4, strokeWidth = 1, strokeColor = 'currentColor') {
        if (typeof scale.ticks !== 'function') return; let custom = null, key = null;
        if (axisGroup.attr('data-xi') != null) { custom = G.state.overrideCustomTicksX || null; sel = window.selectedAxisName === 'X'; key = 'X'; }
        else if (axisGroup.attr('data-yi') != null) { const yi = +axisGroup.attr('data-yi'); custom = (G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[yi]) || null; sel = window.selectedAxisName === (yi === 0 ? 'Y' : ('Y' + (yi + 1))); key = 'Y'+yi;}
        else if (axisGroup.attr('data-ai') != null) { custom = G.state.overrideCustomTicksTernary?.a || null; sel = window.selectedAxisName === 'A'; key = 'A';}
        else if (axisGroup.attr('data-bi') != null) { custom = G.state.overrideCustomTicksTernary?.b || null; sel = window.selectedAxisName === 'B'; key = 'B';}
        else if (axisGroup.attr('data-ci') != null) { custom = G.state.overrideCustomTicksTernary?.c || null; sel = window.selectedAxisName === 'C'; key = 'C';}
        if (G.state.minorTickOn[key] === false) return; const useCustom = G.state.useCustomTicksOn?.[key] === true;
        const domain = scale.domain(); let minors = []; if (useCustom) { if (!Array.isArray(custom) || custom.length < 2) return; 
        const t = custom.filter(Number.isFinite).sort((a,b) => a - b); for (let i = 0; i < t.length - 1; i++) { const mid = (t[i] + t[i + 1]) / 2; 
        if (mid >= domain[0] && mid <= domain[1]) minors.push(mid);}}
        else { if (axisCtor === d3.axisBottom) count = (G.state.overrideXTicks ?? G.state.overrideTernaryTicks?.a ?? count);
        else if (axisCtor === d3.axisLeft) count = (G.state.overrideYTicks?.[0] ?? G.state.overrideTernaryTicks?.b ?? count);
        else if (axisCtor === d3.axisRight) count = (G.state.overrideTernaryTicks?.c ?? count);
        if (count == null) return; const major = scale.ticks(count); if (major.length >= 2) { const step = major[1] - major[0];
        minors = major.slice(0, -1).map(v => v + step / 2); if (major[0] - step / 2 >= domain[0]) minors.unshift(major[0] - step / 2);
        if (major[major.length - 1] + step / 2 <= domain[1]) minors.push(major[major.length - 1] + step / 2);}} if (!minors.length) return;
        minors = minors.filter(v => v >= Math.min(domain[0], domain[1]) && v <= Math.max(domain[0], domain[1]));
        const mg = axisGroup.append('g').call(axisCtor(scale).tickValues(minors).tickSize(size).tickFormat('')); mg.select('path.domain').remove(); mg.selectAll('line').classed('minor-tick', true).attr('stroke-width', strokeWidth).attr('stroke', strokeColor);
    }

    function multiYaxis(svg, scales, s, series){
        const yScale = scales.y; const DIM = G.config.DIM;
        if (s.multiyaxis === 1 && ["line","area","scatter","scatterline"].includes(s.type) && series.length > 1) { scales.y2 = series.map((sv,i) => {
        if (i===0) return yScale; const [minY,maxY] = d3.extent(sv.y); return d3.scaleLinear().domain([minY - (maxY-minY)*0.06,
        maxY + (maxY-minY)*0.06]).range([DIM.H - DIM.MB, DIM.MT]);}); G.state.multiYScales = scales.y2; 
        if (G.state.overrideMultiY) { for (const [key, range] of Object.entries(G.state.overrideMultiY)) { const idx = +key;
        if (G.state.multiYScales[idx]) { G.state.multiYScales[idx].domain(range);}}} series.slice(1).forEach((sv,i) => { const axisIndex = i + 1;
        const customYi = G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[axisIndex];
        const countYi  = customYi ? null : (G.state.overrideYTicks && G.state.overrideYTicks[axisIndex] != null ? G.state.overrideYTicks[axisIndex] : s.yticks);
        const gYi=svg.append("g").attr("data-yi",axisIndex).attr("transform",`translate(${DIM.W-DIM.MR+i*s.multiygap},0)`).attr("stroke-width",s.scalewidth).call(d3.axisRight(G.state.multiYScales[axisIndex]).tickValues(customYi).ticks(countYi).tickFormat(makeTickFormat('y', axisIndex)));
        gYi.selectAll("path,line").attr("stroke",sv.color); G.axis.addMinorTicks(gYi,G.state.multiYScales[axisIndex],d3.axisRight,countYi,4,s.scalewidth,sv.color);
        G.axis.applyTickStyles(gYi,"y",axisIndex,s.scaleFs,sv.color);});}
    }

    G.axis.drawAxis = function(svg, scales, titles, s, series) {
        const DIM = G.config.DIM;
        if (["ternary","ternaryline","ternaryarea"].includes(s.type)) { svg.selectAll(".axis-title").remove(); G.axis.renderTernaryAxes(svg, s, DIM); return;}
        svg.selectAll(".axis-title.ternary").remove();  
        const xScale = scales.x, yScale = scales.y;
        const customX = G.state.overrideCustomTicksX, countX  = customX ? null : (G.state.overrideXTicks ?? s.xticks);
        const customY0 = G.state.overrideCustomTicksY && G.state.overrideCustomTicksY[0];
        const countY0  = customY0 ? null : (G.state.overrideYTicks && G.state.overrideYTicks[0] != null ? G.state.overrideYTicks[0] : s.yticks);
        const gX=svg.append("g").attr("data-xi",0).attr("transform","translate(0,"+(DIM.H-DIM.MB)+")").attr("stroke-width",s.scalewidth)
        .call(d3.axisBottom(xScale).tickValues(customX).ticks(countX).tickSize(6).tickPadding(4).tickFormat(s.type==="bar"?null:makeTickFormat('x', 0))); G.axis.applyTickStyles(gX,'x',0,s.scaleFs);
        const gY=svg.append("g").attr("data-yi",0).attr("transform","translate("+DIM.ML+",0)").attr("stroke-width",s.scalewidth)
        .call(d3.axisLeft(yScale).tickValues(customY0).ticks(countY0).tickSize(6).tickPadding(4).tickFormat(makeTickFormat('y', 0)));
        G.axis.applyTickStyles(gY,'y',0,s.scaleFs);
        G.axis.addMinorTicks(gX, xScale, d3.axisBottom, s.xticks, 4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gY, yScale, d3.axisLeft,  s.yticks, 4, s.scalewidth, 'currentColor');
        svg.append("line").attr("x1", DIM.ML).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.MT).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth);
        svg.append("line").attr("x1", DIM.W - DIM.MR).attr("y1", DIM.MT).attr("x2", DIM.W - DIM.MR).attr("y2", DIM.H - DIM.MB).attr("stroke", "black").attr("stroke-linecap", "square").attr("stroke-width", s.scalewidth); multiYaxis(svg, scales, s, series);
        axisTitle(svg, [{ key: "x", label: titles.x, pos: [DIM.W / 2, DIM.H - DIM.MB / 1.7], rotation: 0, anchor: "middle" }, { key: "y", label: titles.y, pos: [DIM.ML - 60, DIM.H / 2], rotation: -90, anchor: "middle" }], s.mode, DIM);
    };

    G.axis.renderTernaryAxes = function(svg, s, DIM) {
        G.axis.drawTernaryAxis(svg, s); const availW = DIM.W - DIM.ML - DIM.MR; const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH   = side * Math.sqrt(3) / 2;
        const pA = [ DIM.ML + (availW - side) / 2, DIM.MT + (availH - triH) / 2 + triH ];
        const pB = [ pA[0] + side, pA[1] ]; const pC = [ pA[0] + side / 2, pA[1] - triH ];
        const ternaryTitles = [{ text: "A-axis", x: (pB[0] + pC[0]) / 2 + 50, y: (pB[1] + pC[1]) / 2 - 25, rot: 60, cls: "tern-x" },
        { text: "B-axis", x: (pA[0] + pC[0]) / 2 - 50, y: (pA[1] + pC[1]) / 2 - 25, rot: -60, cls: "tern-y" },
        { text: "C-axis", x: (pA[0] + pB[0]) / 2, y: pA[1] + 25, rot: 0,   cls: "tern-z" }];
        ternaryTitles.forEach(({ text, x, y, rot, cls }) => { const g = svg.append("g")
        .classed(`axis-title ternary ${cls} user-text`, true).attr("transform", `translate(${x},${y}) rotate(${rot})`);
        const { fo, div } = G.utils.editableText(g, { x: 0, y: 0, text, rotation: 0 }); const pad = 5;
        fo.attr("width", div.node().scrollWidth + pad).attr("x", - (div.node().scrollWidth + pad) / 2);});
    };
    
    G.axis.drawTernaryAxis = function(svg,s) {
        const DIM = G.config.DIM; const availW = DIM.W - DIM.ML - DIM.MR; const availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)); const triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2; const p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side; const p2y = p1y; const p3x = p1x + side / 2; const p3y = p1y - triH;
        const domA = G.state.overrideTernary?.a || [0, 100]; const domB = G.state.overrideTernary?.b || [0, 100];
        const domC = G.state.overrideTernary?.c || [0, 100]; const scaleA = d3.scaleLinear().domain(domA).range([0, side]);
        const scaleB = d3.scaleLinear().domain(domB).range([side, 0]); const scaleC = d3.scaleLinear().domain(domC).range([0, side]);
        const customA = G.state.overrideCustomTicksTernary?.a;
        const customB = G.state.overrideCustomTicksTernary?.b;
        const customC = G.state.overrideCustomTicksTernary?.c;
        const countA = customA ? null : (G.state.overrideTernaryTicks?.a ?? s.xticks);
        const countB = customB ? null : (G.state.overrideTernaryTicks?.b ?? s.xticks);
        const countC = customC ? null : (G.state.overrideTernaryTicks?.c ?? s.xticks);
        G.state.axisScales = { a: scaleA, b: scaleB, c: scaleC };    
        const gA=svg.append("g").attr("data-ai",0).attr("transform",`translate(${p1x},${p1y})`).attr("stroke-width",s.scalewidth).call(d3.axisBottom(scaleA).tickValues(customA).ticks(countA).tickSize(6).tickPadding(4));
        G.axis.applyTickStyles(gA,'a',0,s.scaleFs);
        const gB=svg.append("g").attr("data-bi",0).attr("transform",`translate(${p1x},${p1y}) rotate(210)`).attr("stroke-width",s.scalewidth).call(d3.axisLeft(scaleB).tickValues(customB).ticks(countB).tickSize(-6).tickPadding(15));
        gB.selectAll("text").attr("transform","rotate(-210)").style("text-anchor","middle").attr("dy","0px");
        G.axis.applyTickStyles(gB,'b',0,s.scaleFs);
        const gC=svg.append("g").attr("data-ci",0).attr("transform",`translate(${p2x},${p1y}) rotate(150)`).attr("stroke-width",s.scalewidth).call(d3.axisRight(scaleC).tickValues(customC).ticks(countC).tickSize(-6).tickPadding(15));
        gC.selectAll("text").attr("transform","rotate(-150)").style("text-anchor","middle").attr("dy","0px");
        G.axis.applyTickStyles(gC,'c',0,s.scaleFs);
        G.axis.addMinorTicks(gA, scaleA, d3.axisBottom, countA, 4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gB, scaleB, d3.axisLeft, countB, -4, s.scalewidth, 'currentColor');
        G.axis.addMinorTicks(gC, scaleC, d3.axisRight, countC, -4, s.scalewidth, 'currentColor');
    };
    
    G.axis.drawTernaryGridLines = function(svg, s) {
        const DIM = G.config.DIM; const availW = DIM.W - DIM.ML - DIM.MR, availH = DIM.H - DIM.MT - DIM.MB;
        const side = Math.min(availW, 2 * availH / Math.sqrt(3)), triH = side * Math.sqrt(3) / 2;
        const p1x = DIM.ML + (availW - side) / 2, p1y = DIM.MT + (availH - triH) / 2 + triH;
        const p2x = p1x + side, p2y = p1y, p3x = p1x + side / 2, p3y = p1y - triH;
        const ot = G.state.overrideTernary || {}; const domains = [ot.a || [0, 100], ot.b || [0, 100], ot.c || [0, 100]];
        const verts = [[p1x, p1y, p2x, p2y, p3x, p3y],[p2x, p2y, p1x, p1y, p3x, p3y],[p3x, p3y, p1x, p1y, p2x, p2y]];
        [d3.scaleLinear().domain(domains[0]).range([0, side]), d3.scaleLinear().domain(domains[1]).range([side, 0]), d3.scaleLinear().domain(domains[2]).range([0, side])].forEach((scale, i) => scale.ticks(s.xticks).forEach(t => {
        if (t <= domains[i][0] || t >= domains[i][1]) return;const tt = (t - domains[i][0]) / (domains[i][1] - domains[i][0]);
        const [x0, y0, x1, y1, x2, y2] = verts[i]; svg.append("line").attr("x1", x0 + (x1 - x0) * tt).attr("y1", y0 + (y1 - y0) * tt)
        .attr("x2", x0 + (x2 - x0) * tt).attr("y2", y0 + (y2 - y0) * tt)
        .attr("stroke", s.gridcolor || "#ccc").attr("stroke-width", s.gridwidth || 1).attr("stroke-dasharray", "2,2");}));
    };
})(window.GraphPlotter);
