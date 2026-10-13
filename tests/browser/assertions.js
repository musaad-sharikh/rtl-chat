"use strict";

// Runs the real content script in a real Firefox against fixture.html, with the
// extension APIs replaced by a small stand-in, and measures the resulting layout.

const results = [];
const check = (name, pass, detail = "") => results.push({ name, pass: Boolean(pass), detail: String(detail) });
const $ = (id) => document.getElementById(id);
const direction = (el) => getComputedStyle(el).direction;

// Which edge of its box an element's text sits against.
const textSide = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const text = range.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  return box.right - text.right < text.left - box.left ? "right" : "left";
};

const frames = async (count = 3) => {
  for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

// --- Stand-in for the extension APIs the content script uses ---------------

const store = {};
const storageListeners = new Set();
const messageListeners = new Set();
const styles = new Map();

globalThis.browser = {
  storage: {
    sync: {
      get: async () => ({ ...store }),
    },
    onChanged: {
      addListener: (fn) => storageListeners.add(fn),
      removeListener: (fn) => storageListeners.delete(fn),
    },
  },
  runtime: {
    // What background.js does with scripting.insertCSS / removeCSS. A page cannot
    // insert a user-origin sheet, so that one goes in a cascade layer: like the user
    // origin, a layer outranks the browser's stylesheet and yields to the page's
    // unlayered rules.
    sendMessage: async (message) => {
      for (const { css } of message.remove) {
        if (!styles.has(css)) throw new Error("removing a stylesheet that was never inserted");
        styles.get(css).remove();
        styles.delete(css);
      }
      for (const { css, origin } of message.insert) {
        const style = document.createElement("style");
        style.textContent = origin === "USER" ? `@layer rtl-chat-user { ${css} }` : css;
        document.head.append(style);
        styles.set(css, style);
      }
    },
    onMessage: {
      addListener: (fn) => messageListeners.add(fn),
    },
  },
};

const setSettings = async (values) => {
  Object.assign(store, values);
  for (const fn of storageListeners) fn({}, "sync");
  await frames(4);
};

const loadContentScript = () =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/src/content.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("content.js failed to load"));
    document.body.append(script);
  });

// --- Assertions ---------------------------------------------------------------

