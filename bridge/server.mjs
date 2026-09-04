#!/usr/bin/env node
/**
 * LISFDC local bot bridge — HTTP API bound to 127.0.0.1 only.
 * Zero deps. Shared bearer token via LISFDC_BRIDGE_TOKEN / .token.
 */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERSION = "1.0.0";
const HOST = "127.0.0.1";
const PORT = Number(process.env.LISFDC_BRIDGE_PORT || 17321);
const TOKEN_FILE = path.join(__dirname, ".token");

const ALLOWED_TYPES = new Set([
  "scrape_linkedin",
  "open_linkedin",
  "research_linkedin",
  "scrape_salesforce",
  "get_stored",
]);

/** @type {{ id: string, type: string, url?: string, waitMs?: number, status: string, createdAt: number, result?: object } | null} */
let current = null;

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function resolveToken() {
  if (process.env.LISFDC_BRIDGE_TOKEN && process.env.LISFDC_BRIDGE_TOKEN.trim()) {
    return process.env.LISFDC_BRIDGE_TOKEN.trim();
  }
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const existing = fs.readFileSync(TOKEN_FILE, "utf8").trim();
      if (existing) return existing;
    }
  } catch (_) {}
  const token = generateToken();
  fs.writeFileSync(TOKEN_FILE, token + "\n", { mode: 0o600 });
  console.log("[lisfdc-bridge] Generated bearer token (also written to bridge/.token — gitignored):");
  console.log(token);
  return token;
}

const TOKEN = resolveToken();

function isLinkedInUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return h === "linkedin.com" || h.endsWith(".linkedin.com");
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 2_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolve(null);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function authOk(req) {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) return false;
  const t = h.slice(7).trim();
  return t.length > 0 && t === TOKEN;
}

function requireAuth(req, res) {
  if (!authOk(req)) {
    sendJson(res, 401, { ok: false, error: "Unauthorized" });
    return false;
  }
  return true;
}

async function handlePostCommands(req, res) {
  if (!requireAuth(req, res)) return;
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: String(e.message || e) });
    return;
  }
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { ok: false, error: "JSON body required" });
    return;
  }
  const type = String(body.type || "").trim();
  if (!ALLOWED_TYPES.has(type)) {
    sendJson(res, 400, {
      ok: false,
      error: "Unknown type. Allowed: " + [...ALLOWED_TYPES].join(", "),
    });
    return;
  }
  if (current && (current.status === "pending" || current.status === "in_flight")) {
    sendJson(res, 409, {
      ok: false,
      error: "Command already pending or in_flight",
      id: current.id,
      status: current.status,
    });
    return;
  }

  if (type === "scrape_salesforce") {
    if (body.url !== undefined && body.url !== null && String(body.url).trim() !== "") {
      sendJson(res, 400, {
        ok: false,
        error: "scrape_salesforce must not include a url field — Salesforce navigate is forbidden",
      });
      return;
    }
  }

  let url;
  let waitMs;
  if (type === "open_linkedin" || type === "research_linkedin") {
    url = String(body.url || "").trim();
    if (!url || !isLinkedInUrl(url)) {
      sendJson(res, 400, {
        ok: false,
        error: "open_linkedin / research_linkedin require a https linkedin.com URL",
      });
      return;
    }
  }
  if (type === "research_linkedin") {
    waitMs = body.waitMs != null ? Number(body.waitMs) : 2500;
    if (!Number.isFinite(waitMs) || waitMs < 0) waitMs = 2500;
    if (waitMs > 15000) waitMs = 15000;
  }

  const id = crypto.randomUUID();
  current = {
    id,
    type,
    url: url || undefined,
    waitMs: waitMs != null ? waitMs : undefined,
    status: "pending",
    createdAt: Date.now(),
  };
  sendJson(res, 200, { ok: true, id });
}

