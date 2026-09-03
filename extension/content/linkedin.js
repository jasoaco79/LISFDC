/* LISFDC LinkedIn content script. Read-only DOM extract. */
(function () {
  "use strict";

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (!msg || msg.type !== "EXTRACT_LINKEDIN") return;
    try {
      var extract = (self.LISFDC_EXTRACT_LINKEDIN || window.LISFDC_EXTRACT_LINKEDIN)();
      if (self.LISFDC_SANITIZE) extract = self.LISFDC_SANITIZE(extract);
      sendResponse({ ok: true, extract: extract });
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
