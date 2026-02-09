(function (G) {
    "use strict";
    G.axis.tickEditing = function (svg) {
        svg.selectAll("g.tick,path.domain,text.tick-label,line.minor-tick,g.tick line").style("cursor", "pointer").on("click", event => {
            event.stopPropagation(); G.utils.clearActive();
            if (!(document.querySelector('input[name="charttype"]:checked').id === 'bar' && d3.select(event.currentTarget).classed('tick-x'))) {
                ['scalemin', 'scalemax', 'tickcount', 'scaleformat', 'customticks', 'useCustomTicks', 'showMinorTicks'].forEach(id => document.getElementById(id).disabled = false);
            }
            const tgt = event.currentTarget; const axisGrp = tgt.tagName === "path" ? tgt.parentNode : tgt.tagName === "g" ? tgt : tgt.closest("g[data-xi],g[data-yi],g[data-ai],g[data-bi],g[data-ci]"); if (!axisGrp) return;
            const xi = axisGrp.getAttribute("data-xi"), yi = axisGrp.getAttribute("data-yi"), ai = axisGrp.getAttribute("data-ai"), bi = axisGrp.getAttribute("data-bi"), ci = axisGrp.getAttribute("data-ci"); let axisTicks, domain, axisName, key;
            if (xi != null) { axisName = "X"; key = "X"; axisTicks = d3.select(axisGrp).selectAll("text.tick-x"); domain = G.state.lastXScale.domain(); }
            else if (yi != null) { axisName = yi === "0" ? "Y" : `Y${+yi + 1}`; key = "Y" + (+yi); axisTicks = d3.select(axisGrp).selectAll("text.tick-y"); domain = (G.state.multiYScales?.[yi] || G.state.lastYScale).domain(); window.activeYi = +yi; }
            else if (ai != null) { axisName = "A"; key = "A"; axisTicks = d3.select(axisGrp).selectAll("text.tick-a"); domain = G.state.axisScales.a.domain(); }
            else if (bi != null) { axisName = "B"; key = "B"; axisTicks = d3.select(axisGrp).selectAll("text.tick-b"); domain = G.state.axisScales.b.domain(); }
            else if (ci != null) { axisName = "C"; key = "C"; axisTicks = d3.select(axisGrp).selectAll("text.tick-c"); domain = G.state.axisScales.c.domain(); }
            else return; window.selectedAxisName = axisName;
            axisTicks.attr("contenteditable", true).style("outline", "1px solid #4A90E2").style("cursor", "pointer"); G.state.activeTicks = axisTicks;
            const el = id => document.getElementById(id); const lbl = el("axis-label"); const minI = el("scalemin"); const maxI = el("scalemax");
            const tc = el("tickcount"); const sf = el("scaleformat"); const chk = el("useCustomTicks"); const ctk = el("customticks");
            lbl.textContent = "Axis Settings: " + axisName; minI.value = domain[0].toFixed(2); maxI.value = domain[1].toFixed(2);
            const isABC = ["A", "B", "C"].includes(axisName); const isY = axisName.startsWith("Y");
            const overrides = axisName === "X" ? G.state.overrideCustomTicksX : isABC ? G.state.overrideCustomTicksTernary?.[axisName.toLowerCase()] : G.state.overrideCustomTicksY?.[window.activeYi]; ctk.value = overrides?.join(",") || "";
            tc.value = (axisName === "X" ? G.state.overrideXTicks : isABC ? G.state.overrideTernaryTicks?.[axisName.toLowerCase()] : G.state.overrideYTicks?.[window.activeYi]) || axisTicks.size();
            sf.value = axisName === "X" ? (G.state.overrideScaleformatX ?? 0) : axisName.startsWith("Y") ? (G.state.overrideScaleformatY?.[window.activeYi] ?? 0) : (G.state.overrideScaleformatTernary?.[axisName.toLowerCase()] ?? 0); document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][+sf.value];
            const okA = axisName === "X" || isY || isABC; chk.disabled = !okA; chk.checked = !!(G.state.useCustomTicksOn && G.state.useCustomTicksOn[key]); sf.disabled = isABC;
            tc.disabled = chk.checked; ctk.disabled = !chk.checked; const smt = document.getElementById('showMinorTicks'); smt.disabled = false; smt.checked = G.state.minorTickOn[key] !== false;
        });
    };
    function bindScaleInput(id, isMin) {
        document.getElementById(id).addEventListener("input", e => {
            if (!window.selectedAxisName) return;
            const me = parseFloat(e.target.value),
                other = parseFloat(document.getElementById(id === "scalemin" ? "scalemax" : "scalemin").value);
            if (isNaN(me) || isNaN(other)) return; if (window.selectedAxisName === "X") { G.state.overrideX = isMin ? [me, other] : [other, me]; }
            else if (window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi || 0; G.state.overrideMultiY = G.state.overrideMultiY || {};
                G.state.overrideMultiY[yi] = isMin ? [me, other] : [other, me];
            } else if (["A", "B", "C"].includes(window.selectedAxisName)) { const letter = window.selectedAxisName.toLowerCase(); G.state.overrideTernary = G.state.overrideTernary || {}; G.state.overrideTernary[letter] = isMin ? [me, other] : [other, me]; } G.renderChart();
        });
    } bindScaleInput("scalemin", true); bindScaleInput("scalemax", false);
    document.getElementById('tickcount').addEventListener('input', function () {
        if (!window.selectedAxisName) return;
        const n = +this.value; if (window.selectedAxisName === "X") { G.state.overrideXTicks = n; }
        else if (window.selectedAxisName === "Y" || window.selectedAxisName.startsWith("Y")) {
            const yi = window.activeYi; G.state.overrideYTicks = G.state.overrideYTicks || {}; G.state.overrideYTicks[yi] = n;
        }
        else if (["A", "B", "C"].includes(window.selectedAxisName)) {
            G.state.overrideTernaryTicks = G.state.overrideTernaryTicks || {};
            G.state.overrideTernaryTicks[window.selectedAxisName.toLowerCase()] = n;
        } G.renderChart();
    });
    document.getElementById('scaleformat').addEventListener('input', function () {
        if (!window.selectedAxisName) return;
        const v = +this.value; document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][v];
        if (window.selectedAxisName === "X") { G.state.overrideScaleformatX = v; }
        else if (window.selectedAxisName.startsWith("Y")) {
            const yi = window.activeYi || 0;
            G.state.overrideScaleformatY = G.state.overrideScaleformatY || {};
            G.state.overrideScaleformatY[yi] = v;
        } G.renderChart();
    });
    document.getElementById('customticks').addEventListener('input', function () {
        if (!window.selectedAxisName) return;
        const txt = this.value.trim(); const vals = txt ? txt.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v)) : null;
        if (window.selectedAxisName === "X") { G.state.overrideCustomTicksX = vals; } else if (window.selectedAxisName.startsWith("Y")) {
            const yi = window.activeYi || 0; G.state.overrideCustomTicksY = G.state.overrideCustomTicksY || {};
            if (vals) G.state.overrideCustomTicksY[yi] = vals; else delete G.state.overrideCustomTicksY[yi];
        }
        else {
            const cls = Array.from(G.state.activeTicks.nodes()[0].classList).find(c => c.startsWith('tick-')
                && !['tick-label', 'tick-x', 'tick-y'].includes(c)); if (cls) {
                    const letter = cls.split('-')[1];
                    G.state.overrideCustomTicksTernary = G.state.overrideCustomTicksTernary || {};
                    if (vals) G.state.overrideCustomTicksTernary[letter] = vals; else delete G.state.overrideCustomTicksTernary[letter];
                }
        } G.renderChart();
    });
    document.getElementById('useCustomTicks').addEventListener('change', function () {
        if (!window.selectedAxisName) return;
        const use = this.checked, ct = document.getElementById('customticks'), tc = document.getElementById('tickcount'); ct.disabled = !use; tc.disabled = use;
        const key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName;
        G.state.useCustomTicksOn = G.state.useCustomTicksOn || {}; G.state.useCustomTicksOn[key] = use;
        const parse = s => s.trim() ? s.split(',').map(v => +v.trim()).filter(Number.isFinite) : [];
        if (use) {
            const vals = parse(ct.value); if (key === 'X') { G.state.overrideCustomTicksX = vals; }
            else if (key.startsWith('Y')) {
                const yi = window.activeYi || 0; G.state.overrideCustomTicksY = G.state.overrideCustomTicksY || {};
                G.state.overrideCustomTicksY[yi] = vals;
            } else { const l = key.toLowerCase(); G.state.overrideCustomTicksTernary = G.state.overrideCustomTicksTernary || {}; G.state.overrideCustomTicksTernary[l] = vals; }
        } else {
            if (key === 'X') { G.state.overrideCustomTicksX = null; }
            else if (key.startsWith('Y')) { const yi = window.activeYi || 0; G.state.overrideCustomTicksY && delete G.state.overrideCustomTicksY[yi]; }
            else { const l = key.toLowerCase(); G.state.overrideCustomTicksTernary && delete G.state.overrideCustomTicksTernary[l]; }
        } G.renderChart();
    });
    document.getElementById('showMinorTicks').addEventListener('change', function () {
        if (!window.selectedAxisName) return; let key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName; G.state.minorTickOn[key] = this.checked; G.renderChart();
    });
})(window.GraphPlotter);
