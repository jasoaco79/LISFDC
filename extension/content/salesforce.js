/* LISFDC Salesforce content script. Visible DOM only.
 * Never writes, never calls APIs, never changes the tab URL, never clicks.
 */
(function () {
  "use strict";

  var extractImpl = self.__LISFDC_extractSalesforce;
  if (typeof extractImpl !== "function" && typeof window !== "undefined") {
    extractImpl = window.__LISFDC_extractSalesforce;
  }

  function runExtract() {
    var fn = extractImpl ||
      self.LISFDC_EXTRACT_SALESFORCE ||
      (typeof window !== "undefined" && window.LISFDC_EXTRACT_SALESFORCE);
    var extract = typeof fn === "function" ? fn() : {
      kind: "unknown",
      url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl && self.LISFDC_HOSTS.pageUrl()) || location.href || "",
      title: document.title || "",
      scrapedAt: new Date().toISOString(),
      id: null,
      objectApiName: null,
      name: null,
      fields: [],
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
          url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl && self.LISFDC_HOSTS.pageUrl()) || location.href || "",
          title: document.title || "",
          scrapedAt: new Date().toISOString(),
          id: null,
          objectApiName: null,
          name: null,
          fields: [],
          error: "extract-failed"
        }
      });
    }
    return true;
  });
})();
