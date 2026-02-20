(function(G) {
    "use strict";
    G.parsers.parseNMR = async function(files){
        const pathOf = f => (f.webkitRelativePath||f.relativePath||f.name).replace(/\\/g,'/');
        if (!files || !files.length) return false; const M = new Map(files.map(f => [pathOf(f), f]));
        const F=files.filter(f=>/\/fid$/i.test(pathOf(f))); if(!F.length) return false
        function kv(t){return (t.match(/^\#\#\$(\w+)=([\s\S]*?)(?=\n\#\#|\s*$)/mg)||[]).reduce((o,s)=>{const m=/^\#\#\$(\w+)=([\s\S]*)$/m.exec(s);if(!m)return o;const v=m[2].replace(/[()]/g,' ').trim().split(/\s+/)[0];o[m[1]]=isNaN(+v)?v:+v;return o},{})}
        const specs=[]; for(const fid of F){
        const base=pathOf(fid).replace(/\/fid$/i,''); const aq=M.get(base+'/acqus')||M.get(base+'/ACQUS'); if(!aq) continue
        const A=kv(await aq.text()); const SFO1=+A.SFO1, SWh=+A.SW_h; if(!isFinite(SFO1)||!isFinite(SWh)) continue
        const O1P=isFinite(+A.O1P)?+A.O1P:(isFinite(+A.O1)?(+A.O1/SFO1):0), BY=+A.BYTORDA||0, DT=+A.DTYPA||0, NC=+A.NC||0, GRP=Math.max(0,Math.round(+A.GRPDLY||0))
        const buf=await fid.arrayBuffer(), dv=new DataView(buf), le=(BY===0); let bps=4,get
        if(DT===2){bps=2;get=i=>dv.getInt16(i*2,le)} else if(DT===3){bps=4;get=i=>dv.getFloat32(i*4,le)} else if(DT===5){bps=8;get=i=>dv.getFloat64(i*8,le)} else {bps=4;get=i=>dv.getInt32(i*4,le)}
        const nS=(buf.byteLength/bps)|0, nC=(nS/2)|0, sc=Math.pow(2,NC), re=new Float64Array(nC), im=new Float64Array(nC)
        for(let i=0;i<nC;i++){re[i]=get(2*i)*sc;im[i]=get(2*i+1)*sc}
        const off=Math.min(GRP,nC-1), R=re.subarray(off), I=im.subarray(off); let N=1; while(N<R.length) N<<=1
        const xr=new Float64Array(N), xi=new Float64Array(N); xr.set(R); xi.set(I)
        for(let i=1,j=0;i<N;i++){let b=N>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[xr[i],xr[j]]=[xr[j],xr[i]];[xi[i],xi[j]]=[xi[j],xi[i]]}}
        for(let len=2;len<=N;len<<=1){const ang=-2*Math.PI/len,wpr=Math.cos(ang),wpi=Math.sin(ang);for(let i=0;i<N;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=wr*xr[l]-wi*xi[l],ti=wr*xi[l]+wi*xr[l];xr[l]=xr[k]-tr;xi[l]=xi[k]-ti;xr[k]+=tr;xi[k]+=ti;const t=wr;wr=t*wpr-wi*wpi;wi=t*wpi+wi*wpr}}}
        const half=N>>1, mag=new Float64Array(N); for(let i=0;i<N;i++) mag[i]=Math.hypot(xr[i],xi[i])
        const ms=new Float64Array(N); ms.set(mag.subarray(half)); ms.set(mag.subarray(0,half),N-half)
        const df=SWh/N, start=-SWh/2, ppm=new Float64Array(N); for(let i=0;i<N;i++) ppm[i]=O1P+(start+i*df)/SFO1
        specs.push({name:base.split('/').pop(),x:Array.from(ppm).reverse(),y:Array.from(ms).reverse()})} if(!specs.length) return false
        const n=specs.length*2, header=Array.from({length:n},(_,i)=>i%2?'Y-axis':'X-axis'), color=Array.from({length:n},(_,i)=>G.config.COLORS[i%G.config.COLORS.length])
        const names=[]; specs.forEach(s=>{names.push('ppm');names.push(s.name)})
        const L=Math.max(...specs.map(s=>s.x.length)), rows=Array.from({length:L},(_,r)=>specs.flatMap(s=>[s.x[r]??'',s.y[r]??'']))
        G.state.hot.loadData([header,color,names,...rows]); document.getElementById('axis-nmr').checked=true; G.axis.resetScales(true); G.renderChart(); return true
    }
})(window.GraphPlotter);
