"use strict";

// Serves the repository on 127.0.0.1, opens the fixture in a headless Firefox on a
// throwaway profile, and waits for the page to post its results.

const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..", "..");
const FLATPAK_APP = "org.mozilla.firefox";
const TIMEOUT_MS = 60_000;

// FIREFOX names a binary to use. Without it, a Flatpak Firefox is preferred when one
// is installed: it cannot see the host's temporary directory, so the profile is
// passed through to its sandbox explicitly.
const firefoxCommand = (profile, url) => {
  const args = ["--headless", "--no-remote", "--profile", profile, url];
  if (process.env.FIREFOX) return [process.env.FIREFOX, args];
  const flatpak = spawnSync("flatpak", ["info", FLATPAK_APP], { stdio: "ignore" });
  if (flatpak.status === 0) {
    return ["flatpak", ["run", `--filesystem=${profile}`, FLATPAK_APP, ...args]];
  }
  return ["firefox", args];
};
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

const PREFS = `
user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("datareporting.policy.dataSubmissionEnabled", false);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("app.update.enabled", false);
`;

const groupAlive = (pid) => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch {
    return false;
  }
};

const stopGroup = async (pid) => {
  if (!pid) return;
  for (const signal of ["SIGTERM", "SIGKILL"]) {
    if (!groupAlive(pid)) return;
    process.kill(-pid, signal);
    for (let i = 0; i < 50 && groupAlive(pid); i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
};

const main = async () => {
  let finish;
  const done = new Promise((resolve) => (finish = resolve));

  const server = http.createServer((req, res) => {
    if (req.method === "POST" && req.url === "/results") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.end("ok");
        finish(JSON.parse(body));
      });
      return;
    }
    const file = path.join(ROOT, path.normalize(decodeURIComponent(req.url.split("?")[0])));
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": `${TYPES[path.extname(file)] || "application/octet-stream"}; charset=utf-8` });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}/tests/browser/fixture.html`;

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "rtl-chat-test-"));
  fs.writeFileSync(path.join(profile, "user.js"), PREFS);

  const [command, args] = firefoxCommand(profile, url);
  // Its own process group: `flatpak run` leaves the browser behind when only the
  // launcher is signalled.
  const firefox = spawn(command, args, { stdio: "ignore", detached: true });
  const failedToStart = new Promise((resolve) => {
    firefox.on("error", (error) => resolve({ error: `could not start Firefox: ${error.message}` }));
    firefox.on("exit", (code) => resolve({ error: `Firefox exited with code ${code} before reporting` }));
  });
  const timedOut = new Promise((resolve) =>
    setTimeout(() => resolve({ error: `no results after ${TIMEOUT_MS / 1000}s` }), TIMEOUT_MS).unref(),
  );

  const outcome = await Promise.race([done, failedToStart, timedOut]);

  firefox.removeAllListeners("exit");
  await stopGroup(firefox.pid);
  server.close();
  fs.rmSync(profile, { recursive: true, force: true });

  if (!Array.isArray(outcome)) {
    console.error(`browser tests did not run: ${outcome.error}`);
    return 1;
  }

  const failed = outcome.filter((result) => !result.pass);
  for (const result of outcome) {
    console.log(`${result.pass ? "ok  " : "FAIL"} ${result.name}${result.pass || !result.detail ? "" : ` (${result.detail})`}`);
  }
  console.log(`\n${outcome.length - failed.length}/${outcome.length} browser checks passed`);
  return failed.length ? 1 : 0;
};

main().then((code) => process.exit(code));
