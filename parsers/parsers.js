(function(G) {
    "use strict";
    G.parsers.parseText = function(text){
        const splitRow = line => {
            const t = line.trim();
            if (t.includes(",")) return t.split(",").map(s => s.trim());
            if (t.includes("\t")) return t.split("\t").map(s => s.trim());
            return t.split(/\s+/);
        };
        const rows = String(text || "")
            .trim()
            .split(/\r?\n/)
            .filter(Boolean)
            .map(splitRow);
        return rows.length ? rows : [[""]];
    }
    G.parsers.parseXLSX = function(buffer){const wb=XLSX.read(new Uint8Array(buffer),{type:'array'});return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1})}
})(window.GraphPlotter);
