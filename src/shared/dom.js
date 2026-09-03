/** Small DOM helpers shared by the in-page readers. */

export function visibleText(node) {
  if (!node) return "";
  const text = (node.innerText || node.textContent || "").replace(/\s+/g, " ").trim();
  return text;
}

export function firstMatching(doc, selectors) {
  for (const selector of selectors) {
    try {
      const node = doc.querySelector(selector);
      if (!node) continue;
      const text = visibleText(node);
      if (text) return { node, text, selector };
    } catch {
      /* invalid selector in this document */
    }
  }
  return null;
}

export function firstText(doc, selectors) {
  const hit = firstMatching(doc, selectors);
  return hit ? hit.text : "";
}

export function allTexts(doc, selectors, limit = 30) {
  const seen = new Set();
  const out = [];
  for (const selector of selectors) {
    let nodes;
    try {
      nodes = doc.querySelectorAll(selector);
    } catch {
      continue;
    }
    for (const node of nodes) {
      const text = visibleText(node);
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push({ text, selector });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function metaContent(doc, selector) {
  const node = doc.querySelector(selector);
  return node ? (node.getAttribute("content") || "").trim() : "";
}

export function parseJsonLd(doc) {
  const blocks = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = (script.textContent || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      /* ignore broken JSON-LD */
    }
  }
  return blocks;
}

export function flattenJsonLd(blocks) {
  const out = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    out.push(block);
    if (Array.isArray(block["@graph"])) {
      for (const item of block["@graph"]) {
        if (item && typeof item === "object") out.push(item);
      }
    }
  }
  return out;
}

export function typeIncludes(node, typeName) {
  const t = node && node["@type"];
  if (!t) return false;
  const list = Array.isArray(t) ? t : [t];
  return list.some((item) => String(item).toLowerCase() === String(typeName).toLowerCase());
}
