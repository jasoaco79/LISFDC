# HANDOFF — LISFDC

## What this repo is

LISFDC is a Chrome Manifest V3 extension that scrapes a LinkedIn tab and a Salesforce tab from the operator’s already signed-in Chrome profile so LinkedIn is not hit from a datacenter.

It is not a Salesforce robot. Salesforce is view-and-import only.

Private: https://github.com/jasoaco79/LISFDC

## Current main

Docs live on `docs/why-design` (PR #1). Product code is `pi/lisfdc-v1-side-panel` (this PR). Neither is on `main` until Jason says.

## Live / preview

Nothing is deployed. Nothing is on the Chrome Web Store. Load unpacked on the operator’s machine.

## How to run

1. Clone this repository.
2. Chrome → Extensions → Developer mode → Load unpacked → the `extension/` folder (contains `manifest.json`).
3. Sign in to LinkedIn and Salesforce in that same Chrome profile (the sites, not the extension).
4. Open the side panel. Scrape LinkedIn. Scrape Salesforce.

## Open leftover work

- QA Thursday 3 Sep 2026 on Jason’s real Chrome (box LinkedIn login does not stick)
- Merge only when Jason says (this PR and docs PR #1)
- Write-back to Salesforce, matching, store listing: out of scope

## Secrets that stay out of git

Passwords, cookies, SIDs, API keys, tokens, webhook URLs.

## Locks

- Salesforce: scrape only. No actions.
- No cookie export, no session replay, no datacenter fetch.
- Branch off `main`, open a PR, merge when Jason says. No merge, deploy, or store publish without that yes.
