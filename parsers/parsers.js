(function (G) {

    G.parseTextFile = async function (file) {
        const txt = await file.text();
        const lines = txt.split(/[\r\n]+/).filter(l => l.trim());
        return lines.map(l => l.split(/[\t,;]+/).map(c => {
            const n = parseFloat(c);
            return isNaN(n) ? c.trim() : n;
        }));
    };

    G.parseXLSX = async function (file) {
        if (typeof XLSX === 'undefined') {
            await G.loadScript('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
        }
        const ab = await file.arrayBuffer();
        const wb = XLSX.read(ab, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    };

    G.parseXRDML = async function (file) {
        const txt = await file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(txt, 'text/xml');
        const ds = doc.querySelector('dataPoints');
        const pos = ds.querySelector('positions');
        const ints = ds.querySelector('intensities');
        if (!pos || !ints) return null;
        const start = parseFloat(pos.querySelector('startPosition')?.textContent || 0);
        const end = parseFloat(pos.querySelector('endPosition')?.textContent || 0);
        const intArr = ints.textContent.trim().split(/\s+/).map(Number);
        const step = (end - start) / (intArr.length - 1);
        return intArr.map((y, i) => [start + i * step, y]);
    };

    G.loadScript = function (src) {
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = src; s.onload = res; s.onerror = rej;
            document.head.appendChild(s);
        });
    };

})(window.GraphPlotter);
