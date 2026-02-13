(function (G) {
    "use strict";
    const MAX_CHART_HTML_LENGTH = 2_000_000;
    async function htmlPrompt(message, defaultValue) {
        return new Promise(res => {
            $('#html-prompt-message').text(message); $('#html-prompt-input').val(defaultValue);
            $('#popup-prompt-overlay').css('display', 'flex').fadeIn(150); $('#html-prompt-input').focus().off('keydown').on('keydown', e => {
                if (e.key === 'Enter') $('#html-prompt-ok').click();
            });
            $('#html-prompt-ok').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res($('#html-prompt-input').val()); });
            $('#html-prompt-cancel').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res(null); });
        });
    }
    function sanitizeChartHTML(raw) {
        if (typeof raw !== "string") return "";
        if (raw.length > MAX_CHART_HTML_LENGTH) return "";
        const template = document.createElement("template");
        template.innerHTML = raw;
        const blockedTags = new Set(["SCRIPT", "IFRAME", "OBJECT", "EMBED", "META", "LINK", "STYLE"]);
        const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_ELEMENT);
        const remove = [];
        let node = walker.nextNode();
        while (node) {
            if (blockedTags.has(node.tagName)) {
                remove.push(node);
                node = walker.nextNode();
                continue;
            }
            Array.from(node.attributes).forEach(attr => {
                const name = attr.name.toLowerCase();
                const value = String(attr.value || "").toLowerCase();
                if (name.startsWith("on") || value.includes("javascript:")) node.removeAttribute(attr.name);
            });
            node = walker.nextNode();
        }
        remove.forEach(n => n.remove());
        return template.innerHTML;
    }
    function normalizeImportState(raw) {
        if (!raw || typeof raw !== "object") return null;
        const table = raw.table;
        if (!Array.isArray(table) || table.length < 3 || !Array.isArray(table[0]) || !Array.isArray(table[1]) || !Array.isArray(table[2])) return null;
        return {
            table,
            col: raw.col && typeof raw.col === "object" ? raw.col : {},
            settings: raw.settings && typeof raw.settings === "object" ? raw.settings : {},
            html: sanitizeChartHTML(raw.html || ""),
            overrideX: raw.overrideX || null,
            overrideMultiY: raw.overrideMultiY && typeof raw.overrideMultiY === "object" ? raw.overrideMultiY : {},
            overrideXTicks: raw.overrideXTicks ?? null,
            overrideYTicks: raw.overrideYTicks && typeof raw.overrideYTicks === "object" ? raw.overrideYTicks : {},
            overrideTernaryTicks: raw.overrideTernaryTicks && typeof raw.overrideTernaryTicks === "object" ? raw.overrideTernaryTicks : {},
            overrideScaleformatX: raw.overrideScaleformatX ?? null,
            overrideScaleformatY: raw.overrideScaleformatY && typeof raw.overrideScaleformatY === "object" ? raw.overrideScaleformatY : {},
            overrideCustomTicksX: raw.overrideCustomTicksX ?? null,
            overrideCustomTicksY: raw.overrideCustomTicksY && typeof raw.overrideCustomTicksY === "object" ? raw.overrideCustomTicksY : {},
            overrideCustomTicksTernary: raw.overrideCustomTicksTernary && typeof raw.overrideCustomTicksTernary === "object" ? raw.overrideCustomTicksTernary : {},
            overrideTernary: raw.overrideTernary && typeof raw.overrideTernary === "object" ? raw.overrideTernary : {},
            minorTickOn: raw.minorTickOn && typeof raw.minorTickOn === "object" ? raw.minorTickOn : {},
            useCustomTicksOn: raw.useCustomTicksOn && typeof raw.useCustomTicksOn === "object" ? raw.useCustomTicksOn : {},
            matchData: raw.matchData || null
        };
    }
    $('#download').click(async function (e) {
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return }
        $('#transparent-option').show();
        const input = await htmlPrompt("Enter DPI  (e.g. 150, 300, or 600 etc.)", "600");
        if (input === null) return;
        const dpi = parseFloat(input);
        if (isNaN(dpi) || dpi <= 0) return alert("Invalid DPI");
        const transparent = document.getElementById('html-prompt-transparent').checked;
        const scale = dpi / 96;
        const svg = document.querySelector("#chart svg");
        if (!svg) return;
        const clone = svg.cloneNode(true);
        clone.querySelectorAll("foreignObject div[contenteditable]").forEach(d => d.style.border = "none");
        clone.querySelectorAll(".outline[visibility='visible']").forEach(e => e.setAttribute("visibility", "hidden"));
        clone.querySelectorAll("text[contenteditable='true']").forEach(t => { t.removeAttribute("contenteditable"); t.style.outline = "none"; });
        clone.querySelectorAll(".xrd-user-peak").forEach(e => e.remove()); // Don't export red peak markers to image? Or keep them? User usually wants graph. Keep them if they are part of SVG.
        // Actually, user might want them. Let's leave them.
        clone.setAttribute("style", `background:${transparent ? 'transparent' : '#fff'};font-family:Arial,sans-serif;`);
        const data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone));
        const img = new Image();
        img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.width * scale; c.height = img.height * scale;
            const ctx = c.getContext("2d");
            if (!transparent) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height); }
            ctx.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(b => {
                if (!b) return;
                const a = document.createElement("a");
                const url = URL.createObjectURL(b);
                a.href = url;
                a.download = `chart@${dpi}dpi${transparent ? '_transparent' : ''}.png`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }, "image/png");
        };
        img.src = data;
    })
    $('#save').click(async function (e) {
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return }
        $('#transparent-option').hide();
        G.utils.clearActive(); const d = new Date(), z = n => ('0' + n).slice(-2), ts = [z(d.getDate()), z(d.getMonth() + 1), d.getFullYear()].join('-') + '_' + [z(d.getHours()), z(d.getMinutes()), z(d.getSeconds())].join('-');

        let matchData = null;
        if (G.matchXRD && G.matchXRD.getMatchSignature && G.matchXRD.getMatchSignature()) {
            matchData = {
                peaks: JSON.parse(G.matchXRD.getPeakData()),
                signature: G.matchXRD.getMatchSignature()
            };
        }
        const payload = {
            v: 'v1.0', ts, table: G.state.hot.getData(), settings: G.getSettings(), col: G.state.colEnabled, html: sanitizeChartHTML(d3.select('#chart').html()),
            overrideX: G.state.overrideX || null, overrideMultiY: G.state.overrideMultiY || {}, overrideXTicks: G.state.overrideXTicks || null,
            overrideYTicks: G.state.overrideYTicks || {}, overrideTernaryTicks: G.state.overrideTernaryTicks || {},
            overrideScaleformatX: G.state.overrideScaleformatX || null, overrideScaleformatY: G.state.overrideScaleformatY || {},
            overrideCustomTicksX: G.state.overrideCustomTicksX || null, overrideCustomTicksY: G.state.overrideCustomTicksY || {},
            overrideCustomTicksTernary: G.state.overrideCustomTicksTernary || {}, overrideTernary: G.state.overrideTernary || {},
            minorTickOn: G.state.minorTickOn || {}, useCustomTicksOn: G.state.useCustomTicksOn || {},
            matchData: matchData
        };
        const u = URL.createObjectURL(new Blob([JSON.stringify(payload)])), a = document.createElement('a'), name = await htmlPrompt("Enter file name", `Project_${ts}`); if (!name) return; a.href = u; a.download = `${name}.instanano`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);
    })
    G.importState = function (raw) {
        const s = normalizeImportState(raw);
        if (!s) { alert("Invalid .instanano file."); return; }
        G.state.hot.loadData(s.table); G.state.colEnabled = s.col; G.state.overrideX = s.overrideX; G.state.overrideMultiY = s.overrideMultiY;
        G.state.overrideXTicks = s.overrideXTicks; G.state.overrideYTicks = s.overrideYTicks; G.state.overrideTernaryTicks = s.overrideTernaryTicks;
        G.state.overrideScaleformatX = s.overrideScaleformatX; G.state.overrideScaleformatY = s.overrideScaleformatY;
        G.state.overrideCustomTicksX = s.overrideCustomTicksX; G.state.overrideCustomTicksY = s.overrideCustomTicksY;
        G.state.overrideCustomTicksTernary = s.overrideCustomTicksTernary; G.state.overrideTernary = s.overrideTernary;
        G.state.minorTickOn = s.minorTickOn || {}; G.state.useCustomTicksOn = s.useCustomTicksOn || {};
        d3.selectAll('input[type="checkbox"][data-col]').each(function () { this.checked = G.state.colEnabled[this.dataset.col] });
        const typeRadio = s.settings.type ? document.getElementById(s.settings.type) : null;
        if (typeRadio) typeRadio.checked = true;
        if (s.settings.mode) {
            const axisRadio = document.querySelector(`input[name="axistitles"][value="${s.settings.mode}"]`);
            if (axisRadio) axisRadio.checked = true;
        }
        G.state.hot.render(); G.axis.resetScales(false); G.renderChart();
        const ratioRadio = s.settings.ratio ? document.querySelector(`[name="aspectratio"][value="${s.settings.ratio}"]`) : null;
        if (ratioRadio) ratioRadio.checked = true;
        const modeRadio = s.settings.mode ? document.querySelector(`[name="axistitles"][value="${s.settings.mode}"]`) : null;
        if (modeRadio) modeRadio.checked = true;
        Object.entries(s.settings).forEach(([k, v]) => {
            if (/^(type|ratio|mode)$/.test(k) || v == null) return;
            const input = document.getElementById(k);
            if (input) input.value = v;
        });
        d3.select('#chart').html(s.html); G.features.prepareShapeLayer(); d3.selectAll('.shape-group').each(function () { G.features.makeShapeInteractive(d3.select(this)) });
        d3.selectAll('foreignObject.user-text,g.legend-group,g.axis-title').call(G.utils.applyDrag); G.axis.tickEditing(d3.select('#chart svg'));

        if (s.matchData && G.matchXRD && G.matchXRD.importState) {
            G.matchXRD.importState(s.matchData.peaks, s.matchData.signature).then(success => {
                if (success) {
                    console.log("Match data imported and verified.");
                }
            });
        }
    }
})(window.GraphPlotter);
