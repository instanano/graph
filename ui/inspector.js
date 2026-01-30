(function (G) {

    G.updateTickStyle = function (a, b) {
        if (!G.activeTicks) return;
        var c = a == 'color' ? 'fill' : a == 'fontSize' ? 'font-size' : a == 'fontFamily' ? 'font-family' : a == 'fontWeight' ? 'font-weight' : a == 'fontStyle' ? 'font-style' : a,
            d = (G.activeTicks.attr('class') || '').split(/\s+/).find(e => e.startsWith('tick-') && e !== 'tick-label');
        if (!d) return;
        var t = d.slice(5), i = t == 'y' ? window.activeYi || 0 : 0;
        G.tickLabelStyles[t] = G.tickLabelStyles[t] || {};
        G.tickLabelStyles[t][i] = G.tickLabelStyles[t][i] || {};
        G.tickLabelStyles[t][i][a] = b;
        G.activeTicks.style(c, b);
    };

    G.bindInspectorControls = function () {
        d3.select("#addedtextcolor").on('input', function () {
            const v = this.value;
            const txt = G.activeText || G.activeDiv;
            if (txt) txt.style('color', v);
            if (G.activeTicks) { G.updateTickStyle('color', v); }
            if (G.activeGroup) {
                const sh = G.activeGroup.select('.shape');
                const tag = sh.node().tagName.toLowerCase();
                if ((tag === 'rect' || tag === 'ellipse') && sh.attr('fill') !== 'none') {
                    sh.attr('fill', v).attr('stroke', v);
                } else {
                    sh.attr('stroke', v);
                }
                G.updateArrowMarkerColor(sh, v);
            }
        });

        d3.select("#addedtextsize").on('input', e => {
            const v = e.target.value + 'px';
            G.updateTickStyle('fontSize', v);
            if (G.activeText || G.activeDiv) {
                const txt = G.activeText || G.activeDiv;
                txt.style('font-size', v);
                if (G.activeFo) G.activeFo.attr('width', txt.node().scrollWidth + 5);
            }
            if (!G.activeGroup) return;
            const s = +e.target.value, b = 5 + s / 2, sh = G.activeGroup.select('.shape'),
                ol = G.activeGroup.select('.outline'), hit = G.activeGroup.select('.hit');
            sh.attr('stroke-width', s);
            hit.attr('stroke-width', sh.node().tagName == 'rect' ? 2 * b : s + 2 * b);
            if (sh.node().tagName == 'rect') {
                const o = G.bufferOutline(sh, b);
                ol.attr('x', o.x).attr('y', o.y).attr('width', o.w).attr('height', o.h);
            } else {
                const pts = G.bufferOutline(sh, b);
                ol.attr('points', pts.join(' '));
            }
        });

        d3.select("#fontfamily").on('change', e => {
            const v = e.target.value;
            G.updateTickStyle('fontFamily', v);
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-family', v);
            if (G.activeFo) {
                const fo = G.activeFo, div = fo.select('div').node();
                fo.attr('width', div.scrollWidth + 5);
            }
        });

        d3.select("#boldBtn").on('click', () => {
            const now = !d3.select("#boldBtn").classed('active');
            d3.select("#boldBtn").classed('active', now);
            G.updateTickStyle('fontWeight', now ? 'bold' : 'normal');
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-weight', now ? 'bold' : 'normal');
        });

        d3.select("#italicBtn").on('click', () => {
            const now = !d3.select("#italicBtn").classed('active');
            d3.select("#italicBtn").classed('active', now);
            G.updateTickStyle('fontStyle', now ? 'italic' : 'normal');
            const tgt = G.activeText || G.activeDiv || G.activeTicks;
            if (tgt) tgt.style('font-style', now ? 'italic' : 'normal');
        });

        d3.select("#removebtn").on("click", () => {
            if (G.activeGroup) {
                G.activeGroup.style("display", "none");
                G.activeGroup = null;
            } else if (G.activeFo) {
                const parentG = G.activeFo.node().parentNode;
                if (parentG.classList.contains("legend-group")) {
                    d3.select(parentG).style("display", "none");
                } else {
                    d3.select(G.activeFo.node()).style("display", "none");
                }
            }
            G.activeFo = G.activeDiv = null;
            d3.select("#removebtn").classed("disabled", true);
        });
    };

    function getActiveEditableDiv() {
        if (typeof G.activeText !== 'undefined' && G.activeText) return G.activeText.node ? G.activeText.node() : G.activeText;
        if (typeof G.activeDiv !== 'undefined' && G.activeDiv) return G.activeDiv.node ? G.activeDiv.node() : G.activeDiv;
        const sel = window.getSelection && window.getSelection();
        if (!sel || sel.rangeCount === 0) return null;
        let node = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode && sel.anchorNode.parentElement;
        if (!node) return null;
        const editable = node.closest && node.closest('foreignObject > div[contenteditable]');
        return editable || null;
    }

    function resizeFO(ed) {
        const fo = ed && ed.parentNode;
        if (fo && fo.tagName && fo.tagName.toLowerCase() === 'foreignobject') {
            fo.setAttribute('width', ed.scrollWidth + 5);
            fo.setAttribute('height', ed.scrollHeight + 5);
        }
    }

    G.applySupSub = function (which) {
        const ed = getActiveEditableDiv();
        if (!ed) return;
        ed.focus();
        const isSup = document.queryCommandState('superscript');
        const isSub = document.queryCommandState('subscript');
        if (which === 'sup') {
            if (isSup) { document.execCommand('superscript', false, null); }
            else {
                if (isSub) document.execCommand('subscript', false, null);
                document.execCommand('superscript', false, null);
            }
        } else {
            if (isSub) { document.execCommand('subscript', false, null); }
            else {
                if (isSup) document.execCommand('superscript', false, null);
                document.execCommand('subscript', false, null);
            }
        }
        resizeFO(ed);
        G.setActiveButtons();
    };

    G.setActiveButtons = function () {
        const ed = getActiveEditableDiv();
        const supOn = ed ? document.queryCommandState('superscript') : false;
        const subOn = ed ? document.queryCommandState('subscript') : false;
        const supBtn = document.getElementById('supBtn');
        const subBtn = document.getElementById('subBtn');
        if (supOn) { supBtn.classList.add('active'); subBtn.classList.remove('active'); }
        else if (subOn) { subBtn.classList.add('active'); supBtn.classList.remove('active'); }
        else { supBtn.classList.remove('active'); subBtn.classList.remove('active'); }
    };

    G.bindSupSubControls = function () {
        document.getElementById('supBtn').addEventListener('mousedown', e => { e.preventDefault(); G.applySupSub('sup'); });
        document.getElementById('subBtn').addEventListener('mousedown', e => { e.preventDefault(); G.applySupSub('sub'); });
        document.addEventListener('selectionchange', G.setActiveButtons);
        document.addEventListener('mouseup', G.setActiveButtons);
        document.addEventListener('keyup', G.setActiveButtons);
    };

})(window.GraphPlotter);
