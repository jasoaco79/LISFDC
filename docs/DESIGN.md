# LISFDC design

## Problem

Datacenter scrapers get blocked on LinkedIn. The operator already has LinkedIn and Salesforce open in a normal Chrome profile. LISFDC must read those pages in place.

## Locked decisions (2 Sep 2026)

- **Salesforce: scrape only.** View the open page. Import visible information. No actions (no clicks, writes, record updates, CRM navigation, Salesforce API mutations).
- **LinkedIn: scrape the open logged-in tab.** Optional user-initiated “open this URL in the existing LinkedIn tab.” No connect, InMail, like, or follow.
- **Workplace is the operator’s Chrome profile**, not a headless browser and not a lab login (LinkedIn fingerprints those).
- **MV3 side panel**, not a Salesforce plugin, not a Web Store listing.
- **No cookie export.** No SID on the clipboard. No session replay to another machine.
- **Host permissions** limited to LinkedIn + Salesforce. No all-sites.
- **Storage:** last LinkedIn extract + last Salesforce extract in `chrome.storage.local` only.
- **Iterate letterhead** is for the sendable PDF, not for the extension chrome.

## Architecture

operator Chrome (already signed in)
  - LinkedIn tab: content script scrapes visible DOM
  - Salesforce tab: content script scrapes visible DOM (read-only)
  - LISFDC side panel: Scrape LinkedIn, Scrape Salesforce, optional open LinkedIn URL in existing LinkedIn tab, show last extracts side by side

All network for LinkedIn/Salesforce stays in-page in those origins. The service worker coordinates messages. It does not fetch LinkedIn or Salesforce as a third party.

## Salesforce scrape (v1)

From the current Lightning or classic record page, import:

- Record name (visible header)
- Object type when visible
- Id from the URL
- Visible header fields

If the page is not a record, or the operator is signed out, show that state. Do not invent fields. Do not call Salesforce REST to mutate. Do not press Lightning buttons.

## LinkedIn scrape (v1)

From the current profile, search cards, or company page, import:

- Name
- Headline
- Location
- Current role / company when present in the DOM

LinkedIn DOM is brittle. Prefer resilient selectors and fallbacks. Surface “not signed in / unexpected layout” instead of crashing.

## Non-goals (this edition)

Write-back to Salesforce, matching/enrichment, Sales Nav depth, visual chrome of the panel, store publish, unattended harvest.