const run = async () => {
  check("baseline: Arabic paragraph starts on the left before the extension runs", textSide($("p-ar")) === "left");

  // Malformed settings must not stop the extension from starting.
  Object.assign(store, { mode: "sideways", disabled: "nope" });
  await loadContentScript();
  await frames(4);

  // Automatic mode
  check("auto: malformed settings still start the extension", styles.size === 2, `styles=${styles.size}`);
  check("auto: Arabic paragraph is on the right", textSide($("p-ar")) === "right");
  check("auto: English paragraph stays on the left", textSide($("p-en")) === "left");
  check("auto: paragraph starting in Arabic is on the right", textSide($("p-ar-mixed")) === "right");
  check("auto: paragraph starting in English is on the left", textSide($("p-en-mixed")) === "left");
  check("auto: Arabic heading is on the right", textSide($("h-ar")) === "right");
  check("auto: Arabic user bubble is on the right", textSide($("user-bubble")) === "right");

  check("auto: a paragraph the site centred stays centred", getComputedStyle($("p-centered")).textAlign === "center");
  const enHeadAlign = getComputedStyle($("cell-en-head")).textAlign;
  check("auto: an English table keeps the site's cell alignment", enHeadAlign === "center", enHeadAlign);
  check("auto: Arabic list is rtl", direction($("list-ar")) === "rtl", direction($("list-ar")));
  check("auto: Arabic list item text is on the right", textSide($("li-ar")) === "right");
  const listStyle = getComputedStyle($("list-ar"));
  check(
    "auto: Arabic list is indented on the right, where its markers are",
    parseFloat(listStyle.paddingRight) > 0 && parseFloat(listStyle.paddingLeft) === 0,
    `left=${listStyle.paddingLeft} right=${listStyle.paddingRight}`,
  );
  check("auto: an item opening with an English term stays on the list's side", textSide($("li-term")) === "right");
  check("auto: so does a paragraph inside an item", textSide($("li-p-term")) === "right");
  check("auto: a list without markers is not indented", getComputedStyle($("list-layout")).paddingRight === "0px", getComputedStyle($("list-layout")).paddingRight);
  check("auto: a right-to-left table the site set up gets its headers on the right", textSide($("rtl-site-th")) === "right");
  const nativeList = getComputedStyle($("rtl-site-list"));
  check("auto: a right-to-left list the site set up is indented on the right too", parseFloat(nativeList.paddingRight) > 0 && parseFloat(nativeList.paddingLeft) === 0, `left=${nativeList.paddingLeft} right=${nativeList.paddingRight}`);
  check("auto: an item the site centred stays centred", getComputedStyle($("li-centered")).textAlign === "center");
  check("auto: English list stays ltr", direction($("list-en")) === "ltr");
  check("auto: English list keeps the site's indent", getComputedStyle($("list-en")).paddingLeft === "30px");
  check("auto: English list item text is on the left", textSide($("li-en")) === "left");

  check("auto: Arabic table is rtl", direction($("table-ar")) === "rtl");
  check(
    "auto: first column of an Arabic table is the rightmost",
    $("cell-first").getBoundingClientRect().left > $("cell-second").getBoundingClientRect().left,
  );
  check("auto: a header cell of an Arabic table is on the right", textSide($("cell-first")) === "right");
  check("auto: a Latin cell of an Arabic table is on the right", textSide($("cell-latin")) === "right");
  check("auto: a number cell of an Arabic table is on the right", textSide($("cell-number")) === "right");
  check("auto: a cell the author centred stays centred", getComputedStyle($("cell-centered")).textAlign === "center");
  check("auto: Arabic blockquote is rtl", direction($("quote-ar")) === "rtl");

  check("auto: code block inside an Arabic list is ltr", direction($("pre-in-list")) === "ltr");
  check("auto: code block text is on the left", textSide($("pre-in-list")) === "left");
  check("auto: inline code inside Arabic text is ltr", direction($("code-inline")) === "ltr");

  check("auto: navigation list is left alone", !$("nav-list").hasAttribute("dir") && direction($("nav-list")) === "ltr");
  check("auto: navigation item is left alone", textSide($("nav-item")) === "left");

  const bubbleLeft = () => Math.round($("turn-user-text").getBoundingClientRect().left);
  const bubbleAtRest = bubbleLeft();
  check("auto: a transcript list is not given a direction", !$("transcript").hasAttribute("dir"));
  check("auto: text inside a transcript turn is still handled", textSide($("turn-user-text")) === "right");
  check("auto: a centred paragraph inside a turn stays centred", getComputedStyle($("turn-centered")).textAlign === "center");
  check("auto: a text list inside a transcript turn is rtl", direction($("turn-list")) === "rtl");

  // Typing, the way a user does it: the value changes and an input event follows.
  const typeInto = async (el, value) => {
    el.value = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await frames();
  };
  check("auto: an empty composer is left alone", !$("composer").hasAttribute("dir"));
  check("auto: editor with Arabic text is rtl", direction($("editor")) === "rtl");
  await typeInto($("composer"), "مرحبا");
  check("auto: composer with Arabic text is rtl", direction($("composer")) === "rtl");
  await typeInto($("composer"), "hello");
  check("auto: composer with English text is ltr", direction($("composer")) === "ltr");
  await typeInto($("composer"), "");
  check("auto: an emptied composer is left alone again", !$("composer").hasAttribute("dir"));

  check("auto: an empty composer on a right-to-left site stays rtl", direction($("composer-in-rtl")) === "rtl");
  await typeInto($("composer-in-rtl"), "hello");
  check("auto: English typed on a right-to-left site is ltr", direction($("composer-in-rtl")) === "ltr");
  await typeInto($("composer-in-rtl"), "");
  check("auto: and the emptied field is rtl again", direction($("composer-in-rtl")) === "rtl");
  check("auto: Arabic on a right-to-left site is not touched", !$("rtl-site-ar").hasAttribute("dir"));
  check("auto: an Arabic sentence opening with a Latin name is not touched there either", !$("rtl-site-latin-first").hasAttribute("dir"));
  check("auto: English on a right-to-left site is on the left", textSide($("rtl-site-en")) === "left");

  check("auto: English text on a left-to-right page is not touched", !$("p-en").hasAttribute("dir") && !$("list-en").hasAttribute("dir"));
  check("auto: an Arabic sentence opening with a Latin term is on the right", textSide($("p-latin-first")) === "right");

  check("auto: a list with its own dir is overridden", $("list-own-dir").getAttribute("dir") === "rtl");

  // Streaming: a reply that arrives node by node, the way a model streams it.
  const reply = document.createElement("div");
  $("chat").append(reply);
  await frames();
  const list = document.createElement("ul");
  reply.append(list);
  await frames();
  const item = document.createElement("li");
  list.append(item);
  item.append("أول ");
  await frames();
  item.append("عنصر يصل حرفاً حرفاً");
  await frames();
  check("streaming: and ends up rtl", direction(list) === "rtl");
  check("streaming: its text is on the right", textSide(item) === "right");

  // Characters appended to a text node that is already there.
  const growing = document.createElement("p");
  growing.append("JavaScript");
  reply.append(growing);
  await frames();
  check("streaming: a paragraph that has only shown a Latin term is ltr", direction(growing) === "ltr");
  growing.firstChild.data += " هي لغة برمجة تعمل في المتصفح";
  await frames();
  check("streaming: and turns rtl once the Arabic arrives", direction(growing) === "rtl");

  const first = document.createElement("p");
  first.textContent = "Sure, here is the translation:";
  const second = document.createElement("p");
  second.textContent = "الترجمة هنا في فقرة مستقلة.";
  reply.append(first, second);
  await frames();
  check("mixed reply: the English paragraph is on the left", textSide(first) === "left");
  check("mixed reply: the Arabic paragraph after it is on the right", textSide(second) === "right");

  // Forced RTL
  await setSettings({ mode: "rtl", disabled: [] });
  check("rtl: both stylesheets are active, and no stale one", styles.size === 2, `styles=${styles.size}`);
  check("rtl: English paragraph is rtl", direction($("p-en")) === "rtl");
  check("rtl: English paragraph text is on the right", textSide($("p-en")) === "right");
  check("rtl: English list is rtl", direction($("list-en")) === "rtl");
  check("rtl: code block is still ltr", direction($("pre-in-list")) === "ltr");
  check("rtl: inline code is still ltr", direction($("code-inline")) === "ltr");
  check("rtl: navigation list is left alone", direction($("nav-list")) === "ltr");
  check("rtl: a transcript list keeps its direction", direction($("transcript")) === "ltr");
  check("rtl: a transcript turn keeps its direction", direction($("turn-user")) === "ltr");
  check("rtl: the user's turn stays on its side", bubbleLeft() === bubbleAtRest, `${bubbleAtRest} -> ${bubbleLeft()}`);
  check("rtl: text inside a transcript turn is rtl", direction($("turn-user-text")) === "rtl");
  check("rtl: a paragraph the site centred stays centred", getComputedStyle($("p-centered")).textAlign === "center");
  check("rtl: a list without markers is not indented", getComputedStyle($("list-layout")).paddingRight === "0px");
  check("rtl: an English list is indented on the right", parseFloat(getComputedStyle($("list-en")).paddingRight) > 0 && parseFloat(getComputedStyle($("list-en")).paddingLeft) === 0);
  check("rtl: an item the site centred stays centred", getComputedStyle($("li-centered")).textAlign === "center");
  check("rtl: composer is rtl", direction($("composer")) === "rtl");
  check("rtl: dir attributes from automatic mode are gone", !$("list-ar").hasAttribute("dir"));
  check("rtl: the list's own dir is back", $("list-own-dir").getAttribute("dir") === "ltr");

  // Switched off for this site
  await setSettings({ mode: "auto", disabled: [location.hostname] });
  check("off: no stylesheet is left", styles.size === 0, `styles=${styles.size}`);
  check("off: no element is still marked", document.querySelectorAll("[data-rtl-chat], [data-rtl-chat-orig], [data-rtl-chat-indent]").length === 0);
  check("off: lists are back to the site's indent", getComputedStyle($("list-ar")).paddingLeft === "30px" && getComputedStyle($("list-en")).paddingLeft === "30px");
  check("off: Arabic paragraph is back on the left", textSide($("p-ar")) === "left");
  check("off: Arabic list is back to ltr", direction($("list-ar")) === "ltr" && !$("list-ar").hasAttribute("dir"));
  check("off: the list's own dir is back", $("list-own-dir").getAttribute("dir") === "ltr");
  check("off: composer has no dir", !$("composer").hasAttribute("dir"));
  const late = document.createElement("ul");
  late.innerHTML = "<li>عنصر بعد الإيقاف</li>";
  $("chat").append(late);
  await frames();
  check("off: new content is not touched", !late.hasAttribute("dir"));

  // Switched back on, then stopped by the popup's "remove this site"
  await setSettings({ mode: "auto", disabled: [] });
  check("on again: Arabic list is rtl", direction($("list-ar")) === "rtl");
  check("on again: content added while off is picked up", direction(late) === "rtl");
  await Promise.all([...messageListeners].map((fn) => fn({ type: "rtl-chat:stop" })));
  await frames();
  check("stop: no stylesheet is left", styles.size === 0, `styles=${styles.size}`);
  check("stop: no element is still marked", document.querySelectorAll("[data-rtl-chat], [data-rtl-chat-indent]").length === 0);

  // Cost on a long conversation, at its worst: Arabic on a left-to-right page, where
  // every paragraph and list has to be given a direction. The bounds are loose; the
  // measured times are printed with the result.
  const R = globalThis.RTLChat;
  const long = document.createElement("div");
  for (let i = 0; i < 2000; i++) {
    const p = document.createElement("p");
    p.textContent = "فقرة عربية طويلة نسبياً تحتوي على كلمات مثل JavaScript و API داخلها، رقم " + i;
    long.append(p);
    if (i % 10 === 0) {
      const ul = document.createElement("ul");
      ul.innerHTML = "<li>عنصر أول في القائمة</li><li>عنصر ثانٍ</li><li>API عنصر ثالث</li>";
      long.append(ul);
    }
  }
  $("chat").append(long);
  let started = performance.now();
  R.applyAll(long, R.GENERIC_SITE, "auto");
  getComputedStyle(long.lastElementChild).direction;
  const firstPass = performance.now() - started;
  const marked = long.querySelectorAll("[data-rtl-chat]").length;
  check("cost: a first pass over 2000 paragraphs and 200 lists stays under 500 ms", firstPass < 500 && marked === 2200, `${firstPass.toFixed(0)} ms, ${marked} elements given a direction`);

  // One streamed chunk: the paragraph it lands in and what surrounds it are judged again.
  const streamed = long.lastElementChild.firstChild;
  started = performance.now();
  for (let i = 0; i < 300; i++) {
    streamed.data += " كلمة";
    for (const el of R.targetsAround(streamed, R.GENERIC_SITE)) R.settle(el, "auto");
  }
  const perChunk = (performance.now() - started) / 300;
  check("cost: a streamed chunk at the end of that conversation stays under 2 ms", perChunk < 2, `${perChunk.toFixed(3)} ms per chunk`);
  R.clearAll(long);
  long.remove();
};

const report = async (error) => {
  if (error) check("the test run completed", false, error.stack || error);
  for (const result of results) {
    const li = document.createElement("li");
    li.textContent = `${result.pass ? "PASS" : "FAIL"} ${result.name} ${result.detail}`;
    li.style.color = result.pass ? "green" : "red";
    $("results").append(li);
  }
  await fetch("/results", { method: "POST", body: JSON.stringify(results) });
};

run().then(() => report(), report);
