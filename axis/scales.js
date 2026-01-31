(function(G) {
    G.axis.prepareChartContext = function() {
        const s = G.getSettings(); const series = G.getSeries(); 
        const [rw, rh] = s.ratio.split(':').map(Number); 
        G.config.DIM.H = Math.round(G.config.DIM.W * rh / rw); 
        G.config.DIM.MR = 80 + (s.multiyaxis === 1 && series.length > 1 ? (series.length - 2) * s.multiygap : 0);
        const titles = G.axis.getTitles(s.mode); const { xScale, yScale } = G.axis.makeScales(s, series); 
        G.state.lastXScale = xScale;
        G.state.lastYScale = yScale;
        return { s, series, xScale, yScale, W: G.config.DIM.W, H: G.config.DIM.H, MT: G.config.DIM.MT, MB: G.config.DIM.MB, ML: G.config.DIM.ML, MR: G.config.DIM.MR, titles};
    }

    G.axis.makeScales = function(s, series) {
        const DIM = G.config.DIM;
        if (s.type === "histogram") {
          const allValues = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
          const [minV,maxV] = d3.extent(allValues);
          const step = (maxV - minV) / s.bins;
          const thresholds = d3.range(minV, maxV, step);
          const maxCount = d3.max(series.map(sv => d3.max(d3.histogram().domain([minV, maxV]).thresholds(thresholds)(sv.y), d => d.length)));
          const xDomain = G.state.overrideX || [minV, maxV];
          const yDomain = G.state.overrideMultiY?.[0] || [0, maxCount * 1.05];
          return {
            xScale: d3.scaleLinear().domain(xDomain).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
          };
        }
          if (s.type === "bar") {
            const allX = series.flatMap(sv => sv.rawX);
            const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
            const [minY,maxY] = d3.extent(allY);
            const padY = (maxY - minY) * 0.06;
            const yDomain = G.state.overrideMultiY?.[0] || [minY - padY, maxY + padY];
            return {
              xScale: d3.scaleBand().domain(allX).range([DIM.ML, DIM.W - DIM.MR]).padding(G.ChartRegistry.get("bar").bandPadding),
              yScale: d3.scaleLinear().domain(yDomain).range([DIM.H - DIM.MB, DIM.MT])
            };
          }
          const allX = series.flatMap(sv => sv.x).filter(v => Number.isFinite(v));
          const allY = series.flatMap(sv => sv.y).filter(v => Number.isFinite(v));
          const [minX,maxX] = d3.extent(allX);
          const [minY,maxY] = d3.extent(allY);
          const padX = (maxX - minX) * 0.02;
          const padY = (maxY - minY) * 0.06;
          let xDom; if (G.state.overrideX) xDom = G.state.overrideX; else if (s.mode === 'ftir' || s.mode === 'nmr') xDom = [maxX + padX, minX - padX];     else xDom = [minX - padX, maxX + padX];
          const yDom = G.state.overrideMultiY?.[0] ? G.state.overrideMultiY[0] : [minY - padY, maxY + padY];
          return {
            xScale: d3.scaleLinear().domain(xDom).range([DIM.ML, DIM.W - DIM.MR]),
            yScale: d3.scaleLinear().domain(yDom).range([DIM.H - DIM.MB, DIM.MT])
          };
    };

    function computeDefaults(series) {
        if (!series.length) return null; const allX = series.flatMap((s) => s.x), allY = series.flatMap((s) => s.y),
        [minX, maxX] = d3.extent(allX), [minY, maxY] = d3.extent(allY), padX = (maxX - minX) * 0.02, padY = (maxY - minY) * 0.06;
        return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY,};
    }

    G.axis.resetScales = function(full = true) {
        const S = G.state;
        if(full){S.overrideX=null; S.overrideMultiY={};S.overrideXTicks=null; S.overrideYTicks={}; 
        S.overrideScaleformatX=null; S.overrideScaleformatY={}; S.overrideCustomTicksX=null; 
        S.overrideCustomTicksY={}; S.overrideCustomTicksTernary=null; S.overrideTernary=null; 
        S.overrideTernaryTicks=null;S.minorTickOn ={}; S.useCustomTicksOn={};} const defs = computeDefaults(G.getSeries()); if (!defs) return;
        if (full) { document.getElementById("scalemin").value = defs.minX; document.getElementById("scalemax").value = defs.maxX;}
    };
})(window.GraphPlotter);
