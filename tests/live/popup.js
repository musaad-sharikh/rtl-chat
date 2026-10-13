"use strict";

// Drives the extension's real toolbar popup, and Firefox's permission prompt, through
// the browser's own UI. Needs the system access that start.js asks Firefox for.

const { sleep } = require("./browser.js");

const WIDGET = "rtl-chat_musaad-sharikh-browser-action";

// Clicks the toolbar button and resolves once the popup page has loaded.
const OPEN = `
  const done = arguments[arguments.length - 1];
  const { CustomizableUI } = ChromeUtils.importESModule("moz-src:///browser/components/customizableui/CustomizableUI.sys.mjs");
  const openBrowser = () => [...document.querySelectorAll(".webextension-popup-browser")].find(b => b.closest("panel")?.state === "open");
  (async () => {
    const placement = CustomizableUI.getPlacementOfWidget(arguments[0]);
    if (!placement || placement.area !== "nav-bar") CustomizableUI.addWidgetToArea(arguments[0], "nav-bar");
    const node = document.getElementById(arguments[0]);
    if (!node) return done({ error: "no toolbar button" });
    if (!openBrowser()) (node.querySelector(".unified-extensions-item-action-button") || node).click();
    for (let i = 0; i < 100; i++) {
      const b = openBrowser();
      if (b && b.currentURI && b.currentURI.spec.includes("popup.html") && !b.webProgress?.isLoadingDocument) {
        // The popup is preloaded in one browser and swapped into the panel.
        await new Promise(r => setTimeout(r, 700));
        return done({ ok: true });
      }
      await new Promise(r => setTimeout(r, 100));
    }
    done({ error: "popup did not open" });
  })().catch(e => done({ error: String(e) }));
`;

// Runs a function body inside the popup page and returns what it returns.
const IN_POPUP = `
  const done = arguments[arguments.length - 1];
  const b = [...document.querySelectorAll(".webextension-popup-browser")].find(x => x.closest("panel")?.state === "open");
  if (!b) return done({ error: "popup is closed" });
  const mm = b.messageManager;
  const name = "rtl-chat-live-" + Math.random();
  const onMessage = (message) => { mm.removeMessageListener(name, onMessage); done(message.data); };
  mm.addMessageListener(name, onMessage);
  const body = "(async () => { const document = content.document; try { const value = await (async () => {" + arguments[0] + "})(); sendAsyncMessage(" + JSON.stringify(name) + ", { value }); } catch (e) { sendAsyncMessage(" + JSON.stringify(name) + ", { error: String(e) }); } })();";
  mm.loadFrameScript("data:text/javascript;charset=utf-8," + encodeURIComponent(body), false);
`;

const STATE = `
  await new Promise(r => content.setTimeout(r, 400));
  const shown = (id) => !document.getElementById(id).hidden;
  return {
    dir: document.documentElement.dir,
    host: document.getElementById("host").textContent,
    status: document.getElementById("status").textContent,
    controls: shown("controls"),
    add: shown("add"),
    remove: shown("remove"),
    enabled: document.getElementById("enabled").checked,
    mode: (document.querySelector('input[name="mode"]:checked') || {}).value,
    modesDisabled: document.getElementById("modes").disabled,
  };
`;

// A click flagged as user input, the way a real one is: permissions.request refuses
// anything else.
const clickIn = (selector) => `
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) throw new Error("no such element");
  const handle = content.windowUtils.setHandlingUserInput(true);
  try { el.click(); } finally { handle.destruct(); }
  return "clicked";
`;

const CLOSE = `
  for (const b of document.querySelectorAll(".webextension-popup-browser")) {
    const panel = b.closest("panel");
    if (panel && panel.state === "open") panel.hidePopup();
  }
`;

// Waits for the permission prompt, reads it, and answers "allow" or "deny".
const PROMPT = `
  const done = arguments[arguments.length - 1];
  (async () => {
    for (let i = 0; i < 50; i++) {
      const n = PopupNotifications.panel.firstElementChild;
      if (n && PopupNotifications.panel.state === "open") {
        const permissions = [...n.querySelectorAll("li")].map(e => e.textContent.trim()).filter(Boolean);
        if (arguments[0] === "allow") n.button.click(); else n.secondaryButton.click();
        return done({ shown: true, permissions });
      }
      await new Promise(r => setTimeout(r, 100));
    }
    done({ shown: false });
  })().catch(e => done({ error: String(e) }));
`;

const popup = (m) => {
  const inChrome = async (work) => {
    await m.context("chrome");
    try {
      return await work();
    } finally {
      await m.context("content");
    }
  };

  const api = {
    open: () => inChrome(() => m.runAsync(OPEN, [WIDGET])),
    close: () => inChrome(() => m.run(CLOSE)),
    evaluate: (code) => inChrome(() => m.runAsync(IN_POPUP, [code], 8000)),
    state: async () => (await api.evaluate(STATE)).value,
    // A fresh popup for every click: the panel closes when the page is used.
    click: async (selector) => {
      await api.close();
      await sleep(300);
      const opened = await api.open();
      if (!opened.ok) throw new Error(opened.error);
      const result = await api.evaluate(clickIn(selector));
      if (result.error) throw new Error(result.error);
      await sleep(700);
    },
    answerPrompt: (action) => inChrome(() => m.runAsync(PROMPT, [action])),
  };
  return api;
};

module.exports = { popup };
