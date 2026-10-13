"use strict";

// Decides what the extension does to a page: which CSS it gets and which elements
// carry a dir attribute. Knows nothing about a particular site; sites.js supplies that.
(() => {
  const R = (globalThis.RTLChat = globalThis.RTLChat || {});

  const MARK = "data-rtl-chat";
  const ORIG = "data-rtl-chat-orig";
  const INDENT = "data-rtl-chat-indent";

  // Elements whose text is one paragraph of prose: each follows its own language.
  const BLOCK = [
    "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote",
    "dd", "dt", "summary", "figcaption", ".whitespace-pre-wrap",
  ];
  // Elements whose direction decides where markers, indents and columns go.
  const CONTAINER = ["ul", "ol", "table"];
  // Items and cells take no direction of their own: they follow the list or table
  // they sit in, so one English term does not pull an item out of an Arabic list.
  const ITEM = "li, td, th";
  const INPUT = [
    "textarea", 'input[type="text"]', 'input[type="search"]', "input:not([type])",
    '[contenteditable="true"]', '[contenteditable=""]', '[contenteditable="plaintext-only"]',
  ];
  // Always left-to-right, in every mode.
  const LTR = [
    "pre", "code", "kbd", "samp", "math", ".katex", ".katex-display",
    "mjx-container", ".MathJax", ".cm-editor", ".monaco-editor",
  ];
  // Site chrome: never restyled.
  const CHROME = [
    "nav", "aside", '[role="navigation"]', '[role="menu"]', '[role="menubar"]',
    '[role="listbox"]', '[role="tablist"]', '[role="toolbar"]', '[role="tree"]',
  ];
  // Lists a site builds its own layout from, such as the transcript of turns, carry
  // a label; lists in the text never do. (A role does not tell them apart: sites put
  // role="list" on text lists too.) Their content is still handled.
  const STRUCTURAL = ":is(ul, ol)[aria-label]";

  const MODES = ["auto", "rtl"];

  R.normalizeSettings = (raw) => {
    const data = raw && typeof raw === "object" ? raw : {};
    return {
      mode: MODES.includes(data.mode) ? data.mode : "auto",
      disabled: Array.isArray(data.disabled)
        ? data.disabled.filter((host) => typeof host === "string")
        : [],
    };
  };

  R.isEnabled = (settings, hostname) => !settings.disabled.includes(hostname);

  // Match pattern for the page's host, or null when the page cannot be scripted.
  R.originPattern = (url) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return `${parsed.protocol}//${parsed.hostname}/*`;
  };

  // Granted host permissions that are not one of the built-in sites.
  R.customOrigins = (origins) => {
    const builtin = R.builtinHosts();
    return (origins || []).filter((pattern) => {
      const match = /^[^:]+:\/\/([^/]*)\//.exec(pattern);
      return !(match && builtin.includes(match[1]));
    });
  };

  // Hebrew, Arabic and the other right-to-left scripts, with their presentation forms.
  const RTL_LETTER = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFC]/;
  const LETTER = /\p{L}/u;
  // Text is right-to-left once this share of its letters is. The first letter is a
  // poor guide: Arabic sentences open with a Latin name or term all the time.
  const RTL_SHARE = 0.3;
  const SAMPLE = 600;

  // "rtl", "ltr", or null for text with no letters to judge by.
  R.detectDirection = (text) => {
    let rtl = 0;
    let letters = 0;
    for (const char of String(text || "").slice(0, SAMPLE)) {
      if (RTL_LETTER.test(char)) {
        rtl++;
        letters++;
      } else if (LETTER.test(char)) {
        letters++;
      }
    }
    if (letters === 0) return null;
    return rtl / letters >= RTL_SHARE ? "rtl" : "ltr";
  };

  const is = (selectors) => `:is(${selectors.join(", ")})`;

  R.buildCss = (site, mode) => {
    const outsideChrome = `:not(${is([...CHROME, ...site.exclude])} *)`;
    const outsideLtr = `:not(${is(LTR)}):not(${is(LTR)} *)`;
    const guard = outsideChrome + outsideLtr;
    // Sites pin header cells to the left; in a right-to-left table they belong on
    // the right. Everything else keeps the alignment the site chose, so a centred
    // heading stays centred. A cell the author aligned (a markdown table's :---:)
    // keeps that too.
    const cells = `table:dir(rtl) :is(td, th):not([align]):not([style*="text-align"])${guard} { text-align: start !important; }`;
    // A list item resolves its alignment against its parent (text-align: match-parent)
    // and hands the result down as a fixed side, which would pin a right-to-left
    // paragraph inside it to the left. This makes the item pass down "start" instead;
    // an element with an alignment of its own is not affected.
    const itemAlign = `li${guard} { text-align: start !important; }`;
    // syncIndent marks the lists whose indent sits on the wrong side.
    const listIndent = `[${INDENT}] { padding-inline: 1.75em 0 !important; }`;
    const ltr = `${is(LTR)} { direction: ltr !important; unicode-bidi: isolate !important; text-align: left !important; }`;

    if (mode === "rtl") {
      const forced =
        is([...BLOCK, ...site.text, ...CONTAINER, ...INPUT, ...site.input]) +
        `:not(${STRUCTURAL})` +
        guard;
      return [
        `${forced}, :is(li:not(${STRUCTURAL} > li), td, th)${guard} { direction: rtl !important; }`,
        cells,
        itemAlign,
        listIndent,
        ltr,
      ].join("\n");
    }

    return [
      cells,
      itemAlign,
      listIndent,
      // A field the site emptied without a keystroke shows its placeholder the way
      // the site laid it out, not the way the last message ran.
      `:is(textarea, input)[${MARK}]:placeholder-shown { direction: inherit !important; }`,
      ltr,
    ].join("\n");
  };

  const selectorsFor = (site) => {
    const s = {
      blocks: [...BLOCK, ...site.text].join(", "),
      containers: CONTAINER.join(", "),
      inputs: [...INPUT, ...site.input].join(", "),
      chrome: [...CHROME, ...site.exclude].join(", "),
      ltr: LTR.join(", "),
    };
    s.all = `${s.blocks}, ${s.containers}, ${s.inputs}`;
    return s;
  };

  // The list item or cell that holds el, ignoring the items of a structural list.
  const holdingItem = (el) => {
    let item = el.parentElement && el.parentElement.closest(ITEM);
    while (item) {
      const turn = item.localName === "li" && item.parentElement && item.parentElement.matches(STRUCTURAL);
      if (!turn) return item;
      item = item.parentElement && item.parentElement.closest(ITEM);
    }
    return null;
  };

  const isTarget = (el, s) => {
    if (el.closest(s.ltr)) return false;
    // The composer is handled wherever it sits; text only outside chrome.
    if (el.matches(s.inputs)) return true;
    if (el.closest(s.chrome)) return false;
    if (el.matches(s.containers)) return !el.matches(STRUCTURAL);
    return !holdingItem(el);
  };

  // Elements under root (root included) whose direction the extension decides, in
  // document order.
  R.collectTargets = (root, site) => {
    const s = selectorsFor(site);
    const found = Array.from(root.querySelectorAll(s.all));
    if (root.nodeType === 1 && root.matches(s.all)) found.unshift(root);
    return found.filter((el) => isTarget(el, s));
  };

  // The targets a change at node can affect: the ones around it, outermost first.
  R.targetsAround = (node, site) => {
    const s = selectorsFor(site);
    const found = [];
    let el = node.nodeType === 1 ? node : node.parentElement;
    for (el = el && el.closest(s.all); el; el = el.parentElement && el.parentElement.closest(s.all)) {
      if (isTarget(el, s)) found.unshift(el);
    }
    return found;
  };

  const SHOW_TEXT = 4; // NodeFilter.SHOW_TEXT

  // The text that decides an element's direction: what the user typed for a field,
  // otherwise its prose without code and math.
  const judgedText = (el) => {
    if (el.localName === "textarea" || el.localName === "input") return el.value;
    const walker = el.ownerDocument.createTreeWalker(el, SHOW_TEXT);
    const ltr = LTR.join(", ");
    let text = "";
    for (let node = walker.nextNode(); node && text.length < SAMPLE; node = walker.nextNode()) {
      if (!node.parentElement.closest(ltr)) text += node.data;
    }
    return text;
  };

  const restore = (el) => {
    if (el.hasAttribute(ORIG)) {
      el.setAttribute("dir", el.getAttribute(ORIG));
      el.removeAttribute(ORIG);
    } else {
      el.removeAttribute("dir");
    }
    el.removeAttribute(MARK);
  };

  // Gives el the direction of its text, touching it only when that differs from the
  // direction it already has. Returns whether its direction changed.
  R.syncElement = (el) => {
    const wanted = R.detectDirection(judgedText(el));

    if (el.hasAttribute(MARK)) {
      if (!wanted) {
        restore(el);
        return true;
      }
      if (el.getAttribute("dir") === wanted) return false;
      el.setAttribute("dir", wanted);
      return true;
    }

    const current = el.ownerDocument.defaultView.getComputedStyle(el).direction;
    if (!wanted || wanted === current) return false;
    if (el.hasAttribute("dir")) el.setAttribute(ORIG, el.getAttribute("dir"));
    el.setAttribute(MARK, "");
    el.setAttribute("dir", wanted);
    return true;
  };

  // Sites often indent lists with a physical padding-left. In a right-to-left list
  // that leaves the markers, now on the right, outside the box. Flags such a list so
  // the stylesheet moves the indent; a list without markers is layout and is left alone.
  R.syncIndent = (list) => {
    const view = list.ownerDocument.defaultView;
    const style = view.getComputedStyle(list);
    if (list.hasAttribute(INDENT)) {
      if (style.direction !== "rtl") list.removeAttribute(INDENT);
      return;
    }
    if (style.direction !== "rtl") return;
    const item = list.querySelector(":scope > li");
    if (!item) return;
    const itemStyle = view.getComputedStyle(item);
    if (itemStyle.display !== "list-item" || itemStyle.listStyleType === "none") return;
    if (parseFloat(style.paddingLeft) > 0 && parseFloat(style.paddingRight) === 0) {
      list.setAttribute(INDENT, "");
    }
  };

  // Settles one element for the mode in force. Forced right-to-left takes its
  // directions from the stylesheet, so only the indent is looked at there.
  // Returns whether the element's direction changed.
  R.settle = (el, mode) => {
    const changed = mode === "auto" ? R.syncElement(el) : false;
    if (el.localName === "ul" || el.localName === "ol") R.syncIndent(el);
    return changed;
  };

  // In document order, so an element is judged after the ones around it are settled.
  R.applyAll = (root, site, mode) => {
    for (const el of R.collectTargets(root, site)) R.settle(el, mode);
  };

  // Takes back the directions the automatic mode set.
  R.clearDirections = (root) => {
    for (const el of root.querySelectorAll(`[${MARK}]`)) restore(el);
  };

  R.clearAll = (root) => {
    R.clearDirections(root);
    for (const el of root.querySelectorAll(`[${INDENT}]`)) el.removeAttribute(INDENT);
  };

  if (typeof module !== "undefined") module.exports = R;
})();
