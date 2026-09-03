/**
 * Read the current Salesforce Lightning or Classic record page.
 * Prefer URL record Id + visible header text. Do not depend on hashed
 * Lightning CSS class names (the .cXyz style tokens).
 */

import { firstText, visibleText } from "../shared/dom.js";
import { isSensitiveLabel, looksLikeSessionSecret } from "../shared/sanitize.js";

const RECORD_ID = /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/;

/** Common key prefixes. Custom objects (a00…) stay as Custom/Unknown. */
const KEY_PREFIX = {
  "001": "Account",
  "003": "Contact",
  "005": "User",
  "006": "Opportunity",
  "00Q": "Lead",
  "00T": "Task",
  "00U": "Event",
  "500": "Case",
  "701": "Campaign",
  "00v": "CampaignMember",
  "00e": "Profile",
  "00G": "Group",
  "00D": "Organization",
  "02s": "EmailMessage",
  "800": "Contract",
  "801": "Order",
  "802": "OrderItem",
};

const NAME_SELECTORS = [
  "[slot='primaryField']",
  "records-entity-label",
  "lightning-formatted-name",
  ".slds-page-header__title lightning-formatted-text",
  "h1.slds-page-header__title",
  ".slds-page-header__title",
  "h1 .uiOutputText",
  ".pageDescription",
  ".bPageTitle h2",
  ".bPageTitle h1",
  "#contactHeaderRow h2",
  "h1.pageType",
  "h2.pageDescription",
  "h1",
];

export function extractSalesforce(doc, rawUrl) {
  const extractedAt = new Date().toISOString();
  const url = safeUrl(rawUrl) || (doc && doc.URL) || "";

  try {
    const fromUrl = parseSalesforceUrl(url);
    const titleInfo = parseSalesforceTitle(doc && doc.title);
    const name = pickName(doc, titleInfo, fromUrl);
    const objectType = fromUrl.objectApiName || titleInfo.objectType || objectFromKeyPrefix(fromUrl.id) || "";
    const headerFields = extractHeaderFields(doc);
    const ui = fromUrl.ui || guessUi(url, doc);

    if (fromUrl.pageKind === "login" || isSalesforceLogin(doc, url)) {
      return {
        source: "salesforce",
        status: "not_signed_in",
        pageType: "login",
        url,
        extractedAt,
        data: {},
        warnings: [
          "This tab looks like a Salesforce login page. Stay in your logged-in Chrome profile and open a record you can already see.",
        ],
      };
    }

    if (!fromUrl.id && !name) {
      return {
        source: "salesforce",
        status: "unexpected_layout",
        pageType: fromUrl.pageKind || "unknown",
        url,
        extractedAt,
        data: {
          ui,
          objectType,
          id: "",
          name: "",
          headerFields,
        },
        warnings: [
          "No Salesforce record Id was found in the URL and no record name was visible in the header. Open a Lightning or Classic record page and try again.",
        ],
      };
    }

    const warnings = [];
    if (!fromUrl.id) {
      warnings.push("Record Id was not in the URL; showing visible header fields only.");
    }
    if (!name) {
      warnings.push("Record name was not found in the header or document title.");
    }

    return {
      source: "salesforce",
      status: "ok",
      pageType: fromUrl.pageKind || "record",
      url,
      extractedAt,
      data: {
        ui,
        objectType,
        id: fromUrl.id || "",
        name,
        headerFields,
      },
      warnings,
    };
  } catch (error) {
    return {
      source: "salesforce",
      status: "unexpected_layout",
      pageType: "unknown",
      url,
      extractedAt,
      data: {},
      warnings: [`Reader failed without crashing the side panel: ${error && error.message ? error.message : String(error)}`],
    };
  }
}

