(function (G) {
    const DIM = G.DIM;

    G.rgbToHex = function (rgb) {
        return "#" + rgb.match(/\d+/g).map(n => (+n).toString(16).padStart(2, "0")).join("");
    };

    G.clearActive = function () {
        if (G.activeGroup) { G.activeGroup.select(".outline").attr("visibility", "hidden"); G.activeGroup = null; }
        if (G.activeText) { G.activeText.attr("contenteditable", false).style("border", null); G.activeText = null; }
        if (G.activeDiv) { G.activeDiv.attr("contenteditable", false).style("border", null).style("cursor", "move"); G.activeDiv = null; }
        if (G.activeTicks) {
            G.activeTicks.attr('contenteditable', false).style('outline', null).style('cursor', 'pointer');
            G.activeTicks = null;
            document.getElementById("axis-label").textContent = "Axis Settings: Select Axis";
            document.getElementById("scalemin").value = "";
            document.getElementById("scalemax").value = "";
            document.getElementById("customticks").value = "";
        }
        G.activeFo = null;
        d3.select("#boldBtn").classed("active", false);
        d3.select("#italicBtn").classed("active", false);
        d3.select("#removebtn").classed("disabled", true);
        window.getSelection().removeAllRanges();
        ['scalemin', 'scalemax', 'tickcount', 'scaleformat', 'customticks', 'useCustomTicks', 'showMinorTicks'].forEach(id => {
            document.getElementById(id).disabled = true;
        });
    };

    G.editableText = function (container, opts) {
        const pad = 2;
        const fo = container.append("foreignObject").attr("x", opts.x).attr("y", opts.y)
            .attr("transform", opts.rotation ? `rotate(${opts.rotation},${opts.x},${opts.y})` : null).attr("overflow", "visible");
        const div = fo.append("xhtml:div").attr("contenteditable", false).style("display", "inline-block").style("white-space", "nowrap")
            .style("padding", `${pad}px`).style("cursor", "move").style("font-size", "12px").html(opts.text);
        const w = div.node().scrollWidth;
        const h = div.node().scrollHeight;
        fo.attr("width", w + pad).attr("height", h + pad);
        div.on("input", () => {
            const nw = div.node().scrollWidth;
            const nh = div.node().scrollHeight;
            fo.attr("width", nw + pad).attr("height", nh + pad);
        }).on("keydown", e => { if (e.key === "Enter") { e.preventDefault(); div.node().blur(); } })
            .on("blur", () => { d3.select(div.node()).style("cursor", "move"); });
        return { fo, div, pad };
    };

    G.updateInspector = function (selection) {
        const node = selection.node();
        const cs = window.getComputedStyle(node);
        const size = parseFloat(selection.attr("stroke-width")) || parseInt(cs.fontSize, 10);
        const col = node.tagName === "DIV" ? cs.color : (cs.stroke !== "none" ? cs.stroke : cs.fill);
        d3.select("#addedtextsize").property("value", size);
        d3.select("#addedtextcolor").property("value", G.rgbToHex(col));
        const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
        d3.select("#fontfamily").property("value", fam);
        d3.select("#boldBtn").classed("active", cs.fontWeight === "700" || cs.fontWeight === "bold");
        d3.select("#italicBtn").classed("active", cs.fontStyle === "italic");
        d3.select("#removebtn").classed("disabled", false);
    };

    function dragStarted(event) {
        G.hot.deselectCell();
        event.sourceEvent.preventDefault();
        G.clearActive();
        const sel = d3.select(this).raise();
        if (sel.classed("shape-group")) {
            G.activateShape(sel);
        } else {
            const fo = sel.node().tagName === "foreignObject" ? sel : sel.select("foreignObject");
            const div = fo.select("div");
            G.activateText(div, fo);
            setTimeout(() => { window.getSelection().selectAllChildren(div.node()); }, 0);
        }
    }

    function dragged(event) {
        const sel = d3.select(this);
        const t = sel.attr("transform") || "";
        const m = t.match(/translate\(([^,]+),([^)]+)\)/) || [];
        const x = +m[1] || 0, y = +m[2] || 0;
        const rot = (/rotate\(([^)]+)\)/.exec(t) || [])[0] || "";
        sel.attr("transform", `translate(${x + event.dx},${y + event.dy})${rot}`);
    }

    function dragEnded() {
        const sel = d3.select(this);
        if (sel.classed("user-text") || sel.classed("axis-title") || sel.classed("legend-group")) {
            const div = sel.select("foreignObject div");
            if (sel.classed("legend-group")) { this.dataset.savedTransform = sel.attr("transform"); }
            div.on("blur", () => { div.attr("contenteditable", false).style("cursor", "move"); });
        }
    }

    G.applyDrag = d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded);

    G.activateShape = function (g) {
        if (G.activeGroup === g) return;
        g.select(".outline").attr("visibility", "visible");
        G.activeGroup = g;
        G.updateInspector(g.select(".shape"));
    };

    G.activateText = function (div, fo) {
        if (G.activeText === div) return;
        div.attr("contenteditable", true).style("border", "1px solid rgb(74,144,226)").node().focus();
        G.activeText = div;
        G.activeFo = fo;
        G.updateInspector(div);
        const el = div.node();
        setTimeout(() => {
            const range = document.createRange();
            range.selectNodeContents(el);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }, 0);
    };

    G.disableAreaCal = function () {
        const cb = document.getElementById('enableAreaCalc');
        if (cb && cb.checked) {
            cb.checked = false;
            cb.dispatchEvent(new Event('change'));
        }
    };

    G.checkEmptyColumns = function () {
        const data = G.hot.getData();
        const dm = document.querySelector('label[for="icon1"]');
        if (!dm) return;
        const shouldShow = data[0].some((_, c) => G.colEnabled[c] && data.slice(3).every(r => r[c] == null || r[c] === "" || isNaN(+r[c])));
        const existingBadge = dm.querySelector(".warning-badge");
        if (shouldShow) {
            if (!existingBadge) {
                const b = document.createElement("span");
                b.className = "warning-badge";
                b.textContent = "!";
                dm.appendChild(b);
            }
        } else if (existingBadge) {
            existingBadge.remove();
        }
    };

    G.detectModeFromData = function () {
        const series = G.getSeries();
        if (!series || !series.length) return null;
        const xVals = series[0].x.filter(v => Number.isFinite(v));
        if (!xVals.length) return null;
        const minX = Math.min(...xVals), maxX = Math.max(...xVals);
        if (minX >= 180 && minX <= 200 && maxX === 800) return 'uvvis';
        if (minX >= 398 && minX <= 400 && maxX === 4000) return 'ftir';
        if (minX >= 0 && minX <= 10 && maxX >= 80 && maxX <= 90) return 'xrd';
        return null;
    };

})(window.GraphPlotter);
