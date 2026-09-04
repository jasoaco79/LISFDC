/* LISFDC: scrape-only LinkedIn visible DOM → structured extract.
 * No network. No cookies. Prefer semantic selectors; CSS class fallbacks are last resort.
 */
(function (root) {
  "use strict";

  function text(el) {
    if (!el) return "";
    return String(el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors, rootEl) {
    var base = rootEl || document;
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = base.querySelector(selectors[i]);
        var t = text(el);
        if (t) return t;
      } catch (e) {}
    }
    return "";
  }

  function attr(el, name) {
    if (!el) return "";
    return String(el.getAttribute(name) || "").trim();
  }

  function absUrl(href) {
    if (!href) return "";
    try {
      return new URL(href, location.href).toString();
    } catch (e) {
      return href;
    }
  }

  function pathParts() {
    return (location.pathname || "/").split("/").filter(Boolean);
  }

  function kindFrom(pathname) {
    var p = (pathname || "").toLowerCase();
    if (
      p.indexOf("/login") === 0 ||
      p.indexOf("/checkpoint") === 0 ||
      p.indexOf("/uas/") === 0 ||
      p.indexOf("/signup") === 0 ||
      p === "/authwall" ||
      p.indexOf("/authwall") === 0
    ) {
      return "signedOut";
    }
    if (p === "/feed" || p.indexOf("/feed/") === 0) return "feed";
    if (p.indexOf("/in/") === 0 || p.indexOf("/pub/") === 0) return "profile";
    if (p.indexOf("/company/") === 0 || p.indexOf("/school/") === 0) return "company";
    if (p.indexOf("/sales/") === 0 || p.indexOf("/salesnav/") === 0) return "salesNav";
    if (p.indexOf("/search/") === 0) return "search";
    return "unknown";
  }

  function extractProfile() {
    var name = firstText([
      "h1.inline.t-24",
      "h1.text-heading-xlarge",
      "main h1.text-heading-xlarge",
      "section.artdeco-card h1",
      ".pv-text-details__left-panel h1",
      ".ph5 h1"
    ]);
    var headline = firstText([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "div.text-body-medium"
    ]);
    var location = firstText([
      ".text-body-small.inline.t-black--light.break-words",
      ".pv-text-details__left-panel .text-body-small",
      "span.text-body-small.inline"
    ]);
    var about = firstText([
      "#about ~ .display-flex .inline-show-more-text",
      "section#about .inline-show-more-text",
      "#about ~ * .full-width span[aria-hidden=\"true\"]"
    ]);
    var experience = [];
    var expRoot = document.querySelector("#experience") ||
      document.querySelector("section.experience-section") ||
      document.querySelector('[id*="experience"]');
    if (expRoot) {
      var items = expRoot.closest("section") || expRoot.parentElement || expRoot;
      var rows = items.querySelectorAll("li, .pvs-list__paged-list-item, .artdeco-list__item");
      for (var i = 0; i < rows.length && experience.length < 8; i++) {
        var row = rows[i];
        var title = firstText([
          ".mr1.t-bold span[aria-hidden=\"true\"]",
          ".hoverable-link-text.t-bold span[aria-hidden=\"true\"]",
          "div.t-bold span[aria-hidden=\"true\"]",
          "h3",
          ".t-16.t-black.t-bold"
        ], row);
        var company = firstText([
          ".t-14.t-normal span[aria-hidden=\"true\"]",
          "span.t-14.t-normal",
          "p.pv-entity__secondary-title",
          ".pv-entity__company-summary-info h4"
        ], row);
        var dates = firstText([
          ".t-14.t-normal.t-black--light span[aria-hidden=\"true\"]",
          ".pvs-entity__caption-wrapper",
          ".pv-entity__date-range span:nth-child(2)"
        ], row);
        if (title || company) {
          experience.push({ title: title, company: company, dates: dates });
        }
      }
    }
    var education = [];
    var eduRoot = document.querySelector("#education") ||
      document.querySelector("section.education-section");
    if (eduRoot) {
      var eduSec = eduRoot.closest("section") || eduRoot.parentElement || eduRoot;
      var eduRows = eduSec.querySelectorAll("li, .pvs-list__paged-list-item, .artdeco-list__item");
      for (var e = 0; e < eduRows.length && education.length < 6; e++) {
        var er = eduRows[e];
        var school = firstText([
          ".mr1.t-bold span[aria-hidden=\"true\"]",
          ".hoverable-link-text.t-bold span[aria-hidden=\"true\"]",
          "h3",
          ".pv-entity__school-name"
        ], er);
        var degree = firstText([
          ".t-14.t-normal span[aria-hidden=\"true\"]",
          ".pv-entity__degree-name .pv-entity__comma-item",
          "span.t-14.t-normal"
        ], er);
        if (school || degree) education.push({ school: school, degree: degree });
      }
    }
    var parts = pathParts();
    var slug = "";
    if (parts[0] === "in" || parts[0] === "pub") slug = parts[1] || "";
    return {
      profile: {
        name: name,
        headline: headline,
        location: location,
        about: about,
        experience: experience,
        education: education,
        profileUrl: location.href.split("?")[0],
        vanitySlug: slug
      }
    };
  }

  function extractCompany() {
    var name = firstText([
      "h1.org-top-card-summary__title",
      "h1.ember-view",
      "h1",
      ".org-top-card-summary__title"
    ]);
    var tagline = firstText([
      ".org-top-card-summary__tagline",
      ".org-page-details__definition-text"
    ]);
    var industry = firstText([
      ".org-top-card-summary-info-list__info-item",
      "dd.org-page-details__definition-text"
    ]);
    var about = firstText([
      ".org-about-module__description",
      ".break-words.white-space-pre-wrap",
      "section.org-about-module p"
    ]);
    var website = "";
    var link = document.querySelector('a[data-control-name="page_member_main_nav_website_learn_more"], a[href^="http"][data-tracking-control-name*="website"]');
    if (link) website = absUrl(attr(link, "href"));
    var parts = pathParts();
    var slug = parts[0] === "company" || parts[0] === "school" ? (parts[1] || "") : "";
    return {
      company: {
        name: name,
        tagline: tagline,
        industry: industry,
        about: about,
        website: website,
        companyUrl: location.href.split("?")[0],
        vanitySlug: slug
      }
    };
  }

  function extractSearch() {
    var q = "";
    try {
      q = new URL(location.href).searchParams.get("keywords") ||
        new URL(location.href).searchParams.get("query") || "";
    } catch (e) {}
    if (!q) {
      q = firstText(['input[aria-label*="Search"]', "input.search-global-typeahead__input"]);
    }
    var results = [];
    var cards = document.querySelectorAll(
      ".reusable-search__result-container, li.reusable-search__result-container, .entity-result, li.artdeco-list__item"
    );
    for (var i = 0; i < cards.length && results.length < 10; i++) {
      var card = cards[i];
      var n = firstText([
        ".entity-result__title-text a span[aria-hidden=\"true\"]",
        ".entity-result__title-text a",
        "a.app-aware-link span[aria-hidden=\"true\"]",
        "span.entity-result__title-text",
        "a[data-control-name*="search_srp"] span[aria-hidden=\"true\"]"
      ], card);
      var h = firstText([
        ".entity-result__primary-subtitle",
        ".entity-result__summary"
      ], card);
      var a = card.querySelector("a[href*='/in/'], a[href*='/company/']");
      var href = a ? absUrl(attr(a, "href")).split("?")[0] : "";
      if (n || href) results.push({ name: n, headline: h, url: href });
    }
    return {
      search: {
        query: q,
        resultCountVisible: results.length,
        topResults: results
      }
    };
  }

  function extractSalesNav() {
    var name = firstText([
      "h1",
      ".artdeco-entity-lockup__title",
      "[data-anonymize=\"person-name\"]",
      ".profile-topcard-person-entity__name"
    ]);
    var headline = firstText([
      ".artdeco-entity-lockup__subtitle",
      "[data-anonymize=\"headline\"]",
      ".profile-topcard-person-entity__lockup-subtitle"
    ]);
    var company = firstText([
      "[data-anonymize=\"company-name\"]",
      ".profile-topcard__summary-position"
    ]);
    return {
      profile: {
        name: name,
        headline: headline,
        location: "",
        about: "",
        experience: company ? [{ title: "", company: company, dates: "" }] : [],
        education: [],
        profileUrl: location.href.split("?")[0],
        vanitySlug: "",
        salesNav: true
      }
    };
  }

  function extract() {
    var kind = kindFrom(location.pathname || "/");
    var base = {
      kind: kind,
      url: location.href,
      scrapedAt: new Date().toISOString()
    };
    var body;
    if (kind === "signedOut" || kind === "feed" || kind === "unknown") {
      body = {};
    } else if (kind === "profile") {
      body = extractProfile();
    } else if (kind === "company") {
      body = extractCompany();
    } else if (kind === "search") {
      body = extractSearch();
    } else if (kind === "salesNav") {
      body = extractSalesNav();
    } else {
      body = {};
    }
    var out = {};
    var k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base, k)) out[k] = base[k];
    for (k in body) if (Object.prototype.hasOwnProperty.call(body, k)) out[k] = body[k];
    return out;
  }

  root.__LISFDC_extractLinkedIn = extract;
})(typeof self !== "undefined" ? self : this);
