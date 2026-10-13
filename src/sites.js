"use strict";

// The only file that knows site hosts and site-specific selectors.
// Every site gets the generic rules from direction.js; an entry here adds to them:
//   text    - extra elements that hold message text (beyond p, li, headings...)
//   input   - extra composer elements (beyond textarea and contenteditable)
//   exclude - extra site chrome to leave alone (beyond nav, aside and menu roles)
// The hosts must stay in step with host_permissions in manifest.json.
(() => {
  const R = (globalThis.RTLChat = globalThis.RTLChat || {});

  R.SITES = [
    {
      id: "chatgpt",
      name: "ChatGPT",
      hosts: ["chatgpt.com"],
      text: [],
      input: ["#prompt-textarea"],
      exclude: [],
    },
    {
      id: "claude",
      name: "Claude",
      hosts: ["claude.ai"],
      text: ['[data-testid="user-message"]'],
      input: [".ProseMirror"],
      exclude: [],
    },
    {
      id: "gemini",
      name: "Gemini",
      hosts: ["gemini.google.com"],
      text: [".query-text-line"],
      input: [".ql-editor"],
      exclude: ["bard-sidenav"],
    },
    {
      id: "aistudio",
      name: "Google AI Studio",
      hosts: ["aistudio.google.com"],
      text: ["ms-cmark-node"],
      input: [],
      exclude: [],
    },
    {
      id: "copilot",
      name: "Copilot",
      hosts: ["copilot.microsoft.com", "copilot.com"],
      text: [],
      input: ["#userInput"],
      exclude: [],
    },
    {
      id: "deepseek",
      name: "DeepSeek",
      hosts: ["chat.deepseek.com"],
      text: [".ds-markdown-paragraph"],
      input: ["#chat-input"],
      exclude: [],
    },
    {
      id: "perplexity",
      name: "Perplexity",
      hosts: ["www.perplexity.ai"],
      text: [],
      input: ["#ask-input"],
      exclude: [],
    },
    {
      id: "grok",
      name: "Grok",
      hosts: ["grok.com"],
      text: [".message-bubble"],
      input: [],
      exclude: [],
    },
    {
      id: "mistral",
      name: "Le Chat",
      hosts: ["chat.mistral.ai"],
      text: [],
      input: [".ProseMirror"],
      exclude: [],
    },
    {
      id: "poe",
      name: "Poe",
      hosts: ["poe.com"],
      text: [],
      input: [],
      exclude: [],
    },
  ];

  R.GENERIC_SITE = { id: "generic", name: "", hosts: [], text: [], input: [], exclude: [] };

  R.builtinHosts = () => R.SITES.flatMap((site) => site.hosts);

  R.findSite = (hostname) =>
    R.SITES.find((site) =>
      site.hosts.some((host) => hostname === host || hostname.endsWith("." + host)),
    ) || R.GENERIC_SITE;

  if (typeof module !== "undefined") module.exports = R;
})();
