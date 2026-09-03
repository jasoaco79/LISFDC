/**
 * Read the current LinkedIn / Sales Navigator document.
 * Resilient selectors + fallbacks. Never throws to the caller UI —
 * unexpected layouts become a structured status.
 */

import {
  firstMatching,
  firstText,
  flattenJsonLd,
  metaContent,
  parseJsonLd,
  typeIncludes,
  visibleText,
} from "../shared/dom.js";

const NAME_SELECTORS = [
  "[data-anonymize='person-name']",
  "h1.text-heading-xlarge",
  ".pv-text-details__left-panel h1",
  ".ph5 h1",
  ".profile-topcard-person-entity__name",
  ".profile-topcard__full-name",
  ".top-card-layout__title",
  "main .scaffold-layout__main h1",
  "main h1",
  "h1",
];

const HEADLINE_SELECTORS = [
  "[data-anonymize='headline']",
  ".pv-text-details__left-panel .text-body-medium",
  ".ph5 .text-body-medium.break-words",
  ".text-body-medium.break-words",
  ".profile-topcard__summary-position",
  ".top-card-layout__headline",
  ".pv-top-card-section__headline",
];

const LOCATION_SELECTORS = [
  "[data-anonymize='location']",
  ".pv-text-details__left-panel .text-body-small.inline",
  ".pb2.t-black--light .text-body-small",
  ".pv-top-card--list-bullet li",
  ".top-card-layout__first-subline",
  ".profile-topcard__location-data",
  ".text-body-small.inline.t-black--light.break-words",
];

const COMPANY_NAME_SELECTORS = [
  "[data-anonymize='company-name']",
  "h1.org-top-card-summary__title",
  ".org-top-card-summary__title",
  ".org-top-card__primary-content h1",
  ".top-card-layout__title",
  "main h1",
  "h1",
];

const SEARCH_CARD_SELECTORS = [
  ".reusable-search__result-container",
  "li.reusable-search__result-container",
  ".entity-result",
  "[data-view-name='people-search-result']",
  "[data-view-name='search-entity-result']",
  "[data-view-name='search-result']",
  ".search-results-container li.artdeco-list__item",
  ".artdeco-entity-lockup",
];

const SEARCH_NAME_SELECTORS = [
  "span[aria-hidden='true']",
  ".entity-result__title-text a",
  ".app-aware-link span[aria-hidden='true']",
  "a.app-aware-link",
  ".artdeco-entity-lockup__title",
  "span.entity-result__title-text",
];

const SEARCH_HEADLINE_SELECTORS = [
  ".entity-result__primary-subtitle",
  ".artdeco-entity-lockup__subtitle",
  ".entity-result__summary",
];

const MAX_SEARCH_CARDS = 20;

export function extractLinkedIn(doc, rawUrl) {
  const extractedAt = new Date().toISOString();
  const url = safeUrl(rawUrl) || (doc && doc.URL) || "";

  try {
    const auth = detectAuthState(doc, url);
    if (auth !== "ok") {
      return {
        source: "linkedin",
        status: auth,
        pageType: classifyPage(url, doc),
        url,
        extractedAt,
        data: {},
        warnings: [
          auth === "not_signed_in"
            ? "This tab looks like a sign-in, guest, or auth-wall page. Stay in your logged-in Chrome profile and open a LinkedIn page you can already see."
            : "The page did not match a signed-in LinkedIn layout.",
        ],
      };
    }

    const pageType = classifyPage(url, doc);
    const warnings = [];
    let data = {};

    if (pageType === "profile") {
      data = extractProfile(doc, url);
    } else if (pageType === "company") {
      data = extractCompany(doc, url);
    } else if (pageType === "search") {
      data = extractSearch(doc, url);
    } else {
      data = extractProfile(doc, url);
      if (!data.name && !data.companyName) {
        const cards = extractSearch(doc, url);
        if (cards.results && cards.results.length) {
          data = cards;
        }
      }
    }

    const meaningful = hasMeaningfulLinkedInData(data);
    if (!meaningful) {
      return {
        source: "linkedin",
        status: "unexpected_layout",
        pageType,
        url,
        extractedAt,
        data,
        warnings: [
          "Signed-in chrome is present, but the expected profile, company, or search fields were not found. LinkedIn DOM changes often — open a profile or search results page and try again.",
        ],
      };
    }

    if (pageType === "other") {
      warnings.push("URL did not look like a profile, company, or search page; used visible fields as a best effort.");
    }

    return {
      source: "linkedin",
      status: "ok",
      pageType: data.pageType || pageType,
      url,
      extractedAt,
      data,
      warnings,
    };
  } catch (error) {
    return {
      source: "linkedin",
      status: "unexpected_layout",
      pageType: "unknown",
      url,
      extractedAt,
      data: {},
      warnings: [`Reader failed without crashing the side panel: ${error && error.message ? error.message : String(error)}`],
    };
  }
}

