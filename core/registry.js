(function (G) {
    const types = new Map();
    G.ChartRegistry = {
        register: function (def) {
            if (!def.id || typeof def.draw !== "function") {
                throw new Error("Invalid chart registration");
            }
            types.set(def.id, def);
        },
        get: function (id) {
            const chart = types.get(id);
            if (!chart) throw new Error(`Unknown chart type: ${id}`);
            return chart;
        }
    };
})(window.GraphPlotter);
