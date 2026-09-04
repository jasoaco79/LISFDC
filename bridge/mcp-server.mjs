#!/usr/bin/env node
/**
 * Minimal MCP (stdio JSON-RPC) wrapper for LISFDC bridge HTTP API.
 * Protocol shape: MCP 2024-11-05 — initialize, tools/list, tools/call.
 * Zero deps. Env: LISFDC_BRIDGE_TOKEN, LISFDC_BRIDGE_URL (default http://127.0.0.1:17321).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

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
    if (fs.existsSync(p)) {
      const t = fs.readFileSync(p, "utf8").trim();
      if (t) return t;
    }
  } catch (_) {}
  return "";
}

const TOKEN = loadToken();

async function httpJson(method, urlPath, body) {
  const headers = { Accept: "application/json" };
  if (TOKEN) headers.Authorization = "Bearer " + TOKEN;
  const opts = { method, headers };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + urlPath, opts);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { ok: false, error: "Non-JSON response", raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

async function postCommand(payload) {
  const { status, data } = await httpJson("POST", "/v1/commands", payload);
  if (status === 401) throw new Error("Unauthorized — set LISFDC_BRIDGE_TOKEN to match the bridge");
  if (status === 409) throw new Error((data && data.error) || "Command queue busy (409)");
  if (!data || !data.ok || !data.id) {
    throw new Error((data && data.error) || `POST /v1/commands failed (${status})`);
  }
  return data.id;
}

async function pollUntilDone(id) {
  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    const { status, data } = await httpJson("GET", "/v1/commands/" + encodeURIComponent(id));
    if (status === 404) throw new Error("Command not found");
    if (data && data.status === "done") return data.result || { ok: false, error: "Empty result" };
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error("Timed out waiting for extension (~60s). Is the extension loaded and bridge enabled?");
}

async function runCommand(payload) {
  const id = await postCommand(payload);
  return pollUntilDone(id);
}

const TOOLS = [
  {
    name: "lisfdc_health",
    description: "Check LISFDC local bridge health (GET /health).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lisfdc_scrape_linkedin",
    description: "Scrape the open LinkedIn tab via the extension (no navigation).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lisfdc_open_linkedin",
    description: "Open a https LinkedIn URL in the existing LinkedIn tab (or create one).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "https LinkedIn URL" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "lisfdc_research_linkedin",
    description: "Open LinkedIn URL, wait briefly, then scrape. Default wait 2500ms (max 15000).",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "https LinkedIn URL" },
        waitMs: { type: "number", description: "Wait after open before scrape (ms)" },
      },
      required: ["url"],
      additionalProperties: false,
    },
  },
  {
    name: "lisfdc_scrape_salesforce",
    description: "Scrape the open Salesforce record tab only. Never navigates Salesforce.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "lisfdc_get_stored",
    description: "Return last LinkedIn and Salesforce extracts from extension storage.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

async function callTool(name, args) {
  args = args || {};
  switch (name) {
    case "lisfdc_health": {
      const { status, data } = await httpJson("GET", "/health");
      return { status, ...(data || {}) };
    }
    case "lisfdc_scrape_linkedin":
      return runCommand({ type: "scrape_linkedin" });
    case "lisfdc_open_linkedin":
      return runCommand({ type: "open_linkedin", url: String(args.url || "") });
    case "lisfdc_research_linkedin": {
      const payload = { type: "research_linkedin", url: String(args.url || "") };
      if (args.waitMs != null) payload.waitMs = Number(args.waitMs);
      return runCommand(payload);
    }
    case "lisfdc_scrape_salesforce":
      return runCommand({ type: "scrape_salesforce" });
    case "lisfdc_get_stored":
      return runCommand({ type: "get_stored" });
    default:
      throw new Error("Unknown tool: " + name);
  }
}

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function respond(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function respondError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(msg) {
  if (!msg || msg.jsonrpc !== "2.0") return;
  if (msg.id === undefined || msg.id === null) {
    if (msg.method === "notifications/initialized") return;
    return;
  }
  const { id, method, params } = msg;
  try {
    if (method === "initialize") {
      respond(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "lisfdc-bridge", version: "1.0.0" },
      });
      return;
    }
    if (method === "ping") {
      respond(id, {});
      return;
    }
    if (method === "tools/list") {
      respond(id, { tools: TOOLS });
      return;
    }
    if (method === "tools/call") {
      const name = params && params.name;
      const args = (params && params.arguments) || {};
      try {
        const result = await callTool(name, args);
        respond(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: result && result.ok === false,
        });
      } catch (e) {
        respond(id, {
          content: [{ type: "text", text: JSON.stringify({ ok: false, error: String(e.message || e) }, null, 2) }],
          isError: true,
        });
      }
      return;
    }
    respondError(id, -32601, "Method not found: " + method);
  } catch (e) {
    respondError(id, -32603, String(e.message || e));
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let msg;
  try {
    msg = JSON.parse(trimmed);
  } catch {
    return;
  }
  handleMessage(msg);
});

rl.on("close", () => process.exit(0));

if (!TOKEN) {
  console.error("[lisfdc-mcp] Warning: no LISFDC_BRIDGE_TOKEN and no bridge/.token — authenticated calls will fail");
}
