"use strict";

// Decides what the extension does to a page: which CSS it gets and which elements
// carry a dir attribute. Knows nothing about a particular site; sites.js supplies that.
(() => {
  const R = (globalThis.RTLChat = globalThis.RTLChat || {});

  const MARK = "data-rtl-chat";
  const ORIG = "data-rtl-chat-orig";

  // Elements whose text is one paragraph of prose.
  const BLOCK = [
    "p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote",
    "dd", "dt", "summary", "figcaption", ".whitespace-pre-wrap",
  ];
  const CELL = ["td", "th"];
  // Elements whose own direction decides where markers, indents and columns go.
  // CSS alone cannot derive that from the content, so these get dir="auto".
  const CONTAINER = ["ul", "ol", "table", "blockquote"];
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

  const is = (selectors) => `:is(${selectors.join(", ")})`;

  R.buildCss = (site, mode) => {
    const outsideChrome = `:not(${is([...CHROME, ...site.exclude])} *)`;
    const outsideLtr = `:not(${is(LTR)}):not(${is(LTR)} *)`;
    const prose = is([...BLOCK, ...site.text]) + outsideChrome + outsideLtr;
    const cells = is(CELL) + outsideChrome + outsideLtr;
    const ltr = `${is(LTR)} { direction: ltr !important; unicode-bidi: isolate !important; text-align: left !important; }`;
    // Sites often indent lists with a physical padding-left, which leaves the
    // markers of a right-to-left list outside the box.
    const listIndent = "{ padding-inline: 1.75em 0 !important; }";

    if (mode === "rtl") {
      const forced = is([...CONTAINER, ...INPUT, ...site.input]) + outsideChrome + outsideLtr;
      return [
        `${prose}, ${cells}, ${forced} { direction: rtl !important; }`,
        `${prose} { text-align: start !important; }`,
        `${is(["ul", "ol"])}${outsideChrome}${outsideLtr} ${listIndent}`,
        ltr,
      ].join("\n");
    }

    return [
      `${prose} { unicode-bidi: plaintext !important; text-align: start !important; }`,
      `${cells} { unicode-bidi: plaintext !important; }`,
      `${is(["ul", "ol"])}[${MARK}]:dir(rtl) ${listIndent}`,
      ltr,
    ].join("\n");
  };

  // Elements under root (root included) that should carry dir="auto".
  R.collectTargets = (root, site) => {
    const inputs = [...INPUT, ...site.input].join(", ");
    const containers = CONTAINER.join(", ");
    const chrome = [...CHROME, ...site.exclude].join(", ");
    const ltr = LTR.join(", ");
    const selector = `${containers}, ${inputs}`;

    const found = Array.from(root.querySelectorAll(selector));
    if (root.nodeType === 1 && root.matches(selector)) found.unshift(root);

    return found.filter((el) => {
      if (el.closest(ltr)) return false;
      // The composer is handled wherever it sits; containers only outside chrome.
      return el.matches(inputs) || !el.closest(chrome);
    });
  };

  R.applyAuto = (el) => {
    if (el.hasAttribute(MARK)) return;
    if (el.hasAttribute("dir")) el.setAttribute(ORIG, el.getAttribute("dir"));
    el.setAttribute(MARK, "");
    el.setAttribute("dir", "auto");
  };

  R.applyAll = (root, site) => {
    for (const el of R.collectTargets(root, site)) R.applyAuto(el);
  };

  R.clearAll = (root) => {
    for (const el of root.querySelectorAll(`[${MARK}]`)) {
      if (el.hasAttribute(ORIG)) {
        el.setAttribute("dir", el.getAttribute(ORIG));
        el.removeAttribute(ORIG);
      } else {
        el.removeAttribute("dir");
      }
      el.removeAttribute(MARK);
    }
  };

  if (typeof module !== "undefined") module.exports = R;
})();
