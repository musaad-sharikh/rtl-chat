"use strict";

// A minimal client for Firefox's Marionette protocol: length-prefixed JSON over TCP.
// Enough to install the extension, drive pages and reach the browser's own UI.

const net = require("node:net");

class Marionette {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.hello = new Promise((resolve) => (this.onHello = resolve));
    socket.on("data", (chunk) => this.read(chunk));
    socket.on("close", () => {
      for (const { reject } of this.pending.values()) reject(new Error("Marionette connection closed"));
      this.pending.clear();
    });
  }

  static async connect(port, host = "127.0.0.1") {
    const socket = await new Promise((resolve, reject) => {
      const s = net.connect(port, host, () => resolve(s));
      s.once("error", reject);
    });
    const client = new Marionette(socket);
    await client.hello;
    return client;
  }

  read(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    for (;;) {
      const colon = this.buffer.indexOf(":");
      if (colon === -1) return;
      const length = Number(this.buffer.subarray(0, colon).toString());
      if (this.buffer.length < colon + 1 + length) return;
      const packet = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length).toString());
      this.buffer = this.buffer.subarray(colon + 1 + length);
      if (!Array.isArray(packet)) {
        this.onHello(packet);
        continue;
      }
      const [, id, error, result] = packet;
      const waiter = this.pending.get(id);
      if (!waiter) continue;
      this.pending.delete(id);
      if (error) waiter.reject(new Error(`${error.error}: ${error.message}`));
      else waiter.resolve(result);
    }
  }

  send(name, params = {}) {
    const id = this.nextId++;
    const body = JSON.stringify([0, id, name, params]);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.write(`${Buffer.byteLength(body)}:${body}`);
    });
  }

  async newSession() {
    return this.send("WebDriver:NewSession", { capabilities: { alwaysMatch: { pageLoadStrategy: "eager" } } });
  }

  async context(value) {
    await this.send("Marionette:SetContext", { value });
  }

  async navigate(url) {
    await this.send("WebDriver:Navigate", { url });
  }

  // Runs a function body in the page (or in the browser UI when the context is "chrome").
  async run(script, args = []) {
    const { value } = await this.send("WebDriver:ExecuteScript", { script, args, newSandbox: false });
    return value;
  }

  // As run(), for a body that calls its last argument when it is done.
  async runAsync(script, args = [], timeout = 30000) {
    await this.send("WebDriver:SetTimeouts", { script: timeout });
    const { value } = await this.send("WebDriver:ExecuteAsyncScript", { script, args, newSandbox: false });
    return value;
  }

  async installAddon(path) {
    const { value } = await this.send("Addon:Install", { path, temporary: true });
    return value;
  }

  async screenshot() {
    const { value } = await this.send("WebDriver:TakeScreenshot", { full: false });
    return Buffer.from(value, "base64");
  }

  close() {
    this.socket.destroy();
  }
}

module.exports = { Marionette };
