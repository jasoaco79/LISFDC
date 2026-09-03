/* LISFDC Salesforce content script. Visible DOM only. Never writes, never calls APIs, never changes the tab URL. */
(function () {
  "use strict";

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== "EXTRACT_SALESFORCE") return;
    try {
      var extract = (self.LISFDC_EXTRACT_SALESFORCE || window.LISFDC_EXTRACT_SALESFORCE)();
      if (self.LISFDC_SANITIZE) extract = self.LISFDC_SANITIZE(extract);
      sendResponse({ ok: true, extract: extract });
    } catch (err) {
      sendResponse({
        ok: false,
        error: "Salesforce extract failed",
        extract: {
          kind: "unknown",
          url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl()) || "",
          title: document.title || "",
          extractedAt: new Date().toISOString(),
          object: null,
          id: null,
          name: null,
          headerFields: [],
          error: "extract-failed"
        }
      });
    }
    return true;
  });
})();
