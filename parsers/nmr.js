(function (G) {

    G.parseNMR = async function (files) {
        let fidFile = null, acqusFile = null, procFile = null;
        for (const f of files) {
            const n = f.name.toLowerCase();
            if (n === 'fid') fidFile = f;
            else if (n === 'acqus') acqusFile = f;
            else if (n.startsWith('procs')) procFile = f;
        }
        if (!fidFile) return null;
        const ab = await fidFile.arrayBuffer();
        const fidData = new Int32Array(ab);
        const n = fidData.length / 2;
        const real = [], imag = [];
        for (let i = 0; i < n; i++) { real.push(fidData[2 * i]); imag.push(fidData[2 * i + 1]); }
        let sw = 5000, sf = 400, sr = 0;
        if (acqusFile) {
            const t = await acqusFile.text();
            const match_sw = t.match(/##\$SW_h=\s*([\d.]+)/);
            const match_sf = t.match(/##\$SFO1=\s*([\d.]+)/);
            if (match_sw) sw = parseFloat(match_sw[1]);
            if (match_sf) sf = parseFloat(match_sf[1]);
        }
        if (procFile) {
            const t = await procFile.text();
            const m = t.match(/##\$SR=\s*([\-\d.]+)/);
            if (m) sr = parseFloat(m[1]);
        }
        const offset = sr / sf;
        const fftSize = 1 << Math.ceil(Math.log2(n));
        const rePad = new Array(fftSize).fill(0), imPad = new Array(fftSize).fill(0);
        for (let i = 0; i < n; i++) { rePad[i] = real[i]; imPad[i] = imag[i]; }
        function fft(re, im, inv) {
            const N = re.length;
            let j = 0;
            for (let i = 0; i < N; i++) { if (i < j) { [re[i], re[j]] = [re[j], re[i]];[im[i], im[j]] = [im[j], im[i]]; } let m = N >> 1; while (m >= 1 && j >= m) { j -= m; m >>= 1; } j += m; }
            for (let len = 2; len <= N; len <<= 1) {
                const ang = 2 * Math.PI / len * (inv ? -1 : 1), wR = Math.cos(ang), wI = Math.sin(ang);
                for (let i = 0; i < N; i += len) {
                    let wRe = 1, wIm = 0;
                    for (let k = 0; k < len / 2; k++) {
                        const tR = wRe * re[i + k + len / 2] - wIm * im[i + k + len / 2], tI = wRe * im[i + k + len / 2] + wIm * re[i + k + len / 2];
                        re[i + k + len / 2] = re[i + k] - tR; im[i + k + len / 2] = im[i + k] - tI;
                        re[i + k] += tR; im[i + k] += tI;
                        const nwR = wRe * wR - wIm * wI, nwI = wRe * wI + wIm * wR;
                        wRe = nwR; wIm = nwI;
                    }
                }
            }
            if (inv) { for (let i = 0; i < N; i++) { re[i] /= N; im[i] /= N; } }
        }
        fft(rePad, imPad, false);
        const mag = rePad.map((r, i) => Math.sqrt(r * r + imPad[i] * imPad[i]));
        const half = new Array(fftSize);
        for (let i = 0; i < fftSize; i++) half[i] = mag[(i + fftSize / 2) % fftSize];
        const rows = [];
        for (let i = 0; i < fftSize; i++) {
            const ppm = (sw / 2 - i * sw / fftSize) / sf + offset;
            rows.push([ppm, half[i]]);
        }
        return rows;
    };

})(window.GraphPlotter);
