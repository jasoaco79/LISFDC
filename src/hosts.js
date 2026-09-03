/**
 * Host allowlists for LISFDC.
 * Network stays in the user's tab. These helpers only decide whether a URL
 * is a LinkedIn or Salesforce page we are allowed to read or navigate to.
 */

export function normalizeHostname(hostname) {
  return String(hostname || "")
    .toLowerCase()
    .replace(/\.$/, "");
}

export function isLinkedInHost(hostname) {
  const host = normalizeHostname(hostname);
  return host === "linkedin.com" || host.endsWith(".linkedin.com");
}

export function isSalesforceHost(hostname) {
  const host = normalizeHostname(hostname);
  return (
    host === "salesforce.com" ||
    host.endsWith(".salesforce.com") ||
    host === "force.com" ||
    host.endsWith(".force.com")
  );
}

export function isHttpsHttpUrl(raw) {
  try {
    const url = new URL(String(raw));
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * User-typed navigation is https-only, LinkedIn hosts only, no credentials
 * in the URL, no javascript:/data: schemes.
 */
export function normalizeLinkedInNavUrl(input) {
  const trimmed = String(input || "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  let candidate = trimmed;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, "")}`;
  }

  let url;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: "not_a_url" };
  }

  if (url.protocol !== "https:") {
    return { ok: false, reason: "https_only" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials_in_url" };
  }
  if (!isLinkedInHost(url.hostname)) {
    return { ok: false, reason: "not_linkedin_host" };
  }

  return { ok: true, url: url.toString() };
}

export function describeTabKind(rawUrl) {
  try {
    const url = new URL(String(rawUrl));
    if (isLinkedInHost(url.hostname)) return "linkedin";
    if (isSalesforceHost(url.hostname)) return "salesforce";
  } catch {
    /* ignore */
  }
  return "other";
}
