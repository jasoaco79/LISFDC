# LISFDC v1 spec (implementation source of truth)

Repo: jasoaco79/LISFDC
Branch: pi/lisfdc-v1-side-panel
Main SHA at branch point: f2ca4bd287cbd96fbd4ebd30a529fbc94d8b4e41

## What this is
Chrome Manifest V3 side-panel extension. Read-only reader of LinkedIn pages (profile, search, company, Sales Navigator) and Salesforce Lightning/classic records from the user current browser tab. Last extracts stored in extension local storage and shown side by side.

## What this is not
- No CRM write-back
- No auto-connect, InMail, or messaging
- No token, cookie, SID, CSRF, or session-storage export
- No headless browser, no remote fetch of LinkedIn or Salesforce pages
- No all-hosts permission
- No store publish


## Hosts (and only these)
- https://*.linkedin.com/* and https://linkedin.com/* (includes Sales Nav /sales/)
- https://*.lightning.force.com/*
- https://*.salesforce.com/*
- https://*.my.salesforce.com/*
- https://*.force.com/*

Permissions: sidePanel, storage, tabs, scripting, activeTab. No all_urls.

## Required source files
- manifest.json (MV3, version 1.0.0, name LISFDC). Side panel default path sidepanel.html. Service worker background.js. Toolbar action opens the side panel. Content scripts for LinkedIn hosts and Salesforce hosts. Icons 16/48/128.
- background.js: on install, open panel on action click. Messages from the panel:
  - EXTRACT_ACTIVE: if the current window active tab host is allowed, inject extract files into that tab only and return structured JSON. Fallback: runtime message to the content script.
  - OPEN_LINKEDIN_URL: if URL host is linkedin.com, reuse an existing LinkedIn tab (current window first) and navigate it. Create a tab only if none exists. Reject non-LinkedIn URLs.
  - GET_STORED / CLEAR_STORED
  Storage keys: lastLinkedInExtract, lastSalesforceExtract. Never store cookies or tokens.
- sidepanel.html, sidepanel.css, sidepanel.js: ~360-420px dark navy/slate panel. Header LISFDC v1, subtitle LinkedIn + Salesforce reader (read-only). Current tab hint. Buttons Extract LinkedIn and Extract Salesforce. URL field plus Open LinkedIn URL. Two columns of last extracts as pretty JSON. Clear. Footer: Never writes. Never exports cookies or session tokens. Status/errors for wrong host.
- content/linkedin.js and content/salesforce.js: define window.__LISFDC_extractLinkedIn and window.__LISFDC_extractSalesforce. Also listen for runtime EXTRACT messages. Read-only; no clicks that mutate; no form fills.
- lib/types.js JSDoc typedefs
- lib/sanitize.js recursive strip of keys/values matching cookie, sid, csrf, token, authorization, sessionid, aura.token. Always run before storage.
- icons generated as real PNGs
- .gitignore: .env, cookies, auth.json, *.pem, node_modules, .DS_Store
- fixtures/sidepanel-mock.html (standalone visual twin of the panel with sample JSON, no extension APIs)
- fixtures/linkedin-profile.html and fixtures/salesforce-record.html with the same selectors the extractors use
- README.md, HANDOFF.md, docs/PLAN.md as specified below

Inject files in order: lib/sanitize.js then the matching content file, then call the window global. Host allowlist helper: hostname is linkedin.com or ends with .linkedin.com, or ends with .lightning.force.com, .salesforce.com, .my.salesforce.com, .force.com, or equals those apex names. Reject other schemes.

Vanilla JS, no bundler.


## LinkedIn JSON
kind: profile | search | company | salesNav | unknown
url, title, extractedAt
profile: name, headline, location, currentRole, company, about (plain text if present)
search: query, resultCountEstimate, topResults [{name, headline, url}]
company: name, about, industry, location if present

Classify from path: /sales/ => salesNav (still fill profile/company/search when the page looks like a lead, account, or search); /in/ or /pub/ => profile; /company/ => company; /search/ => search; else unknown.

Defensive selectors (DOM churns):
- name: h1, .text-heading-xlarge, [data-anonymize=person-name]
- headline: .text-body-medium, [data-anonymize=headline]
- location: .text-body-small, [data-anonymize=location]
- about: section#about or About heading sibling
- currentRole/company from first Experience item or headline
- search query from keywords=; cards .entity-result, .reusable-search__result-container
Visible text only. Do not click to expand contact info.

## Salesforce JSON
kind: lightning | classic | unknown
url, title, extractedAt
object, id (from /lightning/r/{Object}/{Id}/view or classic /{Id})
name (header)
headerFields [{label, value}] up to 12 visible highlight items

Id is 15 or 18 alphanumerics. Classic object from prefix: 001 Account, 003 Contact, 00Q Lead, 006 Opportunity, 005 User, 00T Task, 701 Campaign, 500 Case, else unknown.
Name: .slds-page-header__title, lightning-formatted-name, classic .pageDescription / h2.pageDescription.
Highlights: records-highlights-details-item, .slds-page-header__detail-row.

## Docs to write
README.md: how to load unpacked (extensions page, Developer mode, Load unpacked, this folder). What v1 does and never does. QA note that LinkedIn login QA is on Jason real Chrome because box login does not stick. Hosts and permissions.

HANDOFF.md: harness-agnostic. What this repo is (LinkedIn plus Salesforce side-panel reader for Jason Chrome). What it is not (no CRM write-back, no auto-connect, no token export). Current main SHA f2ca4bd287cbd96fbd4ebd30a529fbc94d8b4e41. How to load. Open leftover work. Secrets that must stay out of git. Jason lock: no merge without his yes. Standard GitHub process: branch off main, PR, review, merge when Jason says. Do not address Claude, Cursor, Codex, or Grok Bot as the reader. No secrets.

docs/PLAN.md: v1 scope, hosts, extract JSON shapes, QA plan for Thu 3 Sep 2026 on Jason Chrome. Note screenshots will live in docs/screenshots/.

Do not write screenshot PNGs. Do not commit. Do not push. Do not print tokens.

After writing, list files and verify manifest.json is valid JSON and every path it names exists. Generate real icon PNGs (python PIL is fine).