function safeUrl(raw) {
  try {
    return new URL(String(raw)).toString();
  } catch {
    return "";
  }
}

export function classifyPage(rawUrl, doc) {
  let path = "";
  try {
    path = new URL(String(rawUrl)).pathname || "";
  } catch {
    path = "";
  }

  if (/\/(in|pub)\//.test(path) || /\/sales\/(people|lead|inbox)\//.test(path)) {
    return "profile";
  }
  if (/\/(company|school|showcase)\//.test(path) || /\/sales\/company\//.test(path)) {
    return "company";
  }
  if (/\/search\//.test(path) || /\/sales\/search\//.test(path) || /\/sales\/lists\//.test(path)) {
    return "search";
  }

  if (doc) {
    if (doc.querySelector(".org-top-card-summary__title, .org-top-card__primary-content")) {
      return "company";
    }
    if (
      doc.querySelector(
        ".reusable-search__result-container, .entity-result, [data-view-name='people-search-result']"
      )
    ) {
      return "search";
    }
    if (doc.querySelector(".pv-text-details__left-panel, .profile-topcard__full-name, main h1")) {
      return "profile";
    }
  }
  return "other";
}

export function detectAuthState(doc, rawUrl) {
  const href = String(rawUrl || "");
  if (/\/(login|uas\/login|checkpoint|signup|authwall)/i.test(href)) {
    return "not_signed_in";
  }

  const title = String((doc && doc.title) || "").toLowerCase();
  if (
    title.includes("sign in") ||
    title.includes("join linkedin") ||
    title.includes("linkedin login") ||
    title.includes("authwall")
  ) {
    return "not_signed_in";
  }

  if (!doc || !doc.querySelector) return "ok";

  if (doc.querySelector(".authwall, .join-form, form.login__form, [data-test-id='guest']")) {
    return "not_signed_in";
  }
  if (doc.querySelector('input[name="session_key"], #username, input[name="session_password"]')) {
    const main = visibleText(doc.querySelector("main") || doc.body).slice(0, 800);
    if (/sign in|join now|welcome to linkedin/i.test(main)) return "not_signed_in";
  }

  const snippet = visibleText(doc.body).slice(0, 1500);
  if (/sign in to view|join to view|join linkedin to see/i.test(snippet)) {
    return "not_signed_in";
  }

  return "ok";
}

function extractProfile(doc, url) {
  const jsonLd = readPersonJsonLd(doc);
  const nameHit = firstMatching(doc, NAME_SELECTORS);
  const name = cleanName(nameHit ? nameHit.text : "") || jsonLd.name || nameFromTitle(doc.title) || "";
  const headline = firstText(doc, HEADLINE_SELECTORS) || jsonLd.jobTitle || "";
  const location = firstText(doc, LOCATION_SELECTORS) || jsonLd.address || "";
  const current = extractCurrentRole(doc, headline, jsonLd);
  const publicId = publicIdFromUrl(url);

  return {
    pageType: "profile",
    name,
    headline,
    location,
    currentRole: current.role || "",
    currentCompany: current.company || "",
    publicId,
    about: extractAbout(doc),
  };
}

function extractCompany(doc, url) {
  const jsonLd = readOrganizationJsonLd(doc);
  const name = firstText(doc, COMPANY_NAME_SELECTORS) || jsonLd.name || nameFromTitle(doc.title) || "";
  const tagline =
    firstText(doc, [".org-top-card-summary__tagline", ".org-top-card-summary-info-list", "[data-anonymize='tagline']"]) ||
    jsonLd.description ||
    "";
  const industry = firstText(doc, [
    ".org-top-card-summary-info-list__info-item",
    "[data-anonymize='industry']",
  ]);
  const slug = companySlugFromUrl(url);

  return {
    pageType: "company",
    companyName: name,
    name,
    tagline: clip(tagline, 280),
    industry,
    slug,
    location: firstText(doc, [".org-top-card-summary-info-list__info-item + .org-top-card-summary-info-list__info-item"]),
  };
}

