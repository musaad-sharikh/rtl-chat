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
  ];

  R.GENERIC_SITE = { id: "generic", name: "", hosts: [], text: [], input: [], exclude: [] };

  R.builtinHosts = () => R.SITES.flatMap((site) => site.hosts);

  R.findSite = (hostname) =>
    R.SITES.find((site) =>
      site.hosts.some((host) => hostname === host || hostname.endsWith("." + host)),
    ) || R.GENERIC_SITE;

  if (typeof module !== "undefined") module.exports = R;
})();
