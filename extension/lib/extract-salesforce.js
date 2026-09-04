/* LISFDC: scrape-only Salesforce Lightning / Classic visible DOM → structured extract.
 * No network. No cookies. Never writes. Prefer semantic / lightning selectors.
 */
(function (root) {
  "use strict";

  function text(el) {
    if (!el) return "";
    return String(el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors, rootEl) {
    var base = rootEl || document;
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = base.querySelector(selectors[i]);
        var t = text(el);
        if (t) return t;
      } catch (e) {}
    }
    return "";
  }

  function attr(el, name) {
    if (!el) return "";
    return String(el.getAttribute(name) || "").trim();
  }

  var RECORD_ID_RE = /\b([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})\b/;

  function idFromUrl(href) {
    try {
      var u = new URL(href || location.href);
      var path = u.pathname || "";
      var m = path.match(/\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
      if (m) return m[1];
      var hash = u.hash || "";
      m = hash.match(/\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$|\?)/);
      if (m) return m[1];
      m = (href || "").match(RECORD_ID_RE);
      return m ? m[1] : "";
    } catch (e) {
      return "";
    }
  }

  function objectFromUrl(href) {
    try {
      var u = new URL(href || location.href);
      var path = (u.pathname || "") + (u.hash || "");
      var m = path.match(/\/lightning\/r\/([A-Za-z0-9_]+)\//);
      if (m) return m[1];
      m = path.match(/\/lightning\/o\/([A-Za-z0-9_]+)\//);
      if (m) return m[1];
      return "";
    } catch (e) {
      return "";
    }
  }

  function isTokenShapedValue(value) {
    var v = String(value == null ? "" : value).trim();
    if (!v) return false;
    if (v.length < 20) return false;
    if (/\s/.test(v)) return false;
    return /^(?:[A-Za-z0-9_\-+/=.]{20,}|[0-9a-f]{32,})$/i.test(v);
  }

  var SKIP_LABEL = /\b(?:cookie|sid|csrf|token|authorization|sessionid|aura\.token)\b/i;

  function shouldSkipField(label, value) {
    var l = String(label == null ? "" : label);
    if (SKIP_LABEL.test(l)) return true;
    if (isTokenShapedValue(value)) return true;
    return false;
  }

  function pushField(fields, label, value) {
    var l = String(label || "").replace(/\s+/g, " ").trim();
    var v = String(value || "").replace(/\s+/g, " ").trim();
    if (!l || !v) return;
    if (shouldSkipField(l, v)) return;
    if (l.length > 80 || v.length > 500) return;
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].label === l && fields[i].value === v) return;
    }
    fields.push({ label: l, value: v });
  }

  function extractLightningFields() {
    var fields = [];
    var items = document.querySelectorAll(
      "records-record-layout-item, force-record-layout-item, .slds-form-element, lightning-output-field, .record-layout-item"
    );
    for (var i = 0; i < items.length && fields.length < 40; i++) {
      var item = items[i];
      var label =
        firstText([
          "span.test-id__field-label",
          ".slds-form-element__label",
          "label",
          "[slot=\"label\"]",
          ".field-label"
        ], item) ||
        attr(item, "field-label") ||
        attr(item, "data-target-selection-name");
      var value =
        firstText([
          "lightning-formatted-text",
          "lightning-formatted-name",
          "lightning-formatted-email",
          "lightning-formatted-phone",
          "lightning-formatted-url",
          "lightning-formatted-number",
          "lightning-formatted-address",
          "lightning-base-formatted-text",
          ".slds-form-element__control",
          ".test-id__field-value",
          "[slot=\"output\"]",
          "a[href^=\"mailto:\"]",
          "a[href^=\"tel:\"]"
        ], item);
      if (!value) {
        var raw = item.querySelector(".slds-form-element__control, .test-id__field-value");
        value = text(raw);
      }
      pushField(fields, label, value);
    }
    return fields;
  }

  function extractClassicFields() {
    var fields = [];
    var rows = document.querySelectorAll(".pbBody .labelCol, .labelCol, td.labelCol");
    for (var i = 0; i < rows.length && fields.length < 40; i++) {
      var labelEl = rows[i];
      var valueEl = labelEl.nextElementSibling;
      if (!valueEl) continue;
      pushField(fields, text(labelEl), text(valueEl));
    }
    var detail = document.querySelectorAll(".detailList tr, table.detailList tr");
    for (var d = 0; d < detail.length && fields.length < 40; d++) {
      var cells = detail[d].querySelectorAll("td, th");
      if (cells.length >= 2) {
        pushField(fields, text(cells[0]), text(cells[1]));
      }
      if (cells.length >= 4) {
        pushField(fields, text(cells[2]), text(cells[3]));
      }
    }
    return fields;
  }

  function extractHighlights() {
    var name = firstText([
      "lightning-formatted-name",
      "records-entity-label",
      ".entityNameTitle",
      ".slds-page-header__title",
      "h1.slds-page-header__title",
      "h1.pageType",
      "h2.pageType",
      ".topName",
      "#topButtonRow + * .pageType",
      "h1"
    ]);
    return name;
  }

  function extract() {
    var href = location.href;
    var id = idFromUrl(href);
    var objectApi = objectFromUrl(href);
    var name = extractHighlights();
    var fields = extractLightningFields();
    if (!fields.length) fields = extractClassicFields();
    return {
      id: id || null,
      objectApiName: objectApi || null,
      name: name || null,
      fields: fields,
      url: href.split("#")[0],
      scrapedAt: new Date().toISOString()
    };
  }

  root.__LISFDC_extractSalesforce = extract;
})(typeof self !== "undefined" ? self : this);
