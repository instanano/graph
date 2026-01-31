(function(G) {
    "use strict";
    G.parsers.parseText = function(text){return text.trim().split(/\r?\n/).map(line=>line.split(/,|\t/))}
    G.parsers.parseXLSX = function(buffer){const wb=XLSX.read(new Uint8Array(buffer),{type:'array'});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1})}
    G.parsers.parseXRDML = function(text) {
        const xml = new DOMParser().parseFromString(text, "application/xml");
        const scan = xml.getElementsByTagName("scan")[0] || xml.getElementsByTagNameNS("*", "scan")[0];
        let pos = scan.getElementsByTagName("positions"); if (!pos.length) {
        const dp = scan.getElementsByTagName("dataPoints")[0]; pos = dp ? dp.getElementsByTagName("positions") : pos;}
        const twoTheta = Array.from(pos).find(p => (p.getAttribute("axis")||"").toLowerCase().includes("2theta"));
        const start = parseFloat((twoTheta.getElementsByTagName("startPosition")[0] || twoTheta.getElementsByTagNameNS("*","startPosition")[0]).textContent);
        const end = parseFloat((twoTheta.getElementsByTagName("endPosition")[0] || twoTheta.getElementsByTagNameNS("*","endPosition")[0]).textContent);
        let intens = scan.getElementsByTagName("counts"); if (!intens.length) { intens = scan.getElementsByTagName("intensities");
        if (!intens.length) { const dp = scan.getElementsByTagName("dataPoints")[0];
        intens = dp ? dp.getElementsByTagName("intensities") : intens;}}
        const arr = intens[0].textContent.trim().split(/\s+/).map(Number); const n = arr.length, step = (end - start) / (n - 1);
        return Array.from({ length: n }, (_, i) => [ start + step * i, arr[i] ]);
    }
})(window.GraphPlotter);
