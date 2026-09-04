# BOT_INSTALL.md — Grok Bot install recipe

Any Grok Bot desk can install LISFDC for an operator. The extension runs in **that operator’s Chrome**, with **their** LinkedIn + Salesforce session. It is not tied to Jason’s Mac, a shared lab box, or a shared Grok Bot login.

Repo: https://github.com/jasoaco79/LISFDC

---

## Prompt for Grok Bot (copy-paste)

```
Read https://github.com/jasoaco79/LISFDC (BOT_INSTALL.md + README.md) and install LISFDC on MY computer as a Chrome MV3 load-unpacked extension.

Rules:
- Use MY registered computer / Chrome profile (ListMachines → machineId). Do not use a shared lab box or the Grok Bot shared box for LinkedIn/Salesforce QA.
- Clone or pull main. Load unpacked the extension/ folder that contains manifest.json — never the repo root.
- You cannot silently inject a Chrome extension. When Load unpacked or an OS dialog needs a human click, hand me the desktop (request_box_help) and resume after I finish.
- Never export cookies, SIDs, tokens, or passwords. Never write/click/save in Salesforce. Never publish to the Chrome Web Store. Never merge product PRs without Jason’s yes.
- When done: confirm extension is loaded, side panel opens, and report the clone path + that Load unpacked pointed at extension/.
```

---

## What the bot does (step by step)

1. **Confirm target machine.** ListMachines. Pick the operator’s computer. Say which machine you will use.
2. **Get the code.** On that machine (or copy onto it):  
   `git clone https://github.com/jasoaco79/LISFDC.git`  
   or `git pull` if already cloned. Stay on `main`.
3. **Locate the load path.** Absolute path to `…/LISFDC/extension/` (must contain `manifest.json`). Do **not** select the repo root.
4. **Open Chrome extensions.** On the operator’s machine, open `chrome://extensions` (computerUse / browser on that machine).
5. **Developer mode** → ON.
6. **Load unpacked** → choose the `extension/` folder. If a file dialog or permission prompt appears, hand the desktop to the operator and resume when they confirm.
7. **Pin LISFDC** and open the **side panel**.
8. **Smoke check (operator signed in):**
   - LinkedIn tab open → **Scrape LinkedIn**
   - Salesforce record tab open → **Scrape Salesforce**
   - Panel shows extracts or a clear error (signed-out / wrong page) — do not invent fields.
9. **Report done:** machine label, clone path, load path (`…/extension`), side panel OK, smoke result.

## What the bot must not do

- Install into a datacenter / shared box Chrome and call that LinkedIn QA
- Export or copy session cookies / Salesforce SIDs / tokens into chat, git, or another machine
- Drive Salesforce clicks, edits, saves, or API writes
- Publish to Chrome Web Store
- Select the repo root for Load unpacked

## Human one-liner

If the operator prefers DIY: clone the repo → `chrome://extensions` → Developer mode → Load unpacked → `extension/` folder → pin → side panel.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| “Manifest file is missing or unreadable” | You selected the repo root. Select `extension/`. |
| LinkedIn scrape empty / signed-out | Operator must be signed into LinkedIn in **this** Chrome profile. |
| Salesforce scrape rejects page | Open a Lightning **record** URL, not home/setup. |
| Extension missing after Chrome restart | Load unpacked paths move if the clone moved; load again from the same `extension/` path. |
| Fixtures look fine but live fails | `fixtures/` are for extractor/screenshot checks only — live QA needs real tabs. |

## Related

- Human install: [README.md](README.md) → Install (load unpacked)
- Design / plan: [docs/DESIGN.md](docs/DESIGN.md), [docs/PLAN.md](docs/PLAN.md)
