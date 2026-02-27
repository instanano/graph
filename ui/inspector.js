(function(G) {
    "use strict";
    G.ui.refs.colorCtrl = d3.select("#addedtextcolor");
    G.ui.refs.sizeCtrl = d3.select("#addedtextsize");
    G.ui.refs.addTextBtn = d3.select("#addtext");
    G.ui.refs.addTextVBtn = d3.select("#addtextv");
    G.ui.refs.rmBtn = d3.select("#removebtn");
    G.ui.refs.fontCtrl = d3.select("#fontfamily");
    G.ui.refs.boldBtn = d3.select("#boldBtn");
    G.ui.refs.italicBtn = d3.select("#italicBtn");
    function updateTickStyle(a,b){
        if(!G.state.activeTicks)return;var c=a=='color'?'fill':a=='fontSize'?'font-size':a=='fontFamily'?'font-family':a=='fontWeight'?'font-weight':a=='fontStyle'?'font-style':a,d=(G.state.activeTicks.attr('class')||'').split(/\s+/).find(e=>e.startsWith('tick-')&&e!=='tick-label');if(!d)return;var t=d.slice(5),i=t=='y'?window.activeYi||0:0;G.state.tickLabelStyles[t]=G.state.tickLabelStyles[t]||{};G.state.tickLabelStyles[t][i]=G.state.tickLabelStyles[t][i]||{};G.state.tickLabelStyles[t][i][a]=b;G.state.activeTicks.style(c,b);
    }
    G.ui.refs.colorCtrl.on('input', function() {
        const v = this.value; const txt = G.state.activeText || G.state.activeDiv; if (txt) txt.style('color', v); if (G.state.activeTicks) {updateTickStyle('color', v);}
        if (G.state.activeGroup) {const sh = G.state.activeGroup.select('.shape'); const tag = sh.node().tagName.toLowerCase();
        if ((tag === 'rect' || tag === 'ellipse') && sh.attr('fill') !== 'none') { sh.attr('fill', v).attr('stroke', v);} 
        else { sh.attr('stroke', v);} G.features.updateArrowMarkerColor(sh, v);}});
    G.ui.refs.sizeCtrl.on('input',e=>{
        const v=e.target.value+'px'; updateTickStyle('fontSize',v); if(G.state.activeText||G.state.activeDiv){
        const txt=G.state.activeText||G.state.activeDiv;txt.style('font-size',v); if(G.state.activeFo)G.state.activeFo.attr('width',txt.node().scrollWidth+5);}
        if(!G.state.activeGroup)return; const s=+e.target.value,b=5+s/2,sh=G.state.activeGroup.select('.shape'),
        ol=G.state.activeGroup.select('.outline'),hit=G.state.activeGroup.select('.hit'); sh.attr('stroke-width',s); 
        hit.attr('stroke-width',sh.node().tagName=='rect'?2*b:s+2*b); if(sh.node().tagName=='rect'){
        const o=G.features.bufferOutline(sh,b);ol.attr('x',o.x).attr('y',o.y).attr('width',o.w).attr('height',o.h);}
        else{const pts=G.features.bufferOutline(sh,b);ol.attr('points',pts.join(' '));}});
    G.ui.refs.fontCtrl.on('change',e=>{
        const v=e.target.value; updateTickStyle('fontFamily',v); const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks;
        if(tgt)tgt.style('font-family',v); if(G.state.activeFo){const fo=G.state.activeFo,div=fo.select('div').node();fo.attr('width',div.scrollWidth+5);}});
    G.ui.refs.boldBtn.on('click',()=>{
        const now=!G.ui.refs.boldBtn.classed('active'); G.ui.refs.boldBtn.classed('active',now); updateTickStyle('fontWeight',now?'bold':'normal');
        const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks; if(tgt)tgt.style('font-weight',now?'bold':'normal');});
    G.ui.refs.italicBtn.on('click',()=>{
        const now=!G.ui.refs.italicBtn.classed('active'); G.ui.refs.italicBtn.classed('active',now); updateTickStyle('fontStyle',now?'italic':'normal');
        const tgt=G.state.activeText||G.state.activeDiv||G.state.activeTicks; if(tgt)tgt.style('font-style',now?'italic':'normal');});
    function getActiveEditableDiv(){
        if(typeof G.state.activeText!=='undefined'&&G.state.activeText)return G.state.activeText.node?G.state.activeText.node():G.state.activeText;
        if(typeof G.state.activeDiv!=='undefined'&&G.state.activeDiv)return G.state.activeDiv.node?G.state.activeDiv.node():G.state.activeDiv;
        const sel=window.getSelection&&window.getSelection(); if(!sel||sel.rangeCount===0)return null;
        let node=sel.anchorNode instanceof Element?sel.anchorNode:sel.anchorNode&&sel.anchorNode.parentElement;
        if(!node)return null; const editable=node.closest&&node.closest('foreignObject > div[contenteditable]'); return editable||null;
    }
    function resizeFO(ed){
        const fo=ed&&ed.parentNode; if(fo&&fo.tagName&&fo.tagName.toLowerCase()==='foreignobject'){
        fo.setAttribute('width',ed.scrollWidth+5); fo.setAttribute('height',ed.scrollHeight+5);}
    }
    G.ui.applySupSub = function(which){
        const ed=getActiveEditableDiv(); if(!ed)return; ed.focus(); const isSup=document.queryCommandState('superscript');
        const isSub=document.queryCommandState('subscript'); if(which==='sup'){ if(isSup){document.execCommand('superscript',false,null);}
        else{ if(isSub) document.execCommand('subscript',false,null); document.execCommand('superscript',false,null);}
        }else{ if(isSub){document.execCommand('subscript',false,null);} else{ if(isSup) document.execCommand('superscript',false,null); document.execCommand('subscript',false,null);}} resizeFO(ed); setActiveButtons();
    }
    function setActiveButtons(){
        const ed=getActiveEditableDiv(); const supOn=ed?document.queryCommandState('superscript'):false;
        const subOn=ed?document.queryCommandState('subscript'):false; const supBtn=document.getElementById('supBtn');
        const subBtn=document.getElementById('subBtn'); if(supOn){supBtn.classList.add('active'); subBtn.classList.remove('active');}
        else if(subOn){subBtn.classList.add('active'); supBtn.classList.remove('active');}
        else{supBtn.classList.remove('active'); subBtn.classList.remove('active');}
    }
    document.getElementById('supBtn').addEventListener('mousedown',e=>{e.preventDefault();G.ui.applySupSub('sup');});
    document.getElementById('subBtn').addEventListener('mousedown',e=>{e.preventDefault();G.ui.applySupSub('sub');});
    document.addEventListener('selectionchange',setActiveButtons);
    document.addEventListener('mouseup',setActiveButtons);
    document.addEventListener('keyup',setActiveButtons);
    G.ui.refs.rmBtn.on("click", () => { if (G.state.activeGroup) { G.state.activeGroup.style("display", "none"); G.state.activeGroup = null;}
        else if (G.state.activeFo) { const parentG = G.state.activeFo.node().parentNode; if (parentG.classList.contains("xrd-ref-legend")) { const refId = parentG.dataset.refid || ""; G.matchXRD?.removeReference?.(refId); d3.select(parentG).remove(); }
        else if (parentG.classList.contains("legend-group")) { d3.select(parentG).style("display", "none"); } else { d3.select(G.state.activeFo.node()).style("display", "none");}} 
        G.state.activeFo = G.state.activeDiv = null; G.ui.refs.rmBtn.classed("disabled", true);}); 
})(window.GraphPlotter);
