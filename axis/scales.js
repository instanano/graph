(function (G) {
    const DIM = G.DIM;

    G.computeDefaults = function (series) {
        if (!series.length) return null;
        const allX = series.flatMap(s => s.x), allY = series.flatMap(s => s.y),
            [minX, maxX] = d3.extent(allX), [minY, maxY] = d3.extent(allY),
            padX = (maxX - minX) * 0.02, padY = (maxY - minY) * 0.06;
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
    };

    G.resetScales = function (full) {
        if (full) {
            window.overrideX = null;
            window.overrideMultiY = {};
            window.overrideXTicks = null;
            window.overrideYTicks = {};
            window.overrideScaleformatX = null;
            window.overrideScaleformatY = {};
            window.overrideCustomTicksX = null;
            window.overrideCustomTicksY = {};
            window.overrideCustomTicksTernary = null;
            window.overrideTernary = null;
            window.overrideTernaryTicks = null;
            window.minorTickOn = {};
            window.useCustomTicksOn = {};
        }
        const defs = G.computeDefaults(G.getSeries());
        if (!defs) return;
        if (full) {
            document.getElementById("scalemin").value = defs.minX;
            document.getElementById("scalemax").value = defs.maxX;
        }
    };

    G.makeScales = function (s, series) {
        if (s.type === "histogram") {
            const allValues = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minV, maxV] = d3.extent(allValues);
            const step = (maxV - minV) / s.bins;
            const thresholds = d3.range(minV, maxV, step);
            const maxCount = d3.max(series.map(sv => d3.max(d3.histogram().domain([minV, maxV]).thresholds(thresholds)(sv.y), d => d.length)));
            const xDomain = window.overrideX || [minV, maxV];
            const yDomain = window.overrideMultiY?.[0] || [0, maxCount * 1.05];
            return {
                xScale: d3.scaleLinear().domain(xDomain).range([DIM.ML, DIM.W - DIM.MR]),
                yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
        }
        if (s.type === "bar") {
            const allX = series.flatMap(sv => sv.rawX);
            const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minY, maxY] = d3.extent(allY);
            const padY = (maxY - minY) * 0.06;
            const yDomain = window.overrideMultiY?.[0] || [minY - padY, maxY + padY];
            return {
                xScale: d3.scaleBand().domain(allX).range([DIM.ML, DIM.W - DIM.MR]).padding(G.ChartRegistry.get("bar").bandPadding),
                yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
        }
        const allX = series.flatMap(sv => sv.x).filter(v => Number.isFinite(v));
        const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
        const [minX, maxX] = d3.extent(allX);
        const [minY, maxY] = d3.extent(allY);
        const padX = (maxX - minX) * 0.02;
        const padY = (maxY - minY) * 0.06;
        let xDom;
        if (window.overrideX) xDom = window.overrideX;
        else if (s.mode === 'ftir' || s.mode === 'nmr') xDom = [maxX + padX, minX - padX];
        else xDom = [minX - padX, maxX + padX];
        const yDom = window.overrideMultiY?.[0] ? window.overrideMultiY[0] : [minY - padY, maxY + padY];
        return {
            xScale: d3.scaleLinear().domain(xDom).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDom).range([DIM.H - DIM.MB, DIM.MT])
        };
    };

    G.computeMultiYScales = function (scales, s, series) {
        if (s.multiyaxis !== 1 || series.length < 2) return;
        const multiYScales = series.map((sv, i) => {
            const [minY, maxY] = d3.extent(sv.y);
            const padY = (maxY - minY) * 0.06;
            const domain = window.overrideMultiY?.[i] ? window.overrideMultiY[i] : [minY - padY, maxY + padY];
            return d3.scaleLinear().domain(domain).range([DIM.H - DIM.MB, DIM.MT]);
        });
        scales.y2 = multiYScales;
        scales.y = multiYScales[0];
        window.multiYScales = multiYScales;
    };

})(window.GraphPlotter);
