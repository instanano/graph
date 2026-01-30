(function (G) {

    G.saveProject = function () {
        const tbl = G.hot.getData();
        const svg = d3.select('#chart svg');
        const shapes = [], texts = [], legends = [], axisTitles = [];
        svg.selectAll('g.shape-group').each(function () {
            const g = d3.select(this);
            if (g.style('display') === 'none') return;
            const sh = g.select('.shape'), t = g.attr('transform') || '';
            const obj = { type: sh.node().tagName, transform: t, stroke: sh.attr('stroke'), strokeWidth: sh.attr('stroke-width'), fill: sh.attr('fill'), fillOpacity: sh.attr('fill-opacity'), strokeDasharray: sh.attr('stroke-dasharray'), markerEnd: sh.attr('marker-end') };
            if (sh.node().tagName === 'line') { obj.x1 = sh.attr('x1'); obj.y1 = sh.attr('y1'); obj.x2 = sh.attr('x2'); obj.y2 = sh.attr('y2'); }
            else if (sh.node().tagName === 'rect') { obj.x = sh.attr('x'); obj.y = sh.attr('y'); obj.width = sh.attr('width'); obj.height = sh.attr('height'); }
            else if (sh.node().tagName === 'ellipse') { obj.cx = sh.attr('cx'); obj.cy = sh.attr('cy'); obj.rx = sh.attr('rx'); obj.ry = sh.attr('ry'); }
            shapes.push(obj);
        });
        svg.selectAll('foreignObject.user-text').each(function () {
            const fo = d3.select(this);
            if (fo.style('display') === 'none') return;
            const div = fo.select('div');
            texts.push({ x: fo.attr('x'), y: fo.attr('y'), transform: fo.attr('transform'), html: div.html(), style: { fontSize: div.style('font-size'), fontFamily: div.style('font-family'), fontWeight: div.style('font-weight'), fontStyle: div.style('font-style'), color: div.style('color') } });
        });
        svg.selectAll('g.legend-group').each(function () {
            const g = d3.select(this);
            if (g.style('display') === 'none') return;
            legends.push({ col: g.attr('data-col'), transform: g.attr('transform') || this.dataset.savedTransform });
        });
        svg.selectAll('g.axis-title').each(function () {
            const g = d3.select(this), fo = g.select('foreignObject'), div = fo.select('div');
            axisTitles.push({ class: g.attr('class'), transform: g.attr('transform'), html: div.html() });
        });
        const s = G.getSettings();
        const proj = { version: 2, data: tbl, colEnabled: G.colEnabled, settings: s, shapes, texts, legends, axisTitles, overrides: { x: window.overrideX, multiY: window.overrideMultiY, xTicks: window.overrideXTicks, yTicks: window.overrideYTicks, customTicksX: window.overrideCustomTicksX, customTicksY: window.overrideCustomTicksY, ternary: window.overrideTernary, ternaryTicks: window.overrideTernaryTicks, customTicksTernary: window.overrideCustomTicksTernary, scaleformatX: window.overrideScaleformatX, scaleformatY: window.overrideScaleformatY, minorTickOn: window.minorTickOn, useCustomTicksOn: window.useCustomTicksOn }, tickLabelStyles: G.tickLabelStyles };
        const blob = new Blob([JSON.stringify(proj)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'graph.instanano'; a.click();
        URL.revokeObjectURL(url);
    };

    G.downloadImage = function () {
        const svg = document.querySelector('#chart svg');
        if (!svg) return;
        const clone = svg.cloneNode(true);
        clone.querySelectorAll('.outline').forEach(el => el.remove());
        clone.querySelectorAll('.area-brush,.fit-brush,.zoom-brush').forEach(el => el.remove());
        const serializer = new XMLSerializer();
        const svgStr = serializer.serializeToString(clone);
        const canvas = document.createElement('canvas');
        const scale = 3;
        canvas.width = svg.viewBox.baseVal.width * scale;
        canvas.height = svg.viewBox.baseVal.height * scale;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/png');
            const a = document.createElement('a'); a.href = url; a.download = 'graph.png'; a.click();
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
    };

    G.loadProject = function (file) {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const proj = JSON.parse(e.target.result);
                G.hot.loadData(proj.data);
                G.colEnabled = proj.colEnabled || {};
                const s = proj.settings || {};
                if (s.mode) document.getElementById('axis-' + s.mode).checked = true;
                if (s.type) document.getElementById(s.type).checked = true;
                if (s.multiyaxis !== undefined) document.getElementById('multiyaxis').checked = s.multiyaxis === 1;
                ['linewidth', 'symbolsize', 'bins', 'opacity'].forEach(k => { if (s[k] !== undefined) document.getElementById(k).value = s[k]; });
                if (proj.overrides) {
                    window.overrideX = proj.overrides.x;
                    window.overrideMultiY = proj.overrides.multiY;
                    window.overrideXTicks = proj.overrides.xTicks;
                    window.overrideYTicks = proj.overrides.yTicks;
                    window.overrideCustomTicksX = proj.overrides.customTicksX;
                    window.overrideCustomTicksY = proj.overrides.customTicksY;
                    window.overrideTernary = proj.overrides.ternary;
                    window.overrideTernaryTicks = proj.overrides.ternaryTicks;
                    window.overrideCustomTicksTernary = proj.overrides.customTicksTernary;
                    window.overrideScaleformatX = proj.overrides.scaleformatX;
                    window.overrideScaleformatY = proj.overrides.scaleformatY;
                    window.minorTickOn = proj.overrides.minorTickOn || {};
                    window.useCustomTicksOn = proj.overrides.useCustomTicksOn || {};
                }
                if (proj.tickLabelStyles) G.tickLabelStyles = proj.tickLabelStyles;
                G.hot.render();
                G.renderChart();
                setTimeout(() => {
                    const svg = d3.select('#chart svg');
                    (proj.shapes || []).forEach(sh => {
                        const g = svg.append('g').classed('shape-group', true).attr('transform', sh.transform);
                        const tag = sh.type.toLowerCase();
                        if (tag === 'line') {
                            g.append('line').classed('hit', true).attr('x1', sh.x1).attr('y1', sh.y1).attr('x2', sh.x2).attr('y2', sh.y2).attr('stroke', 'transparent').attr('stroke-width', 10);
                            const ln = g.append('line').classed('shape', true).attr('x1', sh.x1).attr('y1', sh.y1).attr('x2', sh.x2).attr('y2', sh.y2).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth);
                            if (sh.strokeDasharray) ln.attr('stroke-dasharray', sh.strokeDasharray);
                            if (sh.markerEnd) { const id = G.createArrowMarker(svg, sh.stroke); ln.attr('marker-end', `url(#${id})`); }
                            const pts = G.bufferOutline(ln, 5);
                            g.append('polygon').classed('outline', true).attr('points', pts.join(' ')).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        } else if (tag === 'rect') {
                            g.append('rect').classed('hit', true).attr('x', sh.x).attr('y', sh.y).attr('width', sh.width).attr('height', sh.height).attr('stroke', 'transparent').attr('stroke-width', 10).attr('fill', 'none');
                            const rc = g.append('rect').classed('shape', true).attr('x', sh.x).attr('y', sh.y).attr('width', sh.width).attr('height', sh.height).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth).attr('fill', sh.fill || 'none');
                            if (sh.fillOpacity) rc.attr('fill-opacity', sh.fillOpacity);
                            if (sh.strokeDasharray) rc.attr('stroke-dasharray', sh.strokeDasharray);
                            const o = G.bufferOutline(rc, 5);
                            g.append('rect').classed('outline', true).attr('x', o.x).attr('y', o.y).attr('width', o.w).attr('height', o.h).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        } else if (tag === 'ellipse') {
                            g.append('ellipse').classed('hit', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', sh.rx).attr('ry', sh.ry).attr('stroke', 'transparent').attr('stroke-width', 10).attr('fill', 'none');
                            const el = g.append('ellipse').classed('shape', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', sh.rx).attr('ry', sh.ry).attr('stroke', sh.stroke).attr('stroke-width', sh.strokeWidth).attr('fill', sh.fill || 'none');
                            if (sh.fillOpacity) el.attr('fill-opacity', sh.fillOpacity);
                            g.append('ellipse').classed('outline', true).attr('cx', sh.cx).attr('cy', sh.cy).attr('rx', +sh.rx + 5).attr('ry', +sh.ry + 5).attr('stroke', 'rgb(74,144,226)').attr('fill', 'none').attr('visibility', 'hidden');
                        }
                        G.makeShapeInteractive(g);
                    });
                    (proj.texts || []).forEach(t => {
                        const obj = G.editableText(svg, { x: t.x, y: t.y, text: '', rotation: 0 });
                        obj.div.html(t.html);
                        if (t.style) { obj.div.style('font-size', t.style.fontSize).style('font-family', t.style.fontFamily).style('font-weight', t.style.fontWeight).style('font-style', t.style.fontStyle).style('color', t.style.color); }
                        obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('transform', t.transform);
                        obj.fo.classed('user-text', true).call(G.applyDrag);
                    });
                    (proj.legends || []).forEach(l => {
                        const g = svg.select(`g.legend-group[data-col="${l.col}"]`);
                        if (!g.empty() && l.transform) { g.attr('transform', l.transform); g.node().dataset.savedTransform = l.transform; }
                    });
                    (proj.axisTitles || []).forEach(at => {
                        const g = svg.select(`g.${at.class.split(' ').join('.')}`);
                        if (!g.empty()) { g.attr('transform', at.transform); g.select('foreignObject div').html(at.html); }
                    });
                }, 100);
            } catch (err) { console.error(err); }
        };
        reader.readAsText(file);
    };

    G.bindExportControls = function () {
        document.getElementById('save').addEventListener('click', G.saveProject);
        document.getElementById('download').addEventListener('click', G.downloadImage);
    };

})(window.GraphPlotter);
