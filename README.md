# LISFDC

Chrome Manifest V3 extension. **LinkedIn + Salesforce, from the operator’s own signed-in browser.**

Private repo: https://github.com/jasoaco79/LISFDC

LISFDC does not log in for you. It does not live in a datacenter. It scrapes the LinkedIn tab you already have open and scrapes the Salesforce tab you already have open, then shows both extracts in a side panel.

**Salesforce is scrape-only.** View the page. Import visible information. No clicks, no writes, no CRM actions, no Salesforce navigation by the extension.

## Why this exists

LinkedIn treats requests from datacenter IPs as automation and blocks them. A real Chrome profile on the operator’s machine is a normal session. LISFDC is a content-script extension in that profile so LinkedIn and Salesforce see the same browser the operator already uses.

It is not a cookie exporter. It does not replay a session onto another computer. It does not background-fetch LinkedIn from a server.

## What it is / is not

| Is | Is not |
| --- | --- |
| Unpacked Chrome MV3 extension | Chrome Web Store listing |
| Side panel with last LinkedIn + last Salesforce scrape | Salesforce robot |
| User-initiated scrape of the current tab | Mass crawler, InMail, auto-connect |
| Optional: type a LinkedIn URL, open it in the existing LinkedIn tab | Salesforce writes, clicks, or API mutations |
| `chrome.storage.local` for last extracts | Cookie / SID / token export |

## End-user process

One Chrome profile. Two tabs you already use. The extension never signs in on your behalf.

1. **Stay in your own Chrome.** Already signed in to LinkedIn and Salesforce in the profile you use every day. Do not QA LinkedIn in a lab/datacenter browser.
2. **Load unpacked.** Extensions → Developer mode → Load unpacked → the `extension/` folder that contains `manifest.json` (not the repo root). Pin LISFDC. Open the side panel. No password prompt from us.
3. **Open the LinkedIn page you care about** (profile, search, or company). Press **Scrape LinkedIn**. The panel fills name, headline, location, current role when those are on the page. Signed-out or unexpected layout is reported, not guessed.
4. **Open the Salesforce record you care about.** Press **Scrape Salesforce**. The panel imports visible name, object type, Id from the URL, header fields. The extension does not click, edit, save, or create in Salesforce.
5. **Read both extracts in the panel.** Last scrape stays on this machine until you scrape again.

If you need a different LinkedIn URL, type it and open it in the existing LinkedIn tab, then scrape. Do not drive Salesforce that way.

## Install (load unpacked)

1. Clone or download this private repository.
2. Open `chrome://extensions`.
3. Turn on **Developer mode**.
4. **Load unpacked** and choose the `extension/` folder of this clone (the folder that contains `manifest.json`, not the repo root).
5. Pin the LISFDC action and click it to open the side panel.

## QA

LinkedIn + Salesforce QA is **Thursday 3 Sep 2026 on Jason's real Chrome**. The shared box login does not stick — do not expect a logged-in session there. Local `fixtures/` HTML is for extractor and screenshot checks only. **Do not merge without Jason's yes.**

## Hosts

- LinkedIn: `linkedin.com`, `www.linkedin.com`, Sales Navigator hosts
- Salesforce: `*.lightning.force.com`, `*.salesforce.com`, `*.my.salesforce.com`, `*.force.com`

No `<all_urls>`.

## Docs in this repo

- [docs/DESIGN.md](docs/DESIGN.md) — architecture and locked decisions
- [docs/PLAN.md](docs/PLAN.md) — v1 slice (QA target)
- [HANDOFF.md](HANDOFF.md) — how the next person continues
- [docs/screenshots/](docs/screenshots/) — fixture shots of the side panel (not live LinkedIn/Salesforce)
- Iterate sendable stamp (PDF): produced beside the mocks; not the letterhead of this chrome

## Secrets that stay out of git

Passwords, session cookies, Salesforce SIDs, API keys, tokens. Last extracts live in `chrome.storage.local` on the operator’s machine, not in this repository.

## Process

Branch off `main`, open a PR, review, merge when Jason says. No direct product commits to `main`. No store publish. No merge, deploy, or DNS without Jason’s yes.
