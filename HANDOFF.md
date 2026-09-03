# LISFDC handoff

This file is for anyone picking up the repo. It is not tied to a particular editor, agent, or CI product.

## What this is

LISFDC is a **Chrome Manifest V3** extension, **unpacked local install only**.

v1 is a **side panel** that, on an explicit user click:

- reads the current LinkedIn / Sales Navigator tab (profile, search cards, or company page) into structured JSON
- reads the current Salesforce Lightning or Classic record (name, object, Id from URL, visible header fields)
- shows **last LinkedIn** and **last Salesforce** extracts side by side
- can navigate an **existing** LinkedIn tab to a URL the user typed (“Open in this tab”)

Extracts live in **`chrome.storage.local`** on that Chrome profile. There is no backend.

The product assumes the operator is already signed in to LinkedIn and Salesforce in desktop Chrome. That logged-in residential/browser session is the runtime. It is not a datacenter scrape.

## What this is not

- Not a proxy, Puppeteer runner, or headless farm
- Not a worker that fetches LinkedIn or Salesforce from a cloud IP
- Not a cookie, `Authorization`, or Salesforce SID exporter
- Not a tool for copying a session onto another machine
- Not an alarm-based or mass search harvester
- Not a Chrome Web Store listing
- Not a Salesforce writer (v1 is read-only on CRM)
- Not an auto-connect / InMail / like / follow bot on LinkedIn

If a future change needs any of the above, stop and get an explicit product decision. Do not “just add a fetch.”

## How to load

1. On the machine that already has the real Chrome profile, clone this repository.
2. Chrome → `chrome://extensions` → **Developer mode** on → **Load unpacked**.
3. Choose the repo root (the directory that contains `manifest.json`).
4. Click the LISFDC action to open the **side panel**.
5. Refresh any LinkedIn / Salesforce tabs that were open before the load, then use **Read LinkedIn tab** / **Read Salesforce tab**.

Do not pack or publish. Do not upload a `.crx` to a store.

Details and screenshots: [README.md](README.md).

## What is already in the tree

| Path | Role |
| --- | --- |
| `manifest.json` | MV3, `side_panel`, host-limited `content_scripts`, service worker, no secrets |
| `src/background.js` | Message router, `chrome.storage.local`, LinkedIn tab navigation |
| `src/content/parse-linkedin.js` | Resilient LinkedIn reader + `not_signed_in` / `unexpected_layout` |
| `src/content/parse-salesforce.js` | URL Id + visible header; avoids hashed Lightning classes |
| `src/panel/` | Side panel UI (dark, internal, no vendor letterhead) |
| `fixtures/` | HTML pages used by the parser harness |
| `tests/run.mjs` | Host tests + `linkedom` fixture harness (`npm test`) |
| `docs/screenshots/` | Side panel UI shots (compare, narrow, empty, unsigned) |
| `icons/` | Neutral PNG icons (not LinkedIn/Salesforce marks) |

## Leftover work (not v1)

These are intentional gaps, not silent bugs:

- No write-back to Salesforce (create/update Contact, Account, Lead, Task).
- No LinkedIn actions (connect, InMail, like, follow, message send).
- No matching / fuzzy join between the two extracts beyond eyeballing the panel.
- No sync across machines or browsers.
- LinkedIn DOM will drift; selectors will need periodic fixture updates when layouts change.
- Sales Navigator pages that are not people/search/company may return `unexpected_layout`.
- Experience / about text is best-effort and clipped; not a full profile dump.
- Search read is the **current visible page**, capped (20 cards). Do not turn this into a crawler.
- Classic Salesforce layouts vary by org; header/label parsing may miss custom page layouts.
- No automated test against live `linkedin.com` or a real org (that would need a real human session).
- No Web Store listing, update URL, or enterprise policy package.
- Side panel screenshots in `docs/screenshots/` are the extension UI with fixture data, not live PII.

## Secrets that must stay out of git

Never add to this repository:

- LinkedIn or Salesforce passwords, OTPs, recovery codes
- `li_at`, `JSESSIONID`, Salesforce `sid` / `sid_Client`, `Authorization` headers
- cookie exports, HAR captures that include cookies, “session.json” dumps
- API keys, connected-app secrets, JWT signing keys (v1 needs none)
- another user’s Chrome profile directory

If you find a secret in the working tree, delete it and rotate the live credential. Do not commit a redacted copy of a real cookie.

The readers are written to drop cookie-shaped values and labels such as “session” / “sid” before `chrome.storage.local` write. That is a safety net, not permission to scrape cookies out of the DOM.

## Merge rule

**Do not merge to `main` unless Jason says yes.**

Work stays on a pull request off `main`. Draft is the default until a human review is done. “The tests passed” is not merge permission.

## Suggested next checks for a reviewer

1. `npm install && npm test` from the repo root.
2. Load unpacked in a throwaway Chrome profile first, then in the real profile.
3. Confirm `manifest.json` has no `<all_urls>` and no keys/tokens.
4. On a real LinkedIn profile and a real Lightning contact, click both read buttons and confirm the JSON is a real parse, not placeholders.
5. Confirm **Open in this tab** refuses non-LinkedIn URLs and does not open a new window.
6. Confirm DevTools → Application → Extension storage shows only the two extract objects, no cookies.
