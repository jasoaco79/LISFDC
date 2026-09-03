/* LISFDC LinkedIn DOM extractor. Visible text only. Never cookies / tokens / CSRF. */
(function (root) {
  "use strict";

  function textOf(el) {
    if (!el) return "";
    return String(el.innerText || el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function firstText(selectors, rootEl) {
    var scope = rootEl || document;
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = scope.querySelector(selectors[i]);
        var t = textOf(el);
        if (t) return t;
      } catch (e) {}
    }
    return "";
  }

  function attrOf(selectors, attr) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) {
          var v = el.getAttribute(attr);
          if (v) return v.trim();
        }
      } catch (e) {}
    }
    return "";
  }

  function pageUrl() {
    if (root.LISFDC_HOSTS && root.LISFDC_HOSTS.pageUrl) {
      var u = root.LISFDC_HOSTS.pageUrl();
      if (u) return u;
    }
    try {
      if (location.protocol !== "file:") return location.href;
    } catch (e) {}
    try {
      return document.documentElement.getAttribute("data-lisfdc-url") || "";
    } catch (e2) {
      return "";
    }
  }

  function kindFrom(url, doc) {
    var u = (url || "").toLowerCase();
    var path = "";
    try {
      path = new URL(url, "https://www.linkedin.com").pathname.toLowerCase();
    } catch (e) {
      path = u;
    }
    if (u.indexOf("sales.linkedin.com") >= 0 || path.indexOf("/sales/") === 0 || path.indexOf("/sales/") >= 0) {
      return "salesNav";
    }
    if (path.indexOf("/in/") >= 0 || path.indexOf("/pub/") >= 0) return "profile";
    if (path.indexOf("/company/") >= 0 || path.indexOf("/school/") >= 0) return "company";
    if (path.indexOf("/search/") >= 0 || path.indexOf("/results/") >= 0) return "search";
    if (doc.querySelector && doc.querySelector("[data-lisfdc-kind]")) {
      return doc.querySelector("[data-lisfdc-kind]").getAttribute("data-lisfdc-kind") || "unknown";
    }
    if (doc.querySelector && doc.querySelector(".entity-result, .reusable-search__result-container")) return "search";
    if (doc.querySelector && doc.querySelector(".org-top-card, .org-top-card-summary__title")) return "company";
    if (doc.querySelector && doc.querySelector("h1.text-heading-xlarge, .pv-text-details__left-panel h1")) return "profile";
    return "unknown";
  }

  function extractProfile() {
    var name = firstText([
      "h1.text-heading-xlarge",
      ".pv-text-details__left-panel h1",
      "[data-anonymize='person-name']",
      "h1[data-lisfdc='name']",
      "main h1",
      "h1"
    ]);
    var headline = firstText([
      ".text-body-medium.break-words",
      ".pv-text-details__left-panel .text-body-medium",
      "[data-anonymize='headline']",
      "[data-lisfdc='headline']"
    ]);
    var location = firstText([
      ".text-body-small.inline.t-black--light.break-words",
      "[data-anonymize='location']",
      "[data-lisfdc='location']",
      ".pv-text-details__left-panel .text-body-small"
    ]);
    var currentRole = firstText([
      "[data-lisfdc='current-role']",
      "#experience ~ .pvs-list__outer-container li .t-bold span[aria-hidden='true']",
      "#experience-section .pv-entity__summary-info h3",
      ".pv-top-card--experience-list-item"
    ]);
    var company = firstText([
      "[data-lisfdc='company']",
      "#experience ~ .pvs-list__outer-container li .t-14.t-normal span[aria-hidden='true']",
      ".pv-top-card--experience-list-item span"
    ]);
    var about = firstText([
      "[data-lisfdc='about']",
      "section#about ~ div .inline-show-more-text",
      "#about ~ .display-flex",
      "[data-generated-suggestion-target]",
      "section.pv-about-section .pv-about__summary-text"
    ]);
    var profile = {};
    if (name) profile.name = name;
    if (headline) profile.headline = headline;
    if (location) profile.location = location;
    if (currentRole) profile.currentRole = currentRole;
    if (company) profile.company = company;
    if (about) profile.about = about;
    return profile;
  }

  function extractSearch(url) {
    var query = firstText([
      "input.search-global-typeahead__input",
      "input[data-lisfdc='query']",
      ".search-global-typeahead__input",
      "input[aria-label='Search']"
    ]);
    if (!query) {
      try {
        var u = new URL(url, "https://www.linkedin.com");
        query = u.searchParams.get("keywords") || u.searchParams.get("query") || "";
      } catch (e) {}
    }
    var countText = firstText([
      ".search-results-container h2",
      ".pb2.t-black--light.t-14",
      "[data-lisfdc='result-count']",
      ".search-reusables__filter-bar-result-count"
    ]);
    var resultCountEstimate = null;
    if (countText) {
      var m = countText.replace(/,/g, "").match(/(\d+)/);
      if (m) resultCountEstimate = parseInt(m[1], 10);
    }
    var topResults = [];
    var cards = document.querySelectorAll(
      "[data-lisfdc='result'], .entity-result, [data-chameleon-result-urn], .reusable-search__result-container"
    );
    for (var i = 0; i < cards.length && topResults.length < 8; i++) {
      var card = cards[i];
      var name = firstText(["[data-lisfdc='result-name']", ".entity-result__title-text a span[aria-hidden='true']", ".entity-result__title-text a", "a.app-aware-link span[aria-hidden='true']", "a"], card);
      var headline = firstText(["[data-lisfdc='result-headline']", ".entity-result__primary-subtitle", ".entity-result__summary", ".t-14.t-black.t-normal"], card);
      var href = "";
      var a = card.querySelector("a[href*='/in/'], a[data-lisfdc='result-url'], a.app-aware-link");
      if (a) href = a.getAttribute("href") || "";
      if (name) {
        topResults.push({ name: name, headline: headline || "", url: href });
      }
    }
    var search = {};
    if (query) search.query = query;
    if (resultCountEstimate !== null) search.resultCountEstimate = resultCountEstimate;
    search.topResults = topResults;
    return search;
  }

  function extractCompany() {
    var name = firstText([
      "h1.org-top-card-summary__title",
      ".org-top-card-summary__title",
      "[data-lisfdc='company-name']",
      "h1"
    ]);
    var about = firstText([
      "[data-lisfdc='company-about']",
      ".org-about-module p",
      ".org-page-details-module__info-text",
      ".break-words p"
    ]);
    var industry = firstText([
      "[data-lisfdc='industry']",
      ".org-top-card-summary-info-list__info-item",
      "dt + dd"
    ]);
    var location = firstText([
      "[data-lisfdc='company-location']",
      ".org-top-card-summary-info-list__info-item + .org-top-card-summary-info-list__info-item"
    ]);
    var company = {};
    if (name) company.name = name;
    if (about) company.about = about;
    if (industry) company.industry = industry;
    if (location) company.location = location;
    return company;
  }

  function extractLinkedIn() {
    var url = pageUrl();
    var title = "";
    try {
      title = document.title || "";
    } catch (e) {}
    var kind = "unknown";
    try {
      kind = kindFrom(url, document);
    } catch (e2) {
      kind = "unknown";
    }
    var out = {
      kind: kind,
      url: url,
      title: title,
      extractedAt: new Date().toISOString()
    };
    try {
      if (kind === "profile" || kind === "salesNav") {
        var profile = extractProfile();
        if (Object.keys(profile).length) out.profile = profile;
      }
      if (kind === "search" || kind === "salesNav") {
        var search = extractSearch(url);
        if (search.query || (search.topResults && search.topResults.length)) out.search = search;
      }
      if (kind === "company" || kind === "salesNav") {
        var company = extractCompany();
        if (Object.keys(company).length) out.company = company;
      }
      if (kind === "unknown") {
        var p = extractProfile();
        if (p.name) {
          out.profile = p;
        }
      }
    } catch (err) {
      out.error = "extract-failed";
    }
    return out;
  }

  root.LISFDC_EXTRACT_LINKEDIN = extractLinkedIn;
})(typeof self !== "undefined" ? self : this);
