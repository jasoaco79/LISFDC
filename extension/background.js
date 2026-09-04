/* LISFDC MV3 service worker.
 * Reads open LinkedIn / Salesforce tabs via content scripts.
 * Optional: update URL of an existing LinkedIn tab (user-initiated).
 * Never touches cookies. Never writes to Salesforce. Never navigates Salesforce.
 */
"use strict";

importScripts("lib/hosts.js", "lib/sanitize.js", "lib/bridge-client.js");

var LI_MATCH = "*://*.linkedin.com/*";
var SF_MATCHES = [
  "*://*.lightning.force.com/*",
  "*://*.salesforce.com/*",
  "*://*.my.salesforce.com/*",
  "*://*.force.com/*"
];

var LI_FILES = ["lib/hosts.js", "lib/sanitize.js", "lib/extract-linkedin.js", "content/linkedin.js"];
var SF_FILES = ["lib/hosts.js", "lib/sanitize.js", "lib/extract-salesforce.js", "content/salesforce.js"];

chrome.runtime.onInstalled.addListener(function () {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
  }
});

chrome.runtime.onStartup.addListener(function () {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
  }
});

function queryTabs(urlPatterns, currentWindow) {
  var q = { url: urlPatterns };
  if (currentWindow) q.currentWindow = true;
  return new Promise(function (resolve) {
    chrome.tabs.query(q, function (tabs) {
      resolve(tabs || []);
    });
  });
}

function pickTab(tabs) {
  if (!tabs || !tabs.length) return null;
  var active = tabs.filter(function (t) { return t.active; });
  if (active.length) return active[0];
  tabs.sort(function (a, b) {
    return (b.lastAccessed || 0) - (a.lastAccessed || 0);
  });
  return tabs[0];
}

async function findTab(urlPatterns) {
  var local = await queryTabs(urlPatterns, true);
  var tab = pickTab(local);
  if (tab) return tab;
  return pickTab(await queryTabs(urlPatterns, false));
}

function sendExtract(tabId, type) {
  return new Promise(function (resolve) {
    chrome.tabs.sendMessage(tabId, { type: type }, function (resp) {
      var err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, missing: true, error: err.message });
        return;
      }
      resolve(resp || { ok: false, error: "Empty content-script response" });
    });
  });
}

function inject(tabId, files) {
  return chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: files
  });
}


function runPageFn(tabId, kind) {
  var fn = kind === "salesforce"
    ? function () {
        try {
          if (typeof self.__LISFDC_extractSalesforce === "function") return self.__LISFDC_extractSalesforce();
          if (typeof window !== "undefined" && typeof window.__LISFDC_extractSalesforce === "function") {
            return window.__LISFDC_extractSalesforce();
          }
        } catch (e) {}
        return null;
      }
    : function () {
        try {
          if (typeof self.__LISFDC_extractLinkedIn === "function") return self.__LISFDC_extractLinkedIn();
          if (typeof window !== "undefined" && typeof window.__LISFDC_extractLinkedIn === "function") {
            return window.__LISFDC_extractLinkedIn();
          }
        } catch (e) {}
        return null;
      };
  return chrome.scripting.executeScript({ target: { tabId: tabId }, func: fn }).then(function (results) {
    var extract = results && results[0] && results[0].result;
    if (!extract) return { ok: false, missing: true, error: "Page function returned nothing" };
    return { ok: true, extract: extract };
  }).catch(function (err) {
    return { ok: false, missing: true, error: String(err && err.message ? err.message : err) };
  });
}

function hostOkLinkedIn(url) {
  if (self.LISFDC_HOSTS && self.LISFDC_HOSTS.isLinkedInHost) {
    return self.LISFDC_HOSTS.isLinkedInHost(url);
  }
  try {
    var h = new URL(url).hostname.toLowerCase();
    return h === "linkedin.com" || h.endsWith(".linkedin.com");
  } catch (e) {
    return false;
  }
}