export function parseSalesforceUrl(rawUrl) {
  const empty = { id: "", objectApiName: "", ui: "", pageKind: "" };
  let url;
  try {
    url = new URL(String(rawUrl));
  } catch {
    return empty;
  }

  const path = url.pathname || "";
  const hash = url.hash || "";

  if (/\/(login|secur\/logout|\/logout)/i.test(path) || /login\.salesforce\.com$/i.test(url.hostname)) {
    return { ...empty, pageKind: "login", ui: "login" };
  }

  const lightningRecord = path.match(/\/lightning\/r\/([^/]+)\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
  if (lightningRecord) {
    return {
      id: lightningRecord[2],
      objectApiName: decodeURIComponent(lightningRecord[1]),
      ui: "lightning",
      pageKind: "record",
    };
  }

  const lightningObject = path.match(/\/lightning\/o\/([^/]+)/);
  if (lightningObject) {
    return {
      id: "",
      objectApiName: decodeURIComponent(lightningObject[1]),
      ui: "lightning",
      pageKind: "object_home",
    };
  }

  const oneApp = hash.match(/\/sObject\/([a-zA-Z0-9]{15,18})\//);
  if (oneApp) {
    return {
      id: oneApp[1],
      objectApiName: objectFromKeyPrefix(oneApp[1]),
      ui: "lightning",
      pageKind: "record",
    };
  }

  const classic = path.match(/^\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
  if (classic && RECORD_ID.test(classic[1]) && !isReservedClassicPath(classic[1])) {
    return {
      id: classic[1],
      objectApiName: objectFromKeyPrefix(classic[1]),
      ui: "classic",
      pageKind: "record",
    };
  }

  const anyId = `${path} ${hash}`.match(/\/([a-zA-Z0-9]{15,18})(?:\/|$)/);
  if (anyId && RECORD_ID.test(anyId[1])) {
    return {
      id: anyId[1],
      objectApiName: objectFromKeyPrefix(anyId[1]),
      ui: path.includes("lightning") ? "lightning" : "",
      pageKind: "record",
    };
  }

  return empty;
}

export function objectFromKeyPrefix(id) {
  if (!id) return "";
  const prefix = String(id).slice(0, 3);
  if (KEY_PREFIX[prefix]) return KEY_PREFIX[prefix];
  if (/^a[0-9a-zA-Z]{2}/.test(prefix)) return "CustomObject";
  return "";
}

function pickName(doc, titleInfo, fromUrl) {
  const fromHeader = firstText(doc, NAME_SELECTORS);
  if (fromHeader && !isChromeNoise(fromHeader, fromUrl.objectApiName)) {
    return cleanRecordName(fromHeader);
  }
  if (titleInfo.name) return titleInfo.name;
  return "";
}

function parseSalesforceTitle(title) {
  const raw = String(title || "").trim();
  if (!raw) return { name: "", objectType: "" };
  const parts = raw.split("|").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2 && /salesforce/i.test(parts[parts.length - 1])) {
    return {
      name: parts[0],
      objectType: parts.length >= 3 ? parts[parts.length - 2] : "",
    };
  }
  const dash = raw.split(" - ").map((part) => part.trim());
  if (dash.length >= 2 && /salesforce/i.test(dash[dash.length - 1])) {
    return { name: dash[0], objectType: dash.length >= 3 ? dash[1] : "" };
  }
  return { name: "", objectType: "" };
}

function extractHeaderFields(doc) {
  const fields = [];
  const push = (label, value) => {
    const l = String(label || "").replace(/\s+/g, " ").trim();
    const v = String(value || "").replace(/\s+/g, " ").trim();
    if (!l || !v) return;
    if (isSensitiveLabel(l) || looksLikeSessionSecret(v)) return;
    if (fields.some((f) => f.label === l && f.value === v)) return;
    if (fields.length >= 12) return;
    fields.push({ label: l, value: clip(v, 200) });
  };

  for (const item of queryAllSafe(doc, "records-highlights-details-item")) {
    const label = visibleText(item.querySelector("p.slds-text-title, dt, .slds-text-title"));
    const value = visibleText(
      item.querySelector(
        "lightning-formatted-text, lightning-formatted-number, lightning-formatted-phone, lightning-formatted-email, lightning-formatted-address, a, dd, p:not(.slds-text-title)"
      )
    );
    push(label, value);
  }

  for (const block of queryAllSafe(doc, ".slds-page-header__detail-block")) {
    const label = visibleText(block.querySelector(".slds-text-title, dt"));
    const valueNode =
      block.querySelector("dd, lightning-formatted-text, lightning-formatted-number, a") ||
      block.querySelector("p:not(.slds-text-title)");
    push(label, visibleText(valueNode));
  }

  const testLabels = queryAllSafe(doc, ".test-id__field-label");
  for (const labelNode of testLabels) {
    const label = visibleText(labelNode);
    const container = labelNode.closest(".slds-form-element, .slds-grid, li, div") || labelNode.parentElement;
    const value = visibleText(container && container.querySelector(".test-id__field-value"));
    push(label, value);
  }

  const classicLabels = queryAllSafe(doc, ".labelCol, td.labelCol");
  for (const labelNode of classicLabels) {
    const label = visibleText(labelNode).replace(/:$/, "");
    const valueNode = labelNode.nextElementSibling;
    if (valueNode && (valueNode.classList.contains("dataCol") || valueNode.matches("td"))) {
      push(label, visibleText(valueNode));
    }
  }

  return fields;
}

function queryAllSafe(doc, selector) {
  try {
    return Array.from(doc.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function isSalesforceLogin(doc, rawUrl) {
  if (/login\.salesforce\.com/i.test(rawUrl)) return true;
  if (!doc || !doc.querySelector) return false;
  if (doc.querySelector("#username, #password, input[name='username']")) {
    const snippet = visibleText(doc.body).slice(0, 800);
    if (/salesforce|log in|login/i.test(snippet)) return true;
  }
  return false;
}

function guessUi(rawUrl, doc) {
  if (/lightning\.force\.com|\/lightning\//i.test(rawUrl)) return "lightning";
  if (doc && doc.querySelector("one-app-nav-bar, lightning-primitive-icon, .slds-page-header")) {
    return "lightning";
  }
  if (doc && doc.querySelector(".bPageTitle, #bodyCell, .apexp")) return "classic";
  return "";
}

function isReservedClassicPath(id) {
  return /^(home|setup|secur|login|_ui|one)$/i.test(id);
}

function isChromeNoise(text, objectApiName) {
  const t = String(text || "").trim();
  if (!t) return true;
  if (/^salesforce$/i.test(t)) return true;
  if (objectApiName && t.toLowerCase() === String(objectApiName).toLowerCase()) return true;
  return false;
}

function cleanRecordName(name) {
  return String(name || "")
    .replace(/\s+/g, " ")
    .trim();
}

function clip(text, max) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function safeUrl(raw) {
  try {
    return new URL(String(raw)).toString();
  } catch {
    return "";
  }
}

export const __test = {
  parseSalesforceTitle,
  RECORD_ID,
};
