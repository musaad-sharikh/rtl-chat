"use strict";

const R = globalThis.RTLChat;

const CUSTOM_SCRIPT_ID = "rtl-chat-custom";
const CONTENT_FILES = ["src/sites.js", "src/direction.js", "src/content.js"];

// The CSS is inserted from here instead of from a <style> element in the page,
// so a site's Content Security Policy cannot block it.
browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || message.type !== "rtl-chat:css" || !sender.tab) return undefined;

  const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
  return (async () => {
    if (message.remove) await browser.scripting.removeCSS({ target, css: message.remove });
    if (message.insert) await browser.scripting.insertCSS({ target, css: message.insert });
  })();
});

// Sites the user added are exactly the extra host permissions they granted, so one
// registered content script follows that list.
const syncCustomScript = async () => {
  const { origins } = await browser.permissions.getAll();
  const matches = R.customOrigins(origins);
  const registered = await browser.scripting.getRegisteredContentScripts({
    ids: [CUSTOM_SCRIPT_ID],
  });

  if (matches.length === 0) {
    if (registered.length) {
      await browser.scripting.unregisterContentScripts({ ids: [CUSTOM_SCRIPT_ID] });
    }
    return;
  }

  const script = { id: CUSTOM_SCRIPT_ID, matches, js: CONTENT_FILES, runAt: "document_idle" };
  if (registered.length) {
    await browser.scripting.updateContentScripts([script]);
  } else {
    await browser.scripting.registerContentScripts([script]);
  }
};

// A registered content script only runs on the next load; tabs already open on a
// newly added site get it now.
const injectIntoOpenTabs = async (origins) => {
  if (!origins || origins.length === 0) return;
  const tabs = await browser.tabs.query({ url: origins });
  await Promise.allSettled(
    tabs.map((tab) =>
      browser.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }),
    ),
  );
};

const report = (error) => console.error("RTL Chat:", error);

browser.runtime.onInstalled.addListener(() => syncCustomScript().catch(report));
browser.runtime.onStartup.addListener(() => syncCustomScript().catch(report));
browser.permissions.onRemoved.addListener(() => syncCustomScript().catch(report));
browser.permissions.onAdded.addListener((permissions) => {
  syncCustomScript()
    .then(() => injectIntoOpenTabs(R.customOrigins(permissions.origins)))
    .catch(report);
});
