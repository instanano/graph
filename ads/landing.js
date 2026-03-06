(function(w,d){
"use strict";
try{
const A=w.InstaNanoAds=w.InstaNanoAds||{};
A.state=A.state&&typeof A.state==="object"?A.state:{};
const C=A.constants||{};
const UTM_KEYS=Array.isArray(C.UTM_KEYS)?C.UTM_KEYS:["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
const CLICK_ID_KEYS=Array.isArray(C.CLICK_ID_KEYS)?C.CLICK_ID_KEYS:["gclid","wbraid","gbraid","dclid","fbclid","li_fat_id"];
const params=new URLSearchParams(w.location.search||"");
const hasAttribution=UTM_KEYS.concat(CLICK_ID_KEYS).some(function(key){return !!String(params.get(key)||"").trim();});
const isAdEntry=params.get("in_lp")==="1"||params.has("landing")||hasAttribution;
if(!isAdEntry)return;
const variants=A.variants||{};
function cleanText(value,maxLen){return String(value==null?"":value).replace(/\s+/g," ").trim().slice(0,maxLen||200);}
function cleanToken(value,maxLen){return cleanText(value,maxLen||80).replace(/[^a-zA-Z0-9_\-.]/g,"");}
function emit(name,payload){if(typeof A.emit==="function")A.emit(name,payload||{});}
function resolveVariant(raw){
const requested=cleanToken(raw||"",64);
if(requested==="xrd")return "landing_v1";
if(requested&&Object.prototype.hasOwnProperty.call(variants,requested))return requested;
return "landing_v1";
}
const variantId=resolveVariant(params.get("landing")||"");
const config=(variants[variantId]&&variants[variantId].landing)?variants[variantId].landing:(variants.landing_v1&&variants.landing_v1.landing?variants.landing_v1.landing:(variants.default&&variants.default.landing?variants.default.landing:null));
if(!config)return;
A.state.variantId=variantId;
const container=d.querySelector(".container");
if(!container||d.getElementById("in-ads-landing"))return;
const allowedHosts={"cdn.jsdelivr.net":1,"images.unsplash.com":1,"instanano.com":1,"www.instanano.com":1};
function safeMediaUrl(raw){
const source=cleanText(raw||"",600);
if(!source)return "";
try{
const url=new URL(source,w.location.href);
if(!/^https?:$/.test(url.protocol))return "";
if(!allowedHosts[url.hostname])return "";
return url.toString();
}catch(_){return "";}
}
function safeVideoUrl(raw){
const source=cleanText(raw||"",600);
if(!source)return "";
try{
const url=new URL(source,w.location.href);
if(!/^https?:$/.test(url.protocol))return "";
const host=(url.hostname||"").replace(/^www\./,"");
let id="";
if(host==="youtu.be")id=cleanToken((url.pathname||"").slice(1),32);
else if(host==="youtube.com"||host==="m.youtube.com"||host==="youtube-nocookie.com"){
if((url.pathname||"").indexOf("/embed/")===0)id=cleanToken((url.pathname.split("/")[2]||""),32);
else id=cleanToken(url.searchParams.get("v")||"",32);
}
if(!id)return "";
const embed=new URL("https://www.youtube.com/embed/"+id);
embed.searchParams.set("enablejsapi","1");
embed.searchParams.set("playsinline","1");
embed.searchParams.set("rel","0");
return embed.toString();
}catch(_){return "";}
}
function videoIdFromUrl(raw){
try{
const url=new URL(raw,w.location.href);
const parts=(url.pathname||"").split("/");
return cleanToken(parts[2]||"",32);
}catch(_){return "";}
}
const block=d.createElement("section");
block.id="in-ads-landing";
block.setAttribute("data-variant",variantId);
block.style.cssText="max-width:1200px;margin:12px auto 0;padding:0 12px;";
const card=d.createElement("div");
card.style.cssText="border:1px solid #d8e5ee;background:linear-gradient(135deg,#f6fbff 0%,#eef6fc 100%);border-radius:12px;padding:16px 18px;color:#102a43;font-family:Arial,Helvetica,sans-serif;box-shadow:0 6px 16px rgba(16,42,67,0.08);";
const top=d.createElement("div");
top.style.cssText="display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap;";
const copy=d.createElement("div");
copy.style.cssText="min-width:260px;flex:1;";
const badge=d.createElement("span");
badge.textContent=cleanText(config.badge||"InstaNano",48);
badge.style.cssText="display:inline-block;background:#d9eefb;color:#0a4a6c;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;";
const title=d.createElement("h2");
title.textContent=cleanText(config.headline||"Fast XRD workflow",120);
title.style.cssText="margin:10px 0 6px;font-size:26px;line-height:1.2;color:#0c2d48;";
const subtitle=d.createElement("p");
subtitle.textContent=cleanText(config.subheading||"Open XRD Match and continue your analysis.",180);
subtitle.style.cssText="margin:0;color:#334e68;font-size:15px;line-height:1.45;";
const list=d.createElement("ul");
list.style.cssText="display:flex;flex-wrap:wrap;gap:8px 16px;margin:12px 0 0;padding:0;list-style:none;color:#1f3f58;font-size:13px;";
const points=Array.isArray(config.trust_points)?config.trust_points.slice(0,4):[];
for(let i=0;i<points.length;i++){
const li=d.createElement("li");
li.textContent="- "+cleanText(points[i],80);
li.style.cssText="white-space:nowrap;";
list.appendChild(li);
}
copy.appendChild(badge);
copy.appendChild(title);
copy.appendChild(subtitle);
if(points.length)copy.appendChild(list);
const cta=d.createElement("button");
cta.type="button";
cta.id="in-landing-cta";
cta.textContent=cleanText(config.cta_label||"Start XRD Match",48);
cta.style.cssText="border:0;background:#0f6ea8;color:#fff;font-weight:700;font-size:15px;padding:12px 18px;border-radius:10px;cursor:pointer;white-space:nowrap;";
const videoUrl=safeVideoUrl(config.video_url||"");
if(videoUrl){
const mediaWrap=d.createElement("div");
mediaWrap.style.cssText="min-width:240px;max-width:380px;flex:1;";
const frame=d.createElement("iframe");
frame.src=videoUrl;
frame.title=cleanText(config.video_title||config.headline||"Workflow preview",120);
frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
frame.allowFullscreen=true;
frame.style.cssText="width:100%;aspect-ratio:16/9;border-radius:10px;border:1px solid #c5d9e8;display:block;background:#000;";
mediaWrap.appendChild(frame);
top.appendChild(mediaWrap);
let played=false;
const onMessage=function(evt){
if(played||evt.source!==frame.contentWindow)return;
let payload=evt.data;
if(typeof payload==="string"){try{payload=JSON.parse(payload);}catch(_){return;}}
if(!payload||payload.event!=="onStateChange"||Number(payload.info)!==1)return;
played=true;
w.removeEventListener("message",onMessage);
emit("landing_video_play",{variant_id:variantId,video_id:videoIdFromUrl(videoUrl)});
};
w.addEventListener("message",onMessage);
frame.addEventListener("load",function(){
try{frame.contentWindow.postMessage('{"event":"listening","id":"in_landing_video"}',"*");}catch(_){}
try{frame.contentWindow.postMessage('{"event":"command","func":"addEventListener","args":["onStateChange"],"id":"in_landing_video"}',"*");}catch(_){}
});
}else{
const mediaUrl=safeMediaUrl(config.media_url||"");
if(mediaUrl){
const mediaWrap=d.createElement("div");
mediaWrap.style.cssText="min-width:120px;";
const img=d.createElement("img");
img.src=mediaUrl;
img.alt="Workflow preview";
img.style.cssText="max-width:160px;border-radius:10px;border:1px solid #c5d9e8;display:block;";
mediaWrap.appendChild(img);
top.appendChild(mediaWrap);
}
}
top.appendChild(copy);
top.appendChild(cta);
card.appendChild(top);
block.appendChild(card);
container.parentNode.insertBefore(block,container);
cta.addEventListener("click",function(e){
e.preventDefault();
emit("landing_cta_click",{variant_id:variantId,cta_id:"in-landing-cta"});
const tab=d.getElementById("icon5");
if(tab){
if(!tab.checked)tab.checked=true;
tab.dispatchEvent(new Event("change",{bubbles:true}));
}
const target=d.querySelector(cleanText(config.cta_target||"#xrd-filter-section",80))||d.getElementById("xrd-filter-section")||d.querySelector(".panel5")||d.getElementById("xrd-search-btn");
if(target&&typeof target.scrollIntoView==="function")target.scrollIntoView({behavior:"smooth",block:"start"});
});
emit("landing_view",{variant_id:variantId});
}catch(_){}}
)(window,document);
