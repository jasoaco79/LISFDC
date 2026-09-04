# LISFDC v1 plan

QA target: **Thursday 3 September 2026** on the operator’s real Chrome.

Product code on a branch. Draft PR. Do not merge until Jason says.

## Must for Thursday

Side panel:

1. Scrape current LinkedIn tab into structured JSON.
2. Scrape current Salesforce tab (visible fields only). No Salesforce actions.
3. Optional: user-supplied LinkedIn URL opens in the existing LinkedIn tab.
4. Side-by-side last extracts in `chrome.storage.local`.

## Docs in the PR

This file, `docs/DESIGN.md`, `README.md`, `HANDOFF.md`, screenshots of the **built** side panel in `docs/screenshots/` (not LinkedIn/Salesforce page captures).

## Done when

Operator can load unpacked, scrape a signed-in LinkedIn tab, scrape a signed-in Salesforce tab, and see both extracts. Draft PR. Not merged. Not in a store.


## Hosts

- LinkedIn + Sales Nav: `https://*.linkedin.com/*`, `https://linkedin.com/*`
- Salesforce: `https://*.lightning.force.com/*`, `https://*.salesforce.com/*`, `https://*.my.salesforce.com/*`, `https://*.force.com/*`

Permissions: `sidePanel`, `storage`, `tabs`, `scripting`, `activeTab` plus those hosts. No `all_urls`.

## Extract JSON

LinkedIn:

```
{
  kind: "profile" | "search" | "company" | "salesNav" | "unknown",
  url, title, extractedAt,
  profile?: { name, headline, location, currentRole, company, about },
  search?: { query, resultCountEstimate, topResults: [{ name, headline, url }] },
  company?: { name, about, industry, location }
}
```

Salesforce:

```
{
  kind: "lightning" | "classic" | "unknown",
  url, title, extractedAt,
  object, id, name,
  headerFields: [{ label, value }]
}
```

Never include cookies, CSRF, or session ids.

## QA — Thursday 3 Sep 2026, Jason's Chrome

Box login does not stick. On Jason's real Chrome:

1. `chrome://extensions` → Developer mode → Load unpacked → `extension/`
2. Open a real LinkedIn profile and a Lightning record
3. **Scrape LinkedIn** — JSON matches visible name/headline/location
4. **Scrape Salesforce** — JSON matches visible name, object, Id from URL, on-screen fields
5. Paste a LinkedIn URL → **Open in existing LinkedIn tab** — existing LI tab navigates; a new tab is created only if none exists
6. Confirm Salesforce has no URL field and no write/navigate
7. Reload the side panel — both last extracts still show
8. Non-matching tab only — scrape errors instead of reading the wrong host
