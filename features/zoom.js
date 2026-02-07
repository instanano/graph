(function(G) {fG.renderChart();}));});
    "use strict";
    $('#zoomBtn').click(function(){
        const btn=$(this);
        if(btn.hasClass('active')){d3.select(".zoom-brush").remove();btn.removeClass('active');return}
        btn.addClass('active');
        const ac=document.getElementById('enableAreaCalc');
        if(ac.checked){ac.checked=false;ac.dispatchEvent(new Event('change'))}
        const svg=d3.select("#chart svg");
        if(svg.empty())return;
        svg.append("g").attr("class","zoom-brush").style("cursor","crosshair")
        .call(d3.brush().extent([[G.config.DIM.ML,G.config.DIM.MT],[G.config.DIM.W-G.config.DIM.MR,G.config.DIM.H-G.config.DIM.MB]])
        .on("end",({selection})=>{
            svg.select(".zoom-brush").remove();
            btn.removeClass('active');
            if(!selection)return;
            const [[x0,y0],[x1,y1]]=selection;
            const v0=G.state.lastXScale.invert(x0);
            const v1=G.state.lastXScale.invert(x1);
            const domain=G.state.lastXScale.domain();
            const isReversed=domain[0]>domain[1];
            const x=isReversed ? [Math.max(v0,v1), Math.min(v0,v1)] : [Math.min(v0,v1), Math.max(v0,v1)];  
            const y=[G.state.lastYScale.invert(y0),G.state.lastYScale.invert(y1)].sort((a,b)=>a-b);
            G.state.overrideX=x;
            G.state.overrideMultiY=G.state.overrideMultiY||{};
            G.state.overrideMultiY[0]=y;
            document.getElementById('scalemin').value=x[0].toFixed(2);
            document.getElementById('scalemax').value=x[1].toFixed(2);
            G.renderChart();G.matchXRD?.render();}));});
    d3.select("#chart").on("dblclick",()=>{G.axis.resetScales(true);G.renderChart()});
})(window.GraphPlotter);
