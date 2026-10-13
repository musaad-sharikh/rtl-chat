"use strict";

const R = globalThis.RTLChat;
const t = (key) => browser.i18n.getMessage(key);
const $ = (id) => document.getElementById(id);

document.documentElement.dir = browser.i18n.getMessage("@@bidi_dir");
document.documentElement.lang = browser.i18n.getMessage("@@ui_locale").replace("_", "-");
for (const el of document.querySelectorAll("[data-i18n]")) {
  el.textContent = t(el.dataset.i18n);
}

let tab = null;
let hostname = "";
let pattern = null;

const STATUS = {
  none: () => t("statusNotCovered"),
  revoked: () => t("statusNoAccess"),
  builtin: () => t("statusBuiltin"),
  added: () => t("statusCustom"),
  wide: () => t("statusAllSites"),
};

const readSettings = async () => R.normalizeSettings(await browser.storage.sync.get(null));

const render = async () => {
  $("controls").hidden = true;
  $("add").hidden = true;
  $("remove").hidden = true;

  if (!pattern) {
    $("host").hidden = true;
    $("status").textContent = t("statusUnsupportedPage");
    return;
  }

  $("host").textContent = hostname;
  const builtin = R.builtinHosts().includes(hostname);
  const granted = await browser.permissions.contains({ origins: [pattern] });

  // Only a site that holds a host permission of its own can be removed here.
  const { origins } = await browser.permissions.getAll();
  const own = origins.includes(pattern);
  $("status").textContent = STATUS[R.accessKind({ builtin, granted, own })]();

  if (!granted) {
    $("add").hidden = false;
    return;
  }

  const settings = await readSettings();
  const enabled = R.isEnabled(settings, hostname);
  $("enabled").checked = enabled;
  $("modes").disabled = !enabled;
  for (const radio of document.querySelectorAll('input[name="mode"]')) {
    radio.checked = radio.value === R.modeFor(settings, hostname);
  }
  $("controls").hidden = false;
  $("remove").hidden = builtin || !own;
};

$("enabled").addEventListener("change", async (event) => {
  const settings = await readSettings();
  const disabled = settings.disabled.filter((host) => host !== hostname);
  if (!event.target.checked) disabled.push(hostname);
  await browser.storage.sync.set({ disabled });
  $("modes").disabled = !event.target.checked;
});

$("modes").addEventListener("change", async (event) => {
  const { modes } = await readSettings();
  if (event.target.value === "auto") delete modes[hostname];
  else modes[hostname] = event.target.value;
  await browser.storage.sync.set({ modes });
});

// permissions.request only works straight from the click, so nothing is awaited
// before it. The background script reacts to the grant and starts the page.
$("add").addEventListener("click", () => {
  browser.permissions.request({ origins: [pattern] }).then(render, console.error);
});

$("remove").addEventListener("click", async () => {
  try {
    await browser.tabs.sendMessage(tab.id, { type: "rtl-chat:stop" });
  } catch {
    // No content script in the tab: nothing to undo there.
  }
  await browser.permissions.remove({ origins: [pattern] });
  // A site that is added again later starts from the defaults.
  const { modes, disabled } = await readSettings();
  delete modes[hostname];
  await browser.storage.sync.set({ modes, disabled: disabled.filter((host) => host !== hostname) });
  // A wider grant still covers the site: it stays at work, from the defaults.
  if (await browser.permissions.contains({ origins: [pattern] })) {
    await browser.scripting
      .executeScript({ target: { tabId: tab.id }, files: R.CONTENT_FILES.map((file) => `/${file}`) })
      .catch(console.error);
  }
  await render();
});

(async () => {
  [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  pattern = tab ? R.originPattern(tab.url) : null;
  hostname = pattern ? new URL(tab.url).hostname : "";
  await render();
})().catch(console.error);
