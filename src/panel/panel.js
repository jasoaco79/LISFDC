const statusEl = document.getElementById("status");
const linkedinBody = document.getElementById("linkedin-body");
const salesforceBody = document.getElementById("salesforce-body");
const linkedinBadge = document.getElementById("linkedin-badge");
const salesforceBadge = document.getElementById("salesforce-badge");

const hasChrome = typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;

init();

function init() {
  document.getElementById("read-linkedin").addEventListener("click", () => extract("LISFDC_EXTRACT_LINKEDIN"));
  document.getElementById("read-salesforce").addEventListener("click", () => extract("LISFDC_EXTRACT_SALESFORCE"));
  document.getElementById("clear-extracts").addEventListener("click", clearExtracts);
  document.getElementById("nav-form").addEventListener("submit", navigateLinkedIn);

  if (hasChrome) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes.lastLinkedIn || changes.lastSalesforce) {
        loadState();
      }
    });
    loadState();
    return;
  }

  const preview = new URLSearchParams(location.search).get("preview");
  renderState(previewState(preview));
  setStatus("Fixture preview — not a live Chrome session.", "");
}

async function loadState() {
  const response = await send({ type: "LISFDC_GET_STATE" });
  if (response && response.ok) renderState(response.state);
}

async function extract(type) {
  setBusy(true);
  setStatus("Reading the current tab in this Chrome profile…", "");
  const response = await send({ type });
  setBusy(false);
  if (!response || !response.ok) {
    setStatus((response && response.message) || "Read failed.", "error");
    return;
  }
  renderState(response.state);
  const result = response.result;
  if (result && result.status === "ok") {
    setStatus("Extract stored in chrome.storage.local (this profile only).", "ok");
    return;
  }
  setStatus((result && result.warnings && result.warnings[0]) || "Read finished with a warning.", "error");
}

async function navigateLinkedIn(event) {
  event.preventDefault();
  const url = document.getElementById("nav-url").value;
  setBusy(true);
  const response = await send({ type: "LISFDC_NAVIGATE_LINKEDIN", url });
  setBusy(false);
  if (!response || !response.ok) {
    setStatus((response && response.message) || "Navigation blocked.", "error");
    return;
  }
  setStatus(`Opened in the existing LinkedIn tab: ${response.url}`, "ok");
}

async function clearExtracts() {
  const response = await send({ type: "LISFDC_CLEAR" });
  if (response && response.ok) {
    renderState(response.state);
    setStatus("Cleared last extracts from chrome.storage.local.", "ok");
  }
}

function send(message) {
  if (!hasChrome) {
    return Promise.resolve({
      ok: false,
      message: "Load LISFDC as an unpacked extension in Chrome to read live tabs.",
    });
  }
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, message: chrome.runtime.lastError.message });
        return;
      }
      resolve(response);
    });
  });
}

function renderState(state) {
  const linkedin = state && state.lastLinkedIn;
  const salesforce = state && state.lastSalesforce;
  renderExtract(linkedinBody, linkedinBadge, linkedin, "linkedin");
  renderExtract(salesforceBody, salesforceBadge, salesforce, "salesforce");
}

function renderExtract(body, badge, extract, kind) {
  if (!extract) {
    badge.textContent = "empty";
    badge.className = "badge";
    body.innerHTML = "";
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent =
      kind === "linkedin"
        ? "No LinkedIn extract yet. Open a profile, search, or company page in this Chrome profile and click Read LinkedIn tab."
        : "No Salesforce extract yet. Open a Lightning or Classic record in this Chrome profile and click Read Salesforce tab.";
    body.appendChild(p);
    return;
  }

  const status = extract.status || "unknown";
  badge.textContent = status.replace(/_/g, " ");
  badge.className = `badge ${badgeClass(status)}`;
  body.replaceChildren();

  const meta = document.createElement("p");
  meta.className = "meta";
  meta.textContent = [extract.pageType, extract.extractedAt, extract.url].filter(Boolean).join(" · ");
  body.appendChild(meta);

  const fields = document.createElement("dl");
  fields.className = "fields";
  for (const [label, value] of summaryPairs(extract)) {
    addField(fields, label, value);
  }
  body.appendChild(fields);

  const data = extract.data || {};
  if (Array.isArray(data.results) && data.results.length) {
    const list = document.createElement("ul");
    list.className = "list";
    for (const item of data.results) {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.name || "(unnamed)";
      li.appendChild(title);
      const sub = document.createElement("div");
      sub.textContent = [item.headline, item.location].filter(Boolean).join(" · ");
      li.appendChild(sub);
      list.appendChild(li);
    }
    body.appendChild(list);
  }

  if (Array.isArray(data.headerFields) && data.headerFields.length) {
    const extra = document.createElement("dl");
    extra.className = "fields";
    for (const field of data.headerFields) {
      addField(extra, field.label, field.value);
    }
    body.appendChild(extra);
  }

  if (Array.isArray(extract.warnings) && extract.warnings.length) {
    for (const warning of extract.warnings) {
      const box = document.createElement("p");
      box.className = "warning";
      box.textContent = warning;
      body.appendChild(box);
    }
  }

  const details = document.createElement("details");
  details.className = "json";
  const summary = document.createElement("summary");
  summary.textContent = "Structured JSON";
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(extract, null, 2);
  details.append(summary, pre);
  body.appendChild(details);
}

