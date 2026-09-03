/**
 * Strip session material before anything is stored or shown.
 * Extracts are page-visible fields only — never cookies, SIDs, or tokens.
 */

const SENSITIVE_KEY =
  /^(cookie|cookies|authorization|auth|token|access_token|refresh_token|sid|session|sessionid|li_at|jessionid|jsessionid|password|passwd|secret|otp|csrf)$/i;

const SENSITIVE_LABEL =
  /cookie|authorization|access token|refresh token|session id|\bsid\b|li_at|jsessionid|password|secret|otp/i;

const COOKIE_SHAPE = /(?:^|[;\s])(?:li_at|JSESSIONID|sid|sid_Client|BrowserId|oinfo)=/i;

export function looksLikeSessionSecret(value) {
  if (value == null) return false;
  const text = String(value);
  if (COOKIE_SHAPE.test(text)) return true;
  if (/Bearer\s+[A-Za-z0-9._\-]+/.test(text)) return true;
  // Long opaque blobs that are not 15/18-char Salesforce record Ids.
  if (text.length >= 80 && /^[A-Za-z0-9./+\-_%=]+$/.test(text) && !isSalesforceRecordId(text)) {
    return true;
  }
  return false;
}

export function isSalesforceRecordId(value) {
  return /^[a-zA-Z0-9]{15}(?:[a-zA-Z0-9]{3})?$/.test(String(value || ""));
}

export function isSensitiveLabel(label) {
  return SENSITIVE_LABEL.test(String(label || ""));
}

export function isSensitiveKey(key) {
  return SENSITIVE_KEY.test(String(key || ""));
}

export function scrubExtract(value, key) {
  if (key && isSensitiveKey(key)) return "[redacted]";
  if (typeof value === "string") {
    if (looksLikeSessionSecret(value)) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => scrubExtract(item));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (isSensitiveKey(k) || isSensitiveLabel(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = scrubExtract(v, k);
    }
    return out;
  }
  return value;
}
