(function (G) {
    const COLORS = G.COLORS;
    const DIM = G.DIM;

    function linearFit(xs, ys) {
        const X = [], Y = [];
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) { X.push(x); Y.push(y); }
        }
        const n = X.length;
        if (n < 2) return null;
        let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
        for (let i = 0; i < n; i++) {
            const x = X[i], y = Y[i];
            sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y;
        }
        const den = n * sxx - sx * sx;
        if (den === 0) return null;
        const m = (n * sxy - sx * sy) / den, b = (sy - m * sx) / n, yb = sy / n;
        let st = 0, sr = 0;
        for (let i = 0; i < n; i++) {
            const yt = Y[i], yf = m * X[i] + b;
            st += (yt - yb) * (yt - yb);
            sr += (yt - yf) * (yt - yf);
        }
        const r2 = st > 0 ? 1 - sr / st : 1;
        return { m, b, r2 };
    }

    function solve3(a, b) {
        let A = a.map(r => r.slice()), B = b.slice();
        for (let i = 0; i < 3; i++) {
            let p = i;
            for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
            [A[i], A[p]] = [A[p], A[i]];
            [B[i], B[p]] = [B[p], B[i]];
            const pv = A[i][i];
            if (pv === 0) return null;
            for (let j = i; j < 3; j++) A[i][j] /= pv;
            B[i] /= pv;
            for (let r = 0; r < 3; r++) if (r !== i) {
                const f = A[r][i];
                for (let j = i; j < 3; j++) A[r][j] -= f * A[i][j];
                B[r] -= f * B[i];
            }
        }
        return B;
    }

    function quadraticFit(xs, ys) {
        let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, t0 = 0, t1 = 0, t2 = 0, c = 0;
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const x2 = x * x, x3 = x2 * x, x4 = x3 * x;
                s0 += 1; s1 += x; s2 += x2; s3 += x3; s4 += x4; t0 += y; t1 += x * y; t2 += x2 * y; c++;
            }
        }
        if (c < 3) return null;
        const sol = solve3([[s4, s3, s2], [s3, s2, s1], [s2, s1, s0]], [t2, t1, t0]);
        if (!sol) return null;
        const [a, b, c0] = sol;
        let yb = t0 / s0, st = 0, sr = 0;
        for (let i = 0; i < xs.length; i++) {
            const x = +xs[i], y = +ys[i];
            if (Number.isFinite(x) && Number.isFinite(y)) {
                const yf = a * x * x + b * x + c0;
                st += (y - yb) * (y - yb);
                sr += (y - yf) * (y - yf);
            }
        }
        const r2 = st > 0 ? 1 - sr / st : 1;
        return { a, b, c: c0, r2 };
    }

    G.bindFittingControls = function () {
        document.getElementById('applyfit').onclick = function () {
            const btn = d3.select(this);
            if (btn.classed('active')) {
                d3.select(".fit-brush").remove();
                btn.classed('active', false).style("background", null);
                return;
            }
            const tbl = G.hot.getData(), hd = tbl[0], cl = tbl[1], nm = tbl[2], rw = tbl.slice(3);
            const enY = [];
            for (let c = 0; c < hd.length; c++) if (hd[c] === 'Y-axis' && G.colEnabled[c]) enY.push(c);
            if (!enY.length) { alert('No enabled Y series.'); return; }
            const xcs = hd.map((h, i) => h === 'X-axis' && G.colEnabled[i] ? i : -1).filter(i => i >= 0);
            if (!xcs.length) { alert('Missing X-axis.'); return; }
            btn.classed('active', true).style("background", "#c6c6c6");
            const svg = d3.select("#chart svg");
            if (svg.empty()) return;
            svg.append("g").attr("class", "fit-brush").style("cursor", "crosshair")
                .call(d3.brushX().extent([[DIM.ML, DIM.MT], [DIM.W - DIM.MR, DIM.H - DIM.MB]])
                    .on("end", ({ selection }) => {
                        svg.select(".fit-brush").remove();
                        btn.classed('active', false).style("background", null);
                        if (!selection) return;
                        const [x0, x1] = selection.map(window.lastXScale.invert);
                        const minX = Math.min(x0, x1), maxX = Math.max(x0, x1);
                        const wh = (document.querySelector('input[name="fit"]:checked') || { value: 'linear' }).value;
                        const infos = [];
                        for (const yi of enY) {
                            let xi = -1;
                            for (let k = 0; k < xcs.length; k++) {
                                const xk = xcs[k], nx = xcs[k + 1] ?? hd.length;
                                if (yi > xk && yi < nx) { xi = xk; break; }
                            }
                            if (xi < 0) continue;
                            const lbl = nm[yi];
                            const subX = [], subY = [];
                            rw.forEach(r => {
                                const vX = parseFloat(r[xi]), vY = parseFloat(r[yi]);
                                if (Number.isFinite(vX) && Number.isFinite(vY) && vX >= minX && vX <= maxX) {
                                    subX.push(vX); subY.push(vY);
                                }
                            });
                            if (subX.length < 2) continue;
                            if (wh === 'linear') {
                                const f = linearFit(subX, subY);
                                if (!f) continue;
                                const yh = rw.map(r => {
                                    const vX = parseFloat(r[xi]);
                                    return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? f.m * vX + f.b : '';
                                });
                                hd.push('Y-axis');
                                cl.push(COLORS[cl.length % COLORS.length]);
                                nm.push(lbl + ' (fit)');
                                rw.forEach((r, i) => r.push(yh[i]));
                                infos.push(`${lbl}: m=${f.m.toFixed(6)}, b=${f.b.toFixed(6)}, R<sup>2</sup>=${f.r2.toFixed(5)}`);
                            } else {
                                if (subX.length < 3) continue;
                                const f = quadraticFit(subX, subY);
                                if (!f) continue;
                                const yh = rw.map(r => {
                                    const vX = parseFloat(r[xi]);
                                    return (Number.isFinite(vX) && vX >= minX && vX <= maxX) ? f.a * vX * vX + f.b * vX + f.c : '';
                                });
                                hd.push('Y-axis');
                                cl.push(COLORS[cl.length % COLORS.length]);
                                nm.push(lbl + ' (fit)');
                                rw.forEach((r, i) => r.push(yh[i]));
                                infos.push(`${lbl}: a=${f.a.toExponential(3)}, b=${f.b.toExponential(3)}, c=${f.c.toExponential(3)}, R<sup>2</sup>=${f.r2.toFixed(5)}`);
                            }
                        }
                        G.hot.loadData([hd, cl, nm, ...rw]);
                        for (let c = 0; c < hd.length; c++) if (G.colEnabled[c] === undefined) G.colEnabled[c] = true;
                        G.hot.render();
                        G.resetScales(false);
                        G.renderChart();
                        const bx = DIM.ML + 6, by = DIM.MT + 12;
                        const newSvg = d3.select('#chart svg');
                        const st = newSvg.selectAll('foreignObject.user-text').size();
                        infos.forEach((tx, i) => {
                            const obj = G.editableText(newSvg, { x: bx, y: by + (st + i) * 16, text: tx, rotation: 0 });
                            obj.div.html(tx);
                            obj.fo.attr('width', obj.div.node().scrollWidth + obj.pad).attr('height', obj.div.node().scrollHeight + obj.pad);
                            obj.fo.classed('user-text', true).call(G.applyDrag);
                        });
                    }));
        };
    };

})(window.GraphPlotter);
