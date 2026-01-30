(function (G) {
    const DIM = G.DIM;

    G.tickEditing = function (svg) {
        svg.selectAll("g.tick,path.domain,text.tick-label,line.minor-tick,g.tick line").style("cursor", "pointer").on("click", event => {
            event.stopPropagation();
            G.clearActive();
            if (!(document.querySelector('input[name="charttype"]:checked').id === 'bar' && d3.select(event.currentTarget).classed('tick-x'))) {
                ['scalemin', 'scalemax', 'tickcount', 'scaleformat', 'customticks', 'useCustomTicks', 'showMinorTicks'].forEach(id => document.getElementById(id).disabled = false);
            }
            const tgt = event.currentTarget;
            const axisGrp = tgt.tagName === "path" ? tgt.parentNode : tgt.tagName === "g" ? tgt : tgt.closest("g[data-xi],g[data-yi],g[data-ai],g[data-bi],g[data-ci]");
            if (!axisGrp) return;
            const xi = axisGrp.getAttribute("data-xi"), yi = axisGrp.getAttribute("data-yi"), ai = axisGrp.getAttribute("data-ai"), bi = axisGrp.getAttribute("data-bi"), ci = axisGrp.getAttribute("data-ci");
            let axisTicks, domain, axisName, key;
            if (xi != null) {
                axisName = "X"; key = "X";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-x");
                domain = window.lastXScale.domain();
            } else if (yi != null) {
                axisName = yi === "0" ? "Y" : `Y${+yi + 1}`;
                key = "Y" + (+yi);
                axisTicks = d3.select(axisGrp).selectAll("text.tick-y");
                domain = (window.multiYScales?.[yi] || window.lastYScale).domain();
                window.activeYi = +yi;
            } else if (ai != null) {
                axisName = "A"; key = "A";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-a");
                domain = window.axisScales.a.domain();
            } else if (bi != null) {
                axisName = "B"; key = "B";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-b");
                domain = window.axisScales.b.domain();
            } else if (ci != null) {
                axisName = "C"; key = "C";
                axisTicks = d3.select(axisGrp).selectAll("text.tick-c");
                domain = window.axisScales.c.domain();
            } else return;
            window.selectedAxisName = axisName;
            axisTicks.attr("contenteditable", true).style("outline", "1px solid #4A90E2").style("cursor", "pointer");
            G.activeTicks = axisTicks;
            const el = id => document.getElementById(id);
            const lbl = el("axis-label"), minI = el("scalemin"), maxI = el("scalemax"), tc = el("tickcount"), sf = el("scaleformat"), chk = el("useCustomTicks"), ctk = el("customticks");
            lbl.textContent = "Axis Settings: " + axisName;
            minI.value = domain[0].toFixed(2);
            maxI.value = domain[1].toFixed(2);
            const isABC = ["A", "B", "C"].includes(axisName);
            const isY = axisName.startsWith("Y");
            const overrides = axisName === "X" ? window.overrideCustomTicksX : isABC ? window.overrideCustomTicksTernary?.[axisName.toLowerCase()] : window.overrideCustomTicksY?.[window.activeYi];
            ctk.value = overrides?.join(",") || "";
            tc.value = (axisName === "X" ? window.overrideXTicks : isABC ? window.overrideTernaryTicks?.[axisName.toLowerCase()] : window.overrideYTicks?.[window.activeYi]) || axisTicks.size();
            sf.value = axisName === "X" ? (window.overrideScaleformatX ?? 0) : axisName.startsWith("Y") ? (window.overrideScaleformatY?.[window.activeYi] ?? 0) : (window.overrideScaleformatTernary?.[axisName.toLowerCase()] ?? 0);
            document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][+sf.value];
            const okA = axisName === "X" || isY || isABC;
            chk.disabled = !okA;
            chk.checked = !!(window.useCustomTicksOn && window.useCustomTicksOn[key]);
            sf.disabled = isABC;
            tc.disabled = chk.checked;
            ctk.disabled = !chk.checked;
            const smt = document.getElementById('showMinorTicks');
            smt.disabled = false;
            smt.checked = window.minorTickOn[key] !== false;
        });
    };

    G.bindScaleInputs = function () {
        function bindScaleInput(id, isMin) {
            document.getElementById(id).addEventListener("input", e => {
                const me = parseFloat(e.target.value),
                    other = parseFloat(document.getElementById(id === "scalemin" ? "scalemax" : "scalemin").value);
                if (isNaN(me) || isNaN(other)) return;
                if (window.selectedAxisName === "X") {
                    window.overrideX = isMin ? [me, other] : [other, me];
                } else if (window.selectedAxisName.startsWith("Y")) {
                    const yi = window.activeYi || 0;
                    window.overrideMultiY = window.overrideMultiY || {};
                    window.overrideMultiY[yi] = isMin ? [me, other] : [other, me];
                } else if (["A", "B", "C"].includes(window.selectedAxisName)) {
                    const letter = window.selectedAxisName.toLowerCase();
                    window.overrideTernary = window.overrideTernary || {};
                    window.overrideTernary[letter] = isMin ? [me, other] : [other, me];
                }
                G.renderChart();
            });
        }
        bindScaleInput("scalemin", true);
        bindScaleInput("scalemax", false);

        document.getElementById('tickcount').addEventListener('input', function () {
            const n = +this.value;
            if (window.selectedAxisName === "X") {
                window.overrideXTicks = n;
            } else if (window.selectedAxisName === "Y" || window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi;
                window.overrideYTicks = window.overrideYTicks || {};
                window.overrideYTicks[yi] = n;
            } else if (["A", "B", "C"].includes(window.selectedAxisName)) {
                window.overrideTernaryTicks = window.overrideTernaryTicks || {};
                window.overrideTernaryTicks[window.selectedAxisName.toLowerCase()] = n;
            }
            G.renderChart();
        });

        document.getElementById('scaleformat').addEventListener('input', function () {
            const v = +this.value;
            document.querySelector('label[for="scaleformat"]').textContent = ["Format: 00", "Format: K", "Format: e"][v];
            if (window.selectedAxisName === "X") {
                window.overrideScaleformatX = v;
            } else if (window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi || 0;
                window.overrideScaleformatY = window.overrideScaleformatY || {};
                window.overrideScaleformatY[yi] = v;
            }
            G.renderChart();
        });

        document.getElementById('customticks').addEventListener('input', function () {
            const txt = this.value.trim();
            const vals = txt ? txt.split(',').map(s => parseFloat(s.trim())).filter(v => !isNaN(v)) : null;
            if (window.selectedAxisName === "X") {
                window.overrideCustomTicksX = vals;
            } else if (window.selectedAxisName.startsWith("Y")) {
                const yi = window.activeYi || 0;
                window.overrideCustomTicksY = window.overrideCustomTicksY || {};
                if (vals) window.overrideCustomTicksY[yi] = vals;
                else delete window.overrideCustomTicksY[yi];
            } else {
                const cls = Array.from(G.activeTicks.nodes()[0].classList).find(c => c.startsWith('tick-') && !['tick-label', 'tick-x', 'tick-y'].includes(c));
                if (cls) {
                    const letter = cls.split('-')[1];
                    window.overrideCustomTicksTernary = window.overrideCustomTicksTernary || {};
                    if (vals) window.overrideCustomTicksTernary[letter] = vals;
                    else delete window.overrideCustomTicksTernary[letter];
                }
            }
            G.renderChart();
        });

        document.getElementById('useCustomTicks').addEventListener('change', function () {
            const use = this.checked, ct = document.getElementById('customticks'), tc = document.getElementById('tickcount');
            ct.disabled = !use;
            tc.disabled = use;
            const key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName;
            window.useCustomTicksOn = window.useCustomTicksOn || {};
            window.useCustomTicksOn[key] = use;
            const parse = s => s.trim() ? s.split(',').map(v => +v.trim()).filter(Number.isFinite) : [];
            if (use) {
                const vals = parse(ct.value);
                if (key === 'X') { window.overrideCustomTicksX = vals; }
                else if (key.startsWith('Y')) { const yi = window.activeYi || 0; window.overrideCustomTicksY = window.overrideCustomTicksY || {}; window.overrideCustomTicksY[yi] = vals; }
                else { const l = key.toLowerCase(); window.overrideCustomTicksTernary = window.overrideCustomTicksTernary || {}; window.overrideCustomTicksTernary[l] = vals; }
            } else {
                if (key === 'X') { window.overrideCustomTicksX = null; }
                else if (key.startsWith('Y')) { const yi = window.activeYi || 0; window.overrideCustomTicksY && delete window.overrideCustomTicksY[yi]; }
                else { const l = key.toLowerCase(); window.overrideCustomTicksTernary && delete window.overrideCustomTicksTernary[l]; }
            }
            G.renderChart();
        });

        document.getElementById('showMinorTicks').addEventListener('change', function () {
            if (!window.selectedAxisName) return;
            let key = window.selectedAxisName === 'X' ? 'X' : window.selectedAxisName.startsWith('Y') ? ('Y' + (window.activeYi || 0)) : window.selectedAxisName;
            window.minorTickOn[key] = this.checked;
            G.renderChart();
        });
    };

})(window.GraphPlotter);
