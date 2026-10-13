"use strict";

(() => {
  // The background injects these files again into tabs that were already open
  // when a site was added; a second copy must not start a second observer.
  if (globalThis.__rtlChatStarted) return;
  globalThis.__rtlChatStarted = true;

  const R = globalThis.RTLChat;
  const site = R.findSite(location.hostname);

  let currentSheets = [];
  let mode = "auto";
  let observer = null;
  // Nodes whose surroundings need another look, and new nodes to look inside too.
  let touched = new Set();
  let added = new Set();
  let scheduled = false;

  // Settles one element, and everything under it when its own direction moved:
  // what is inside was judged against the direction it used to inherit.
  const settle = (el) => {
    if (R.settle(el, mode)) R.applyAll(el, site, mode);
  };

  const flush = () => {
    scheduled = false;
    const [around, inside] = [touched, added];
    touched = new Set();
    added = new Set();
    for (const node of around) {
      if (!node.isConnected) continue;
      for (const el of R.targetsAround(node, site)) settle(el);
    }
    for (const node of inside) {
      if (node.isConnected) R.applyAll(node, site, mode);
    }
  };

  const schedule = (node, isNew = false) => {
    touched.add(node);
    if (isNew) added.add(node);
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(flush);
  };

  // Text arrives while a reply streams: new nodes, or more characters in a node
  // that is already there. Either can tip the direction of what holds it.
  const onMutations = (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        schedule(mutation.target);
        continue;
      }
      schedule(mutation.target);
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) schedule(node, true);
      }
    }
  };

  // Typing in a textarea changes its value, not the DOM, so no mutation reports it.
  const onInput = (event) => {
    if (event.target && event.target.nodeType === 1) schedule(event.target);
  };

  const startObserver = () => {
    if (observer) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    document.addEventListener("input", onInput, true);
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    document.removeEventListener("input", onInput, true);
    touched = new Set();
    added = new Set();
  };

  const setSheets = async (sheets) => {
    if (JSON.stringify(sheets) === JSON.stringify(currentSheets)) return;
    await browser.runtime.sendMessage({ type: "rtl-chat:css", remove: currentSheets, insert: sheets });
    currentSheets = sheets;
  };

  const refresh = async () => {
    const settings = R.normalizeSettings(await browser.storage.sync.get(null));
    const enabled = R.isEnabled(settings, location.hostname);

    await setSheets(enabled ? R.buildSheets(site, settings.mode) : []);

    if (enabled) {
      mode = settings.mode;
      // Forced RTL takes its directions from the stylesheet alone.
      if (mode !== "auto") R.clearDirections(document);
      R.applyAll(document, site, mode);
      startObserver();
    } else {
      stopObserver();
      R.clearAll(document);
    }
  };

  // Settings changes can arrive faster than a refresh completes; run them in order.
  let queue = Promise.resolve();
  const queueRefresh = () => {
    queue = queue.then(refresh).catch((error) => console.error("RTL Chat:", error));
  };

  const onStorageChanged = (changes, area) => {
    if (area === "sync") queueRefresh();
  };
  browser.storage.onChanged.addListener(onStorageChanged);

  // Sent by the popup just before it drops this site's host permission, while the
  // background can still remove the CSS.
  browser.runtime.onMessage.addListener((message) => {
    if (!message || message.type !== "rtl-chat:stop") return undefined;
    browser.storage.onChanged.removeListener(onStorageChanged);
    queue = queue.then(async () => {
      stopObserver();
      R.clearAll(document);
      await setSheets([]);
      globalThis.__rtlChatStarted = false;
    });
    return queue;
  });

  queueRefresh();
})();
