import { describeTabKind, isLinkedInHost, isSalesforceHost, normalizeLinkedInNavUrl } from "../src/hosts.js";
import { objectFromKeyPrefix, parseSalesforceUrl } from "../src/content/parse-salesforce.js";
import { classifyPage, detectAuthState, __test as liTest } from "../src/content/parse-linkedin.js";
import { isSensitiveLabel, looksLikeSessionSecret, scrubExtract } from "../src/shared/sanitize.js";

const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

export function runHostTests() {
  failures.length = 0;

  assert(isLinkedInHost("linkedin.com"), "bare linkedin.com is allowed");
  assert(isLinkedInHost("www.linkedin.com"), "www.linkedin.com is allowed");
  assert(isLinkedInHost("www.linkedin.com."), "trailing-dot host is allowed");
  assert(!isLinkedInHost("evil-linkedin.com"), "suffix spoof is rejected");
  assert(!isLinkedInHost("example.com"), "unrelated host is rejected");

  assert(isSalesforceHost("acme.lightning.force.com"), "lightning host");
  assert(isSalesforceHost("acme.my.salesforce.com"), "my.salesforce.com host");
  assert(isSalesforceHost("na1.salesforce.com"), "classic pod host");
  assert(isSalesforceHost("acme.force.com"), "force.com host");
  assert(!isSalesforceHost("force.com.evil.example"), "suffix spoof salesforce rejected");

  assert(describeTabKind("https://www.linkedin.com/in/x") === "linkedin", "tab kind linkedin");
  assert(describeTabKind("https://acme.lightning.force.com/lightning/r/Contact/003xx/view") === "salesforce", "tab kind sf");
  assert(describeTabKind("https://example.com") === "other", "tab kind other");

  const good = normalizeLinkedInNavUrl("www.linkedin.com/in/jane-example");
  assert(good.ok && good.url === "https://www.linkedin.com/in/jane-example", "nav prepends https");

  const salesNav = normalizeLinkedInNavUrl("https://www.linkedin.com/sales/search/people?query=vp");
  assert(salesNav.ok, "sales navigator search URL allowed");

  assert(!normalizeLinkedInNavUrl("https://example.com/in/x").ok, "non-linkedin nav rejected");
  assert(!normalizeLinkedInNavUrl("javascript:alert(1)").ok, "javascript URL rejected");
  assert(!normalizeLinkedInNavUrl("https://user:pass@www.linkedin.com/in/x").ok, "credentials in URL rejected");
  assert(!normalizeLinkedInNavUrl("http://www.linkedin.com/in/x").ok, "http rejected");
  assert(!normalizeLinkedInNavUrl("").ok, "empty rejected");

  const lightning = parseSalesforceUrl(
    "https://acme.lightning.force.com/lightning/r/Contact/003000000000001AAA/view"
  );
  assert(lightning.id === "003000000000001AAA", "lightning id");
  assert(lightning.objectApiName === "Contact", "lightning object");
  assert(lightning.ui === "lightning", "lightning ui");

  const custom = parseSalesforceUrl(
    "https://acme.lightning.force.com/lightning/r/Widget__c/a00000000000001AAA/view"
  );
  assert(custom.objectApiName === "Widget__c", "custom object from URL, not CSS");

  const classic = parseSalesforceUrl("https://na1.salesforce.com/003000000000001AAA");
  assert(classic.id === "003000000000001AAA" && classic.objectApiName === "Contact", "classic id + prefix");

  const login = parseSalesforceUrl("https://login.salesforce.com/");
  assert(login.pageKind === "login", "login.salesforce.com classified");

  assert(objectFromKeyPrefix("006000000000001AAA") === "Opportunity", "opp prefix");
  assert(objectFromKeyPrefix("00Q000000000001AAA") === "Lead", "lead prefix");

  assert(classifyPage("https://www.linkedin.com/in/jane", null) === "profile", "classify profile");
  assert(classifyPage("https://www.linkedin.com/company/northwind", null) === "company", "classify company");
  assert(classifyPage("https://www.linkedin.com/search/results/people/", null) === "search", "classify search");
  assert(classifyPage("https://www.linkedin.com/sales/people/ACw123", null) === "profile", "sales nav people");

  assert(liTest.publicIdFromUrl("https://www.linkedin.com/in/jane-example/") === "jane-example", "public id");
  assert(liTest.splitHeadline("VP Sales at Northwind").company === "Northwind", "headline split");

  const guestDoc = { title: "Sign in | LinkedIn", querySelector: () => null, body: null };
  assert(detectAuthState(guestDoc, "https://www.linkedin.com/login") === "not_signed_in", "login URL is not signed in");

  assert(looksLikeSessionSecret("sid=00Dxx0000001gFE!AQcAQH0.this.must.not.be.stored"), "sid cookie detected");
  assert(isSensitiveLabel("Session cookie"), "session label detected");
  assert(!looksLikeSessionSecret("003000000000001AAA"), "record id is not a secret");

  const scrubbed = scrubExtract({
    name: "Jane",
    sid: "00Dxx0000001gFE!secret",
    cookie: "li_at=abc",
    headerFields: [{ label: "Session cookie", value: "sid=nope" }, { label: "Title", value: "VP" }],
  });
  assert(scrubbed.sid === "[redacted]", "sid key redacted");
  assert(scrubbed.cookie === "[redacted]", "cookie key redacted");
  assert(scrubbed.headerFields[0].value === "[redacted]", "sid-shaped header value redacted");
  assert(scrubbed.headerFields[1].value === "VP", "normal header kept");

  return failures;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const list = runHostTests();
  if (list.length) {
    console.error("hosts tests failed:\n - " + list.join("\n - "));
    process.exit(1);
  }
  console.log("hosts tests passed");
}
