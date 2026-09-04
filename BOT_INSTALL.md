# BOT_INSTALL — Grok Bot load-unpacked for LISFDC

Public repo: https://github.com/jasoaco79/LISFDC

This file is for **Grok Bots** (and humans copying a bot prompt). It tells a bot how to fetch this repo, read the docs, and install the Manifest V3 extension **load-unpacked** on the **operator’s own Chrome** — never on a shared lab box.

---

## Prompt for Grok Bot

Copy-paste the block below into a Grok Bot turn:

```
Install LISFDC on the OPERATOR’s Chrome (load-unpacked MV3).

1. Fetch https://github.com/jasoaco79/LISFDC (public). Read BOT_INSTALL.md and README.md before acting.
2. Use ListMachines. Prefer a connected operator Mac with working local tools (e.g. Jason’s MacBook). Target that machineId for clone/pull and browser work. NEVER install or QA LinkedIn on the shared lab box / Cursor box.
3. Clone or pull `main` on the operator machine. Extension path is `<clone>/extension/` (folder with manifest.json) — NOT the repo root.
4. On the operator machine, open chrome://extensions (computerUse / browser on that machine). Enable Developer mode. Load unpacked → select the `extension/` folder. Pin LISFDC. Open the side panel. Verify LinkedIn/Salesforce scrapes against the operator’s own signed-in tabs when they ask.
5. Hard rules:
   - Never export cookies, SIDs, tokens, or passwords.
   - Never Salesforce writes, clicks, saves, creates, or API mutations (scrape-only).
   - Never Chrome Web Store publish.
   - Never silently inject the extension — Chrome requires a Load unpacked click and OS folder dialogs. Hand the desktop / use request_box_help so the operator (or computerUse with approval) can complete those UI steps.
6. When done: report machineId used, clone path, that Load unpacked succeeded, pin + side panel open, and any scrape verification. If blocked on OS dialogs, say exactly what the operator must click.
```

---

## Bot steps (detailed)

### A) Confirm operator machine + Chrome

1. Call `ListMachines`. Pick a **connected** machine that is the operator’s computer (Mac/Windows/Linux with Chrome), not the shared agent box.
2. Confirm Chrome exists on that machine (`/Applications/Google Chrome.app` on macOS, or equivalent).
3. All install and LinkedIn/Salesforce QA runs **on that machineId**. The shared box login does not stick for LinkedIn — do not use it for QA.

### B) Fetch code

```bash
# On the operator machine (pass machineId)
git clone https://github.com/jasoaco79/LISFDC.git
# or, if already cloned:
cd <path-to-LISFDC> && git pull origin main
```

Confirm:

- `extension/manifest.json` exists
- Load path = `…/LISFDC/extension` (directory containing `manifest.json`)
- **Do not** Load unpacked the repo root

### C) Load unpacked in Chrome (operator machine)

1. Open Chrome on the **operator** machine (computerUse / browser bound to that machineId).
2. Navigate to `chrome://extensions`.
3. Turn **Developer mode** ON (top-right toggle).
4. Click **Load unpacked**.
5. In the OS folder picker, select the `extension/` folder (with `manifest.json`), not the repo root.
6. Pin the LISFDC extension action.
7. Open the side panel (click the LISFDC action).
8. Optional verify: with LinkedIn and/or Salesforce already signed in on that Chrome profile, open a page and use **Scrape LinkedIn** / **Scrape Salesforce**. Report what appeared; do not invent fields.

### D) Cannot silently inject

Chrome does **not** allow a bot to install an unpacked extension with zero UI. Expect:

- A **Load unpacked** button click
- An **OS file/folder dialog**

If computerUse cannot finish those steps alone, **hand the desktop** or call **request_box_help** / the platform’s human-in-the-loop path so the operator completes the click and folder selection. Do not claim the extension is installed until Load unpacked has succeeded.

### E) Report done

Tell the operator:

- machineId / machine label used
- Absolute path of the `extension/` folder loaded
- Developer mode on, Load unpacked OK, pinned, side panel opened
- Scrape verification result (or “not run — waiting for operator tabs”)
- Any leftover manual step

---

## Hard prohibitions (every bot)

| Never | Why |
| --- | --- |
| Shared lab / Cursor box for LinkedIn QA | Datacenter / shared session does not stick; LinkedIn blocks it |
| Export cookies, SIDs, tokens, passwords | Out of scope; secrets stay on the operator machine |
| Salesforce writes / clicks / saves / creates / API mutations | Extension is scrape-only |
| Chrome Web Store publish | Unpacked only; no store listing |
| Silent / headless extension inject without UI | Chrome requires Load unpacked + OS dialogs |
| Load unpacked on repo root | Wrong; must be `extension/` with `manifest.json` |

---

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| Repo / clone fails | Confirm repo is public: https://github.com/jasoaco79/LISFDC — use HTTPS clone; retry `git pull origin main` |
| “Manifest file is missing or unreadable” | You selected the repo root. Select `extension/` (the folder that contains `manifest.json`). |
| Load unpacked button missing | Enable **Developer mode** on `chrome://extensions`. |
| OS dialog never appears / bot stuck | Hand desktop or request_box_help; operator must choose the `extension/` folder. |
| Extension loads but side panel empty | Click the LISFDC toolbar icon to open the side panel; refresh the LinkedIn/Salesforce tab; scrape again. |
| LinkedIn scrape says signed-out / unexpected layout | Use the operator’s everyday Chrome profile already signed into LinkedIn. Do not QA on the shared box. |
| Salesforce scrape empty | Open a Lightning record URL the operator can see; scrape is view-only — no navigation by the extension. |
| Wrong machine | Re-run ListMachines; pass the operator’s machineId to Shell / browser tools. Never install only on the lab box. |
| Private clone / 404 (stale) | Repo should be public. If still private, ask the owner to set visibility public, then retry. |
| computerUse cannot open chrome:// | Launch Chrome on the operator machine first, then navigate; or ask the operator to open `chrome://extensions` and complete Load unpacked while you guide. |

---

## Related

- [README.md](README.md) — human install + what LISFDC is / is not
- [docs/DESIGN.md](docs/DESIGN.md) — architecture
- [HANDOFF.md](HANDOFF.md) — how the next person continues
