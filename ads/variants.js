(function (w) {
    "use strict";

    const NS = (w.InstaNanoAds = w.InstaNanoAds || {});
    const UTM_KEYS = [
        "utm_id",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "utm_source_platform",
        "utm_creative_format",
        "utm_marketing_tactic"
    ];
    const CLICK_ID_KEYS = ["gclid", "wbraid", "gbraid", "dclid", "fbclid"];
    const INTERNAL_KEYS = ["in_lp", "in_flow", "in_offer", "in_exp", "in_ver", "landing"];

    const variants = {
        default: {
            key: "default",
            badge: "Free XRD Preview",
            headline: "Plot your data instantly and preview top XRD matches for free.",
            subheading:
                "Get the top 3 peaks of the top 3 references free, then unlock full matching when needed.",
            ctaText: "Try Your Sample",
            ctaTarget: "tool",
            trustPoints: [
                "No app install required",
                "Fast in-browser plotting workflow",
                "Credit-based unlock only when you need full matching"
            ]
        },
        xrd_v1: {
            key: "xrd_v1",
            badge: "XRD Matching",
            headline: "Upload XRD data, preview top matches free, unlock full references when ready.",
            subheading:
                "Designed for researchers who want immediate plotting plus a practical phase-matching workflow.",
            ctaText: "Try XRD Workflow",
            ctaTarget: "xrd",
            trustPoints: [
                "Top-3 preview is free",
                "Unlock flow keeps your current graph tab intact",
                "Filters and references stay tied to your working sample"
            ]
        },
        xrd_speed_v1: {
            key: "xrd_speed_v1",
            badge: "Fast Track",
            headline: "From raw sample to XRD preview in minutes.",
            subheading:
                "Open graph, select peaks, search references, and unlock full detail only when required.",
            ctaText: "Start Matching",
            ctaTarget: "xrd",
            trustPoints: [
                "Built for quick ad-click onboarding",
                "No forced flow change for checkout",
                "Works with your existing credit plans"
            ]
        }
    };

    function deepFreeze(obj) {
        if (!obj || typeof obj !== "object") return obj;
        Object.getOwnPropertyNames(obj).forEach(function (name) {
            const value = obj[name];
            if (value && typeof value === "object") deepFreeze(value);
        });
        return Object.freeze(obj);
    }

    NS.schemaVersion = "ads_v1";
    NS.paramKeys = {
        utm: UTM_KEYS.slice(),
        clickIds: CLICK_ID_KEYS.slice(),
        internal: INTERNAL_KEYS.slice()
    };
    NS.variants = deepFreeze(variants);
    NS._queue = Array.isArray(NS._queue) ? NS._queue : [];

    NS.emit = function (name, payload) {
        if (!name || typeof name !== "string") return;
        const event = {
            name: name,
            payload: payload && typeof payload === "object" ? payload : {},
            ts: Date.now()
        };
        if (typeof NS.onEvent === "function") {
            try {
                NS.onEvent(event);
                return;
            } catch (_) {
                // fall through to queue for safety
            }
        }
        NS._queue.push(event);
    };

    NS.consumeQueuedEvents = function (handler) {
        if (typeof handler !== "function") return;
        while (NS._queue.length) {
            const event = NS._queue.shift();
            handler(event);
        }
    };
})(window);
