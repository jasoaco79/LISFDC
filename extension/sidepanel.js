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

async function loadLast() {
  var resp = await send({ type: "GET_LAST_EXTRACTS" });
  if (!resp.ok) return;
  if (resp.lastLinkedInExtract) renderExtract("li", resp.lastLinkedInExtract);
  if (resp.lastSalesforceExtract) renderExtract("sf", resp.lastSalesforceExtract);
}

async function onReadLi() {
  setBusy(true);
  setStatus("li", "Reading open LinkedIn tab…", "");
  var resp = await send({ type: "READ_LINKEDIN" });
  setBusy(false);
  if (!resp.ok) {
    setStatus("li", resp.error || "Read failed.", "err");
    return;
  }
  renderExtract("li", resp.extract);
}

async function onReadSf() {
  setBusy(true);
  setStatus("sf", "Reading open Salesforce tab…", "");
  var resp = await send({ type: "READ_SALESFORCE" });
  setBusy(false);
  if (!resp.ok) {
    setStatus("sf", resp.error || "Read failed.", "err");
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
  if (!resp.ok) {
    setStatus("li", resp.error || "Open failed.", "err");
    return;
  }
  setStatus("li", "Existing LinkedIn tab now at " + resp.url, "ok");
}

$("btn-read-li").addEventListener("click", onReadLi);
$("btn-read-sf").addEventListener("click", onReadSf);
$("btn-open-li").addEventListener("click", onOpenLi);
loadLast();