function handleGetPending(req, res) {
  if (!requireAuth(req, res)) return;
  if (!current || current.status !== "pending") {
    sendJson(res, 200, { ok: true, command: null });
    return;
  }
  current.status = "in_flight";
  sendJson(res, 200, {
    ok: true,
    command: {
      id: current.id,
      type: current.type,
      url: current.url,
      waitMs: current.waitMs,
    },
  });
}

async function handlePostResult(req, res, id) {
  if (!requireAuth(req, res)) return;
  if (!current || current.id !== id) {
    sendJson(res, 404, { ok: false, error: "Unknown command id" });
    return;
  }
  if (current.status !== "in_flight" && current.status !== "pending") {
    sendJson(res, 409, { ok: false, error: "Command already finished", status: current.status });
    return;
  }
  let body;
  try {
    body = await readBody(req);
  } catch (e) {
    sendJson(res, 400, { ok: false, error: String(e.message || e) });
    return;
  }
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { ok: false, error: "JSON body required" });
    return;
  }
  current.result = {
    ok: !!body.ok,
    error: body.error,
    extract: body.extract,
    lastLinkedInExtract: body.lastLinkedInExtract,
    lastSalesforceExtract: body.lastSalesforceExtract,
    url: body.url,
    tabId: body.tabId,
  };
  current.status = "done";
  sendJson(res, 200, { ok: true, id: current.id });
}

function handleGetCommand(req, res, id) {
  if (!requireAuth(req, res)) return;
  if (!current || current.id !== id) {
    sendJson(res, 404, { ok: false, error: "Unknown command id" });
    return;
  }
  const out = {
    ok: true,
    id: current.id,
    type: current.type,
    status: current.status,
  };
  if (current.status === "done") {
    out.result = current.result || null;
  }
  sendJson(res, 200, out);
}

function matchRoute(method, pathname) {
  if (method === "GET" && pathname === "/health") return "health";
  if (method === "POST" && pathname === "/v1/commands") return "post_commands";
  if (method === "GET" && pathname === "/v1/commands/pending") return "get_pending";
  const resultM = pathname.match(/^\/v1\/commands\/([^/]+)\/result$/);
  if (method === "POST" && resultM) return { kind: "post_result", id: decodeURIComponent(resultM[1]) };
  const getM = pathname.match(/^\/v1\/commands\/([^/]+)$/);
  if (method === "GET" && getM) return { kind: "get_command", id: decodeURIComponent(getM[1]) };
  return null;
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  let pathname = "/";
  try {
    pathname = new URL(req.url || "/", `http://${HOST}:${PORT}`).pathname;
  } catch {
    sendJson(res, 400, { ok: false, error: "Bad request URL" });
    return;
  }

  // CORS not needed for extension/localhost; allow OPTIONS for safety
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    });
    res.end();
    return;
  }

  try {
    const route = matchRoute(method, pathname);
    if (route === "health") {
      sendJson(res, 200, { ok: true, bridge: "lisfdc", version: VERSION });
      return;
    }
    if (route === "post_commands") {
      await handlePostCommands(req, res);
      return;
    }
    if (route === "get_pending") {
      handleGetPending(req, res);
      return;
    }
    if (route && route.kind === "post_result") {
      await handlePostResult(req, res, route.id);
      return;
    }
    if (route && route.kind === "get_command") {
      handleGetCommand(req, res, route.id);
      return;
    }
    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (e) {
    sendJson(res, 500, { ok: false, error: String(e && e.message ? e.message : e) });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[lisfdc-bridge] listening on http://${HOST}:${PORT}`);
  console.log(`[lisfdc-bridge] health: GET http://${HOST}:${PORT}/health`);
  if (!process.env.LISFDC_BRIDGE_TOKEN) {
    console.log("[lisfdc-bridge] Using token from env or .token (see above if newly generated)");
  } else {
    console.log("[lisfdc-bridge] Using LISFDC_BRIDGE_TOKEN from environment");
  }
});
