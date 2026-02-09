(function(G) {
    "use strict";
    let bound = false;
    G.ui.bindShellEvents = function() {
        if (bound) return;
        bound = true;
        const helpIcon = document.getElementById('help-icon');
        const helpOverlay = document.getElementById('help-prompt-overlay');
        const helpClose = document.getElementById('help-close');
        helpIcon?.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
        helpClose?.addEventListener('click', () => { helpOverlay.style.display = 'none'; });
        const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
        const modKey = isMac ? 'meta' : 'ctrl';
        const keyBinder = (() => {
            const map = new Map();
            const normalize = combo => combo.toLowerCase().split('+').map(s => s.trim()).sort().join('+');
            addEventListener('keydown', e => {
                const parts = [];
                if (isMac ? e.metaKey : e.ctrlKey) parts.push(modKey);
                parts.push(e.key.toLowerCase());
                const combo = parts.sort().join('+');
                if (map.has(combo)) {
                    e.preventDefault();
                    map.get(combo)(e);
                }
            });
            return (combo, handler) => map.set(normalize(combo), handler);
        })();
        keyBinder(`${modKey}+s`, () => document.getElementById('save')?.click());
        keyBinder(`${modKey}+d`, () => document.getElementById('download')?.click());
        keyBinder(`${modKey}+z`, () => document.getElementById('zoomBtn')?.click());
        keyBinder(`${modKey}+backspace`, () => document.getElementById('removebtn')?.click());
        keyBinder('delete', () => document.getElementById('removebtn')?.click());
        keyBinder('escape', () => {
            G.utils.clearActive();
            const popup = document.getElementById('popup-prompt-overlay');
            const help = document.getElementById('help-prompt-overlay');
            if (popup) popup.style.display = 'none';
            if (help) help.style.display = 'none';
            G.ui.disableAreaCal();
        });
        keyBinder(`${modKey}+f`, () => {
            const c = document.querySelector('.container');
            if (!c) return;
            if (!document.fullscreenElement) c.requestFullscreen().then(() => { c.style.background = '#f4eee2'; });
            else document.exitFullscreen().then(() => { c.style.background = ''; });
        });
        keyBinder(`${modKey}+i`, () => document.getElementById('enableAreaCalc')?.click());
        keyBinder(`${modKey}+.`, () => G.ui.applySupSub('sup'));
        keyBinder(`${modKey}+,`, () => G.ui.applySupSub('sub'));
        const gLink = 'https://instanano.com/online-graph-plotter/';
        const mWP = document.getElementById('mWP');
        const mEM = document.getElementById('mEM');
        const mCP = document.getElementById('mCP');
        if (mWP) mWP.href = 'https://wa.me/919467826266?text=' + encodeURIComponent('Link to open InstaNANO Graph Plotter on your laptop:\n' + gLink);
        if (mEM) mEM.href = 'mailto:?subject=' + encodeURIComponent('InstaNANO Graph Plotter Link') + '&body=' + encodeURIComponent("Link to open InstaNANO Graph Plotter on your laptop:\n\n" + gLink);
        if (mCP) mCP.onclick = e => (e.preventDefault(), navigator.clipboard.writeText(gLink).then(() => { mCP.textContent = 'Copied'; }));
        if (matchMedia('(max-width:600px)').matches) {
            document.querySelectorAll('input[name=sidebar]').forEach(i => { i.checked = false; });
            document.querySelector('.icon-strip')?.addEventListener('click', e => {
                const label = e.target.closest('label');
                const i = document.getElementById(label?.htmlFor);
                if (i?.checked) {
                    e.preventDefault();
                    i.checked = false;
                }
            });
        }
    };
})(window.GraphPlotter);
