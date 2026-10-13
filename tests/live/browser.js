"use strict";

// Shared helpers for the live checks: connect to the Firefox that start.js launched,
// type and click the way a user does, save screenshots.

const fs = require("node:fs");
const path = require("node:path");
const { Marionette } = require("./marionette.js");

const ROOT = path.join(__dirname, "..", "..");
const SHOTS = path.join(__dirname, "shots");
const PORT = Number(process.env.MARIONETTE_PORT || 28281);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const open = async () => {
  const m = await Marionette.connect(PORT);
  await m.newSession();
  return m;
};

const shot = async (m, name) => {
  fs.mkdirSync(SHOTS, { recursive: true });
  fs.writeFileSync(path.join(SHOTS, `${name}.png`), await m.screenshot());
};

const click = async (m, selector) => {
  const { value } = await m.send("WebDriver:FindElement", { using: "css selector", value: selector });
  await m.send("WebDriver:ElementClick", { id: Object.values(value)[0] });
};

// Types through the keyboard action queue: keys go to whatever holds the focus,
// which is what rich editors (Lexical, ProseMirror, Quill) expect.
const keys = async (m, text) => {
  const actions = [];
  for (const char of text) actions.push({ type: "keyDown", value: char }, { type: "keyUp", value: char });
  await m.send("WebDriver:PerformActions", { actions: [{ type: "key", id: "kbd", actions }] });
  await m.send("WebDriver:ReleaseActions");
};

const ENTER = "\uE007";

// Dismisses a cookie banner by declining, where the site shows one.
const declineCookies = (m) =>
  m.run(`const b = [...document.querySelectorAll("button")].find(b => /^(Decline optional|Reject All)$/.test(b.textContent.trim())); if (b) b.click();`);

const setLanguages = async (m, value) => {
  await m.context("chrome");
  try {
    await m.run(`Services.prefs.setCharPref("intl.accept_languages", arguments[0])`, [value]);
  } finally {
    await m.context("content");
  }
};

module.exports = { ROOT, PORT, ENTER, open, shot, sleep, click, keys, declineCookies, setLanguages };
