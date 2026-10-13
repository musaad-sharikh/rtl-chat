"use strict";

// Sends a test prompt on one real site, measures the reply, then drives the real
// popup through off, on and forced right-to-left, measuring again each time.
//
//   node tests/live/scenario.js chatgpt|gemini|perplexity
//
// SKIP_SEND=1 measures the conversation already on screen. WAIT sets how long to
// wait for the reply, in milliseconds.

const { open, shot, sleep, click, keys, declineCookies, ENTER } = require("./browser.js");
const { popup } = require("./popup.js");

const PROMPT =
  "اكتب رداً قصيراً يحتوي بالترتيب على: فقرة عربية من جملتين، ثم فقرة إنجليزية من جملة واحدة، " +
  "ثم فقرة عربية تبدأ بكلمة JavaScript، ثم قائمة مرقمة من ثلاثة عناصر بالعربي يبدأ أحدها بكلمة API، " +
  "ثم قائمة نقطية من عنصرين بالإنجليزي، ثم جدول من عمودين وصفين بالعربي، " +
  "ثم كود Python من سطرين داخل code block.";

// composer: where to type. button: the site sends with a button, not Enter.
// scope: what holds the messages. chrome: site UI that must not move.
const SITES = {
  chatgpt: { url: "https://chatgpt.com/", composer: "textarea", button: true, scope: "main li[data-message-role]", chrome: "aside p, aside a, nav a" },
  gemini: { url: "https://gemini.google.com/app", composer: ".ql-editor", scope: "user-query, message-content", chrome: "bard-sidenav li, bard-sidenav a" },
  perplexity: { url: "https://www.perplexity.ai/", composer: "#ask-input", scope: "main", chrome: "nav a, aside a" },
};

// One line per text element: tag, language of its text, computed direction, and the
// side of its box the text sits on. Plus the geometry of the site's own chrome.
const MEASURE = `
  const side = (el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const text = range.getBoundingClientRect(), box = el.getBoundingClientRect();
    if (!text.width) return "-";
    const right = box.right - text.right, left = text.left - box.left;
    return Math.abs(right - left) < 2 ? "=" : (right < left ? "R" : "L");
  };
  const rows = [];
  for (const scope of document.querySelectorAll(arguments[0])) {
    for (const el of scope.querySelectorAll("p, ol, ul, table, th, pre, :not(pre) > code")) {
      const text = (el.textContent || "").trim();
      if (!text || !el.getClientRects().length) continue;
      const letters = [...text.slice(0, 200)].filter(c => /\\p{L}/u.test(c));
      const arabic = letters.filter(c => /[\\u0590-\\u08FF]/.test(c)).length / (letters.length || 1) >= 0.3;
      rows.push([el.localName, arabic ? "AR" : "EN", getComputedStyle(el).direction, side(el)].join(":") + " " + JSON.stringify(text.slice(0, 22)));
    }
  }
  const chrome = [...document.querySelectorAll(arguments[1])].filter(e => e.getClientRects().length).map(e => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.left), Math.round(r.width), getComputedStyle(e).direction].join(",");
  });
  return { marks: document.querySelectorAll("[data-rtl-chat]").length, rows, chrome: chrome.join("|"), chromeCount: chrome.length };
`;

const COMPOSER = `
  const e = document.querySelector(arguments[0]);
  const text = (e.value ?? e.innerText ?? "").trim();
  return { typed: text.length, expected: arguments[1].length, direction: getComputedStyle(e).direction };
`;

// The site's send button: the rightmost button of the composer's box.
const PRESS_SEND = `
  let box = document.querySelector(arguments[0]), buttons = [];
  while (box && buttons.length < 2) {
    box = box.parentElement;
    buttons = [...box.querySelectorAll("button")].filter(b => b.getClientRects().length);
  }
  buttons.sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0].click();
`;

const main = async () => {
  const name = process.argv[2];
  const site = SITES[name];
  if (!site) throw new Error(`usage: scenario.js ${Object.keys(SITES).join("|")}`);

  const m = await open();
  const p = popup(m);
  const measure = async (label) => {
    const result = await m.run(MEASURE, [site.scope, site.chrome]);
    await shot(m, `${name}-${label}`);
    return result;
  };
  const print = (title, rows) => console.log(`${title}\n  ${rows.join("\n  ")}`);

  if (!process.env.SKIP_SEND) {
    await m.navigate(site.url);
    await sleep(7000);
    await declineCookies(m);
    await click(m, site.composer);
    await keys(m, PROMPT);
    await sleep(800);
    console.log("composer:", JSON.stringify(await m.run(COMPOSER, [site.composer, PROMPT])));
    await shot(m, `${name}-typed`);
    if (site.button) await m.run(PRESS_SEND, [site.composer]);
    else await keys(m, ENTER);
    await sleep(4000);
    print("while streaming:", (await m.run(MEASURE, [site.scope, site.chrome])).rows.slice(0, 6));
    await sleep(Number(process.env.WAIT || 45000));
  }

  const auto = await measure("auto");
  print(`automatic (${auto.marks} elements given a direction):`, auto.rows);

  await p.click("#enabled");
  const off = await measure("off");
  print("switched off, rows that differ from automatic:", off.rows.filter((row, i) => row !== auto.rows[i]));

  await p.click("#enabled");
  await p.click('input[name="mode"][value="rtl"]');
  const rtl = await measure("rtl");
  print("always right-to-left, rows that are not rtl:", rtl.rows.filter((row) => !/:rtl:/.test(row)));

  await p.click('input[name="mode"][value="auto"]');
  const again = await measure("auto-again");
  await p.close();

  console.log("automatic again matches the first measurement:", JSON.stringify(again.rows) === JSON.stringify(auto.rows));
  console.log(
    `site chrome identical in all four states (${auto.chromeCount} elements):`,
    [off, rtl, again].every((state) => state.chrome === auto.chrome),
  );
  m.close();
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
