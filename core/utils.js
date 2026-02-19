(function(G) {
    "use strict";
    G.utils.escapeHTML = function(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, ch => (
            ch === "&" ? "&amp;" :
            ch === "<" ? "&lt;" :
            ch === ">" ? "&gt;" :
            ch === '"' ? "&quot;" : "&#39;"
        ));
    };
    G.utils.clearActive = function() { 
        const S = G.state;
        if (S.activeGroup) { S.activeGroup.select(".outline").attr("visibility", "hidden"); S.activeGroup = null;}
        if (S.activeText) { S.activeText.attr("contenteditable", false).style("border", null); S.activeText = null;}
        if (S.activeDiv) { S.activeDiv.attr("contenteditable", false).style("border", null).style("cursor", "move"); S.activeDiv = null;}
        if (S.activeTicks) { S.activeTicks.attr('contenteditable', false).style('outline', null).style('cursor', 'pointer'); S.activeTicks = null; document.getElementById("axis-label").textContent = "Axis Settings: Select Axis"; document.getElementById("scalemin").value = ""; document.getElementById("scalemax").value = ""; document.getElementById("customticks").value = "";} S.activeFo = null; 
        if(G.ui.refs.boldBtn) G.ui.refs.boldBtn.classed("active", false); 
        if(G.ui.refs.italicBtn) G.ui.refs.italicBtn.classed("active", false); 
        if(G.ui.refs.rmBtn) G.ui.refs.rmBtn.classed("disabled", true); 
        window.getSelection().removeAllRanges();
        ['scalemin','scalemax','tickcount','scaleformat','customticks','useCustomTicks','showMinorTicks'].forEach(id => { document.getElementById(id).disabled = true;});
    };
    G.utils.rgbToHex = function(rgb) { return "#"+rgb.match(/\d+/g).map(n=>(+n).toString(16).padStart(2,"0")).join(""); };
    function dragStarted(event) {
        G.state.hot.deselectCell(); event.sourceEvent.preventDefault(); G.utils.clearActive(); const sel = d3.select(this).raise(); 
        if (sel.classed("shape-group")) { G.features.activateShape(sel);} else { const fo  = sel.node().tagName === "foreignObject" ? sel : sel.select("foreignObject"); const div = fo.select("div"); G.features.activateText(div, fo); setTimeout(() => { window.getSelection().selectAllChildren(div.node());}, 0);}
    }
    function dragged(event) {
        const sel = d3.select(this); const t = sel.attr("transform") || ""; const m = t.match(/translate\(([^,]+),([^)]+)\)/) || [];
        const x = +m[1] || 0, y = +m[2] || 0; const rot = (/rotate\(([^)]+)\)/.exec(t) || [])[0] || "";
        sel.attr("transform", `translate(${x + event.dx},${y + event.dy})${rot}`);
    }
    function dragEnded() {
        const sel = d3.select(this); if (sel.classed("user-text") || sel.classed("axis-title") || sel.classed("legend-group") || sel.classed("xrd-ref-legend-group")) {
        const div = sel.select("foreignObject div"); if (sel.classed("legend-group") || sel.classed("xrd-ref-legend-group")) { this.dataset.savedTransform = sel.attr("transform");} div.on("blur", () => { div.attr("contenteditable", false).style("cursor", "move");});}
    }
    G.utils.applyDrag = d3.drag().on("start", dragStarted).on("drag", dragged).on("end", dragEnded);
    G.utils.updateInspector = function(selection) {
        const node = selection.node(); const cs = window.getComputedStyle(node);
        const size = parseFloat(selection.attr("stroke-width")) || parseInt(cs.fontSize, 10);
        const col  = node.tagName === "DIV" ? cs.color : (cs.stroke !== "none" ? cs.stroke : cs.fill);
        G.ui.refs.sizeCtrl.property("value", size);
        G.ui.refs.colorCtrl.property("value", G.utils.rgbToHex(col));
        const fam = cs.fontFamily.split(",")[0].replace(/['"]/g, "");
        G.ui.refs.fontCtrl.property("value", fam);
        const isBold = cs.fontWeight === "700" || cs.fontWeight === "bold";
        G.ui.refs.boldBtn.classed("active", isBold);
        const isItalic = cs.fontStyle === "italic";
        G.ui.refs.italicBtn.classed("active", isItalic);    
        G.ui.refs.rmBtn.classed("disabled", false);
    };
    G.utils.editableText = function(container, { x, y, text, rotation }) {
        const pad = 2; const fo = container.append("foreignObject").attr("x", x).attr("y", y)
        .attr("transform", rotation ? `rotate(${rotation},${x},${y})` : null).attr("overflow", "visible");
        const div = fo.append("xhtml:div").attr("contenteditable", false).style("display", "inline-block").style("white-space", "nowrap")
        .style("padding", `${pad}px`).style("cursor", "move").style("font-size", "12px").text(String(text == null ? "" : text)); const w = div.node().scrollWidth;
        const h = div.node().scrollHeight; fo.attr("width",  w + pad).attr("height", h + pad); div.on("input", () => {
        const nw = div.node().scrollWidth; const nh = div.node().scrollHeight; fo.attr("width",  nw + pad).attr("height", nh + pad);})
        .on("paste", function(e) {
            e.preventDefault();
            const plain = (e.clipboardData || window.clipboardData).getData("text/plain");
            const usedExec = typeof document.execCommand === "function" && document.execCommand("insertText", false, plain);
            if (usedExec) return;
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) { this.textContent += plain; return; }
            sel.deleteFromDocument();
            const tn = document.createTextNode(plain);
            const range = sel.getRangeAt(0);
            range.insertNode(tn);
            range.setStartAfter(tn);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        })
        .on("keydown", function(e) { if (e.key === "Enter") { e.preventDefault(); this.blur();}}).on("blur", () => {
        d3.select(div.node()).style("cursor", "move");}); return { fo, div, pad };
    };
})(window.GraphPlotter);
