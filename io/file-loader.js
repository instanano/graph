(function(G) {
    "use strict";
    G.io = G.io || {};
    let bound = false;
    G.io.initFileLoader = function({ detectModeFromData, openPanelForMode } = {}) {
        if (bound) return;
        bound = true;
        const fileHandlers={ instanano:null, csv:G.parsers.parseText, txt:G.parsers.parseText, xls:G.parsers.parseXLSX, xlsx:G.parsers.parseXLSX, xrdml:G.parsers.parseXRDML};
        const fileModes = {xrdml:'xrd',raw:'xrd',spc:'uvvis'};
        const fileinput=document.getElementById('fileinput');
        const dropzone=document.getElementById('dropzone');
        if (!fileinput || !dropzone) return;
        fileinput.accept=Object.keys(fileHandlers).map(ext=>'.'+ext).join(',');
        const setMode = mode => {
            if (!mode) return;
            const radio = document.querySelector(`input[name="axistitles"][value="${mode}"]`);
            if (radio) radio.checked = true;
            openPanelForMode?.(mode);
        };
        async function handleFileList(src){
            const items = src && src.items; const files = items && items.length ? await (async()=>{const out=[];
            const readAll=r=>new Promise(res=>{const a=[];(function n(){r.readEntries(es=>{if(!es.length)res(a);else{a.push(...es);n()}})})()});
            const walk=async (en,p='')=>en.isFile ? await new Promise(r=>en.file(f=>{f.relativePath=p+f.name;out.push(f);r()})) : await Promise.all((await readAll(en.createReader())).map(e=>walk(e,p+en.name+'/')));
            for (const it of items){const en=it.webkitGetAsEntry&&it.webkitGetAsEntry(); if(en) await walk(en)} return out})() : [...(src?.files||src||[])];
            if(!files.length) return;
            if (await G.parsers.parseNMR(files)) return;
            const file=files[0]; const ext=file.name.split('.').pop().toLowerCase();
            if (ext === 'instanano') {
                const text = await file.text();
                try { G.importState(JSON.parse(text)); }
                catch (_) { alert('Invalid .instanano file'); }
                return;
            }
            const parser=fileHandlers[ext]; if(!parser) return alert('Unsupported file type: .'+ext);
            if (fileModes[ext]) setMode(fileModes[ext]);
            let rows;
            if(ext==='xls'||ext==='xlsx'){ const buffer=await file.arrayBuffer(); rows=parser(buffer);}
            else { const text=await file.text(); rows=parser(text);}
            const n=Math.max(...rows.map(r=>r.length)), header=Array(n).fill().map((_,i)=>i===0?'X-axis':'Y-axis'),
            color=Array(n).fill().map((_,i)=>G.config.COLORS[i%G.config.COLORS.length]), name=Array(n).fill('Sample');
            G.state.hot.loadData([header,color,name,...rows]); G.state.colEnabled = {}; G.state.hot.getData()[0].forEach((_, c) => { G.state.colEnabled[c] = true; });
            G.state.hot.render();
            setMode(detectModeFromData?.());
            d3.select('#chart').selectAll("g.axis-title, g.legend-group, g.shape-group, defs, foreignObject.user-text").remove();
            G.ui.disableAreaCal(); G.state.tickLabelStyles={x:{fontSize:null,color:null},y:{fontSize:null,color:null}};
            G.axis.resetScales(true); G.renderChart();
        }
        ['dragenter','dragover'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.add('hover')}));
        ['dragleave','drop'].forEach(evt=>dropzone.addEventListener(evt,e=>{e.preventDefault();dropzone.classList.remove('hover')}));
        dropzone.addEventListener('drop', async e=>{ e.preventDefault(); dropzone.classList.remove('hover'); await handleFileList(e.dataTransfer);});
        fileinput.addEventListener('change', async ()=>{ await handleFileList(fileinput.files); });
        dropzone.addEventListener('click',()=>fileinput.click());
    };
})(window.GraphPlotter);
