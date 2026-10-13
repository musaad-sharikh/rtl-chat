"use strict";

(() => {
  // The background injects these files again into tabs that were already open
  // when a site was added; a second copy must not start a second observer.
  if (globalThis.__rtlChatStarted) return;
  globalThis.__rtlChatStarted = true;

  const R = globalThis.RTLChat;
  const site = R.findSite(location.hostname);

  let currentCss = null;
  let observer = null;
  let pending = [];
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    const nodes = pending;
    pending = [];
    for (const node of nodes) {
      if (node.isConnected) R.applyAll(node, site);
    }
  };

  const onMutations = (mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType === 1) pending.push(node);
      }
    }
    if (pending.length && !scheduled) {
      scheduled = true;
      requestAnimationFrame(flush);
    }
  };

  const startObserver = () => {
    if (observer) return;
    observer = new MutationObserver(onMutations);
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
    pending = [];
  };

  const setCss = async (css) => {
    if (css === currentCss) return;
    await browser.runtime.sendMessage({ type: "rtl-chat:css", remove: currentCss, insert: css });
    currentCss = css;
  };

  const refresh = async () => {
    const settings = R.normalizeSettings(await browser.storage.sync.get(null));
    const enabled = R.isEnabled(settings, location.hostname);

    await setCss(enabled ? R.buildCss(site, settings.mode) : null);

    // Forced RTL is CSS only; dir="auto" is what the automatic mode adds.
    if (enabled && settings.mode === "auto") {
      R.applyAll(document, site);
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
      await setCss(null);
      globalThis.__rtlChatStarted = false;
    });
    return queue;
  });

  queueRefresh();
})();
