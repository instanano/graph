(function(G) {
    "use strict";
    G.parsers.parseXRDASCII = function(text) {
        const rows = [];
        String(text || "").split(/\r?\n/).forEach(line => {
            const t = line.trim();
            if (!t || t.startsWith("#") || t.startsWith(";") || /^[_A-Za-z]+\s*=/.test(t)) return;
            const nums = t.match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g);
            if (!nums || nums.length < 2) return;
            const x = Number(nums[0]);
            const y = Number(nums[1]);
            if (Number.isFinite(x) && Number.isFinite(y)) rows.push([x, y]);
        });
        return rows.length ? rows : G.parsers.parseText(text);
    };
    function includesAscii(bytes, text) {
        for (let i = 0, n = bytes.length - text.length; i <= n; i++) {
            let ok = true;
            for (let j = 0; j < text.length; j++) {
                if (bytes[i + j] !== text.charCodeAt(j)) { ok = false; break; }
            }
            if (ok) return true;
        }
        return false;
    }
    function parseRAWRigakuUltima(buffer) {
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 0x0c5a) return null;
        const bytes = new Uint8Array(buffer);
        if (bytes[0] !== 0x46 || bytes[1] !== 0x49 || !includesAscii(bytes, "Ultima IV")) return null;
        const dv = new DataView(buffer);
        const n = dv.getUint16(0x0c52, true);
        const dataOff = 0x0c56;
        if (n < 2 || dataOff + n * 4 > buffer.byteLength) return null;
        const start = dv.getFloat32(0x0b92, true);
        const end = dv.getFloat32(0x0b96, true);
        const step = dv.getFloat32(0x0b9a, true);
        const metaOk = Number.isFinite(start) && Number.isFinite(end) && Number.isFinite(step) && step > 0;
        if (metaOk) {
            const expected = Math.round((end - start) / step) + 1;
            if (Math.abs(expected - n) > 3) return null;
        }
        const x0 = Number.isFinite(start) ? start : 0;
        const xStep = metaOk ? step : (Number.isFinite(start) && Number.isFinite(end) ? (end - start) / (n - 1) : 1);
        if (!(Number.isFinite(xStep) && xStep > 0)) return null;
        const rows = new Array(n);
        for (let i = 0; i < n; i++) {
            const y = dv.getFloat32(dataOff + i * 4, true);
            if (!Number.isFinite(y)) return null;
            rows[i] = [x0 + i * xStep, y];
        }
        return rows;
    }
    const rawVariants = [{ id: "rigaku-ultima", parse: parseRAWRigakuUltima }];
    G.parsers.parseRAW = function(buffer) {
        for (const variant of rawVariants) {
            const rows = variant.parse(buffer);
            if (rows && rows.length) return rows;
        }
        return [];
    };
    G.parsers.parseXRDML = function(text) {
        const xml = new DOMParser().parseFromString(text, "application/xml");
        const scan = xml.getElementsByTagName("scan")[0] || xml.getElementsByTagNameNS("*", "scan")[0];
        if (!scan) return [];
        let pos = scan.getElementsByTagName("positions");
        if (!pos.length) {
            const dp = scan.getElementsByTagName("dataPoints")[0];
            pos = dp ? dp.getElementsByTagName("positions") : pos;
        }
        const twoTheta = Array.from(pos).find(p => (p.getAttribute("axis") || "").toLowerCase().includes("2theta"));
        if (!twoTheta) return [];
        const start = parseFloat((twoTheta.getElementsByTagName("startPosition")[0] || twoTheta.getElementsByTagNameNS("*", "startPosition")[0]).textContent);
        const end = parseFloat((twoTheta.getElementsByTagName("endPosition")[0] || twoTheta.getElementsByTagNameNS("*", "endPosition")[0]).textContent);
        let intens = scan.getElementsByTagName("counts");
        if (!intens.length) {
            intens = scan.getElementsByTagName("intensities");
            if (!intens.length) {
                const dp = scan.getElementsByTagName("dataPoints")[0];
                intens = dp ? dp.getElementsByTagName("intensities") : intens;
            }
        }
        if (!intens.length || !intens[0] || !Number.isFinite(start) || !Number.isFinite(end)) return [];
        const arr = intens[0].textContent.trim().split(/\s+/).map(Number).filter(Number.isFinite);
        const n = arr.length;
        if (n < 2) return [];
        const step = (end - start) / (n - 1);
        return Array.from({ length: n }, (_, i) => [start + step * i, arr[i]]);
    };
})(window.GraphPlotter);
