#!/usr/bin/env node
/**
 * Optional CLI: node cli.mjs <type> [--url URL] [--waitMs N]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.LISFDC_BRIDGE_URL || "http://127.0.0.1:17321").replace(/\/$/, "");
const POLL_MS = 500;
const TIMEOUT_MS = 60_000;

function loadToken() {
  if (process.env.LISFDC_BRIDGE_TOKEN && process.env.LISFDC_BRIDGE_TOKEN.trim()) {
    return process.env.LISFDC_BRIDGE_TOKEN.trim();
  }
  try {
    const p = path.join(__dirname, ".token");
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  } catch (_) {}
  return "";
}

function parseArgs(argv) {
  const out = { type: null, url: null, waitMs: null };
  const rest = argv.slice(2);
  if (!rest.length) return out;
  out.type = rest[0];
  for (let i = 1; i < rest.length; i++) {
    if (rest[i] === "--url" && rest[i + 1]) out.url = rest[++i];
    else if (rest[i] === "--waitMs" && rest[i + 1]) out.waitMs = Number(rest[++i]);
  }
  return out;
}

async function httpJson(method, urlPath, body, token) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const opts = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, opts);
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; }
  catch { data = { ok: false, error: text.slice(0, 500) }; }
  return { status: res.status, data };
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.type || args.type === "help" || args.type === "--help") {
    console.error("Usage: node cli.mjs <health|scrape_linkedin|open_linkedin|research_linkedin|scrape_salesforce|get_stored> [--url URL] [--waitMs N]");
    process.exit(args.type ? 0 : 1);
  }
  const token = loadToken();
  if (args.type === "health") {
    const { status, data } = await httpJson("GET", "/health");
    console.log(JSON.stringify({ status, ...data }, null, 2));
    process.exit(data && data.ok ? 0 : 1);
  }
  const payload = { type: args.type };
  if (args.url) payload.url = args.url;
  if (args.waitMs != null) payload.waitMs = args.waitMs;
  const { status, data } = await httpJson("POST", "/v1/commands", payload, token);
  if (!data || !data.ok || !data.id) {
    console.error(JSON.stringify(data || { ok: false, status }, null, 2));
    process.exit(1);
  }
  const id = data.id;
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const polled = await httpJson("GET", "/v1/commands/" + encodeURIComponent(id), undefined, token);
    if (polled.data && polled.data.status === "done") {
      console.log(JSON.stringify(polled.data.result, null, 2));
      process.exit(polled.data.result && polled.data.result.ok ? 0 : 1);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.error(JSON.stringify({ ok: false, error: "timeout" }, null, 2));
  process.exit(1);
}

main().catch((e) => {
  console.error(String(e.message || e));
  process.exit(1);
});