function summaryPairs(extract) {
  const data = extract.data || {};
  const pairs = [];
  const add = (label, value) => {
    if (value) pairs.push([label, value]);
  };
  add("Name", data.name);
  add("Headline", data.headline);
  add("Location", data.location);
  add("Current role", data.currentRole);
  add("Current company", data.currentCompany);
  add("Company", data.companyName);
  add("Industry", data.industry);
  add("Public id", data.publicId);
  add("Object", data.objectType);
  add("Record Id", data.id);
  add("UI", data.ui);
  add("Visible results", data.resultCount != null ? String(data.resultCount) : "");
  return pairs;
}

function addField(dl, label, value) {
  const wrap = document.createElement("div");
  const dt = document.createElement("dt");
  dt.textContent = label;
  const dd = document.createElement("dd");
  dd.textContent = value;
  wrap.append(dt, dd);
  dl.appendChild(wrap);
}

function badgeClass(status) {
  if (status === "ok") return "ok";
  if (status === "not_signed_in" || status === "unexpected_layout") return "err";
  return "warn";
}

function setStatus(text, kind) {
  statusEl.textContent = text || "";
  statusEl.className = `status ${kind || ""}`;
}

function setBusy(busy) {
  for (const id of ["read-linkedin", "read-salesforce", "clear-extracts"]) {
    document.getElementById(id).disabled = busy;
  }
  document.querySelector("#nav-form button").disabled = busy;
}

function previewState(kind) {
  if (kind === "empty") {
    return { lastLinkedIn: null, lastSalesforce: null };
  }
  if (kind === "unsigned") {
    return {
      lastLinkedIn: {
        source: "linkedin",
        status: "not_signed_in",
        pageType: "other",
        url: "https://www.linkedin.com/login",
        extractedAt: "2026-09-03T02:40:00.000Z",
        data: {},
        warnings: [
          "This tab looks like a sign-in, guest, or auth-wall page. Stay in your logged-in Chrome profile and open a LinkedIn page you can already see.",
        ],
      },
      lastSalesforce: {
        source: "salesforce",
        status: "not_signed_in",
        pageType: "login",
        url: "https://login.salesforce.com/",
        extractedAt: "2026-09-03T02:40:00.000Z",
        data: {},
        warnings: [
          "This tab looks like a Salesforce login page. Stay in your logged-in Chrome profile and open a record you can already see.",
        ],
      },
    };
  }
  return {
    lastLinkedIn: {
      source: "linkedin",
      status: "ok",
      pageType: "profile",
      url: "https://www.linkedin.com/in/jane-example",
      extractedAt: "2026-09-03T02:41:00.000Z",
      data: {
        pageType: "profile",
        name: "Jane Example",
        headline: "VP Sales at Northwind",
        location: "Austin, Texas, United States",
        currentRole: "VP Sales",
        currentCompany: "Northwind",
        publicId: "jane-example",
        about: "Enterprise sales leader focused on mid-market CRM rollouts.",
      },
      warnings: [],
    },
    lastSalesforce: {
      source: "salesforce",
      status: "ok",
      pageType: "record",
      url: "https://example.lightning.force.com/lightning/r/Contact/003000000000001AAA/view",
      extractedAt: "2026-09-03T02:41:10.000Z",
      data: {
        ui: "lightning",
        objectType: "Contact",
        id: "003000000000001AAA",
        name: "Jane Example",
        headerFields: [
          { label: "Title", value: "VP Sales" },
          { label: "Account", value: "Northwind" },
          { label: "Email", value: "jane@example.com" },
          { label: "Phone", value: "(512) 555-0100" },
        ],
      },
      warnings: [],
    },
  };
}
