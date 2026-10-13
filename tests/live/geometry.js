"use strict";

// Compares the box, direction and alignment of every visible element on a page with
// the extension switched off and on. Anything that differs on a page with no
// conversation is the extension disturbing the site's own design.
//
//   node tests/live/geometry.js "en-US,en" https://chatgpt.com/ https://grok.com/
//
// The first argument is the language list the browser sends, so a site can be checked
// with its interface in Arabic ("ar,en-US,en"). Animated elements differ on their own;
// run a page twice before reading much into a difference.

const { open, sleep, shot, declineCookies, setLanguages } = require("./browser.js");
const { popup } = require("./popup.js");

const BOXES = `
  const out = {};
  let index = 0;
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const style = getComputedStyle(el);
    out[index++ + ":" + el.localName] = [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), style.direction, style.textAlign].join(",");
  }
  return out;
`;

const main = async () => {
  const [languages, ...urls] = process.argv.slice(2);
  const m = await open();
  const p = popup(m);
  await setLanguages(m, languages);

  for (const url of urls) {
    const host = new URL(url).hostname;
    await m.navigate(url);
    await sleep(7000);
    await declineCookies(m);
    await sleep(1500);

    await p.close();
    await p.open();
    const state = await p.state();
    if (!state.controls) {
      console.log(host, "- not active:", state.status);
      continue;
    }
    if (!state.enabled) await p.click("#enabled");

    const on = await m.run(BOXES);
    const page = await m.run(`return { dir: document.documentElement.dir, lang: document.documentElement.lang }`);
    await shot(m, `geometry-${host}-${languages.slice(0, 2)}`);
    await p.click("#enabled");
    const off = await m.run(BOXES);
    await p.click("#enabled");
    await p.close();

    const differing = [...new Set([...Object.keys(on), ...Object.keys(off)])].filter((key) => on[key] !== off[key]);
    console.log(host, JSON.stringify(page), `elements: ${Object.keys(off).length}, differ: ${differing.length}`);
    for (const key of differing.slice(0, 6)) console.log(`  ${key} off=${off[key]} on=${on[key]}`);
  }
  m.close();
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
