import { extractLinkedIn } from "./parse-linkedin.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== "LISFDC_EXTRACT") return;
  try {
    sendResponse({ ok: true, result: extractLinkedIn(document, location.href) });
  } catch (error) {
    sendResponse({
      ok: true,
      result: {
        source: "linkedin",
        status: "unexpected_layout",
        pageType: "unknown",
        url: location.href,
        extractedAt: new Date().toISOString(),
        data: {},
        warnings: [`Content script caught an error: ${error && error.message ? error.message : String(error)}`],
      },
    });
  }
  return true;
});
