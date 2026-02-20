(function(G) {
    "use strict";
    function movingAverage(a,w){
        const h=Math.floor(w/2),m=[];
        for(let i=0;i<a.length;i++){
          let s=0,c=0;
          for(let j=i-h;j<=i+h;j++){
            if(j>=0&&j<a.length&&isFinite(a[j])){ s+=a[j]; c++; }}
          m[i]=c?s/c:NaN;}
        return m;}
    function rollingBaseline(a, w) {
      const h = Math.floor(w / 2), e = [], b = [];
      for (let i = 0; i < a.length; i++) {
        let m = Infinity;
        for (let j = i - h; j <= i + h; j++) {
          if (j >= 0 && j < a.length && isFinite(a[j])) {
            m = Math.min(m, a[j]);}}
        e[i] = m === Infinity ? NaN : m;}
      for (let i = 0; i < e.length; i++) {
        let M = -Infinity;
        for (let j = i - h; j <= i + h; j++) {
          if (j >= 0 && j < e.length && isFinite(e[j])) {
            M = Math.max(M, e[j]);}}
        b[i] = M === -Infinity ? NaN : M;}
      return b;} 
    function process(suffix, fn, w){
        const tbl = G.state.hot.getData(), hdr = tbl[0], rows = tbl.slice(3), baseNames = tbl[2].slice();
        hdr.forEach((h,i)=>{
          if(h==="Y-axis" && G.state.colEnabled[i]){
            if (suffix === "corrected" && baseNames[i].includes("(baseline)")) { return;}
            const raw = rows.map(r=>parseFloat(r[i])||NaN), out = fn(raw, w), newIdx = tbl[1].length;
            hdr.push("Y-axis");                         
            tbl[1].push(G.config.COLORS[newIdx % G.config.COLORS.length]);   
            tbl[2].push(`${baseNames[i]} (${suffix})`);   
            rows.forEach((r,j)=> r.push(out[j]));  }});
        G.state.hot.loadData(tbl);
        G.axis.resetScales(true);
        G.renderChart();}
    function previewSeries(fn, w, cssClass) {
        const svg = d3.select("#chart svg"); svg.selectAll(`g.${cssClass}`).remove(); if (w <= 0) return;
        const opts = G.getSettings(); const isFTIR = opts.mode === "ftir" && cssClass === "baseline-preview";
        const data = G.getSeries().map(sv => { let yVals; if (isFTIR) { const inv = sv.y.map(v => -v);
        const baseInv = rollingBaseline(inv, w); const rawEnv = baseInv.map(b => -b); yVals = rawEnv;} 
        else { yVals = fn(sv.y, w);} return { rawX: sv.rawX, x: sv.x, y: yVals, color: sv.color};});
        const chartDef = G.ChartRegistry.get(opts.type); const g  = svg.append("g").classed(cssClass, true)
        .attr("clip-path", "url(#clip)"); chartDef.draw(g, data, { x: G.state.lastXScale, y: G.state.lastYScale }, opts);
        g.selectAll("path").attr("stroke", "gray").attr("stroke-width", opts.linewidth);
    }
    document.getElementById("applysmoothing").onclick = () => {
        const w = +document.getElementById("smoothingslider").value; if (w > 0) {
        process("smoothed", movingAverage, w); document.getElementById("smoothingslider").value = 0;}};
    document.getElementById("applybaseline").onclick = () => {
        const w = +document.getElementById("baselineslider").value; if (w <= 0) return; const s = G.getSettings();
        if (s.mode === "ftir") { process("baseline", (signal, win) => { const inv = signal.map(v => -v);
        const bInv = rollingBaseline(inv, win); const rawEnv = bInv.map(b => -b); return rawEnv;}, w);
        process("corrected", (signal, win) => { const inv = signal.map(v => -v); const bInv = rollingBaseline(inv, win);
        const rawEnv = bInv.map(b => -b); 
        return signal.map((v, i) => isFinite(v) && isFinite(rawEnv[i]) ? (v / rawEnv[i]) * 100 : NaN);}, w);} 
        else { process("baseline", rollingBaseline, w); process("corrected", (signal, win) => {
        const env = rollingBaseline(signal, win);
        return signal.map((v, i) => isFinite(v) && isFinite(env[i]) ? v - env[i] : NaN);}, w);}
        document.getElementById("baselineslider").value = 0;};
    ['smoothing','baseline'].forEach(type=> document.getElementById(type+'slider').addEventListener('input',e=>{
        if(type==='smoothing') G.renderChart(); previewSeries(type==='smoothing'?movingAverage:rollingBaseline, +e.target.value, `${type}-preview`);}));
})(window.GraphPlotter);
