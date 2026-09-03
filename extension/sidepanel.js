"use strict";

function $(id) { return document.getElementById(id); }

function pretty(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch (e) {
    return String(obj);
  }
}

function setBusy(busy) {
  $("btn-read-li").disabled = busy;
  $("btn-read-sf").disabled = busy;
  $("btn-open-li").disabled = busy;
  $("btn-clear").disabled = busy;
}

function setStatus(which, text, kind) {
  var el = $(which === "li" ? "li-status" : "sf-status");
  el.textContent = text || "";
  el.className = "status" + (kind ? " " + kind : "");
}

function renderExtract(which, extract) {
  var pre = $(which === "li" ? "li-json" : "sf-json");
  if (!extract) {
    pre.textContent = which === "li" ? "No LinkedIn extract yet." : "No Salesforce extract yet.";
    return;
  }
  pre.textContent = pretty(extract);
  var ts = extract.extractedAt || "";
  setStatus(which, ts ? ("Last extract " + ts) : "Last extract loaded.", "ok");
}

function send(msg) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(msg, function (resp) {
      var err = chrome.runtime.lastError;
      if (err) {
        resolve({ ok: false, error: err.message });
        return;
      }
      resolve(resp || { ok: false, error: "No response from background" });
    });
  });
}

function refreshHint() {
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = (tabs && tabs[0]) || null;
      var hint = $("tab-hint");
      if (!hint) return;
      if (!tab || !tab.url) {
        hint.textContent = "Current tab: (none)";
        return;
      }
      hint.textContent = "Current tab: " + tab.url;
    });
  } catch (e) {
    var hintEl = $("tab-hint");
    if (hintEl) hintEl.textContent = "Current tab: (unavailable)";
  }
}

async function loadLast() {
  var resp = await send({ type: "GET_STORED" });
  if (!resp.ok) return;
  renderExtract("li", resp.lastLinkedInExtract || null);
  renderExtract("sf", resp.lastSalesforceExtract || null);
  if (!resp.lastLinkedInExtract) setStatus("li", "", "");
  if (!resp.lastSalesforceExtract) setStatus("sf", "", "");
}

async function onReadLi() {
  setBusy(true);
  setStatus("li", "Scraping open LinkedIn tab…", "");
  var resp = await send({ type: "SCRAPE_LINKEDIN" });
  setBusy(false);
  refreshHint();
  if (!resp.ok) {
    setStatus("li", resp.error || "Scrape failed.", "err");
    return;
  }
  renderExtract("li", resp.extract);
}

async function onReadSf() {
  setBusy(true);
  setStatus("sf", "Scraping open Salesforce tab…", "");
  var resp = await send({ type: "SCRAPE_SALESFORCE" });
  setBusy(false);
  refreshHint();
  if (!resp.ok) {
    setStatus("sf", resp.error || "Scrape failed.", "err");
    return;
  }
  renderExtract("sf", resp.extract);
}

async function onOpenLi() {
  var url = $("li-url").value;
  setBusy(true);
  setStatus("li", "Updating existing LinkedIn tab…", "");
  var resp = await send({ type: "OPEN_LINKEDIN_URL", url: url });
  setBusy(false);
  refreshHint();
  if (!resp.ok) {
    setStatus("li", resp.error || "Open failed.", "err");
    return;
  }
  setStatus("li", "Existing LinkedIn tab now at " + resp.url, "ok");
}

async function onClear() {
  setBusy(true);
  var resp = await send({ type: "CLEAR_STORED" });
  setBusy(false);
  renderExtract("li", null);
  renderExtract("sf", null);
  setStatus("li", resp.ok ? "Cleared." : (resp.error || "Clear failed."), resp.ok ? "ok" : "err");
  setStatus("sf", resp.ok ? "Cleared." : "", resp.ok ? "ok" : "err");
}

$("btn-read-li").addEventListener("click", onReadLi);
$("btn-read-sf").addEventListener("click", onReadSf);
$("btn-open-li").addEventListener("click", onOpenLi);
$("btn-clear").addEventListener("click", onClear);
refreshHint();
loadLast();
setInterval(refreshHint, 4000);
