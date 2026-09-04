/* LISFDC bridge client — polls local HTTP bridge for bot commands. */
(function (root) {
  "use strict";

  var ALARM_NAME = "lisfdc-bridge-poll";
  var DEFAULT_BASE = "http://127.0.0.1:17321";
  var lastStatus = { ok: false, message: "Bridge idle", at: null };
  var busy = false;

  function getConfig() {
    return chrome.storage.local.get(["bridgeEnabled", "bridgeBaseUrl", "bridgeToken"]).then(function (data) {
      return {
        enabled: !!data.bridgeEnabled,
        baseUrl: (data.bridgeBaseUrl || DEFAULT_BASE).replace(/\/$/, ""),
        token: data.bridgeToken || ""
      };
    });
  }

  function setConfig(cfg) {
    return chrome.storage.local.set({
      bridgeEnabled: !!cfg.enabled,
      bridgeBaseUrl: (cfg.baseUrl || DEFAULT_BASE).trim(),
      bridgeToken: (cfg.token || "").trim()
    });
  }

  function setStatus(ok, message) {
    lastStatus = { ok: !!ok, message: String(message || ""), at: new Date().toISOString() };
  }

  function getStatus() {
    return Object.assign({}, lastStatus);
  }

  function authHeaders(token) {
    return {
      Authorization: "Bearer " + token,
      Accept: "application/json",
      "Content-Type": "application/json"
    };
  }

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  async function executeCommand(cmd, handlers) {
    var type = cmd && cmd.type;
    if (type === "scrape_linkedin") return handlers.scrapeLinkedIn();
    if (type === "scrape_salesforce") return handlers.scrapeSalesforce();
    if (type === "get_stored") return handlers.getStored();
    if (type === "open_linkedin") return handlers.openLinkedInUrl(cmd.url);
    if (type === "research_linkedin") {
      var openRes = await handlers.openLinkedInUrl(cmd.url);
      if (!openRes || !openRes.ok) return openRes;
      var waitMs = typeof cmd.waitMs === "number" ? cmd.waitMs : 2500;
      if (waitMs < 0) waitMs = 0;
      if (waitMs > 15000) waitMs = 15000;
      await wait(waitMs);
      var scrapeRes = await handlers.scrapeLinkedIn();
      if (scrapeRes && scrapeRes.ok) {
        scrapeRes.url = openRes.url || cmd.url;
        scrapeRes.tabId = openRes.tabId;
      }
      return scrapeRes;
    }
    return { ok: false, error: "Unknown command type: " + type };
  }

  async function postResult(baseUrl, token, id, result) {
    var body = {
      ok: !!(result && result.ok),
      error: result && result.error,
      extract: result && result.extract,
      lastLinkedInExtract: result && result.lastLinkedInExtract,
      lastSalesforceExtract: result && result.lastSalesforceExtract,
      url: result && result.url,
      tabId: result && result.tabId
    };
    var res = await fetch(baseUrl + "/v1/commands/" + encodeURIComponent(id) + "/result", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("POST result failed: HTTP " + res.status);
  }

  async function pollOnce(handlers) {
    if (busy) return;
    var cfg = await getConfig();
    if (!cfg.enabled) {
      setStatus(false, "Bridge disabled");
      return;
    }
    if (!cfg.token) {
      setStatus(false, "Bridge enabled but token missing");
      return;
    }
    busy = true;
    try {
      var res = await fetch(cfg.baseUrl + "/v1/commands/pending", {
        method: "GET",
        headers: authHeaders(cfg.token)
      });
      if (res.status === 401) {
        setStatus(false, "Unauthorized (check token)");
        return;
      }
      if (!res.ok) {
        setStatus(false, "Poll HTTP " + res.status);
        return;
      }
      var data = await res.json();
      setStatus(true, "Poll ok" + (data.command ? " (got command)" : ""));
      if (!data.command) return;
      var result;
      try {
        result = await executeCommand(data.command, handlers);
      } catch (e) {
        result = { ok: false, error: String(e && e.message ? e.message : e) };
      }
      await postResult(cfg.baseUrl, cfg.token, data.command.id, result || { ok: false, error: "No result" });
      setStatus(true, "Command " + data.command.type + " done");
    } catch (e) {
      setStatus(false, "Poll error: " + String(e && e.message ? e.message : e));
    } finally {
      busy = false;
    }
  }

  function scheduleNext() {
    try {
      chrome.alarms.create(ALARM_NAME, { when: Date.now() + 2000 });
    } catch (e) {}
  }

  function startPolling(handlers) {
    handlers = handlers || {};
    // Prefer sub-minute period when supported; always also self-reschedule ~2s.
    try {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: 0.05 });
    } catch (e) {
      try { chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 }); } catch (e2) {}
    }
    scheduleNext();
    chrome.alarms.onAlarm.addListener(function (alarm) {
      if (!alarm || alarm.name !== ALARM_NAME) return;
      pollOnce(handlers).finally(scheduleNext);
    });
    // Kick once on SW start
    pollOnce(handlers).finally(scheduleNext);
  }

  root.LISFDC_BRIDGE = {
    getConfig: getConfig,
    setConfig: setConfig,
    getStatus: getStatus,
    startPolling: startPolling,
    pollOnce: pollOnce,
    DEFAULT_BASE: DEFAULT_BASE
  };
})(typeof self !== "undefined" ? self : this);

