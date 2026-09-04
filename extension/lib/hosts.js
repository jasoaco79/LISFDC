/* LISFDC host match helpers. No secrets. Shared by content scripts and extractors. */
(function (root) {
  "use strict";

  function hostnameOf(url) {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch (e) {
      return "";
    }
  }

  function isLinkedInHost(urlOrHost) {
    var h = urlOrHost.indexOf("://") >= 0 ? hostnameOf(urlOrHost) : String(urlOrHost || "").toLowerCase();
    return h === "linkedin.com" || h.endsWith(".linkedin.com");
  }

  function isSalesforceHost(urlOrHost) {
    var h = urlOrHost.indexOf("://") >= 0 ? hostnameOf(urlOrHost) : String(urlOrHost || "").toLowerCase();
    if (!h) return false;
    return (
      h.endsWith(".lightning.force.com") ||
      h.endsWith(".salesforce.com") ||
      h.endsWith(".my.salesforce.com") ||
      h.endsWith(".force.com") ||
      h === "lightning.force.com" ||
      h === "salesforce.com" ||
      h === "force.com"
    );
  }

  function pageUrl() {
    try {
      if (typeof location !== "undefined" && location.protocol && location.protocol !== "file:") {
        return location.href;
      }
    } catch (e) {}
    try {
      var el = document.documentElement;
      if (el && el.getAttribute) {
        return el.getAttribute("data-lisfdc-url") || "";
      }
    } catch (e2) {}
    return "";
  }

  root.LISFDC_HOSTS = {
    hostnameOf: hostnameOf,
    isLinkedInHost: isLinkedInHost,
    isSalesforceHost: isSalesforceHost,
    pageUrl: pageUrl
  };
})(typeof self !== "undefined" ? self : this);
