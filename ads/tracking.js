(function(w,d){
"use strict";
const A=w.InstaNanoAds=w.InstaNanoAds||{};
A.state=A.state&&typeof A.state==="object"?A.state:{};
const C=A.constants||{};
const UTM_KEYS=Array.isArray(C.UTM_KEYS)?C.UTM_KEYS:["utm_source","utm_medium","utm_campaign","utm_term","utm_content"];
const CLICK_ID_KEYS=Array.isArray(C.CLICK_ID_KEYS)?C.CLICK_ID_KEYS:["gclid","wbraid","gbraid","dclid","fbclid","li_fat_id"];
const INTERNAL_PARAMS=Array.isArray(C.INTERNAL_PARAMS)?C.INTERNAL_PARAMS:["in_lp","in_flow","in_offer","in_exp","in_ver","landing"];
const TOUCH_KEYS=UTM_KEYS.concat(CLICK_ID_KEYS,INTERNAL_PARAMS);
const TRACKED_EVENTS=new Set(["tracking_ready","campaign_visit","landing_view","landing_content_click","landing_cta_click","xrd_tab_open","xrd_peak_add_click","xrd_search_click","xrd_unlock_click","xrd_no_credit_prompt_view","xrd_plan_select","checkout_started","checkout_error","purchase_success"]);
const FLOW_EVENTS=new Set(["landing_cta_click","xrd_tab_open","xrd_peak_add_click","xrd_search_click","xrd_unlock_click","xrd_no_credit_prompt_view","xrd_plan_select","checkout_started","checkout_error","purchase_success"]);
const RESERVED_FIELDS=new Set(["event","event_id","ts","visitor_id","session_id","flow_id","variant_id","page_url","page_path","page_title","referrer"]);
const VISITOR_KEY="in_ads_visitor_id_v1";
const SESSION_KEY="in_ads_session_id_v1";
const SESSION_TS_KEY="in_ads_session_ts_v1";
const FLOW_KEY="in_ads_flow_id_v1";
const FIRST_TOUCH_KEY="in_ads_first_touch_v1";
const LAST_TOUCH_KEY="in_ads_last_touch_v1";
const PENDING_CHECKOUT_KEY="in_ads_pending_checkout_v1";
const PURCHASE_SYNC_KEY="in_ads_purchase_sync_v1";
const PURCHASE_SEEN_KEY="in_ads_purchase_seen_v1";
const SESSION_IDLE_MS=30*60*1000;
const FIRST_TOUCH_TTL_MS=90*24*60*60*1000;
const CHECKOUT_TTL_MS=7*24*60*60*1000;
const DEDUP_WINDOW_MS=1000;
const dedupMap=new Map();
A._storageFallback=A._storageFallback||{local:{},session:{}};
const localStore=createStore("localStorage",A._storageFallback.local);
const sessionStore=createStore("sessionStorage",A._storageFallback.session);
function createStore(name,fallback){
let nativeOk;
function raw(){try{return w[name];}catch(_){return null;}}
function nativeAvailable(){
if(nativeOk!==undefined)return nativeOk;
const s=raw();
if(!s){nativeOk=false;return nativeOk;}
try{const t="__in_ads_test__";s.setItem(t,"1");s.removeItem(t);nativeOk=true;return nativeOk;}catch(_){nativeOk=false;return nativeOk;}
}
return{
get:function(key){
const s=raw();
if(s){try{const v=s.getItem(key);if(v!==null)return v;}catch(_){}}
return Object.prototype.hasOwnProperty.call(fallback,key)?fallback[key]:null;
},
set:function(key,value){
const str=String(value);
const s=raw();
if(s){try{s.setItem(key,str);delete fallback[key];return true;}catch(_){}}
fallback[key]=str;
return false;
},
remove:function(key){
const s=raw();
if(s){try{s.removeItem(key);}catch(_){}}
delete fallback[key];
},
hasNative:nativeAvailable
};
}
function now(){return Date.now();}
function makeId(prefix){return prefix+"_"+Math.random().toString(36).slice(2,10)+now().toString(36);}
function cleanText(value,maxLen){return String(value==null?"":value).replace(/\s+/g," ").trim().slice(0,maxLen||240);}
function cleanToken(value,maxLen){return cleanText(value,maxLen||96).replace(/[^a-zA-Z0-9_\-.]/g,"");}
function toNumber(value){const n=Number(value);return Number.isFinite(n)?n:0;}
function readJSON(store,key){const raw=store.get(key);if(!raw)return null;try{return JSON.parse(raw);}catch(_){return null;}}
function writeJSON(store,key,obj){try{return store.set(key,JSON.stringify(obj));}catch(_){return false;}}
function readParam(name){const params=new URLSearchParams(w.location.search||"");return cleanText(params.get(name)||"",120);}
function getVariantId(preferred){
const direct=cleanToken(preferred||"",64);
if(direct)return direct;
const stateVariant=cleanToken(A.state.variantId||"",64);
if(stateVariant)return stateVariant;
const qVariant=cleanToken(readParam("in_ver")||"",64);
if(qVariant)return qVariant;
const landing=cleanToken(readParam("landing")||"",64);
if(landing==="xrd")return "landing_v1";
if(landing)return landing;
return "default";
}
function getVisitorId(){
let id=cleanToken(localStore.get(VISITOR_KEY)||"",80);
if(!id){id=makeId("visitor");localStore.set(VISITOR_KEY,id);}
return id;
}
function getSessionId(){
const ts=toNumber(sessionStore.get(SESSION_TS_KEY));
let id=cleanToken(sessionStore.get(SESSION_KEY)||"",80);
const t=now();
if(!id||!ts||t-ts>SESSION_IDLE_MS){id=makeId("session");}
sessionStore.set(SESSION_KEY,id);
sessionStore.set(SESSION_TS_KEY,String(t));
return id;
}
function getFlowId(createIfMissing){
let flow=cleanToken(sessionStore.get(FLOW_KEY)||"",90);
if(!flow){
const qFlow=cleanToken(readParam("in_flow")||"",90);
if(qFlow)flow=qFlow;
}
if(!flow&&createIfMissing)flow=makeId("flow");
if(flow){sessionStore.set(FLOW_KEY,flow);A.state.flowId=flow;}
return flow||"";
}
function hasAnyParams(obj,keys){for(let i=0;i<keys.length;i++){if(obj[keys[i]])return true;}return false;}
function collectTouchParams(){
const params=new URLSearchParams(w.location.search||"");
const values={};
for(let i=0;i<TOUCH_KEYS.length;i++){
const key=TOUCH_KEYS[i];
const value=cleanText(params.get(key)||"",180);
if(value)values[key]=value;
}
return values;
}
function readFirstTouch(t){
const ft=readJSON(localStore,FIRST_TOUCH_KEY);
if(!ft||typeof ft!=="object")return null;
if(toNumber(ft.exp)<(t||now())){localStore.remove(FIRST_TOUCH_KEY);return null;}
return ft;
}
function readLastTouch(){
const lt=readJSON(localStore,LAST_TOUCH_KEY);
if(!lt||typeof lt!=="object")return null;
return lt;
}
function captureAttribution(){
const t=now();
const values=collectTouchParams();
if(!Object.keys(values).length)return {captured:false,values:{}};
const payload={ts:t,page_url:w.location.href,referrer:d.referrer||"",values:values};
writeJSON(localStore,LAST_TOUCH_KEY,payload);
if(!readFirstTouch(t))writeJSON(localStore,FIRST_TOUCH_KEY,{ts:t,exp:t+FIRST_TOUCH_TTL_MS,page_url:w.location.href,referrer:d.referrer||"",values:values});
return {captured:true,values:values};
}
function appendTouch(payload){
const ft=readFirstTouch(now());
const lt=readLastTouch();
payload.ft_ts=ft?toNumber(ft.ts):0;
payload.lt_ts=lt?toNumber(lt.ts):0;
for(let i=0;i<TOUCH_KEYS.length;i++){
const key=TOUCH_KEYS[i];
payload["ft_"+key]=ft&&ft.values?cleanText(ft.values[key]||"",180):"";
payload["lt_"+key]=lt&&lt.values?cleanText(lt.values[key]||"",180):"";
}
}
function sanitizeValue(value){
if(value==null)return "";
if(typeof value==="string")return cleanText(value,240);
if(typeof value==="number")return Number.isFinite(value)?value:0;
if(typeof value==="boolean")return value;
if(Array.isArray(value))return cleanText(value.join(","),240);
try{return cleanText(JSON.stringify(value),240);}catch(_){return "";}
}
function sanitizeParams(params){
const out={};
if(!params||typeof params!=="object")return out;
for(const key in params){
if(!Object.prototype.hasOwnProperty.call(params,key))continue;
if(RESERVED_FIELDS.has(key))continue;
out[key]=sanitizeValue(params[key]);
}
return out;
}
function isDuplicate(eventName,params){
const t=now();
for(const [key,stamp]of dedupMap){if(t-stamp>DEDUP_WINDOW_MS)dedupMap.delete(key);}
let encoded="";
try{encoded=JSON.stringify(params||{});}catch(_){encoded="";}
const dedupKey=eventName+"|"+encoded;
const last=dedupMap.get(dedupKey);
if(last&&t-last<DEDUP_WINDOW_MS)return true;
dedupMap.set(dedupKey,t);
return false;
}
function track(eventName,params){
if(!TRACKED_EVENTS.has(eventName))return false;
const safeParams=sanitizeParams(params);
if(isDuplicate(eventName,safeParams))return false;
const flowFromParams=cleanToken(params&&params.flow_id?params.flow_id:"",90);
const flowId=flowFromParams||getFlowId(FLOW_EVENTS.has(eventName));
if(flowId)sessionStore.set(FLOW_KEY,flowId);
const variantId=getVariantId(params&&params.variant_id?params.variant_id:"");
const payload={
event:eventName,
event_id:makeId("event"),
ts:now(),
visitor_id:getVisitorId(),
session_id:getSessionId(),
flow_id:flowId||"",
variant_id:variantId,
page_url:w.location.href,
page_path:w.location.pathname+w.location.search,
page_title:cleanText(d.title||"",200),
referrer:d.referrer||""
};
appendTouch(payload);
for(const key in safeParams){if(Object.prototype.hasOwnProperty.call(safeParams,key))payload[key]=safeParams[key];}
w.dataLayer=Array.isArray(w.dataLayer)?w.dataLayer:[];
try{w.dataLayer.push(payload);return true;}catch(_){return false;}
}
A.track=track;
function inferNoCreditReason(){
const code=cleanToken(A.state.lastUnlockCode||"",64);
if(typeof w.instananoCredits==="undefined")return {reason:"logged_out",code:code};
if(code==="no_credits"||code==="expired"||code==="email_monthly_limit")return {reason:"zero_credit",code:code};
if(code==="no_account"||code==="email_not_verified"||code==="email_denied")return {reason:"no_plan",code:code};
return {reason:"no_plan",code:code};
}
function parsePlanId(urlText){
try{
const url=new URL(urlText,w.location.href);
const id=cleanToken(url.searchParams.get("add-to-cart")||url.searchParams.get("product_id")||"",80);
return id;
}catch(_){return "";}
}
function appendFlowParams(urlText,ctx){
try{
const url=new URL(urlText,w.location.href);
if(url.origin!==w.location.origin)return urlText;
if(!/\/(cart|checkout)\b/i.test(url.pathname)&&!url.searchParams.has("add-to-cart"))return urlText;
if(ctx.flow_id)url.searchParams.set("in_flow",ctx.flow_id);
if(ctx.variant_id)url.searchParams.set("in_ver",ctx.variant_id);
const exp=readParam("in_exp");
const offer=readParam("in_offer");
if(exp&&!url.searchParams.get("in_exp"))url.searchParams.set("in_exp",exp);
if(offer&&!url.searchParams.get("in_offer"))url.searchParams.set("in_offer",offer);
return url.toString();
}catch(_){return urlText;}
}
function readPendingCheckout(){
const data=readJSON(localStore,PENDING_CHECKOUT_KEY);
if(!data||typeof data!=="object")return null;
const ts=toNumber(data.ts);
if(ts&&now()-ts>CHECKOUT_TTL_MS){localStore.remove(PENDING_CHECKOUT_KEY);return null;}
return data;
}
function purchaseKeyFromPage(){
const queryOrder=cleanToken(readParam("order-received")||"",64);
if(queryOrder)return "order_"+queryOrder;
const pathMatch=(w.location.pathname||"").match(/order-received\/([^/]+)/i);
if(pathMatch&&pathMatch[1])return "order_"+cleanToken(pathMatch[1],64);
if(/order-received/i.test(w.location.pathname+w.location.search))return "order_path_"+cleanToken(w.location.pathname,96);
if(d.body&&/\bwoocommerce-order-received\b/.test(d.body.className||""))return "woo_body_"+cleanToken(w.location.pathname,96);
if(d.querySelector(".woocommerce-order,.woocommerce-thankyou-order-received,.woocommerce-order-overview"))return "woo_dom_"+cleanToken(w.location.pathname,96);
return "";
}
function readSeenPurchases(){
const map=readJSON(localStore,PURCHASE_SEEN_KEY);
return map&&typeof map==="object"?map:{};
}
function writeSeenPurchases(map){
const keys=Object.keys(map).sort(function(a,b){return toNumber(map[b])-toNumber(map[a]);}).slice(0,80);
const out={};
for(let i=0;i<keys.length;i++)out[keys[i]]=map[keys[i]];
writeJSON(localStore,PURCHASE_SEEN_KEY,out);
}
function isPurchaseSeen(key){
if(!key)return true;
const map=readSeenPurchases();
return !!map[key];
}
function markPurchaseSeen(key){
if(!key)return;
const map=readSeenPurchases();
map[key]=now();
writeSeenPurchases(map);
}
function emitPurchaseSuccess(context,synced){
const c=context&&typeof context==="object"?context:{};
const key=cleanToken(c.purchase_key||purchaseKeyFromPage()||"",120);
if(!key||isPurchaseSeen(key))return false;
const pending=readPendingCheckout()||{};
const flowId=cleanToken(c.flow_id||pending.flow_id||"",90);
const variantId=getVariantId(c.variant_id||pending.variant_id||"");
const planId=cleanToken(c.plan_id||pending.plan_id||"",80);
const checkoutTs=toNumber(c.ts||pending.ts||0);
if(flowId)sessionStore.set(FLOW_KEY,flowId);
markPurchaseSeen(key);
track("purchase_success",{flow_id:flowId,variant_id:variantId,plan_id:planId,checkout_ts:checkoutTs,purchase_key:key,sync_source:synced?"storage":"page"});
if(!synced)writeJSON(localStore,PURCHASE_SYNC_KEY,{purchase_key:key,flow_id:flowId,variant_id:variantId,plan_id:planId,ts:now()});
localStore.remove(PENDING_CHECKOUT_KEY);
return true;
}
function bindPurchaseSync(){
w.addEventListener("storage",function(e){
if(e.key!==PURCHASE_SYNC_KEY||!e.newValue)return;
let payload;
try{payload=JSON.parse(e.newValue);}catch(_){return;}
if(!payload||!payload.purchase_key)return;
emitPurchaseSuccess(payload,true);
});
}
function patchUnlockOutcome(){
const G=w.GraphPlotter;
if(!G||!G.matchXRD||typeof G.matchXRD.unlock!=="function"||G.matchXRD.__inUnlockPatched)return;
const base=G.matchXRD.unlock;
G.matchXRD.unlock=async function(){
try{
const result=await base.apply(this,arguments);
A.state.lastUnlockCode=result&&!result.ok?cleanToken(result.code||"",64):"";
return result;
}catch(err){
A.state.lastUnlockCode="unknown";
throw err;
}
};
G.matchXRD.__inUnlockPatched=true;
}
function isCheckoutContext(){
const path=(w.location.pathname||"").toLowerCase();
const bodyClass=(d.body&&d.body.className?d.body.className:"").toLowerCase();
if(path.indexOf("order-received")!==-1||bodyClass.indexOf("woocommerce-order-received")!==-1)return false;
if(bodyClass.indexOf("woocommerce-checkout")!==-1)return true;
if(/\/checkout\b/.test(path))return true;
return !!d.querySelector("form.checkout");
}
function inferCheckoutErrorType(message){
const text=String(message||"").toLowerCase();
if(!text)return "unknown";
if(text.indexOf("coupon")!==-1)return "coupon_error";
if(text.indexOf("session")!==-1||text.indexOf("expired")!==-1)return "session_expired";
if(text.indexOf("payment")!==-1||text.indexOf("card")!==-1||text.indexOf("declin")!==-1||text.indexOf("gateway")!==-1)return "payment_failed";
if(text.indexOf("required")!==-1||text.indexOf("invalid")!==-1||text.indexOf("billing")!==-1||text.indexOf("shipping")!==-1||text.indexOf("email")!==-1||text.indexOf("phone")!==-1||text.indexOf("postcode")!==-1||text.indexOf("address")!==-1)return "validation_error";
return "unknown";
}
function emitCheckoutError(node){
if(!node||!node.getClientRects||node.getClientRects().length===0)return false;
const css=w.getComputedStyle? w.getComputedStyle(node):null;
if(css&&(css.display==="none"||css.visibility==="hidden"))return false;
const message=cleanText(node.textContent||"",220);
if(!message)return false;
const sig=cleanToken(message,120)+"|"+cleanToken(w.location.pathname,96);
if(A.state.lastCheckoutErrorSig===sig)return false;
A.state.lastCheckoutErrorSig=sig;
const pending=readPendingCheckout()||{};
track("checkout_error",{flow_id:cleanToken(pending.flow_id||"",90),variant_id:getVariantId(pending.variant_id||""),plan_id:cleanToken(pending.plan_id||"",80),error_type:inferCheckoutErrorType(message),error_text:message});
return true;
}
function scanCheckoutErrors(root){
const scope=root&&root.querySelectorAll?root:d;
const notices=scope.querySelectorAll(".woocommerce-error,.woocommerce-NoticeGroup-checkout .woocommerce-error,.wc-block-components-notice-banner.is-error,.wc-block-components-notice-banner[role='alert']");
for(let i=0;i<notices.length;i++)emitCheckoutError(notices[i]);
}
function bindCheckoutErrorTracking(){
if(!isCheckoutContext())return;
let timer=0;
const run=function(root){
if(timer)clearTimeout(timer);
timer=setTimeout(function(){timer=0;scanCheckoutErrors(root||d);},80);
};
run(d);
const hosts=[];
const checkoutForm=d.querySelector("form.checkout");
const noticesWrap=d.querySelector(".woocommerce-notices-wrapper");
const noticesGroup=d.querySelector(".woocommerce-NoticeGroup-checkout");
if(checkoutForm)hosts.push(checkoutForm);
if(noticesWrap&&hosts.indexOf(noticesWrap)===-1)hosts.push(noticesWrap);
if(noticesGroup&&hosts.indexOf(noticesGroup)===-1)hosts.push(noticesGroup);
if(!hosts.length&&d.body)hosts.push(d.body);
for(let i=0;i<hosts.length;i++){
const observer=new MutationObserver(function(){run(hosts[i]);});
observer.observe(hosts[i],{childList:true,subtree:true,attributes:true,attributeFilter:["class","style"]});
}
}
function bindDomTracking(){
const icon5=d.getElementById("icon5");
if(icon5)icon5.addEventListener("change",function(){if(this.checked)track("xrd_tab_open",{tab_id:"icon5"});});
const chart=d.getElementById("chart");
if(chart)chart.addEventListener("click",function(e){
const xrdTab=d.getElementById("icon5");
if(!xrdTab||!xrdTab.checked)return;
const svg=chart.querySelector("svg");
if(!svg||!svg.contains(e.target))return;
track("xrd_peak_add_click",{selector:"#chart svg"});
});
const searchBtn=d.getElementById("xrd-search-btn");
if(searchBtn)searchBtn.addEventListener("click",function(){track("xrd_search_click",{selector:"#xrd-search-btn"});});
const unlockBtn=d.getElementById("xrd-unlock-btn");
if(unlockBtn)unlockBtn.addEventListener("click",function(){track("xrd_unlock_click",{selector:"#xrd-unlock-btn"});});
const plans=d.getElementById("xrd-credit-plans");
if(plans){
plans.addEventListener("click",function(e){
const link=e.target&&e.target.closest?e.target.closest("a[href]"):null;
if(!link||!plans.contains(link))return;
const flowId=getFlowId(true);
const variantId=getVariantId("");
const rawHref=link.getAttribute("href")||link.href||"";
const appended=appendFlowParams(rawHref,{flow_id:flowId,variant_id:variantId});
if(appended&&appended!==rawHref){link.setAttribute("href",appended);if(link.href)link.href=appended;}
const checkoutUrl=appended||rawHref;
const planId=parsePlanId(checkoutUrl);
const checkoutContext={flow_id:flowId,plan_id:planId,variant_id:variantId,ts:now(),checkout_url:checkoutUrl};
writeJSON(localStore,PENDING_CHECKOUT_KEY,checkoutContext);
track("xrd_plan_select",{flow_id:flowId,variant_id:variantId,plan_id:planId,checkout_url:checkoutUrl});
track("checkout_started",{flow_id:flowId,variant_id:variantId,plan_id:planId,checkout_url:checkoutUrl});
});
let promptVisible=false;
let promptLastCheck=0;
const evaluatePrompt=function(){
const n=now();
if(n-promptLastCheck<200)return;
promptLastCheck=n;
let visible=false;
if(plans){
const css=w.getComputedStyle(plans);
visible=css.display!=="none"&&css.visibility!=="hidden"&&plans.getClientRects().length>0;
}
if(visible&&!promptVisible){
const info=inferNoCreditReason();
track("xrd_no_credit_prompt_view",{reason:info.reason,unlock_code:info.code});
}
promptVisible=visible;
};
const observer=new MutationObserver(evaluatePrompt);
observer.observe(plans,{attributes:true,attributeFilter:["style","class"],childList:true,subtree:true});
evaluatePrompt();
}
patchUnlockOutcome();
bindCheckoutErrorTracking();
emitPurchaseSuccess({},false);
}
function bindEventBus(){
if(typeof A.consumeQueuedEvents!=="function")return;
A.consumeQueuedEvents(function(name,payload){
if(!TRACKED_EVENTS.has(name))return;
track(name,payload&&typeof payload==="object"?payload:{});
});
}
function checkCampaignEntry(captured){
const params=new URLSearchParams(w.location.search||"");
const hasLanding=params.has("landing");
const hasInLp=params.get("in_lp")==="1";
const hasAttrib=hasAnyParams(captured.values||{},UTM_KEYS.concat(CLICK_ID_KEYS));
if(!hasLanding&&!hasInLp&&!hasAttrib)return;
track("campaign_visit",{entry_landing:hasLanding?1:0,entry_in_lp:hasInLp?1:0,entry_attribution:hasAttrib?1:0});
}
function init(){
const captured=captureAttribution();
if(readParam("in_flow"))getFlowId(false);
bindEventBus();
bindPurchaseSync();
track("tracking_ready",{storage_mode:localStore.hasNative()?"native":"memory"});
checkCampaignEntry(captured);
if(d.readyState==="loading")d.addEventListener("DOMContentLoaded",bindDomTracking,{once:true});
else bindDomTracking();
}
init();
})(window,document);
