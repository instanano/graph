(function(G) {
    "use strict";
    function isXrdRefCol(col) {
        const map = G.state.xrdRefCols || {};
        const c = +col;
        return Object.values(map).some(v => +v === c);
    }
    G.initTable = function() {
        const container = document.getElementById("table");
        G.state.hot = new myTable(container, {
            data: [["X-axis","Y-axis"],["#FFFF00","#000000"],["Sample","Sample"],[10,223],[20,132],[30,532],[40,242],[50,300],[70,100],[100,250]],
            colHeaders: colIndex => {
                G.state.colEnabled[colIndex] = G.state.colEnabled[colIndex] !== false;
                return `<input type="checkbox" data-col="${colIndex}" ${G.state.colEnabled[colIndex] ? "checked" : ""}>`;},
            rowHeaders: rowIndex => ["Axis", "Color", "Name"][rowIndex] || rowIndex - 2,
            rowHeaderWidth:60, colWidths:70,
            contextMenu: true, 
            afterRemoveRow: () => { G.axis.resetScales(true); G.renderChart(); },
            afterRemoveCol: (start, count) => {
                if (!G.state.xrdRefSyncing && count > 0) {
                    const next = {};
                    Object.entries(G.state.xrdRefCols || {}).forEach(([refId, col]) => {
                        const c = Number(col);
                        if (!Number.isInteger(c)) return;
                        if (c < start) next[refId] = c;
                        else if (c >= start + count) next[refId] = c - count;
                    });
                    G.state.xrdRefCols = next;
                    G.matchXRD?.syncPinnedFromTable?.(false);
                }
                G.axis.resetScales(true); G.renderChart();
            },
            afterChange: (changes) => {
                if (!changes) return;
                if (G.state.xrdRefSyncing) return;
                const billableTouched = changes.some(ch => !isXrdRefCol(ch?.[1]));
                if (billableTouched && G.matchXRD) { G.matchXRD.invalidateLock?.(); G.matchXRD.render(); }
            },
            afterCreateCol: (start, count) => {
                if (!G.state.xrdRefSyncing && count > 0) {
                    const shifted = {};
                    Object.entries(G.state.xrdRefCols || {}).forEach(([refId, col]) => {
                        const c = Number(col);
                        if (!Number.isInteger(c)) return;
                        shifted[refId] = c >= start ? c + count : c;
                    });
                    G.state.xrdRefCols = shifted;
                    G.matchXRD?.syncPinnedFromTable?.(false);
                }
                for (let c = start; c < start + count; c++) {
                    G.state.hot.setDataAtCell(0, c, "Y-axis");
                    G.state.hot.setDataAtCell(1, c, G.config.COLORS[c % G.config.COLORS.length]);
                    G.state.hot.setDataAtCell(2, c, "Sample");}},
            cells: (row, col) => {
                const props = {};
                if (row === 0) { props.type = "dropdown"; props.source = ["X-axis", "Y-axis", "Z-axis", "Y-error"]; props.className = 'tabledropdown';}
                if (row === 1) { props.renderer = (inst, td, r, c, prop, val) => { td.innerHTML = ""; if (!["X-axis", "Z-axis"]
                .includes(inst.getDataAtCell(0, c))) { const inp = document.createElement("input"); inp.type = "color"; 
                inp.value = val || G.config.COLORS[c % G.config.COLORS.length]; inp.oninput = e => inst.setDataAtCell(r, c, e.target.value); td.appendChild(inp);}};}
                if (row === 2) { props.renderer = (inst, td, r, c, prop, val) => { 
                td.textContent = ["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c)) ? "" : (val || "Sample");};}
                if (row >= 3 && isXrdRefCol(col)) props.readOnly = true;
                const base = props.renderer || myTable.renderers.TextRenderer;
                props.renderer = function(inst, td, r, c, prop, val) {
                    base.apply(this, arguments);
                    td.style.background = G.state.colEnabled[c] ? "" : "lightcoral";};
                return props;}
        });
        G.state.hot.addHook("afterCreateCol", checkEmptyColumns);
        container.addEventListener("change", e => {
            if (e.target.matches('input[type="checkbox"][data-col]')) {
                const col = +e.target.dataset.col;
                G.state.colEnabled[col] = e.target.checked;
                if (!isXrdRefCol(col) && G.matchXRD) { G.matchXRD.invalidateLock?.(); G.matchXRD.render(); }
                G.state.hot.render();
                G.axis.resetScales(false);
                G.renderChart(); checkEmptyColumns();}});
    };
    function checkEmptyColumns() {
        const data = G.state.hot.getData(); const dm = document.querySelector('label[for="icon1"]'); if (!dm) return;
        const shouldShow = data[0].some((_, c) => G.state.colEnabled[c] && data.slice(3).every(r => r[c] == null || r[c] === "" || isNaN(+r[c])));
        const existingBadge = dm.querySelector(".warning-badge"); if (shouldShow) { if (!existingBadge) { const b = document.createElement("span");
        b.className = "warning-badge"; b.textContent = "!"; dm.appendChild(b);}} else if (existingBadge) { existingBadge.remove();}
    }
})(window.GraphPlotter);
