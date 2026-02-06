(function (G) {
    "use strict";
    const CDN_BASE = 'https://cdn.jsdelivr.net/gh/instanano/graph_static@latest/match/';
    const cache = {};
    const config = {
        ftirmatch: { buf: { range: 20, single: 50 }, cols: ['Peak Position', 'Group', 'Class', 'Intensity'] },
        xpsmatch: { buf: { range: 1, single: 0.5 }, cols: ['Peak Position', 'Group', 'Material', 'Notes'] },
        ramanmatch: { buf: { range: 10, single: 30 }, cols: ['Raman Shift (cm⁻¹)', 'Material', 'Mode', 'Notes'] },
        uvvismatch: { buf: { range: 20, single: 40 }, cols: ['λmax (nm)', 'Material', 'Characteristic', 'Description'] },
        hnmrmatch: { buf: { range: 0.2, single: 0.5 }, cols: ['Chemical Shift (ppm)', 'Type', 'Assignment', 'Description'] },
        cnmrmatch: { buf: { range: 10, single: 20 }, cols: ['Chemical Shift (ppm)', 'Type', 'Assignment', 'Description'] }
    };
    async function fetchData(id) {
        if (cache[id]) return cache[id];
        const folder = id.replace('match', '');
        const res = await fetch(`${CDN_BASE}${folder}/match.json`);
        return cache[id] = await res.json();
    }
    G.matchStandard = {
        isStandard: (id) => !!config[id],
        search: async (id, xVal) => {
            const data = await fetchData(id);
            const { buf, cols } = config[id];
            const matches = data.filter(r => {
                const p = r[0].split('-').map(Number);
                return p.length > 1
                    ? (xVal >= p[0] - buf.range && xVal <= p[1] + buf.range)
                    : Math.abs(xVal - p[0]) <= buf.single;
            });
            return { matches: matches.map(row => ({ row })), cols };
        }
    };
})(window.GraphPlotter);