function hostOkSalesforce(url) {
  if (self.LISFDC_HOSTS && self.LISFDC_HOSTS.isSalesforceHost) {
    return self.LISFDC_HOSTS.isSalesforceHost(url);
  }
  return false;
}

function cleanExtract(extract) {
  if (self.LISFDC_SANITIZE) return self.LISFDC_SANITIZE(extract);
  return extract;
}

async function storeExtract(kind, extract) {
  var cleaned = cleanExtract(extract);
  var patch = {};
  if (kind === "linkedin") patch.lastLinkedInExtract = cleaned;
  else patch.lastSalesforceExtract = cleaned;
  await chrome.storage.local.set(patch);
  return cleaned;
}

function isRecordSalesforceExtract(extract) {
  return !!(extract && extract.id);
}

function isUsableLinkedInExtract(extract) {
  if (!extract) return false;
  var kind = extract.kind;
  if (kind === "unknown" || kind === "signedOut" || kind === "feed") return false;
  if (kind === "profile" || kind === "salesNav") {
    return !!(extract.profile && extract.profile.name);
  }
  if (kind === "company") {
    return !!(extract.company && extract.company.name);
  }
  if (kind === "search") {
    return !!(extract.search && (extract.search.query || (extract.search.topResults && extract.search.topResults.length)));
  }
  return false;
}

async function scrapeLinkedIn() {
  var tab = await findTab([LI_MATCH, "*://linkedin.com/*"]);
  if (!tab) {
    return { ok: false, error: "No open LinkedIn tab. Open linkedin.com in Chrome, then press Scrape LinkedIn." };
  }
  var resp = await sendExtract(tab.id, "EXTRACT_LINKEDIN");
  if (resp.missing) {
    try {
      await inject(tab.id, LI_FILES);
    } catch (e) {
      return { ok: false, error: "Could not inject LinkedIn reader into the open tab." };
    }
    resp = await sendExtract(tab.id, "EXTRACT_LINKEDIN");
    if (resp.missing) {
      resp = await runPageFn(tab.id, "linkedin");
    }
  }
  if (!resp || !resp.ok || !resp.extract) {
    return { ok: false, error: (resp && resp.error) || "LinkedIn tab did not return visible fields." };
  }
  if (!isUsableLinkedInExtract(resp.extract)) {
    return {
      ok: false,
      error: "LinkedIn tab is login, feed, or an unknown layout — not stored. Open a profile, company, or search page, then scrape again."
    };
  }
  var extract = await storeExtract("linkedin", resp.extract);
  return { ok: true, extract: extract };
}

async function scrapeSalesforce() {
  var tab = await findTab(SF_MATCHES);
  if (!tab) {
    return { ok: false, error: "No open Salesforce tab. Open a Lightning or Classic record in Chrome, then press Scrape Salesforce." };
  }
  var resp = await sendExtract(tab.id, "EXTRACT_SALESFORCE");
  if (resp.missing) {
    try {
      await inject(tab.id, SF_FILES);
    } catch (e) {
      return { ok: false, error: "Could not inject Salesforce reader into the open tab." };
    }
    resp = await sendExtract(tab.id, "EXTRACT_SALESFORCE");
    if (resp.missing) {
      resp = await runPageFn(tab.id, "salesforce");
    }
  }
  if (!resp || !resp.ok || !resp.extract) {
    return { ok: false, error: (resp && resp.error) || "Salesforce tab did not return visible fields." };
  }
  if (!isRecordSalesforceExtract(resp.extract)) {
    return {
      ok: false,
      error: "Salesforce tab is home, setup, login, or another non-record page — not stored. Open a record, then scrape again."
    };
  }
  var extract = await storeExtract("salesforce", resp.extract);
  return { ok: true, extract: extract };
}

