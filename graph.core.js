(function (G) {
    const DIM = G.DIM;
    const COLORS = G.COLORS;

    G.getSeries = function () {
        const data = G.hot.getData(), header = data[0], series = [], rows = data.slice(3);
        let xCol = -1, zCol = -1;
        for (let c = 0; c < header.length; c++) {
            if (header[c] === 'X-axis' && G.colEnabled[c] !== false) { xCol = c; zCol = -1; }
            else if (header[c] === 'Z-axis' && G.colEnabled[c] !== false) { zCol = c; }
            else if (header[c] === 'Y-axis' && G.colEnabled[c] !== false) {
                let errorCol = -1;
                for (let ec = c + 1; ec < header.length && header[ec] !== 'X-axis' && header[ec] !== 'Y-axis'; ec++) {
                    if (header[ec] === 'Y-error' && G.colEnabled[ec] !== false) { errorCol = ec; break; }
                }
                const sv = { rawX: [], x: [], y: [], z: zCol >= 0 ? [] : undefined, color: data[1][c], label: data[2][c], error: errorCol >= 0 ? [] : undefined, errorColor: errorCol >= 0 ? data[1][errorCol] : undefined };
                for (const row of rows) {
                    const xv = parseFloat(row[xCol]), yv = parseFloat(row[c]);
                    sv.rawX.push(row[xCol]);
                    sv.x.push(xv);
                    sv.y.push(yv);
                    if (zCol >= 0) sv.z.push(parseFloat(row[zCol]));
                    if (errorCol >= 0) sv.error.push(parseFloat(row[errorCol]));
                }
                series.push(sv);
            }
        }
        return series;
    };

    G.getSettings = function () {
        const ratio = document.querySelector('input[name="aspectratio"]:checked')?.value || '4:2.85';
        const preset = G.ratioPresets[ratio] || G.ratioPresets['4:2.85'];
        const chartRadio = document.querySelector('input[name="charttype"]:checked');
        const s = {
            type: chartRadio?.id || 'line',
            mode: document.querySelector('input[name="axistitles"]:checked')?.value || 'default',
            symbolsize: +document.getElementById('symbolsize')?.value || preset.symbolsize || 5,
            xticks: preset.xticks,
            yticks: preset.yticks,
            scaleformat: +document.getElementById('scaleformat')?.value || 0,
            bins: +document.getElementById('bins')?.value || 10,
            multiygap: +document.getElementById('multiygap')?.value || preset.multiygap,
            scalewidth: +document.getElementById('scalewidth')?.value || preset.scalewidth,
            linewidth: +document.getElementById('linewidth')?.value || preset.linewidth,
            multiyaxis: +document.getElementById('multiyaxis')?.value || 0,
            opacity: +document.getElementById('opacity')?.value || 0.5,
            scaleFs: preset.scaleFs,
            axisTitleFs: preset.axisTitleFs,
            legendFs: preset.legendFs,
            ratio: ratio
        };
        if (chartRadio?.dataset) {
            Object.entries(chartRadio.dataset).forEach(([key, val]) => {
                if (/^-?\d+(\.\d+)?$/.test(val)) s[key] = +val;
                else if (val.includes(',')) s[key] = val.split(',').map(v => v.trim());
                else s[key] = val;
            });
        }
        return s;
    };

    G.renderChart = function () {
        const svg = d3.select('#chart svg');
        if (svg.empty()) return;
        const savedShapes = [], savedTexts = [], savedLegends = [], savedAxisTitles = [];
        svg.selectAll('g.shape-group').each(function () { savedShapes.push(this.cloneNode(true)); });
        svg.selectAll('foreignObject.user-text').each(function () { savedTexts.push(this.cloneNode(true)); });
        svg.selectAll('g.legend-group').each(function () { savedLegends.push({ col: d3.select(this).attr('data-col'), transform: this.dataset.savedTransform || d3.select(this).attr('transform') }); });
        svg.selectAll('g.axis-title').each(function () { savedAxisTitles.push({ class: d3.select(this).attr('class'), transform: d3.select(this).attr('transform'), html: d3.select(this).select('foreignObject div').html() }); });
        svg.selectAll('g:not(.defs), path.series-path, foreignObject, line, rect:not(#chart-bg)').remove();
        const series = G.getSeries();
        const s = G.getSettings();
        const titles = G.getTitles(s.mode);
        const { xScale, yScale } = G.makeScales(s, series);
        const scales = { x: xScale, y: yScale };
        G.computeMultiYScales(scales, s, series);
        window.lastXScale = xScale;
        window.lastYScale = yScale;
        G.drawAxis(svg, scales, titles, s, series);
        const chartDef = G.ChartRegistry.get(s.type);
        const clipId = 'clip';
        let defs = svg.select('defs');
        if (defs.empty()) defs = svg.append('defs');
        if (defs.select('#' + clipId).empty()) {
            defs.append('clipPath').attr('id', clipId).append('rect').attr('x', DIM.ML).attr('y', DIM.MT).attr('width', DIM.W - DIM.ML - DIM.MR).attr('height', DIM.H - DIM.MT - DIM.MB);
        }
        const g = svg.append('g').attr('clip-path', `url(#${clipId})`);
        chartDef.draw(g, series, scales, s);
        G.drawLegend();
        G.tickEditing(svg);
        G.toolTip(svg, { xScale, yScale });
        savedShapes.forEach(el => svg.node().appendChild(el));
        savedTexts.forEach(el => svg.node().appendChild(el));
        savedLegends.forEach(l => {
            const lg = svg.select(`g.legend-group[data-col="${l.col}"]`);
            if (!lg.empty() && l.transform) { lg.attr('transform', l.transform); lg.node().dataset.savedTransform = l.transform; }
        });
        savedAxisTitles.forEach(at => {
            const ag = svg.select(`g.${at.class.split(' ').join('.')}`);
            if (!ag.empty()) { ag.attr('transform', at.transform); ag.select('foreignObject div').html(at.html); }
        });
        svg.selectAll('g.shape-group').each(function () { G.makeShapeInteractive(d3.select(this)); });
        svg.selectAll('foreignObject.user-text').each(function () { d3.select(this).call(G.applyDrag); });
        const w = +document.getElementById('smoothingslider')?.value || 0;
        if (w > 0) G.previewSeries(G.movingAverage, w, 'smooth-preview');
        const bw = +document.getElementById('baselineslider')?.value || 0;
        if (bw > 0) G.previewSeries(G.rollingBaseline, bw, 'baseline-preview');
    };

    const fileHandlers = { instanano: null, csv: 'text', txt: 'text', xls: 'xlsx', xlsx: 'xlsx', xrdml: 'xrdml' };
    const fileModes = { xrdml: 'xrd', raw: 'xrd', spc: 'uvvis' };

    G.handleFileList = async function (src) {
        const items = src && src.items;
        const files = items && items.length ? await (async () => {
            const out = [];
            const readAll = r => new Promise(res => { const a = []; (function n() { r.readEntries(es => { if (!es.length) res(a); else { a.push(...es); n(); } }); })(); });
            const walk = async (en, p = '') => en.isFile ? await new Promise(r => en.file(f => { f.relativePath = p + f.name; out.push(f); r(); })) : await Promise.all((await readAll(en.createReader())).map(e => walk(e, p + en.name + '/')));
            for (const it of items) { const en = it.webkitGetAsEntry && it.webkitGetAsEntry(); if (en) await walk(en); }
            return out;
        })() : [...(src?.files || src || [])];
        if (!files.length) return;

        const nmrFiles = files.filter(f => ['fid', 'acqus', 'procs', 'proc2s'].includes(f.name.toLowerCase()));
        if (nmrFiles.length && await G.parseNMR(nmrFiles)) return;

        const file = files[0];
        const ext = file.name.split('.').pop().toLowerCase();

        if (ext === 'instanano') {
            const text = await file.text();
            G.importState(JSON.parse(text));
            return;
        }

        const handlerType = fileHandlers[ext];
        if (!handlerType) { alert('Unsupported file type: .' + ext); return; }

        if (fileModes[ext]) {
            const radio = document.querySelector(`input[name="axistitles"][value="${fileModes[ext]}"]`);
            if (radio) radio.checked = true;
        }

        let rows;
        if (handlerType === 'xlsx') {
            rows = await G.parseXLSX(file);
        } else if (handlerType === 'xrdml') {
            rows = await G.parseXRDML(file);
        } else {
            rows = await G.parseTextFile(file);
        }

        if (!rows || !rows.length) return;

        const n = Math.max(...rows.map(r => r.length));
        const header = Array(n).fill().map((_, i) => i === 0 ? 'X-axis' : 'Y-axis');
        const color = Array(n).fill().map((_, i) => COLORS[i % COLORS.length]);
        const name = Array(n).fill('Sample');

        G.hot.loadData([header, color, name, ...rows]);
        G.colEnabled = {};
        G.hot.getData()[0].forEach((_, c) => { G.colEnabled[c] = true; });
        G.hot.render();

        const mode = G.detectModeFromData();
        if (mode) {
            const radio = document.querySelector(`input[name="axistitles"][value="${mode}"]`);
            if (radio) radio.checked = true;
        }

        d3.select('#chart').selectAll("g.axis-title, g.legend-group, g.shape-group, defs, foreignObject.user-text").remove();
        G.disableAreaCal();
        G.tickLabelStyles = { x: { fontSize: null, color: null }, y: { fontSize: null, color: null } };
        G.resetScales(true);
        G.renderChart();
        G.checkEmptyColumns();
    };

    G.bindFileHandlers = function () {
        const fileinput = document.getElementById('fileinput');
        const dropzone = document.getElementById('dropzone');

        // Set accepted file types
        fileinput.accept = Object.keys(fileHandlers).map(ext => '.' + ext).join(',');

        dropzone.addEventListener('click', () => fileinput.click());
        ['dragenter', 'dragover'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('hover'); }));
        ['dragleave', 'drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('hover'); }));
        dropzone.addEventListener('drop', async e => { e.preventDefault(); dropzone.classList.remove('hover'); await G.handleFileList(e.dataTransfer); });
        fileinput.addEventListener('change', async () => { await G.handleFileList(fileinput); fileinput.value = ''; });
    };

    G.bindChartTypeControls = function () {
        const controls = document.querySelectorAll('input[id]');
        const showEls = document.querySelectorAll('[data-show]');
        const radios = document.querySelectorAll('input[name="charttype"]');

        radios.forEach(radio => radio.addEventListener('change', () => {
            controls.forEach(ctl => {
                ctl.value = radio.dataset[ctl.id] ?? ctl.dataset?.defaultValue ?? ctl.defaultValue;
                ctl.dispatchEvent(new Event('input'));
            });

            showEls.forEach(el => {
                el.style.display = el.dataset.show.split(/\s+/).includes(radio.id) ? '' : 'none';
            });
            const specs = radio.dataset.axis?.split(/\s*,\s*/).map(s => s.trim());
            if (specs) {
                const d = G.hot.getData();
                while (d[0].length < specs.length) {
                    d.forEach((r, i) => r.push(i === 0 ? specs[r.length].replace('*', '') : i === 1 ? COLORS[r.length % COLORS.length] : i === 2 ? "Sample" : ""));
                }
                G.hot.loadData(d);

                let p = specs.findIndex(s => s.endsWith('*'));
                if (p < 0) p = specs.length;
                const patterns = specs.map(s => s.replace(/\*$/, ''));
                const wild = patterns.slice(p);

                G.hot.getData()[0].forEach((orig, i) => {
                    const lbl = i < p ? patterns[i] : (wild.length ? wild[(i - p) % wild.length] : orig);
                    G.hot.setDataAtCell(0, i, lbl);
                    G.colEnabled[i] = G.colEnabled[i] && patterns.includes(lbl);
                });
                G.hot.render();
            }

            G.resetScales(false);
            G.renderChart();
            G.checkEmptyColumns();
        }));

        document.querySelector('input[name="charttype"]:checked')?.dispatchEvent(new Event('change'));
    };

    G.bindSliderControls = function () {
        ['smoothingslider', 'baselineslider', 'multiyaxis'].forEach(id => {
            const input = document.getElementById(id);
            if (!input) return;
            function updateThumbColor() { input.classList.toggle('zero', input.value === '0'); }
            input.addEventListener('input', updateThumbColor);
            updateThumbColor();
        });

        document.querySelectorAll('span[data-current-value]').forEach(span => {
            const slider = document.getElementById(span.dataset.currentValue);
            if (!slider || slider.type !== 'range') return;
            span.textContent = slider.value;
            slider.oninput = () => { span.textContent = slider.value; };
        });
    };

    G.bindKeyboardShortcuts = function () {
        const modKey = navigator.platform.match(/Mac/) ? 'Meta' : 'Control';
        function keyBinder(combo, fn) {
            const parts = combo.split('+'), key = parts.pop().toLowerCase();
            document.addEventListener('keydown', e => {
                if (document.activeElement.isContentEditable) return;
                const mods = { meta: e.metaKey, control: e.ctrlKey, shift: e.shiftKey, alt: e.altKey };
                const match = parts.every(m => mods[m.toLowerCase()]) && e.key.toLowerCase() === key;
                if (match) { e.preventDefault(); fn(); }
            });
        }
        keyBinder(`${modKey}+s`, () => document.getElementById('save')?.click());
        keyBinder(`${modKey}+d`, () => document.getElementById('download')?.click());
        keyBinder(`${modKey}+z`, () => { G.resetScales(true); G.renderChart(); });
        keyBinder('Escape', () => G.clearActive());
        keyBinder('Delete', () => { if (G.activeGroup || G.activeFo) document.getElementById('removebtn')?.click(); });
        keyBinder('Backspace', () => { if (G.activeGroup || G.activeFo) document.getElementById('removebtn')?.click(); });
    };

    G.init = function () {
        const ratio = document.querySelector('input[name="aspectratio"]:checked')?.value || '4:2.85';
        const [w, h] = ratio.split(':').map(Number);
        const W = 600, H = W * h / w;
        G.DIM.W = W; G.DIM.H = H;
        const svg = d3.select('#chart').append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet').style('background', 'white');
        svg.append('rect').attr('id', 'chart-bg').attr('width', W).attr('height', H).attr('fill', 'white');
        G.initTable();
        G.hot.getData()[0].forEach((_, c) => { G.colEnabled[c] = true; });
        G.bindScaleInputs();
        G.bindInspectorControls();
        G.bindSupSubControls();
        G.bindShapeControls();
        G.bindSmoothingControls();
        G.bindFittingControls();
        G.bindTaucControls();
        G.bindZoom();
        G.bindFileHandlers();
        G.bindExportControls();
        G.bindKeyboardShortcuts();
        G.bindChartTypeControls();
        G.bindSliderControls();
        G.prepareShapeLayer();
        G.areacalculation();

        document.querySelectorAll('input[name="axistitles"], #multiyaxis, #linewidth, #symbolsize, #bins, #opacity').forEach(el => el.addEventListener('change', () => G.renderChart()));
        document.querySelectorAll('input[name="aspectratio"]').forEach(el => el.addEventListener('change', function () {
            const [nw, nh] = this.value.split(':').map(Number);
            const W2 = 600, H2 = W2 * nh / nw;
            G.DIM.W = W2; G.DIM.H = H2;
            d3.select('#chart svg').attr('viewBox', `0 0 ${W2} ${H2}`).select('#chart-bg').attr('width', W2).attr('height', H2);
            G.resetScales(true);
            G.renderChart();
        }));
        svg.on('click', e => { if (e.target === svg.node() || e.target.id === 'chart-bg') G.clearActive(); });
        G.renderChart();
    };

    document.addEventListener('DOMContentLoaded', G.init);

})(window.GraphPlotter);
