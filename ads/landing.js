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
function createEl(tag,className,text){
const el=d.createElement(tag);
if(className)el.className=className;
if(text!=null)el.textContent=text;
return el;
}
const block=createEl("section","in-ads-landing");
block.id="in-ads-landing";
block.setAttribute("data-variant",variantId);
const card=createEl("div","in-ads-landing__card");
const top=createEl("div","in-ads-landing__layout");
const copy=createEl("div","in-ads-landing__copy");
const badge=createEl("span","in-ads-landing__badge",cleanText(config.badge||"InstaNano",48));
const title=createEl("h2","in-ads-landing__title",cleanText(config.headline||"Fast XRD workflow",120));
const subtitle=createEl("p","in-ads-landing__subtitle",cleanText(config.subheading||"Open XRD Match and continue your analysis.",180));
const list=createEl("ul","in-ads-landing__list");
const points=Array.isArray(config.trust_points)?config.trust_points.slice(0,4):[];
for(let i=0;i<points.length;i++){
const li=createEl("li","in-ads-landing__list-item","- "+cleanText(points[i],80));
list.appendChild(li);
}
copy.appendChild(badge);
copy.appendChild(title);
copy.appendChild(subtitle);
if(points.length)copy.appendChild(list);
const cta=createEl("button","in-ads-landing__cta",cleanText(config.cta_label||"Start XRD Match",48));
cta.type="button";
cta.id="in-landing-cta";
copy.appendChild(cta);
const videoUrl=safeVideoUrl(config.video_url||"");
if(videoUrl){
const mediaWrap=createEl("div","in-ads-landing__media");
const frame=createEl("iframe","in-ads-landing__frame");
frame.src=videoUrl;
frame.title=cleanText(config.video_title||config.headline||"Workflow preview",120);
frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
frame.allowFullscreen=true;
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
const mediaWrap=createEl("div","in-ads-landing__media in-ads-landing__media--image");
const img=createEl("img","in-ads-landing__image");
img.src=mediaUrl;
img.alt="Workflow preview";
mediaWrap.appendChild(img);
top.appendChild(mediaWrap);
}
}
top.appendChild(copy);
card.appendChild(top);
block.appendChild(card);
d.body.appendChild(block);
cta.addEventListener("click",function(e){
e.preventDefault();
emit("landing_cta_click",{variant_id:variantId,cta_id:"in-landing-cta"});
block.classList.add("in-ads-landing--hidden");
});
emit("landing_view",{variant_id:variantId});
}catch(_){}}
)(window,document);
