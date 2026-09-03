/* LISFDC LinkedIn content script. Read-only DOM extract. */
(function () {
  "use strict";

  function runExtract() {
    var fn = self.LISFDC_EXTRACT_LINKEDIN || (typeof window !== "undefined" && window.LISFDC_EXTRACT_LINKEDIN);
    var extract = fn ? fn() : {
      kind: "unknown",
      url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl()) || "",
      title: document.title || "",
      extractedAt: new Date().toISOString(),
      error: "extractor-missing"
    };
    if (self.LISFDC_SANITIZE) extract = self.LISFDC_SANITIZE(extract);
    return extract;
  }

  self.__LISFDC_extractLinkedIn = runExtract;
  if (typeof window !== "undefined") window.__LISFDC_extractLinkedIn = runExtract;

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== "EXTRACT_LINKEDIN") return;
    try {
      sendResponse({ ok: true, extract: runExtract() });
    } catch (err) {
      sendResponse({
        ok: false,
        error: "LinkedIn extract failed",
        extract: {
          kind: "unknown",
          url: (self.LISFDC_HOSTS && self.LISFDC_HOSTS.pageUrl()) || "",
          title: document.title || "",
          extractedAt: new Date().toISOString(),
          error: "extract-failed"
        }
      });
    }
    return true;
  });
})();
