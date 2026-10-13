"use strict";

// Each site keeps its own settings: forces right-to-left on a site added through the
// popup, switches a built-in site off, and reads each one back from the other. Then
// looks at a site that was never enabled, where nothing may be marked.
//
//   node tests/live/per-site.js https://duck.ai/ https://chatgpt.com/ https://ar.wikipedia.org/

const { open, sleep } = require("./browser.js");
const { popup } = require("./popup.js");

const FIELD_DIRECTION = `
  const field = document.querySelector("textarea, [contenteditable=true]");
  return field ? getComputedStyle(field).direction : null;
`;

const MARKED = `return document.querySelectorAll("[data-rtl-chat], [data-rtl-chat-indent]").length;`;

const main = async () => {
  const [added, builtin, untouched] = process.argv.slice(2);
  if (!untouched) throw new Error("usage: per-site.js <site to add> <built-in site> <site left alone>");
  const m = await open();
  const p = popup(m);

  const visit = async (url) => {
    await m.navigate(url);
    await sleep(6000);
  };
  const state = async () => {
    await p.close();
    await p.open();
    const s = await p.state();
    return JSON.stringify({ host: s.host, status: s.status, enabled: s.enabled, mode: s.mode });
  };

  await visit(added);
  await p.click("#add");
  await p.answerPrompt("allow");
  await sleep(1500);
  await p.click('input[name="mode"][value="rtl"]');
  console.log("added site, forced right-to-left:", await state(), "field:", await m.run(FIELD_DIRECTION));

  await visit(builtin);
  console.log("built-in site, untouched so far:", await state(), "field:", await m.run(FIELD_DIRECTION));
  await p.click("#enabled");
  console.log("built-in site, switched off:", await state());

  await visit(added);
  console.log("added site, after the other was switched off:", await state(), "field:", await m.run(FIELD_DIRECTION));

  await visit(untouched);
  console.log("site never enabled:", await state(), "marked elements:", await m.run(MARKED));

  // Leave both sites the way they were found.
  await visit(builtin);
  await p.click("#enabled");
  console.log("built-in site, switched back on:", await state());
  await visit(added);
  await p.click("#remove");
  await sleep(1200);
  console.log("added site, removed:", await state());

  await p.close();
  m.close();
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
