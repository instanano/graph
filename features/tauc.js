(function (G) {
    const COLORS = G.COLORS;

    G.bindTaucControls = function () {
        document.getElementById('generateTauc').addEventListener('click', () => {
            const exp = parseFloat(document.querySelector('input[name="tauc"]:checked').value);
            const raw = G.hot.getData().map(r => r.slice());
            const header = raw[0], colors = raw[1], names = raw[2];
            const origLen = header.length;
            const xIdx = header.indexOf('X-axis');
            const yIdx = header.indexOf('Y-axis', xIdx + 1);
            if (xIdx < 0 || yIdx < 0) return alert('Missing X-axis or Y-axis');
            raw.forEach(r => r.splice(origLen));
            header.splice(origLen);
            colors.splice(origLen);
            names.splice(origLen);
            const hv = [];
            for (let i = 3; i < raw.length; i++) hv[i] = 1240 / parseFloat(raw[i][xIdx]);
            header.push('X-axis');
            colors.push(colors[xIdx]);
            names.push(names[xIdx]);
            header.push('Y-axis');
            colors.push(colors[yIdx]);
            names.push(names[yIdx] + ` (Tauc n=${exp})`);
            for (let i = 3; i < raw.length; i++) {
                raw[i].push(hv[i], Math.pow(2.303 * hv[i] * parseFloat(raw[i][yIdx]), exp));
            }
            G.hot.loadData(raw);
            G.colEnabled = {};
            const total = header.length;
            for (let c = 0; c < total; c++) G.colEnabled[c] = c >= origLen;
            document.getElementById('axis-tauc').checked = true;
            G.hot.render();
            G.resetScales(true);
            G.renderChart();
        });
    };

})(window.GraphPlotter);
