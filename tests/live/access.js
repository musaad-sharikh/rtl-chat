"use strict";

// Where a site's access comes from, and what happens when it changes outside the
// popup. Access is given and taken away with the real switches on the extension's
// Permissions tab in about:addons; sites are added and removed through the real popup.
//
//   node tests/live/access.js https://duck.ai/ https://ar.wikipedia.org/ https://chatgpt.com/
//
// The first site is added by hand, the second is never added, the third is built in.

const { open, sleep } = require("./browser.js");
const { popup } = require("./popup.js");

const ID = "rtl-chat@musaad-sharikh";
const ALL = "*://*/*";

// What the extension is doing to the page in front.
const PAGE = `
  const field = document.querySelector("textarea, [contenteditable=true]");
  return {
    on: document.documentElement.hasAttribute("data-rtl-chat-on"),
    marked: document.querySelectorAll("[data-rtl-chat], [data-rtl-chat-indent]").length,
    field: field ? getComputedStyle(field).direction : null,
  };
`;

// Sets one switch on the Permissions tab and reads all of them back.
const SWITCH = `
  const done = arguments[arguments.length - 1];
  const [id, key, wanted] = arguments;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  (async () => {
    const win = window.wrappedJSObject || window;
    await win.gViewController.loadView("addons://detail/" + encodeURIComponent(id) + "/permissions");
    await wait(1200);
    const switches = () => [...document.querySelectorAll("addon-permissions-list moz-toggle")];
    const target = switches().find((s) => s.getAttribute("permission-key") === key);
    if (!target) return done({ error: "no switch for " + key, switches: switches().map((s) => s.getAttribute("permission-key")) });
    if (target.pressed !== wanted) (target.buttonEl || target).click();
    await wait(1500);
    done({ switches: Object.fromEntries(switches().map((s) => [s.getAttribute("permission-key"), s.pressed])) });
  })().catch((error) => done({ error: String(error) }));
`;

const main = async () => {
  const [added, other, builtin] = process.argv.slice(2);
  if (!builtin) throw new Error("usage: access.js <site to add> <site never added> <built-in site>");
  const m = await open();
  const p = popup(m);

  const visit = async (url) => {
    await m.navigate(url);
    await sleep(6000);
  };
  const page = async () => JSON.stringify(await m.run(PAGE));
  const state = async () => {
    await p.close();
    await p.open();
    const s = await p.state();
    await p.close();
    return JSON.stringify({ status: s.status, controls: s.controls, add: s.add, remove: s.remove, enabled: s.enabled, mode: s.mode });
  };
  // In a tab of its own, so the page under test stays open and is not reloaded.
  const setSwitch = async (key, wanted) => {
    const { value: home } = await m.send("WebDriver:GetWindowHandle");
    const { handle } = await m.send("WebDriver:NewWindow", { type: "tab" });
    await m.send("WebDriver:SwitchToWindow", { handle });
    try {
      await m.navigate("about:addons");
      await sleep(1500);
      return JSON.stringify(await m.runAsync(SWITCH, [ID, key, wanted]));
    } finally {
      await m.send("WebDriver:CloseWindow");
      await m.send("WebDriver:SwitchToWindow", { handle: home });
      await sleep(1500);
    }
  };
  const originOf = (url) => `${new URL(url).protocol}//${new URL(url).hostname}/*`;

  console.log("== a site added by hand");
  await visit(added);
  await p.click("#add");
  await p.answerPrompt("allow");
  await sleep(1500);
  await p.click('input[name="mode"][value="rtl"]');
  console.log("added and forced right-to-left:", await state(), await page());

  console.log("== its access taken away in about:addons, the tab left open");
  console.log("switch off:", await setSwitch(originOf(added), false));
  console.log("same tab, not reloaded:", await state(), await page());

  console.log("== access given back through the popup");
  await p.click("#add");
  await p.answerPrompt("allow");
  await sleep(1500);
  console.log("same tab, not reloaded:", await state(), await page());

  console.log("== all websites switched on in about:addons");
  console.log("switch on:", await setSwitch(ALL, true));
  console.log("added site:", await state(), await page());
  await visit(other);
  console.log("site never added:", await state(), await page());
  await p.click("#enabled");
  console.log("site never added, switched off there:", await state(), await page());
  await visit(added);
  console.log("added site, after the other was switched off:", await state(), await page());
  await visit(builtin);
  console.log("built-in site:", await state(), await page());

  console.log("== the added site removed while all websites is on");
  await visit(added);
  await p.click("#remove");
  await sleep(1500);
  console.log("same tab, not reloaded:", await state(), await page());

  console.log("== all websites switched off again, a tab left open");
  await visit(other);
  await p.click("#enabled");
  console.log("site never added, switched back on:", await state(), await page());
  console.log("switch off:", await setSwitch(ALL, false));
  console.log("same tab, not reloaded:", await state(), await page());
  await visit(added);
  console.log("site that was removed:", await state(), await page());

  console.log("== a built-in site's access taken away and given back, the tab left open");
  await visit(builtin);
  console.log("before:", await state(), await page());
  console.log("switch off:", await setSwitch(originOf(builtin), false));
  console.log("same tab, not reloaded:", await state(), await page());
  await p.click("#add");
  await p.answerPrompt("allow");
  await sleep(1500);
  console.log("given back through the popup:", await state(), await page());

  await p.close();
  m.close();
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
