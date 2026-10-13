"use strict";

// Starts a headless Firefox the live checks can drive: a throwaway profile, the
// Marionette remote protocol, and the extension installed as a temporary add-on.
// Runs until interrupted. Nothing is shown on screen.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { ROOT, PORT, open, sleep } = require("./browser.js");

const FLATPAK_APP = "org.mozilla.firefox";

const PREFS = `
user_pref("marionette.port", ${PORT});
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("app.update.enabled", false);
user_pref("intl.accept_languages", "en-US,en");
`;

const main = async () => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rtl-chat-live-"));
  fs.writeFileSync(path.join(profile, "user.js"), PREFS);

  // --remote-allow-system-access lets the checks reach the browser's own UI: the
  // toolbar button, the popup and the permission prompt.
  const args = ["--headless", "--no-remote", "--marionette", "--remote-allow-system-access", "--profile", profile, "about:blank"];
  const env = { ...process.env, MOZ_HEADLESS_WIDTH: "1400", MOZ_HEADLESS_HEIGHT: "1000" };
  let command = process.env.FIREFOX || "firefox";
  let commandArgs = args;
  if (!process.env.FIREFOX && spawnSync("flatpak", ["info", FLATPAK_APP], { stdio: "ignore" }).status === 0) {
    // A Flatpak Firefox sees neither the profile nor the extension unless told to.
    command = "flatpak";
    commandArgs = [
      "run", "--env=MOZ_HEADLESS_WIDTH=1400", "--env=MOZ_HEADLESS_HEIGHT=1000",
      `--filesystem=${profile}`, `--filesystem=${ROOT}:ro`, FLATPAK_APP, ...args,
    ];
  }

  // Its own process group: `flatpak run` leaves the browser behind when only the
  // launcher is signalled.
  const firefox = spawn(command, commandArgs, { stdio: "ignore", env, detached: true });

  const stop = () => {
    try {
      process.kill(-firefox.pid, "SIGTERM");
    } catch {
      // Already gone.
    }
    fs.rmSync(profile, { recursive: true, force: true });
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  let m = null;
  for (let attempt = 0; attempt < 60 && !m; attempt++) {
    await sleep(500);
    m = await open().catch(() => null);
  }
  if (!m) {
    console.error("Firefox did not open its remote port");
    stop();
  }
  console.log("extension installed:", await m.installAddon(ROOT));
  m.close();
  console.log(`Firefox is running headless, Marionette on port ${PORT}. Ctrl+C stops it.`);
  setInterval(() => {}, 1 << 30);
};

main();
