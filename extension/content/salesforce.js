/* LISFDC Salesforce content script. Visible DOM only.
 * Never writes, never calls APIs, never changes the tab URL, never clicks.
 */
(function () {
  "use strict";

  function runExtract() {
    var fn = self.LISFDC_EXTRACT_SALESFORCE || (typeof window !== "undefined" && window.LISFDC_EXTRACT_SALESFORCE);
    var extract = fn ? fn() : {
      kind: "unknown",
      url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl()) || "",
      title: document.title || "",
      extractedAt: new Date().toISOString(),
      object: null,
      id: null,
      name: null,
      headerFields: [],
      error: "extractor-missing"
    };
    if (self.LISFDC_SANITIZE) extract = self.LISFDC_SANITIZE(extract);
    return extract;
  }

  self.__LISFDC_extractSalesforce = runExtract;
  if (typeof window !== "undefined") window.__LISFDC_extractSalesforce = runExtract;

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== "EXTRACT_SALESFORCE") return;
    try {
      sendResponse({ ok: true, extract: runExtract() });
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
