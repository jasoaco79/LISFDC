/* LISFDC: strip cookie/sid/csrf/token/authorization/sessionid before storage.
 * Recursive. Keys and values. Never keep session material in chrome.storage.local.
 */
(function (root) {
  "use strict";

  var SENSITIVE_KEY = /cookie|sid|csrf|token|authorization|sessionid|aura\.token/i;

  function isSensitiveKey(key) {
    return SENSITIVE_KEY.test(String(key == null ? "" : key));
  }

  function isSensitiveString(value) {
    if (typeof value !== "string") return false;
    var s = value.trim();
    if (!s) return false;
    if (SENSITIVE_KEY.test(s) && s.length < 80 && s.indexOf(" ") < 0) return true;
    if (/^(sid|csrf|cookie|authorization|sessionid|aura\.token)\s*=/i.test(s)) return true;
    if (/Set-Cookie:/i.test(s)) return true;
    return false;
  }

  function sanitize(value) {
    if (value == null) return value;
    if (Array.isArray(value)) {
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        var item = sanitize(value[i]);
        if (item === undefined) continue;
        arr.push(item);
      }
      return arr;
    }
    if (typeof value === "object") {
      var out = {};
      var keys = Object.keys(value);
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        if (isSensitiveKey(key)) continue;
        var v = value[key];
        if (isSensitiveString(v)) continue;
        if (key === "label" && isSensitiveKey(v)) continue;
        var cleaned = sanitize(v);
        if (cleaned === undefined) continue;
        out[key] = cleaned;
      }
      if (Object.prototype.hasOwnProperty.call(value, "label") &&
          !Object.prototype.hasOwnProperty.call(out, "label")) {
        return undefined;
      }
      return out;
    }
    if (isSensitiveString(value)) return undefined;
    return value;
  }

  root.LISFDC_SANITIZE = sanitize;
})(typeof self !== "undefined" ? self : this);
