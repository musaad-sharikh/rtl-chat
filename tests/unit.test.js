"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
require(path.join(root, "src/sites.js"));
const R = require(path.join(root, "src/direction.js"));

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("normalizeSettings falls back to auto mode with nothing disabled", () => {
  const fallback = { mode: "auto", disabled: [] };
  assert.deepEqual(R.normalizeSettings(undefined), fallback);
  assert.deepEqual(R.normalizeSettings(null), fallback);
  assert.deepEqual(R.normalizeSettings({}), fallback);
  assert.deepEqual(R.normalizeSettings({ mode: "sideways", disabled: "claude.ai" }), fallback);
  assert.deepEqual(R.normalizeSettings({ mode: 7, disabled: [1, null, "claude.ai"] }), {
    mode: "auto",
    disabled: ["claude.ai"],
  });
});

test("normalizeSettings keeps valid values", () => {
  assert.deepEqual(R.normalizeSettings({ mode: "rtl", disabled: ["chatgpt.com"] }), {
    mode: "rtl",
    disabled: ["chatgpt.com"],
  });
});

test("isEnabled is false only for a disabled host", () => {
  const settings = R.normalizeSettings({ disabled: ["claude.ai"] });
  assert.equal(R.isEnabled(settings, "claude.ai"), false);
  assert.equal(R.isEnabled(settings, "chatgpt.com"), true);
});

test("findSite matches a host, a subdomain, and falls back to the generic site", () => {
  assert.equal(R.findSite("chatgpt.com").id, "chatgpt");
  assert.equal(R.findSite("gemini.google.com").id, "gemini");
  assert.equal(R.findSite("www.perplexity.ai").id, "perplexity");
  assert.equal(R.findSite("example.com"), R.GENERIC_SITE);
  assert.equal(R.findSite("notchatgpt.com"), R.GENERIC_SITE);
  assert.equal(R.findSite("google.com"), R.GENERIC_SITE);
});

test("there are ten built-in sites and each has the full shape", () => {
  assert.equal(R.SITES.length, 10);
  for (const site of R.SITES) {
    assert.equal(typeof site.id, "string");
    assert.equal(typeof site.name, "string");
    assert.ok(site.hosts.length > 0, site.id);
    for (const key of ["text", "input", "exclude"]) {
      assert.ok(Array.isArray(site[key]), `${site.id}.${key}`);
    }
  }
});

test("originPattern only accepts http and https pages", () => {
  assert.equal(R.originPattern("https://example.com/chat/1?x=2"), "https://example.com/*");
  assert.equal(R.originPattern("http://localhost:3000/"), "http://localhost/*");
  assert.equal(R.originPattern("about:debugging"), null);
  assert.equal(R.originPattern("moz-extension://abc/popup.html"), null);
  assert.equal(R.originPattern("file:///tmp/a.html"), null);
  assert.equal(R.originPattern(undefined), null);
  assert.equal(R.originPattern("not a url"), null);
});

test("customOrigins drops the built-in sites and keeps the rest", () => {
  const manifest = readJson("manifest.json");
  const granted = [...manifest.host_permissions, "https://example.com/*", "*://*.example.org/*"];
  assert.deepEqual(R.customOrigins(granted), ["https://example.com/*", "*://*.example.org/*"]);
  assert.deepEqual(R.customOrigins([]), []);
  assert.deepEqual(R.customOrigins(undefined), []);
});

test("manifest hosts and sites.js hosts are the same set", () => {
  const manifest = readJson("manifest.json");
  const fromManifest = manifest.host_permissions.map((p) => new URL(p.replace("/*", "/")).hostname);
  assert.deepEqual([...fromManifest].sort(), [...R.builtinHosts()].sort());
  assert.deepEqual(manifest.content_scripts[0].matches, manifest.host_permissions);
});

test("detectDirection goes by the share of right-to-left letters, not the first one", () => {
  assert.equal(R.detectDirection("هذه فقرة عربية"), "rtl");
  assert.equal(R.detectDirection("An English paragraph"), "ltr");
  assert.equal(R.detectDirection("JavaScript هي لغة برمجة"), "rtl");
  assert.equal(R.detectDirection("API واجهة"), "rtl");
  assert.equal(R.detectDirection("The word مرحبا means hello"), "ltr");
  assert.equal(R.detectDirection("שלום עולם"), "rtl");
  assert.equal(R.detectDirection("سلام دنیا"), "rtl");
});

test("detectDirection has no opinion on text without letters", () => {
  for (const text of ["", "   ", "123", "12.5%", "… — !", null, undefined]) {
    assert.equal(R.detectDirection(text), null, JSON.stringify(text));
  }
});

test("buildCss in auto mode sets no direction of its own and keeps code LTR", () => {
  const css = R.buildCss(R.findSite("chatgpt.com"), "auto");
  assert.doesNotMatch(css, /direction:\s*rtl/);
  assert.doesNotMatch(css, /unicode-bidi:\s*plaintext/);
  assert.match(css, /pre[^{]*\{[^}]*direction:\s*ltr/);
});

test("buildCss in rtl mode forces direction and still keeps code LTR", () => {
  const css = R.buildCss(R.GENERIC_SITE, "rtl");
  assert.match(css, /direction:\s*rtl/);
  assert.match(css, /pre[^{]*\{[^}]*direction:\s*ltr/);
});

test("buildCss carries the site's own text and exclude selectors", () => {
  const site = { id: "x", name: "X", hosts: [], text: [".bubble"], input: [], exclude: ["side-bar"] };
  assert.match(R.buildCss(site, "rtl"), /\.bubble/);
  for (const mode of ["auto", "rtl"]) assert.match(R.buildCss(site, mode), /side-bar/, mode);
});

test("buildCss leaves labelled lists alone when it forces a direction", () => {
  assert.match(R.buildCss(R.GENERIC_SITE, "rtl"), /:is\(ul, ol\)\[aria-label\]/);
});

test("the list-item alignment goes in under the user origin, without !important", () => {
  const sheets = R.buildSheets(R.findSite("chatgpt.com"), "auto");
  assert.deepEqual(sheets.map((sheet) => sheet.origin), ["AUTHOR", "USER"]);
  assert.match(sheets[1].css, /^li.*text-align:\s*start;/);
  assert.doesNotMatch(sheets[1].css, /!important/);
  assert.doesNotMatch(sheets[0].css, /\bli:not[^{]*\{\s*text-align/);
});

test("both locales define the same keys, each with a message", () => {
  const en = readJson("_locales/en/messages.json");
  const ar = readJson("_locales/ar/messages.json");
  assert.deepEqual(Object.keys(ar).sort(), Object.keys(en).sort());
  for (const locale of [en, ar]) {
    for (const [key, entry] of Object.entries(locale)) {
      assert.ok(entry.message && entry.message.trim(), key);
    }
  }
});

test("every string the popup and the manifest reference exists", () => {
  const en = readJson("_locales/en/messages.json");
  const html = fs.readFileSync(path.join(root, "src/popup/popup.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "src/popup/popup.js"), "utf8");
  const manifest = fs.readFileSync(path.join(root, "manifest.json"), "utf8");
  const keys = new Set();
  for (const m of html.matchAll(/data-i18n="([^"]+)"/g)) keys.add(m[1]);
  for (const m of js.matchAll(/\bt\("([^"]+)"/g)) keys.add(m[1]);
  for (const m of manifest.matchAll(/__MSG_([A-Za-z0-9_]+)__/g)) keys.add(m[1]);
  assert.ok(keys.size > 0);
  for (const key of keys) assert.ok(en[key], `missing message: ${key}`);
});
