"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
require(path.join(root, "src/sites.js"));
const R = require(path.join(root, "src/direction.js"));

const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("normalizeSettings falls back to no site modes and nothing disabled", () => {
  const fallback = { modes: {}, disabled: [] };
  assert.deepEqual(R.normalizeSettings(undefined), fallback);
  assert.deepEqual(R.normalizeSettings(null), fallback);
  assert.deepEqual(R.normalizeSettings({}), fallback);
  assert.deepEqual(R.normalizeSettings({ modes: "sideways", disabled: "claude.ai" }), fallback);
  assert.deepEqual(R.normalizeSettings({ modes: ["rtl"], disabled: [] }), fallback);
  assert.deepEqual(
    R.normalizeSettings({ modes: { "claude.ai": "sideways", "chatgpt.com": 7 }, disabled: [1, null, "claude.ai"] }),
    { modes: {}, disabled: ["claude.ai"] },
  );
});

test("normalizeSettings keeps valid values", () => {
  assert.deepEqual(R.normalizeSettings({ modes: { "claude.ai": "rtl" }, disabled: ["chatgpt.com"] }), {
    modes: { "claude.ai": "rtl" },
    disabled: ["chatgpt.com"],
  });
});

test("modeFor gives each site its own mode, automatic unless it chose another", () => {
  const settings = R.normalizeSettings({ modes: { "claude.ai": "rtl" } });
  assert.equal(R.modeFor(settings, "claude.ai"), "rtl");
  assert.equal(R.modeFor(settings, "chatgpt.com"), "auto");
  assert.equal(R.modeFor(settings, "constructor"), "auto");
});

test("accessKind tells a site the user added from one a wider grant covers", () => {
  assert.equal(R.accessKind({ builtin: true, granted: true, own: true }), "builtin");
  assert.equal(R.accessKind({ builtin: true, granted: true, own: false }), "builtin");
  assert.equal(R.accessKind({ builtin: true, granted: false, own: false }), "revoked");
  assert.equal(R.accessKind({ builtin: false, granted: true, own: true }), "added");
  assert.equal(R.accessKind({ builtin: false, granted: true, own: false }), "wide");
  assert.equal(R.accessKind({ builtin: false, granted: false, own: false }), "none");
});

test("every stylesheet applies only under the root's attribute", () => {
  for (const site of [R.findSite("chatgpt.com"), R.GENERIC_SITE]) {
    for (const mode of ["auto", "rtl"]) {
      for (const sheet of R.buildSheets(site, mode, "abc")) {
        assert.ok(sheet.css.startsWith(':root[data-rtl-chat-on="abc"]'), `${site.id} ${mode} ${sheet.origin}`);
      }
    }
  }
  const [author] = R.buildSheets(R.GENERIC_SITE, "rtl", "abc");
  assert.match(author.css, /^:root\[data-rtl-chat-on="abc"\] \{\n[\s\S]*\n\}$/);
  assert.notEqual(author.css, R.buildSheets(R.GENERIC_SITE, "rtl", "xyz")[0].css);
});

test("isEnabled is false only for a disabled host", () => {
  const settings = R.normalizeSettings({ disabled: ["claude.ai"] });
  assert.equal(R.isEnabled(settings, "claude.ai"), false);
  assert.equal(R.isEnabled(settings, "chatgpt.com"), true);
});

test("findSite matches a host, a subdomain, and falls back to the generic site", () => {
  assert.equal(R.findSite("chatgpt.com").id, "chatgpt");
  assert.equal(R.findSite("claude.ai").id, "claude");
  assert.equal(R.findSite("www.claude.ai").id, "claude");
  assert.equal(R.findSite("example.com"), R.GENERIC_SITE);
  assert.equal(R.findSite("notchatgpt.com"), R.GENERIC_SITE);
  assert.equal(R.findSite("google.com"), R.GENERIC_SITE);
});

