(function(G) {
    async function htmlPrompt(message, defaultValue) {
        return new Promise(res => { $('#html-prompt-message').text(message); $('#html-prompt-input').val(defaultValue); 
        $('#popup-prompt-overlay').css('display','flex').fadeIn(150); $('#html-prompt-input').focus().off('keydown').on('keydown', e => {
        if (e.key === 'Enter')   $('#html-prompt-ok').click();});
        $('#html-prompt-ok').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res($('#html-prompt-input').val());});
        $('#html-prompt-cancel').off('click').on('click', () => { $('#popup-prompt-overlay').fadeOut(150); res(null);});});
    }

    $('#download').click(async function(e){
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return}     
        $('#transparent-option').show();
        const input = await htmlPrompt( "Enter DPI  (e.g. 150, 300, or 600 etc.)", "600");
        if(input===null)return;
        const dpi=parseFloat(input);
        if(isNaN(dpi)||dpi<=0)return alert("Invalid DPI");
        const transparent = document.getElementById('html-prompt-transparent').checked;
        const scale=dpi/96;
        const svg=document.querySelector("#chart svg");
        if(!svg)return;
        const clone=svg.cloneNode(true);
        clone.querySelectorAll("foreignObject div[contenteditable]").forEach(d=>d.style.border="none");
        clone.querySelectorAll(".outline[visibility='visible']").forEach(e=>e.setAttribute("visibility","hidden"));
        clone.querySelectorAll("text[contenteditable='true']").forEach(t => { t.removeAttribute("contenteditable"); t.style.outline = "none";});
        clone.setAttribute("style",`background:${transparent ? 'transparent' : '#fff'};font-family:Arial,sans-serif;`);
        const data="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(new XMLSerializer().serializeToString(clone));
        const img=new Image();
        img.onload=()=>{
            const c=document.createElement("canvas");
            c.width=img.width*scale; c.height=img.height*scale;
            const ctx=c.getContext("2d");
            if (!transparent) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);}
            ctx.drawImage(img,0,0,c.width,c.height);
            c.toBlob(b=>{const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download = `chart@${dpi}dpi${transparent ? '_transparent' : ''}.png`;a.click();},"image/png");}; img.src=data;})
        
    $('#save').click(async function(e){  
        e.preventDefault(); if (!myUserVars.isLoggedIn) { e.stopPropagation(); $('#ajax-login-modal').show(); return} 
        $('#transparent-option').hide();
        G.utils.clearActive(); const d=new Date(), z=n=>('0'+n).slice(-2), ts=[z(d.getDate()), z(d.getMonth()+1), d.getFullYear()].join('-')+'_'+[z(d.getHours()),z(d.getMinutes()),z(d.getSeconds())].join('-'); 
        const payload={v:'v1.0', ts, table:G.state.hot.getData(), settings:G.getSettings(), col:G.state.colEnabled, html:d3.select('#chart').html(),
        overrideX:G.state.overrideX||null, overrideMultiY:G.state.overrideMultiY||{}, overrideXTicks:G.state.overrideXTicks||null,
        overrideYTicks:G.state.overrideYTicks||{}, overrideTernaryTicks:G.state.overrideTernaryTicks||{}, 
        overrideScaleformatX:G.state.overrideScaleformatX||null, overrideScaleformatY:G.state.overrideScaleformatY||{},
        overrideCustomTicksX:G.state.overrideCustomTicksX||null, overrideCustomTicksY:G.state.overrideCustomTicksY||{},
        overrideCustomTicksTernary:G.state.overrideCustomTicksTernary||{}, overrideTernary:G.state.overrideTernary||{}, 
        minorTickOn: G.state.minorTickOn || {}, useCustomTicksOn:G.state.useCustomTicksOn||{}};
        const u=URL.createObjectURL(new Blob([JSON.stringify(payload)])), a=document.createElement('a'), name = await htmlPrompt( "Enter file name", `Project_${ts}`); if(!name) return; a.href=u; a.download=`${name}.instanano`; 
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u);})
    
    G.importState = function(s){ G.state.hot.loadData(s.table); G.state.colEnabled=s.col; G.state.overrideX = s.overrideX; G.state.overrideMultiY = s.overrideMultiY;
        G.state.overrideXTicks= s.overrideXTicks; G.state.overrideYTicks = s.overrideYTicks; G.state.overrideTernaryTicks = s.overrideTernaryTicks;
        G.state.overrideScaleformatX = s.overrideScaleformatX; G.state.overrideScaleformatY = s.overrideScaleformatY;
        G.state.overrideCustomTicksX = s.overrideCustomTicksX; G.state.overrideCustomTicksY = s.overrideCustomTicksY;
        G.state.overrideCustomTicksTernary = s.overrideCustomTicksTernary; G.state.overrideTernary = s.overrideTernary; 
        G.state.minorTickOn = s.minorTickOn || {}; G.state.useCustomTicksOn=s.useCustomTicksOn||{};
        d3.selectAll('input[type="checkbox"][data-col]').each(function(){this.checked=G.state.colEnabled[this.dataset.col]});
        document.getElementById(s.settings.type).checked=true; 
        if (s.settings.mode) { const axisRadio = document.querySelector(`input[name="axistitles"][value="${s.settings.mode}"]`); 
        if (axisRadio) axisRadio.checked = true;}
        G.state.hot.render(); G.axis.resetScales(false); G.renderChart();
        document.querySelector(`[name="aspectratio"][value="${s.settings.ratio}"]`).checked=true;
        document.querySelector(`[name="axistitles"][value="${s.settings.mode}"]`).checked=true;
        Object.entries(s.settings).forEach(([k,v])=> !/^(type|ratio|mode)$/.test(k)&&(e=document.getElementById(k))&&v!=null&&(e.value=v));
        d3.select('#chart').html(s.html); G.features.prepareShapeLayer(); d3.selectAll('.shape-group').each(function(){G.features.makeShapeInteractive(d3.select(this))});
        d3.selectAll('foreignObject.user-text,g.legend-group,g.axis-title').call(G.utils.applyDrag); G.axis.tickEditing(d3.select('#chart svg'));
    }
})(window.GraphPlotter);
