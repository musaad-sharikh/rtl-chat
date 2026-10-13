"use strict";

// The "any other site" flow on a site outside the built-in ones, through the real
// popup and Firefox's real permission prompt: refuse, grant, use, remove.
//
//   node tests/live/permission.js https://duck.ai/

const { open, sleep } = require("./browser.js");
const { popup } = require("./popup.js");

const FIELD_DIRECTION = `
  const field = document.querySelector("textarea, [contenteditable=true]");
  return field ? getComputedStyle(field).direction : null;
`;

const main = async () => {
  const url = process.argv[2];
  const m = await open();
  const p = popup(m);

  const report = async (label) => {
    await p.close();
    await p.open();
    const s = await p.state();
    console.log(label, JSON.stringify({ host: s.host, status: s.status, controls: s.controls, add: s.add, remove: s.remove }));
  };
  const reload = async () => {
    await m.navigate(url);
    await sleep(5000);
  };

  await reload();
  await report("before:");

  await p.click("#add");
  console.log("prompt, refused:", JSON.stringify(await p.answerPrompt("deny")));
  await sleep(800);
  await report("after refusing:");

  await p.click("#add");
  console.log("prompt, allowed:", JSON.stringify(await p.answerPrompt("allow")));
  await sleep(1500);
  await report("after allowing:");

  // Forced right-to-left shows on an empty field, so it tells whether the content
  // script is running: in the tab that was already open, after a reload, and no
  // longer once the site is removed.
  await p.click('input[name="mode"][value="rtl"]');
  console.log("field direction, tab that was open:", await m.run(FIELD_DIRECTION));
  await reload();
  console.log("field direction, after a reload:", await m.run(FIELD_DIRECTION));

  await p.click("#remove");
  await sleep(1200);
  await report("after removing:");
  console.log("field direction, removed:", await m.run(FIELD_DIRECTION));
  await reload();
  console.log("field direction, removed and reloaded:", await m.run(FIELD_DIRECTION));

  // The mode is one setting for every site: put it back before leaving.
  await p.click("#add");
  await p.answerPrompt("allow");
  await sleep(1500);
  await p.click('input[name="mode"][value="auto"]');
  await p.click("#remove");
  await sleep(800);

  await p.close();
  m.close();
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
