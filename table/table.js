(function (G) {
    const COLORS = G.COLORS;

    G.initTable = function () {
        const container = document.getElementById("table");
        G.hot = new myTable(container, {
            data: [["X-axis", "Y-axis"], ["#FFFF00", "#000000"], ["Sample", "Sample"], [10, 223], [20, 132], [30, 532], [40, 242], [50, 300], [70, 100], [100, 250]],
            colHeaders: colIndex => {
                G.colEnabled[colIndex] = G.colEnabled[colIndex] !== false;
                return `<input type="checkbox" data-col="${colIndex}" ${G.colEnabled[colIndex] ? "checked" : ""}>`;
            },
            rowHeaders: rowIndex => ["Axis", "Color", "Name"][rowIndex] || rowIndex - 2,
            rowHeaderWidth: 60,
            colWidths: 70,
            contextMenu: true,
            afterRemoveRow: () => { G.resetScales(true); G.renderChart(); },
            afterRemoveCol: () => { G.resetScales(true); G.renderChart(); },
            afterCreateCol: (start, count) => {
                for (let c = start; c < start + count; c++) {
                    G.hot.setDataAtCell(0, c, "Y-axis");
                    G.hot.setDataAtCell(1, c, COLORS[c % COLORS.length]);
                    G.hot.setDataAtCell(2, c, "Sample");
                }
            },
            cells: (row, col) => {
                const props = {};
                if (row === 0) {
                    props.type = "dropdown";
                    props.source = ["X-axis", "Y-axis", "Z-axis", "Y-error"];
                    props.className = 'tabledropdown';
                }
                if (row === 1) {
                    props.renderer = (inst, td, r, c, prop, val) => {
                        td.innerHTML = "";
                        if (!["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c))) {
                            const inp = document.createElement("input");
                            inp.type = "color";
                            inp.value = val || COLORS[c % COLORS.length];
                            inp.oninput = e => inst.setDataAtCell(r, c, e.target.value);
                            td.appendChild(inp);
                        }
                    };
                }
                if (row === 2) {
                    props.renderer = (inst, td, r, c, prop, val) => {
                        td.innerHTML = ["X-axis", "Z-axis"].includes(inst.getDataAtCell(0, c)) ? "" : (val || "Sample");
                    };
                }
                const base = props.renderer || myTable.renderers.TextRenderer;
                props.renderer = function (inst, td, r, c, prop, val) {
                    base.apply(this, arguments);
                    td.style.background = G.colEnabled[c] ? "" : "lightcoral";
                };
                return props;
            }
        });
        G.hot.addHook("afterCreateCol", G.checkEmptyColumns);
        container.addEventListener("change", e => {
            if (e.target.matches('input[type="checkbox"][data-col]')) {
                const col = +e.target.dataset.col;
                G.colEnabled[col] = e.target.checked;
                G.hot.render();
                G.resetScales(false);
                G.renderChart();
                G.checkEmptyColumns();
            }
        });
    };

})(window.GraphPlotter);
