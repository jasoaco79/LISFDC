/* LISFDC Salesforce DOM extractor. Visible fields only. No API. No writes. No cookies/CSRF/sid. */
(function (root) {
  "use strict";

  var SKIP_LABEL = /session|csrf|token|cookie|sid|authorization|password|secret/i;

  function textOf(el) {
    if (!el) return "";
    return String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors, rootEl) {
    var scope = rootEl || document;
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = scope.querySelector(selectors[i]);
        var t = textOf(el);
        if (t) return t;
      } catch (e) {}
    }
    return "";
  }

  function pageUrl() {
    if (root.LISFDC_HOSTS && root.LISFDC_HOSTS.pageUrl) {
      var u = root.LISFDC_HOSTS.pageUrl();
      if (u) return u;
    }
    try {
      if (location.protocol !== "file:") return location.href;
    } catch (e) {}
    try {
      return document.documentElement.getAttribute("data-lisfdc-url") || "";
    } catch (e2) {
      return "";
    }
  }

  function kindFrom(url) {
    var u = (url || "").toLowerCase();
    var path = "";
    try {
      path = new URL(url, "https://example.salesforce.com").pathname.toLowerCase();
    } catch (e) {
      path = u;
    }
    if (u.indexOf("lightning.force.com") >= 0 || path.indexOf("/lightning/") >= 0 || path.indexOf("/one/one.app") >= 0) {
      return "lightning";
    }
    if (u.indexOf("salesforce.com") >= 0 || u.indexOf("force.com") >= 0) {
      if (document.querySelector(".slds-page-header, lightning-page-header, .oneRecordActionWrapper")) return "lightning";
      if (document.querySelector("#bodyCell, .bPageTitle, .labelCol")) return "classic";
      return "classic";
    }
    if (document.querySelector("[data-lisfdc-kind]")) {
      return document.querySelector("[data-lisfdc-kind]").getAttribute("data-lisfdc-kind") || "unknown";
    }
    return "unknown";
  }

  function parseObjectAndId(url) {
    var objectName = null;
    var id = null;
    var path = "";
    try {
      path = new URL(url, "https://example.lightning.force.com").pathname;
    } catch (e) {
      path = url || "";
    }
    var lightning = path.match(/\/lightning\/r\/([A-Za-z0-9_]+)\/([a-zA-Z0-9]{15,18})\b/);
    if (lightning) {
      objectName = lightning[1];
      id = lightning[2];
      return { object: objectName, id: id };
    }
    var classicObj = path.match(/\/([A-Za-z0-9_]+)\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
    if (classicObj && classicObj[1].toLowerCase() !== "lightning") {
      objectName = classicObj[1];
      id = classicObj[2];
      return { object: objectName, id: id };
    }
    var PREFIX = {
      "001": "Account", "003": "Contact", "00Q": "Lead", "006": "Opportunity",
      "005": "User", "00T": "Task", "701": "Campaign", "500": "Case"
    };
    var idOnly = path.match(/\/([a-zA-Z0-9]{15}|[a-zA-Z0-9]{18})(?:\/|$)/);
    if (idOnly) {
      id = idOnly[1];
      if (!objectName && id) objectName = PREFIX[id.substring(0, 3)] || objectName;
    }
    try {
      var u = new URL(url, "https://example.lightning.force.com");
      var blob = (u.hash || "") + " " + (u.search || "");
      var sObject = blob.match(/sObject\/([a-zA-Z0-9]{15,18})\b/);
      if (sObject && !id) id = sObject[1];
      var lightningHash = blob.match(/\/lightning\/r\/([A-Za-z0-9_]+)\/([a-zA-Z0-9]{15,18})/);
      if (lightningHash) {
        objectName = objectName || lightningHash[1];
        id = id || lightningHash[2];
      }
    } catch (eHash) {}
    var attrObj = document.documentElement.getAttribute("data-lisfdc-object");
    var attrId = document.documentElement.getAttribute("data-lisfdc-id");
    if (attrObj) objectName = objectName || attrObj;
    if (attrId) id = id || attrId;
    return { object: objectName, id: id };
  }

  function collectLightningFields() {
    var fields = [];
    var seen = {};
    var nodes = document.querySelectorAll(
      "[data-lisfdc-field], .slds-form-element, records-record-layout-item, lightning-output-field, records-highlights-details-item, .slds-page-header__detail-row"
    );
    for (var i = 0; i < nodes.length && fields.length < 12; i++) {
      var n = nodes[i];
      var label = "";
      var value = "";
      if (n.hasAttribute && n.hasAttribute("data-lisfdc-field")) {
        label = n.getAttribute("data-lisfdc-label") || firstText(["[data-lisfdc-label]", ".slds-form-element__label"], n);
        value = n.getAttribute("data-lisfdc-value") || firstText(["[data-lisfdc-value]", ".slds-form-element__static"], n);
      } else {
        label = firstText([
          ".slds-form-element__label",
          "label",
          "span.test-id__field-label",
          ".test-id__field-label"
        ], n);
        value = firstText([
          ".slds-form-element__static",
          "lightning-formatted-text",
          "lightning-formatted-number",
          "lightning-formatted-phone",
          "lightning-formatted-email",
          "lightning-formatted-url",
          "lightning-formatted-address",
          ".test-id__field-value",
          "span.test-id__field-value"
        ], n);
      }
      if (!label || !value) continue;
      if (SKIP_LABEL.test(label) || SKIP_LABEL.test(value)) continue;
      var key = label + "\0" + value;
      if (seen[key]) continue;
      seen[key] = true;
      fields.push({ label: label, value: value });
    }
    return fields;
  }

  function collectClassicFields() {
    var fields = [];
    var seen = {};
    var labels = document.querySelectorAll(".labelCol, td.labelCol, [data-lisfdc-field]");
    for (var i = 0; i < labels.length && fields.length < 12; i++) {
      var labEl = labels[i];
      var label = textOf(labEl);
      var value = "";
      if (labEl.hasAttribute && labEl.hasAttribute("data-lisfdc-field")) {
        label = labEl.getAttribute("data-lisfdc-label") || label;
        value = labEl.getAttribute("data-lisfdc-value") || firstText(["[data-lisfdc-value]"], labEl);
      } else {
        var data = labEl.nextElementSibling;
        if (data && (data.className || "").indexOf("dataCol") >= 0) {
          value = textOf(data);
        }
      }
      label = label.replace(/:$/, "").trim();
      if (!label || !value) continue;
      if (SKIP_LABEL.test(label) || SKIP_LABEL.test(value)) continue;
      var key = label + "\0" + value;
      if (seen[key]) continue;
      seen[key] = true;
      fields.push({ label: label, value: value });
    }
    return fields;
  }

  function extractSalesforce() {
    var url = pageUrl();
    var title = "";
    try {
      title = document.title || "";
    } catch (e) {}
    var kind = "unknown";
    try {
      kind = kindFrom(url);
    } catch (e2) {
      kind = "unknown";
    }
    var parsed = { object: null, id: null };
    try {
      parsed = parseObjectAndId(url);
    } catch (e3) {}
    var name = firstText([
      "[data-lisfdc='record-name']",
      ".slds-page-header__title lightning-formatted-text",
      "h1.slds-page-header__title",
      ".slds-page-header__title",
      "lightning-formatted-name",
      "#headerTitle",
      ".pageDescription",
      "h1.pageType",
      "h1"
    ]);
    var headerFields = [];
    try {
      if (kind === "classic") headerFields = collectClassicFields();
      else headerFields = collectLightningFields();
      if (!headerFields.length) {
        headerFields = collectLightningFields().concat(collectClassicFields());
      }
    } catch (e4) {
      headerFields = [];
    }
    var out = {
      kind: kind,
      url: url,
      title: title,
      extractedAt: new Date().toISOString(),
      object: parsed.object,
      id: parsed.id,
      name: name || null,
      headerFields: headerFields
    };
    return out;
  }

  root.LISFDC_EXTRACT_SALESFORCE = extractSalesforce;
})(typeof self !== "undefined" ? self : this);
