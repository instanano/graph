(function(w){
"use strict";
const A=w.InstaNanoAds=w.InstaNanoAds||{};
function deepFreeze(obj,seen){
if(!obj||typeof obj!=="object"||Object.isFrozen(obj))return obj;
seen=seen||[];
if(seen.indexOf(obj)!==-1)return obj;
seen.push(obj);
Object.getOwnPropertyNames(obj).forEach(function(key){deepFreeze(obj[key],seen);});
return Object.freeze(obj);
}
const UTM_KEYS=["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
const CLICK_ID_KEYS=["gclid","wbraid","gbraid","dclid","fbclid","li_fat_id"];
const INTERNAL_PARAMS=["in_lp","in_flow","in_offer","in_exp","in_ver","landing"];
const VARIANTS={
default:{id:"default",experiment:"landing",version:"default",landing:{badge:"Scientific Analysis",headline:"Plot your spectra and unlock faster XRD decisions.",subheading:"Upload, inspect peaks, and move to XRD matching in one focused workflow.",trust_points:["No installation needed","Built for researchers and labs","Works with your existing files"],cta_label:"Open XRD Match",cta_target:"#xrd-filter-section",media_url:"",video_url:"https://www.youtube.com/watch?v=uKmeZx3cwo8"}},
landing_v1:{id:"landing_v1",experiment:"landing",version:"v1",landing:{badge:"XRD Match Ready",headline:"Turn raw peaks into match-ready XRD insights in minutes.",subheading:"Start in the graph workspace, switch to XRD Match, and run your search flow faster.",trust_points:["Interactive peak selection","Reference-backed matching","Credit plans available instantly"],cta_label:"Start XRD Match",cta_target:"#xrd-filter-section",media_url:"",video_url:"https://www.youtube.com/watch?v=VkA4wvNuAZA"}}
};
A.constants=A.constants||{};
A.constants.UTM_KEYS=deepFreeze(UTM_KEYS.slice());
A.constants.CLICK_ID_KEYS=deepFreeze(CLICK_ID_KEYS.slice());
A.constants.INTERNAL_PARAMS=deepFreeze(INTERNAL_PARAMS.slice());
A.constants.ATTRIBUTION_KEYS=deepFreeze(UTM_KEYS.concat(CLICK_ID_KEYS));
A.variants=deepFreeze(VARIANTS);
A.state=A.state&&typeof A.state==="object"?A.state:{};
if(!A.state.variantId)A.state.variantId="default";
const q=Array.isArray(A._eventQueue)?A._eventQueue:[];
const h=Array.isArray(A._eventHandlers)?A._eventHandlers:[];
A._eventQueue=q;
A._eventHandlers=h;
A.emit=function(name,payload){
if(typeof name!=="string"||!name)return;
const p=payload&&typeof payload==="object"?payload:{};
const evt={name:name,payload:p,ts:Date.now()};
q.push(evt);
for(let i=0;i<h.length;i++){try{h[i](evt.name,evt.payload,evt.ts);}catch(_){}}
};
A.consumeQueuedEvents=function(handler){
if(typeof handler!=="function")return;
h.push(handler);
while(q.length){
const evt=q.shift();
try{handler(evt.name,evt.payload,evt.ts);}catch(_){}
}
};
})(window);
