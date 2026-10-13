"use strict";

const R = globalThis.RTLChat;

const CUSTOM_SCRIPT_ID = "rtl-chat-custom";
const CONTENT_FILES = R.CONTENT_FILES;

browser.runtime.onMessage.addListener((message, sender) => {
  if (!message || !sender.tab) return undefined;

  // A content script cannot ask about permissions itself.
  if (message.type === "rtl-chat:has-access") {
    const pattern = R.originPattern(sender.url);
    return pattern ? browser.permissions.contains({ origins: [pattern] }) : Promise.resolve(false);
  }

  // The CSS is inserted from here instead of from a <style> element in the page,
  // so a site's Content Security Policy cannot block it.
  if (message.type !== "rtl-chat:css") return undefined;

  const target = { tabId: sender.tab.id, frameIds: [sender.frameId] };
  return (async () => {
    for (const { css, origin } of message.remove) {
      await browser.scripting.removeCSS({ target, css, origin });
    }
    for (const { css, origin } of message.insert) {
      await browser.scripting.insertCSS({ target, css, origin });
    }
  })();
});

// Sites the user added are exactly the extra host permissions they granted, so one
// registered content script follows that list. A wider grant, such as "all websites"
// in Firefox's settings, is in that list too and is followed the same way.
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

// A content script only runs on the next load; tabs already open on a site whose
// access was just granted get it now.
const injectIntoOpenTabs = async (origins) => {
  if (!origins || origins.length === 0) return;
  const tabs = await browser.tabs.query({ url: origins, discarded: false });
  await Promise.allSettled(
    tabs.map((tab) =>
      browser.scripting.executeScript({ target: { tabId: tab.id }, files: CONTENT_FILES }),
    ),
  );
};

// A page whose access was taken away keeps the script it already has, and that script
// has no way to notice. Every tab is told, and each script asks back about its own page.
const tellOpenTabs = async () => {
  const tabs = await browser.tabs.query({ discarded: false });
  await Promise.allSettled(
    tabs.map((tab) => browser.tabs.sendMessage(tab.id, { type: "rtl-chat:access-changed" })),
  );
};

const report = (error) => console.error("RTL Chat:", error);

browser.runtime.onInstalled.addListener(() => syncCustomScript().catch(report));
browser.runtime.onStartup.addListener(() => syncCustomScript().catch(report));
browser.permissions.onRemoved.addListener(() => {
  syncCustomScript().catch(report);
  tellOpenTabs().catch(report);
});
browser.permissions.onAdded.addListener((permissions) => {
  syncCustomScript()
    .then(() => injectIntoOpenTabs(permissions.origins))
    .catch(report);
});
