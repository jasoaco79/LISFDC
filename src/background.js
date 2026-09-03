/**
 * LISFDC service worker.
 * Routes user-initiated reads and LinkedIn tab navigation.
 * Does not fetch LinkedIn or Salesforce from this worker.
 * Does not store cookies, Authorization headers, or SIDs.
 */

import { describeTabKind, isLinkedInHost, isSalesforceHost, normalizeLinkedInNavUrl } from "./hosts.js";
import { scrubExtract } from "./shared/sanitize.js";

const STORAGE_KEYS = {
  linkedin: "lastLinkedIn",
  salesforce: "lastSalesforce",
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(sendResponse)
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error && error.message ? error.message : String(error),
      });
    });
  return true;
});

async function handleMessage(message) {
  const type = message && message.type;
  if (type === "LISFDC_GET_STATE") {
    return { ok: true, state: await getState() };
  }
  if (type === "LISFDC_EXTRACT_LINKEDIN") {
    return extractFromKind("linkedin");
  }
  if (type === "LISFDC_EXTRACT_SALESFORCE") {
    return extractFromKind("salesforce");
  }
  if (type === "LISFDC_NAVIGATE_LINKEDIN") {
    return navigateLinkedIn(message.url);
  }
  if (type === "LISFDC_CLEAR") {
    await chrome.storage.local.remove([STORAGE_KEYS.linkedin, STORAGE_KEYS.salesforce]);
    return { ok: true, state: await getState() };
  }
  return { ok: false, error: "unknown_message" };
}

async function getState() {
  const stored = await chrome.storage.local.get([STORAGE_KEYS.linkedin, STORAGE_KEYS.salesforce]);
  return {
    lastLinkedIn: stored[STORAGE_KEYS.linkedin] || null,
    lastSalesforce: stored[STORAGE_KEYS.salesforce] || null,
  };
}

async function extractFromKind(kind) {
  const tab = await findTab(kind);
  if (!tab) {
    return {
      ok: false,
      error: kind === "linkedin" ? "no_linkedin_tab" : "no_salesforce_tab",
      message:
        kind === "linkedin"
          ? "No LinkedIn tab is open in this Chrome profile. Open linkedin.com while signed in, then read again."
          : "No Salesforce tab is open in this Chrome profile. Open a Lightning or Classic record, then read again.",
    };
  }

  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { type: "LISFDC_EXTRACT" });
  } catch {
    return {
      ok: false,
      error: "content_script_missing",
      message:
        "The page reader is not on this tab yet. Refresh the LinkedIn or Salesforce tab after loading LISFDC, then try again. LISFDC does not fetch those sites from the background worker.",
      tab: { id: tab.id, url: tab.url || "" },
    };
  }

  const result = scrubExtract((response && response.result) || emptyFailure(kind, tab.url));
  await chrome.storage.local.set({ [STORAGE_KEYS[kind]]: result });
  return { ok: true, result, state: await getState() };
}

async function navigateLinkedIn(rawUrl) {
  const parsed = normalizeLinkedInNavUrl(rawUrl);
  if (!parsed.ok) {
    return {
      ok: false,
      error: parsed.reason,
      message: navErrorMessage(parsed.reason),
    };
  }

  const tab = await findTab("linkedin");
  if (!tab) {
    return {
      ok: false,
      error: "no_linkedin_tab",
      message:
        "Open a LinkedIn tab in this Chrome profile first, then use Open in this tab. LISFDC will not create a new tab or send that URL from a worker.",
    };
  }

  await chrome.tabs.update(tab.id, { url: parsed.url, active: true });
  return { ok: true, url: parsed.url, tabId: tab.id };
}

async function findTab(kind) {
  const match =
    kind === "linkedin"
      ? (url) => isLinkedInHost(safeHost(url))
      : (url) => isSalesforceHost(safeHost(url));

  const focused = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused[0] && match(focused[0].url || "")) return focused[0];

  const windows = await chrome.windows.getAll({ populate: false });
  const lastFocused = windows.find((w) => w.focused) || windows[0];
  if (lastFocused) {
    const inWindow = await chrome.tabs.query({ active: true, windowId: lastFocused.id });
    if (inWindow[0] && match(inWindow[0].url || "")) return inWindow[0];
  }

  const all = await chrome.tabs.query({});
  const candidates = all.filter((tab) => match(tab.url || "") && describeTabKind(tab.url) === kind);
  if (!candidates.length) return null;
  candidates.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  return candidates[0];
}

function safeHost(rawUrl) {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return "";
  }
}

function emptyFailure(kind, url) {
  return {
    source: kind,
    status: "unexpected_layout",
    pageType: "unknown",
    url: url || "",
    extractedAt: new Date().toISOString(),
    data: {},
    warnings: ["The content script returned no extract."],
  };
}

function navErrorMessage(reason) {
  switch (reason) {
    case "empty":
      return "Type a LinkedIn profile or search URL first.";
    case "not_a_url":
      return "That does not look like a URL.";
    case "https_only":
      return "Only https LinkedIn URLs are allowed.";
    case "credentials_in_url":
      return "Remove any username or password from the URL.";
    case "not_linkedin_host":
      return "Open in this tab only accepts linkedin.com / www.linkedin.com / Sales Navigator hosts.";
    default:
      return "That URL is not allowed.";
  }
}