async function extractActive() {
  var tabs = await new Promise(function (resolve) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (t) {
      resolve(t || []);
    });
  });
  var tab = tabs[0];
  if (!tab || !tab.url) {
    return { ok: false, error: "No active tab." };
  }
  if (hostOkLinkedIn(tab.url)) return scrapeLinkedIn();
  if (hostOkSalesforce(tab.url)) return scrapeSalesforce();
  return { ok: false, error: "Active tab is not LinkedIn or Salesforce. Open one of those pages, then scrape." };
}

async function openLinkedInUrl(raw) {
  var url = String(raw || "").trim();
  if (!url) return { ok: false, error: "Paste a LinkedIn https URL first." };
  var parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return { ok: false, error: "That is not a valid URL." };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https LinkedIn URLs are allowed." };
  }
  if (!hostOkLinkedIn(url)) {
    return { ok: false, error: "URL host must be linkedin.com (including Sales Nav). Salesforce and other hosts are rejected." };
  }
  var tab = await findTab([LI_MATCH, "*://linkedin.com/*"]);
  if (tab) {
    await chrome.tabs.update(tab.id, { url: parsed.toString(), active: true });
    return { ok: true, tabId: tab.id, url: parsed.toString(), created: false };
  }
  var created = await chrome.tabs.create({ url: parsed.toString(), active: true });
  return { ok: true, tabId: created.id, url: parsed.toString(), created: true };
}

async function getStored() {
  var data = await chrome.storage.local.get(["lastLinkedInExtract", "lastSalesforceExtract"]);
  return {
    ok: true,
    lastLinkedInExtract: data.lastLinkedInExtract || null,
    lastSalesforceExtract: data.lastSalesforceExtract || null
  };
}

async function clearStored() {
  await chrome.storage.local.remove(["lastLinkedInExtract", "lastSalesforceExtract"]);
  return { ok: true, lastLinkedInExtract: null, lastSalesforceExtract: null };
}

chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
  if (!msg || !msg.type) return;
  var p = null;
  if (msg.type === "READ_LINKEDIN" || msg.type === "SCRAPE_LINKEDIN") p = scrapeLinkedIn();
  else if (msg.type === "READ_SALESFORCE" || msg.type === "SCRAPE_SALESFORCE") p = scrapeSalesforce();
  else if (msg.type === "EXTRACT_ACTIVE") p = extractActive();
  else if (msg.type === "OPEN_LINKEDIN_URL") p = openLinkedInUrl(msg.url);
  else if (msg.type === "GET_LAST_EXTRACTS" || msg.type === "GET_STORED") p = getStored();
  else if (msg.type === "CLEAR_STORED") p = clearStored();
  else if (msg.type === "GET_BRIDGE_CONFIG") {
    p = self.LISFDC_BRIDGE.getConfig().then(function (cfg) {
      return { ok: true, config: cfg, status: self.LISFDC_BRIDGE.getStatus() };
    });
  } else if (msg.type === "SET_BRIDGE_CONFIG") {
    p = self.LISFDC_BRIDGE.setConfig({
      enabled: !!(msg.enabled || (msg.config && msg.config.enabled)),
      baseUrl: msg.baseUrl || (msg.config && msg.config.baseUrl),
      token: msg.token || (msg.config && msg.config.token)
    }).then(function () {
      return self.LISFDC_BRIDGE.getConfig().then(function (cfg) {
        return { ok: true, config: cfg };
      });
    });
  } else if (msg.type === "BRIDGE_STATUS") {
    p = Promise.resolve({ ok: true, status: self.LISFDC_BRIDGE.getStatus() });
  } else return;
  p.then(sendResponse).catch(function (err) {
    sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
  });
  return true;
});

if (self.LISFDC_BRIDGE) {
  self.LISFDC_BRIDGE.startPolling({
    scrapeLinkedIn: scrapeLinkedIn,
    scrapeSalesforce: scrapeSalesforce,
    openLinkedInUrl: openLinkedInUrl,
    getStored: getStored
  });
}