test("there are two built-in sites and each has the full shape", () => {
  assert.equal(R.SITES.length, 2);
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
  assert.match(sheets[1].css, /^:root\[data-rtl-chat-on=""\] li.*text-align:\s*start;/);
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

test("the content script files are the same list everywhere they are given", () => {
  const manifest = readJson("manifest.json");
  assert.deepEqual(manifest.content_scripts[0].js, R.CONTENT_FILES);
  // The background and the popup need sites.js and direction.js, in that order, first.
  assert.deepEqual(manifest.background.scripts.slice(0, 2), R.CONTENT_FILES.slice(0, 2));
  const html = fs.readFileSync(path.join(root, "src/popup/popup.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => path.posix.join("src/popup", m[1]));
  assert.deepEqual(scripts.slice(0, 2), R.CONTENT_FILES.slice(0, 2));
});

// background.js, loaded the way Firefox loads it, against a stand-in for the APIs it uses.
const loadBackground = (granted) => {
  const vm = require("node:vm");
  const listeners = {};
  const on = (name) => ({ addListener: (fn) => (listeners[name] = fn) });
  const calls = [];
  // Values from the script's own realm, made comparable with deepEqual.
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const record = (entry) => calls.push(plain(entry));
  let registered = [];
  const browser = {
    runtime: { onMessage: on("message"), onInstalled: on("installed"), onStartup: on("startup") },
    permissions: {
      onAdded: on("added"),
      onRemoved: on("removed"),
      getAll: async () => ({ origins: [...granted.origins] }),
      contains: async ({ origins }) => origins.every((o) => granted.origins.includes(o)),
    },
    scripting: {
      getRegisteredContentScripts: async ({ ids }) => registered.filter((s) => ids.includes(s.id)),
      registerContentScripts: async (scripts) => {
        record(["register", scripts]);
        registered = plain(scripts);
      },
      updateContentScripts: async (scripts) => {
        record(["update", scripts]);
        registered = plain(scripts);
      },
      unregisterContentScripts: async ({ ids }) => {
        record(["unregister", ids]);
        registered = registered.filter((s) => !ids.includes(s.id));
      },
      insertCSS: async (details) => record(["insertCSS", details]),
      removeCSS: async (details) => record(["removeCSS", details]),
      executeScript: async (details) => record(["executeScript", details]),
    },
    tabs: {
      query: async () => [{ id: 7 }],
      sendMessage: async (tabId, message) => record(["sendMessage", tabId, message]),
    },
  };
  const context = vm.createContext({ browser, console, URL });
  for (const file of readJson("manifest.json").background.scripts) {
    vm.runInContext(fs.readFileSync(path.join(root, file), "utf8"), context, { filename: file });
  }
  const settled = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { listeners, calls, settled, registered: () => registered };
};

test("background keeps one content script registered on the sites the user added", async () => {
  const manifest = readJson("manifest.json");
  const granted = { origins: [...manifest.host_permissions] };
  const bg = loadBackground(granted);

  bg.listeners.installed();
  await bg.settled();
  assert.deepEqual(bg.calls, [], "nothing to register for the built-in sites alone");

  granted.origins.push("https://example.com/*");
  bg.listeners.added({ origins: ["https://example.com/*"] });
  await bg.settled();
  assert.equal(bg.registered().length, 1);
  assert.deepEqual(bg.registered()[0].matches, ["https://example.com/*"]);
  assert.deepEqual(bg.registered()[0].js, R.CONTENT_FILES);
  assert.ok(bg.calls.some(([kind, d]) => kind === "executeScript" && d.target.tabId === 7), "open tabs get the script");

  granted.origins.push("*://*/*");
  bg.listeners.added({ origins: ["*://*/*"] });
  await bg.settled();
  assert.deepEqual(bg.registered()[0].matches, ["https://example.com/*", "*://*/*"]);
  assert.ok(bg.calls.some(([kind]) => kind === "update"));

  granted.origins = [...manifest.host_permissions];
  bg.listeners.removed({ origins: ["https://example.com/*", "*://*/*"] });
  await bg.settled();
  assert.deepEqual(bg.registered(), []);
  assert.ok(bg.calls.some(([kind, tabId, m]) => kind === "sendMessage" && tabId === 7 && m.type === "rtl-chat:access-changed"));
});

test("background answers only content scripts, and inserts CSS into the frame that asked", async () => {
  const bg = loadBackground({ origins: ["https://chatgpt.com/*"] });
  const onMessage = bg.listeners.message;
  const css = { type: "rtl-chat:css", remove: [{ css: "a{}", origin: "AUTHOR" }], insert: [{ css: "b{}", origin: "USER" }] };

  assert.equal(onMessage(css, {}), undefined, "a sender without a tab is ignored");
  assert.equal(onMessage(null, { tab: { id: 1 } }), undefined);
  assert.equal(onMessage({ type: "other" }, { tab: { id: 1 } }), undefined);

  await onMessage(css, { tab: { id: 3 }, frameId: 0 });
  const target = { tabId: 3, frameIds: [0] };
  assert.deepEqual(bg.calls, [
    ["removeCSS", { target, css: "a{}", origin: "AUTHOR" }],
    ["insertCSS", { target, css: "b{}", origin: "USER" }],
  ]);

  const ask = { type: "rtl-chat:has-access" };
  assert.equal(await onMessage(ask, { tab: { id: 3 }, url: "https://chatgpt.com/c/1" }), true);
  assert.equal(await onMessage(ask, { tab: { id: 3 }, url: "https://example.com/" }), false);
  assert.equal(await onMessage(ask, { tab: { id: 3 }, url: "about:blank" }), false);
});
