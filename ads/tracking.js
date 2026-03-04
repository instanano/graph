(function (w, d) {
    "use strict";

    const NS = (w.InstaNanoAds = w.InstaNanoAds || {});
    if (NS.__trackingInitialized) return;
    NS.__trackingInitialized = true;

    const ATTR_KEY = "instanano_ads_attr_v1";
    const VISITOR_KEY = "instanano_ads_vid_v1";
    const SESSION_KEY = "instanano_ads_sid_v1";
    const FLOW_KEY = "instanano_ads_flow_v1";
    const CHECKOUT_KEY = "instanano_ads_checkout_v1";
    const EVENT_VERSION = "1.0.0";
    const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

    const paramKeys = NS.paramKeys || {};
    const UTM_KEYS = paramKeys.utm || [
        "utm_id",
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term"
    ];
    const CLICK_ID_KEYS = paramKeys.clickIds || ["gclid", "wbraid", "gbraid", "dclid", "fbclid"];
    const INTERNAL_KEYS = paramKeys.internal || ["in_lp", "in_flow", "in_offer", "in_exp", "in_ver", "landing"];
    const TRACK_KEYS = UTM_KEYS.concat(CLICK_ID_KEYS, INTERNAL_KEYS);

    let pendingSearchResult = false;
    let lastUnlockClickAt = 0;
    let planModalOpen = false;
    let searchTimeoutHandle = null;

    function safeString(value, maxLen) {
        if (value == null) return "";
        const str = String(value)
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();
        return str.length > maxLen ? str.slice(0, maxLen) : str;
    }

    function toNumber(value, fallback) {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function safeRead(storage, key) {
        try {
            return storage.getItem(key);
        } catch (_) {
            return null;
        }
    }

    function safeWrite(storage, key, value) {
        try {
            storage.setItem(key, value);
        } catch (_) {
            // Ignore storage failures; tracking should not break UX.
        }
    }

    function safeRemove(storage, key) {
        try {
            storage.removeItem(key);
        } catch (_) {
            // Ignore storage failures.
        }
    }

    function parseJson(raw, fallback) {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function uid(prefix) {
        const base =
            w.crypto && typeof w.crypto.randomUUID === "function"
                ? w.crypto.randomUUID()
                : Math.random().toString(36).slice(2) + Date.now().toString(36);
        return prefix + "_" + base;
    }

    function getId(storage, key, prefix) {
        const existing = safeRead(storage, key);
        if (existing) return existing;
        const created = uid(prefix);
        safeWrite(storage, key, created);
        return created;
    }

    function getSearchParams() {
        try {
            return new URLSearchParams(w.location.search || "");
        } catch (_) {
            return new URLSearchParams();
        }
    }

    function hasAnyAttribution(data) {
        return Object.keys(data).some(function (k) {
            return !!data[k];
        });
    }

    function readAttributionState() {
        return parseJson(safeRead(w.localStorage, ATTR_KEY), {});
    }

    function writeAttributionState(state) {
        safeWrite(w.localStorage, ATTR_KEY, JSON.stringify(state || {}));
    }

    function pickParams(params, keys) {
        const out = {};
        keys.forEach(function (key) {
            if (!params.has(key)) return;
            const value = safeString(params.get(key), 180);
            if (value) out[key] = value;
        });
        return out;
    }

    function captureAttribution() {
        const params = getSearchParams();
        const incoming = Object.assign({}, pickParams(params, TRACK_KEYS));
        const state = readAttributionState();

        if (!state.first_touch && hasAnyAttribution(incoming)) {
            state.first_touch = incoming;
            state.first_touch_at = Date.now();
        }

        if (hasAnyAttribution(incoming)) {
            state.last_touch = incoming;
            state.last_touch_at = Date.now();
        }

        state.updated_at = Date.now();
        writeAttributionState(state);
        return state;
    }

    function buildAttributionPayload() {
        const state = readAttributionState();
        const first = state.first_touch || {};
        const last = state.last_touch || {};
        const out = {};

        TRACK_KEYS.forEach(function (key) {
            if (last[key]) out[key] = last[key];
            if (first[key]) out["ft_" + key] = first[key];
        });

        return out;
    }

    function dataLayerPush(payload) {
        w.dataLayer = w.dataLayer || [];
        w.dataLayer.push(payload);
    }

    function getSelectedPeakCount() {
        return d.querySelectorAll("#chart .xrd-user-peak").length;
    }

    function getMatchMetrics() {
        const box = d.getElementById("xrd-matchedData");
        if (!box) {
            return { result_count: 0, locked_count: 0, limited_count: 0, has_no_match_text: false };
        }

        const rows = box.querySelectorAll(".matchedrow");
        const locked = box.querySelectorAll('.matchedrow[data-tag="locked"]').length;
        const limited = box.querySelectorAll('.matchedrow[data-tag="limited"]').length;
        const text = safeString(box.textContent || "", 400).toLowerCase();

        return {
            result_count: rows.length,
            locked_count: locked,
            limited_count: limited,
            has_no_match_text: text.indexOf("no matching peaks found") >= 0
        };
    }

    function pushEvent(eventName, extra) {
        const payload = Object.assign(
            {
                event: "instanano_event",
                event_name: safeString(eventName, 64),
                event_id: uid("evt"),
                event_version: EVENT_VERSION,
                ts: new Date().toISOString(),
                visitor_id: getId(w.localStorage, VISITOR_KEY, "vid"),
                session_id: getId(w.sessionStorage, SESSION_KEY, "sid"),
                flow_id: getId(w.sessionStorage, FLOW_KEY, "flow"),
                page_path: safeString(w.location.pathname, 200),
                page_url: safeString(w.location.href, 1000),
                page_title: safeString(d.title, 200),
                referrer: safeString(d.referrer, 1000),
                is_logged_in: typeof w.instananoCredits !== "undefined"
            },
            buildAttributionPayload(),
            extra || {}
        );

        dataLayerPush(payload);
    }

    function consumeAdsEvent(event) {
        if (!event || !event.name) return;
        pushEvent(event.name, event.payload || {});
    }

    function onLandingReady() {
        NS.onEvent = consumeAdsEvent;
        if (typeof NS.consumeQueuedEvents === "function") NS.consumeQueuedEvents(consumeAdsEvent);
    }

    function emitSearchResult(source) {
        const metrics = getMatchMetrics();
        pushEvent("xrd_search_result", Object.assign({ source: source }, metrics));

        if (metrics.locked_count > 0 || metrics.limited_count > 0) {
            pushEvent("xrd_unlock_prompt_view", {
                locked_count: metrics.locked_count,
                limited_count: metrics.limited_count
            });
        }
    }

    function scheduleSearchTimeoutFallback() {
        if (searchTimeoutHandle) w.clearTimeout(searchTimeoutHandle);
        searchTimeoutHandle = w.setTimeout(function () {
            if (!pendingSearchResult) return;
            pendingSearchResult = false;
            emitSearchResult("timeout");
        }, 4500);
    }

    function isVisible(el) {
        if (!el) return false;
        const style = w.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
    }

    function detectPlanModalOpen() {
        const modal = d.getElementById("xrd-credit-plans");
        if (!modal) return;
        const visible = isVisible(modal);
        if (visible && !planModalOpen) {
            planModalOpen = true;
            pushEvent("plans_modal_open", { location: "xrd_unlock" });
        } else if (!visible && planModalOpen) {
            planModalOpen = false;
        }
    }

    function parseActionFromRequest(input, init) {
        const req = input && typeof input === "object" ? input : null;
        const url = safeString(
            typeof input === "string" ? input : req && req.url ? req.url : "",
            1000
        );

        let body = init && Object.prototype.hasOwnProperty.call(init, "body") ? init.body : null;
        if (!body && req && req.bodyUsed === false) {
            body = null;
        }

        let action = "";
        if (body && typeof FormData !== "undefined" && body instanceof FormData) {
            action = safeString(body.get("action"), 80);
        } else if (typeof body === "string") {
            const params = new URLSearchParams(body);
            action = safeString(params.get("action"), 80);
        }

        return { url: url, action: action };
    }

    function rememberCheckout(planData) {
        const payload = {
            ts: Date.now(),
            plan_id: safeString(planData.plan_id, 32),
            plan_name: safeString(planData.plan_name, 120)
        };
        safeWrite(w.localStorage, CHECKOUT_KEY, JSON.stringify(payload));
    }

    function takeRecentCheckout() {
        const data = parseJson(safeRead(w.localStorage, CHECKOUT_KEY), null);
        if (!data || !data.ts) return null;
        if (Date.now() - Number(data.ts) > CHECKOUT_TTL_MS) {
            safeRemove(w.localStorage, CHECKOUT_KEY);
            return null;
        }
        return data;
    }

    function attachUIListeners() {
        const icon5 = d.getElementById("icon5");
        if (icon5) {
            icon5.addEventListener("change", function () {
                if (icon5.checked) pushEvent("xrd_tab_open", { panel: "xrd" });
            });
        }

        const searchBtn = d.getElementById("xrd-search-btn");
        if (searchBtn) {
            searchBtn.addEventListener("click", function () {
                pendingSearchResult = true;
                pushEvent("xrd_search_click", {
                    selected_peak_count: getSelectedPeakCount(),
                    filter_mode: safeString((d.getElementById("xrd-logic-mode") || {}).value, 16),
                    filter_element_count: toNumber((d.getElementById("xrd-element-count") || {}).value, 0),
                    has_element_filter: safeString((d.getElementById("xrd-elements") || {}).value, 200) !== ""
                });
                scheduleSearchTimeoutFallback();
            });
        }

        const unlockBtn = d.getElementById("xrd-unlock-btn");
        if (unlockBtn) {
            unlockBtn.addEventListener("click", function () {
                lastUnlockClickAt = Date.now();
                pushEvent("xrd_unlock_click", {
                    selected_peak_count: getSelectedPeakCount(),
                    has_credit_nonce: typeof w.instananoCredits !== "undefined"
                });
            });
        }

        const plansRoot = d.getElementById("xrd-credit-plans");
        if (plansRoot) {
            plansRoot.addEventListener("click", function (event) {
                const link = event.target && event.target.closest ? event.target.closest("a.cta-button[href]") : null;
                if (!link) return;

                let parsed;
                try {
                    parsed = new URL(link.getAttribute("href"), w.location.origin);
                } catch (_) {
                    return;
                }

                const planCard = link.closest(".pricing-card");
                const planName = safeString(planCard && planCard.querySelector("h3") ? planCard.querySelector("h3").textContent : "", 120);
                const amount = safeString(planCard && planCard.querySelector(".amount") ? planCard.querySelector(".amount").textContent : "", 40);
                const planId = safeString(parsed.searchParams.get("add-to-cart") || "", 32);
                const planData = {
                    plan_id: planId,
                    plan_name: planName,
                    plan_amount_label: amount,
                    checkout_mode: "new_tab"
                };

                pushEvent("plan_buy_click", planData);
                pushEvent("checkout_started", planData);
                rememberCheckout(planData);
            });

            const modalObserver = new MutationObserver(detectPlanModalOpen);
            modalObserver.observe(plansRoot, {
                attributes: true,
                attributeFilter: ["style", "class"]
            });
        }

        const matches = d.getElementById("xrd-matchedData");
        if (matches) {
            const matchObserver = new MutationObserver(function () {
                if (!pendingSearchResult) return;
                pendingSearchResult = false;
                emitSearchResult("observer");
            });
            matchObserver.observe(matches, {
                childList: true,
                subtree: true
            });
        }
    }

    function patchFetch() {
        if (typeof w.fetch !== "function" || w.fetch.__instananoAdsWrapped) return;

        const originalFetch = w.fetch.bind(w);
        const wrappedFetch = function (input, init) {
            const meta = parseActionFromRequest(input, init);
            const startedAt = Date.now();

            return originalFetch(input, init)
                .then(function (response) {
                    if (
                        meta.url.indexOf("admin-ajax.php") >= 0 &&
                        meta.action === "instanano_use_credit" &&
                        Date.now() - lastUnlockClickAt < 30000
                    ) {
                        response
                            .clone()
                            .json()
                            .then(function (json) {
                                const duration = Date.now() - startedAt;
                                if (json && json.success) {
                                    pushEvent("xrd_unlock_success", {
                                        response_ms: duration,
                                        analysis_type: safeString(
                                            json.data && json.data.analysis_type ? json.data.analysis_type : "xrd",
                                            16
                                        )
                                    });

                                    const checkout = takeRecentCheckout();
                                    if (checkout) {
                                        pushEvent("xrd_unlock_after_payment_success", {
                                            plan_id: safeString(checkout.plan_id, 32),
                                            plan_name: safeString(checkout.plan_name, 120)
                                        });
                                        safeRemove(w.localStorage, CHECKOUT_KEY);
                                    }
                                } else {
                                    pushEvent("xrd_unlock_failed", {
                                        response_ms: duration,
                                        error_code: safeString(json && json.data ? json.data.code : "unknown", 48),
                                        error_message: safeString(json && json.data ? json.data.message : "Unlock failed", 200)
                                    });
                                }
                            })
                            .catch(function () {
                                pushEvent("xrd_unlock_failed", {
                                    response_ms: Date.now() - startedAt,
                                    error_code: "invalid_json",
                                    error_message: "Unlock response parse failed"
                                });
                            });
                    }
                    return response;
                })
                .catch(function (error) {
                    if (
                        meta.url.indexOf("admin-ajax.php") >= 0 &&
                        meta.action === "instanano_use_credit" &&
                        Date.now() - lastUnlockClickAt < 30000
                    ) {
                        pushEvent("xrd_unlock_failed", {
                            response_ms: Date.now() - startedAt,
                            error_code: "network_error",
                            error_message: safeString(error && error.message ? error.message : "network error", 200)
                        });
                    }
                    throw error;
                });
        };

        wrappedFetch.__instananoAdsWrapped = true;
        w.fetch = wrappedFetch;
    }

    function init() {
        captureAttribution();
        onLandingReady();
        patchFetch();
        attachUIListeners();

        pushEvent("tracking_ready", {
            tracking_mode: "browser_only",
            schema: NS.schemaVersion || "ads_v1"
        });

        // If landing module is not used, still count visits with campaign params.
        const params = getSearchParams();
        if (params.has("in_lp") || params.has("landing") || params.has("utm_source") || params.has("gclid") || params.has("fbclid")) {
            pushEvent("campaign_visit", {
                in_lp: safeString(params.get("in_lp") || params.get("landing") || "", 64)
            });
        }

        detectPlanModalOpen();
    }

    if (d.readyState === "loading") {
        d.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})(window, document);