function extractSearch(doc) {
  const results = [];
  const seen = new Set();

  for (const selector of SEARCH_CARD_SELECTORS) {
    let cards;
    try {
      cards = doc.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const card of cards) {
      if (results.length >= MAX_SEARCH_CARDS) break;
      const item = readSearchCard(card);
      if (!item.name) continue;
      const key = `${item.name}|${item.headline}|${item.profileUrl || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(item);
    }
    if (results.length >= MAX_SEARCH_CARDS) break;
  }

  return {
    pageType: "search",
    resultCount: results.length,
    cappedAt: MAX_SEARCH_CARDS,
    results,
  };
}

function readSearchCard(card) {
  const name = firstText(card, SEARCH_NAME_SELECTORS);
  const headline = firstText(card, SEARCH_HEADLINE_SELECTORS);
  const location = firstText(card, [
    ".entity-result__secondary-subtitle",
    ".artdeco-entity-lockup__caption",
  ]);
  const href = findProfileHref(card);
  const current = splitHeadline(headline);
  return {
    name: cleanName(name),
    headline,
    location,
    currentRole: current.role,
    currentCompany: current.company,
    profileUrl: href,
  };
}

function findProfileHref(card) {
  const links = card.querySelectorAll("a[href]");
  for (const link of links) {
    const href = link.getAttribute("href") || "";
    if (/\/in\//.test(href) || /\/sales\/(people|lead)\//.test(href) || /\/company\//.test(href)) {
      try {
        return new URL(href, "https://www.linkedin.com").toString();
      } catch {
        return href;
      }
    }
  }
  return "";
}

function extractCurrentRole(doc, headline, jsonLd) {
  const fromHeadline = splitHeadline(headline);
  const experience = findExperienceSection(doc);
  if (experience) {
    const first = experience.querySelector(
      "li, [data-view-name='profile-component-entity'], .pvs-list__paged-list-item"
    );
    if (first) {
      const lines = visibleText(first)
        .split("·")[0]
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const role = firstText(first, [
        ".t-bold span[aria-hidden='true']",
        ".t-bold",
        "[data-field='title']",
        "span[aria-hidden='true']",
      ]);
      const company = firstText(first, [
        ".t-14.t-normal span[aria-hidden='true']",
        "[data-field='company']",
        ".pv-entity__secondary-title",
      ]);
      return {
        role: role || lines[0] || fromHeadline.role || jsonLd.jobTitle || "",
        company: company || fromHeadline.company || jsonLd.company || "",
      };
    }
  }
  return {
    role: fromHeadline.role || jsonLd.jobTitle || "",
    company: fromHeadline.company || jsonLd.company || "",
  };
}

function findExperienceSection(doc) {
  const byId = doc.querySelector("#experience, #experience-section, section.experience-section");
  if (byId) return byId;
  const headings = doc.querySelectorAll("h2, h3");
  for (const heading of headings) {
    if (/^experience$/i.test(visibleText(heading))) {
      return heading.closest("section") || heading.parentElement;
    }
  }
  return null;
}

function extractAbout(doc) {
  const about = doc.querySelector("#about, section.pv-about-section, [data-view-name='profile-card']");
  if (!about) return "";
  const text = visibleText(about);
  return clip(text.replace(/^about\s+/i, ""), 400);
}

function splitHeadline(headline) {
  const text = String(headline || "").trim();
  if (!text) return { role: "", company: "" };
  const at = text.split(/\s+at\s+/i);
  if (at.length >= 2) {
    return { role: at[0].trim(), company: at.slice(1).join(" at ").trim() };
  }
  const pipe = text.split("|");
  if (pipe.length >= 2) {
    return { role: pipe[0].trim(), company: pipe.slice(1).join("|").trim() };
  }
  return { role: text, company: "" };
}

function readPersonJsonLd(doc) {
  const items = flattenJsonLd(parseJsonLd(doc));
  const person = items.find((item) => typeIncludes(item, "Person")) || {};
  const org =
    person.worksFor && typeof person.worksFor === "object"
      ? person.worksFor.name || ""
      : person.worksFor || "";
  const address =
    person.address && typeof person.address === "object"
      ? person.address.addressLocality || person.address.name || ""
      : person.address || "";
  return {
    name: person.name || "",
    jobTitle: person.jobTitle || "",
    company: org,
    address,
  };
}

function readOrganizationJsonLd(doc) {
  const items = flattenJsonLd(parseJsonLd(doc));
  const org = items.find((item) => typeIncludes(item, "Organization") || typeIncludes(item, "Corporation")) || {};
  return {
    name: org.name || "",
    description: org.description || "",
  };
}

function cleanName(name) {
  return String(name || "")
    .replace(/\s*\|.*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nameFromTitle(title) {
  const raw = String(title || "");
  const left = raw.split("|")[0].split(" - ")[0].trim();
  if (!left || /linkedin/i.test(left)) return "";
  return left;
}

function publicIdFromUrl(rawUrl) {
  try {
    const path = new URL(String(rawUrl)).pathname;
    const m = path.match(/\/in\/([^/]+)/) || path.match(/\/sales\/people\/([^/,]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function companySlugFromUrl(rawUrl) {
  try {
    const path = new URL(String(rawUrl)).pathname;
    const m = path.match(/\/company\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function clip(text, max) {
  const s = String(text || "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function hasMeaningfulLinkedInData(data) {
  if (!data || typeof data !== "object") return false;
  if (data.name || data.companyName) return true;
  if (Array.isArray(data.results) && data.results.length > 0) return true;
  return false;
}

export const __test = {
  splitHeadline,
  publicIdFromUrl,
  companySlugFromUrl,
};
