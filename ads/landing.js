(function (w, d) {
    "use strict";

    const NS = (w.InstaNanoAds = w.InstaNanoAds || {});
    if (NS.__landingInitialized) return;
    NS.__landingInitialized = true;

    const ROOT_ID = "instanano-ads-landing";
    const STYLE_ID = "instanano-ads-landing-style";

    function safeString(value, maxLen) {
        if (value == null) return "";
        const text = String(value)
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim();
        return text.length > maxLen ? text.slice(0, maxLen) : text;
    }

    function normalizeKey(value) {
        const key = safeString(value, 64).toLowerCase();
        return key.replace(/[^a-z0-9_-]/g, "");
    }

    function readParams() {
        try {
            return new URLSearchParams(w.location.search || "");
        } catch (_) {
            return new URLSearchParams();
        }
    }

    function resolveVariant(params) {
        const variants = NS.variants || {};
        const requestedRaw = params.get("in_lp") || params.get("landing") || "";
        let requested = normalizeKey(requestedRaw);
        if (requested === "xrd") requested = "xrd_v1";

        if (!requested) return { key: "", variant: null };
        if (variants[requested]) return { key: requested, variant: variants[requested] };
        if (variants.default) return { key: "default", variant: variants.default };

        return { key: "", variant: null };
    }

    function ensureStyles() {
        if (d.getElementById(STYLE_ID)) return;
        const style = d.createElement("style");
        style.id = STYLE_ID;
        style.textContent =
            "#" +
            ROOT_ID +
            "{max-width:1500px;margin:10px auto 8px;padding:0 10px;box-sizing:border-box;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-card{border:1px solid #dfd7ca;border-radius:14px;background:linear-gradient(120deg,#fffefb,#f6f0e5);padding:16px 18px;display:grid;grid-template-columns:1fr auto;gap:16px;align-items:center;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-badge{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.02em;color:#7a5b00;background:#fdebb9;border:1px solid #f1d27a;border-radius:999px;padding:4px 10px;margin-bottom:8px;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-title{margin:0;font-size:28px;line-height:1.2;color:#2b2417;font-weight:700;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-sub{margin:7px 0 10px;color:#4c4130;font-size:15px;line-height:1.45;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-trust{display:flex;flex-wrap:wrap;gap:6px 12px;margin:0;padding:0;list-style:none;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-trust li{font-size:13px;color:#5a4c38;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-cta{display:inline-block;white-space:nowrap;border:0;border-radius:999px;background:#8a6a00;color:#fff;padding:11px 16px;font-weight:700;font-size:14px;cursor:pointer;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-cta:hover{background:#715500;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-media{width:100%;max-width:280px;border-radius:10px;overflow:hidden;border:1px solid #e7dcc7;background:#fff;}" +
            "#" +
            ROOT_ID +
            " .ads-landing-media video,#" +
            ROOT_ID +
            " .ads-landing-media iframe{display:block;width:100%;height:160px;border:0;}" +
            "@media (max-width:900px){#" +
            ROOT_ID +
            " .ads-landing-card{grid-template-columns:1fr;}#" +
            ROOT_ID +
            " .ads-landing-title{font-size:22px;}#" +
            ROOT_ID +
            " .ads-landing-media{max-width:none;}}";
        d.head.appendChild(style);
    }

    function isSafeEmbedUrl(url) {
        try {
            const parsed = new URL(url, w.location.origin);
            const host = parsed.hostname.toLowerCase();
            return (
                host === "www.youtube-nocookie.com" ||
                host === "www.youtube.com" ||
                host === "youtube.com" ||
                host === "player.vimeo.com"
            );
        } catch (_) {
            return false;
        }
    }

    function createNode(tag, className, text) {
        const node = d.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function buildMedia(mediaConfig, variantKey) {
        if (!mediaConfig || typeof mediaConfig !== "object") return null;

        const wrapper = createNode("div", "ads-landing-media", "");

        if (mediaConfig.type === "video" && mediaConfig.src) {
            const video = d.createElement("video");
            video.controls = true;
            video.preload = "metadata";
            video.src = safeString(mediaConfig.src, 1000);
            video.addEventListener("play", function () {
                NS.emit("landing_video_play", { variant_key: variantKey, media_type: "video" });
            });
            wrapper.appendChild(video);
            return wrapper;
        }

        if (mediaConfig.type === "embed" && mediaConfig.src && isSafeEmbedUrl(mediaConfig.src)) {
            const frame = d.createElement("iframe");
            frame.loading = "lazy";
            frame.referrerPolicy = "strict-origin-when-cross-origin";
            frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
            frame.allowFullscreen = true;
            frame.src = safeString(mediaConfig.src, 1000);
            wrapper.appendChild(frame);
            return wrapper;
        }

        return null;
    }

    function focusWorkflow(target) {
        if (target === "xrd") {
            const xrdTab = d.getElementById("icon5");
            if (xrdTab) xrdTab.checked = true;
        }

        const targetNode =
            d.getElementById("dropzone") ||
            d.getElementById("xrd-search-btn") ||
            d.querySelector(".container");

        if (targetNode && typeof targetNode.scrollIntoView === "function") {
            targetNode.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }

    function renderLanding(variantKey, variant, params) {
        if (!variant || d.getElementById(ROOT_ID)) return;

        const container = d.querySelector(".container");
        if (!container || !container.parentNode) return;

        ensureStyles();

        const root = createNode("section", "", "");
        root.id = ROOT_ID;
        root.setAttribute("data-variant", variantKey);

        const card = createNode("div", "ads-landing-card", "");
        const left = createNode("div", "ads-landing-copy", "");

        const badgeText = safeString(variant.badge, 64);
        if (badgeText) left.appendChild(createNode("span", "ads-landing-badge", badgeText));

        left.appendChild(createNode("h2", "ads-landing-title", safeString(variant.headline, 220)));
        left.appendChild(createNode("p", "ads-landing-sub", safeString(variant.subheading, 320)));

        const trustList = createNode("ul", "ads-landing-trust", "");
        const trustPoints = Array.isArray(variant.trustPoints) ? variant.trustPoints : [];
        trustPoints.slice(0, 4).forEach(function (point) {
            trustList.appendChild(createNode("li", "", "- " + safeString(point, 120)));
        });
        if (trustList.childElementCount) left.appendChild(trustList);

        const cta = createNode("button", "ads-landing-cta", safeString(variant.ctaText || "Try Now", 48));
        cta.type = "button";
        cta.addEventListener("click", function () {
            const target = safeString(variant.ctaTarget || "tool", 16);
            focusWorkflow(target);
            NS.emit("landing_cta_click", {
                variant_key: variantKey,
                cta_target: target,
                in_offer: safeString(params.get("in_offer") || "", 64)
            });
        });

        const right = createNode("div", "ads-landing-actions", "");
        right.appendChild(cta);

        const media = buildMedia(variant.media, variantKey);
        if (media) right.appendChild(media);

        card.appendChild(left);
        card.appendChild(right);
        root.appendChild(card);

        container.parentNode.insertBefore(root, container);
        NS.emit("landing_view", {
            variant_key: variantKey,
            in_offer: safeString(params.get("in_offer") || "", 64),
            in_exp: safeString(params.get("in_exp") || "", 64)
        });
    }

    function init() {
        const params = readParams();
        const resolved = resolveVariant(params);

        // Render only for explicit landing traffic to avoid affecting regular users.
        if (!params.has("in_lp") && !params.has("landing")) return;
        if (!resolved.variant) return;

        renderLanding(resolved.key, resolved.variant, params);
    }

    if (d.readyState === "loading") {
        d.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})(window, document);
