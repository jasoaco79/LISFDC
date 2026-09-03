#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";
import { extractLinkedIn } from "../src/content/parse-linkedin.js";
import { extractSalesforce } from "../src/content/parse-salesforce.js";
import { runHostTests } from "./hosts.test.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const failures = [];
const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8"));
assert(manifest.manifest_version === 3, "manifest v3");
assert(manifest.side_panel && manifest.side_panel.default_path, "side_panel.default_path");
assert(manifest.background && manifest.background.service_worker, "service worker");
assert(Array.isArray(manifest.content_scripts) && manifest.content_scripts.length >= 2, "content scripts");
const blob = JSON.stringify(manifest);
assert(!blob.includes("<all_urls>"), "no all_urls");
assert(!/api[_-]?key|secret|password|li_at|sid=/i.test(blob), "manifest has no secrets");
assert(
  manifest.host_permissions.every((p) => /linkedin\.com|salesforce\.com|force\.com/.test(p)),
  "host permissions limited to LinkedIn + Salesforce"
);

const hostFailures = runHostTests();
if (hostFailures.length) {
  console.error("Host / URL tests failed:");
  for (const item of hostFailures) console.error(" -", item);
  process.exit(1);
}
console.log("Host / URL / sanitize tests passed.");

async function load(rel, href) {
  const html = await readFile(path.join(root, rel), "utf8");
  const { document } = parseHTML(html);
  return { document, href };
}

const profile = extractLinkedIn(
  (await load("fixtures/linkedin-profile.html")).document,
  "https://www.linkedin.com/in/jane-example"
);
assert(profile.status === "ok", "profile status ok");
assert(profile.data.name === "Jane Example", "profile name");
assert(/VP Sales/.test(profile.data.headline), "profile headline");
assert(/Austin/.test(profile.data.location), "profile location");
assert(
  profile.data.currentCompany === "Northwind" || /Northwind/.test(profile.data.currentCompany),
  "profile company"
);
assert(Boolean(profile.data.currentRole), "profile current role present");
assert(profile.data.publicId === "jane-example", "profile public id");

const search = extractLinkedIn(
  (await load("fixtures/linkedin-search.html")).document,
  "https://www.linkedin.com/search/results/people/?keywords=sales"
);
assert(search.status === "ok", "search status ok");
assert(search.pageType === "search", "search page type");
assert(search.data.results.length === 2, "two search cards");
assert(search.data.results[0].name === "Ada Example", "first card name");
assert(/Contoso/.test(search.data.results[0].headline), "first card headline");

const company = extractLinkedIn(
  (await load("fixtures/linkedin-company.html")).document,
  "https://www.linkedin.com/company/northwind"
);
assert(company.status === "ok", "company status ok");
assert(company.data.companyName === "Northwind", "company name");

const guest = extractLinkedIn(
  (await load("fixtures/linkedin-guest.html")).document,
  "https://www.linkedin.com/login"
);
assert(guest.status === "not_signed_in", "guest / login is not_signed_in");
assert(!guest.data.name, "guest extract has no name");

const { document: emptyDoc } = parseHTML("<html><body><p>feed</p></body></html>");
const unexpected = extractLinkedIn(emptyDoc, "https://www.linkedin.com/feed/");
assert(unexpected.status === "unexpected_layout", "empty feed is unexpected_layout");

const lightning = extractSalesforce(
  (await load("fixtures/salesforce-lightning.html")).document,
  "https://acme.lightning.force.com/lightning/r/Contact/003000000000001AAA/view"
);
assert(lightning.status === "ok", "lightning status ok");
assert(lightning.data.id === "003000000000001AAA", "lightning id from URL");
assert(lightning.data.objectType === "Contact", "lightning object from URL");
assert(lightning.data.name === "Jane Example", "lightning name");
assert(
  lightning.data.headerFields.some((field) => field.label === "Title" && field.value === "VP Sales"),
  "highlight title"
);
assert(
  lightning.data.headerFields.some((field) => field.label === "Account" && field.value === "Northwind"),
  "highlight account"
);
assert(!JSON.stringify(lightning).includes("sid="), "lightning extract must not include sid cookie values");

const classic = extractSalesforce(
  (await load("fixtures/salesforce-classic.html")).document,
  "https://na1.salesforce.com/003000000000001AAA"
);
assert(classic.status === "ok", "classic status ok");
assert(classic.data.id === "003000000000001AAA", "classic id");
assert(classic.data.objectType === "Contact", "classic object from key prefix");
assert(classic.data.name === "Jane Example", "classic name");

const sfLogin = extractSalesforce(
  (await load("fixtures/salesforce-login.html")).document,
  "https://login.salesforce.com/"
);
assert(sfLogin.status === "not_signed_in", "salesforce login status");

if (failures.length) {
  console.error("Parser harness failed:");
  for (const item of failures) console.error(" -", item);
  process.exit(1);
}

console.log("Parser harness passed against LinkedIn and Salesforce fixtures.");
console.log("Sample profile:", profile.data.name, "/", profile.data.headline);
console.log("Sample Salesforce:", lightning.data.objectType, lightning.data.id, lightning.data.name);
