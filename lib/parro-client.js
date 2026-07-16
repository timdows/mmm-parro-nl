"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { parseMessages } = require("./message-parser");

const REST_BASE = "https://rest-v2.parro.com/rest/v2";

class ParroClient {
  constructor(settings, moduleDirectory, logger = console) {
    this.settings = settings;
    this.moduleDirectory = moduleDirectory;
    this.logger = logger;
  }

  resolve(relativePath) {
    return path.resolve(this.moduleDirectory, relativePath);
  }

  async getMessages(maximumEntries = 5) {
    const sessionFile = this.resolve(this.settings.sessionFile);
    const authFile = this.resolve(this.settings.authFile);
    const debugDirectory = this.resolve(this.settings.debugOutputDirectory);
    fs.mkdirSync(path.dirname(sessionFile), { recursive: true });
    fs.mkdirSync(path.dirname(authFile), { recursive: true });
    fs.mkdirSync(debugDirectory, { recursive: true });

    const cachedAuth = this.loadAuth(authFile);
    if (cachedAuth) {
      const responseSummary = [];
      try {
        const messages = await this.fetchAllGroupMessages(cachedAuth.headers, maximumEntries, responseSummary);
        this.writeSummary(debugDirectory, responseSummary, messages.length, null, "bearer-token-cache");
        return messages;
      } catch (error) {
        this.logger.warn(`[MMM-Parro-NL] Bearer-token niet bruikbaar; OAuth-login wordt geprobeerd: ${error.message}`);
      }
    }

    return this.getMessagesThroughBrowser(maximumEntries, sessionFile, authFile, debugDirectory);
  }

  async getMessagesThroughBrowser(maximumEntries, sessionFile, authFile, debugDirectory) {
    // Alleen OAuth heeft een browser nodig. Met een geldig bearer-token kan de
    // module ook het lokale archief/API-pad gebruiken als Playwright ontbreekt.
    const { chromium } = require("playwright");
    const browser = await chromium.launch({ headless: this.settings.headless });
    const contextOptions = { locale: "nl-NL" };
    if (fs.existsSync(sessionFile)) contextOptions.storageState = sessionFile;
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const responseSummary = [];
    let authHeaders = null;

    page.on("response", (response) => {
      const contentType = response.headers()["content-type"] || "";
      const url = response.url();
      if (contentType.includes("json") && /parro\.com|parnassys\.net/.test(url)) {
        responseSummary.push(this.responseSummary(response));
      }
      if (url.startsWith(REST_BASE)) {
        const candidate = this.extractReusableHeaders(response.request().headers());
        if (candidate.authorization) authHeaders = candidate;
      }
    });

    try {
      await page.goto("https://talk.parro.com", {
        waitUntil: "domcontentloaded",
        timeout: this.settings.loginTimeoutMs
      });
      await this.enableFlutterSemantics(page);
      await this.loginIfNeeded(page);

      const deadline = Date.now() + 20000;
      while (!authHeaders && Date.now() < deadline) await page.waitForTimeout(250);
      if (!authHeaders) throw new Error("Parro is geopend, maar er is geen bearer-token ontvangen");

      this.saveAuth(authFile, authHeaders);
      await context.storageState({ path: sessionFile });
      const messages = await this.fetchAllGroupMessages(authHeaders, maximumEntries, responseSummary);
      await this.writeDiagnostics(page, debugDirectory, responseSummary, messages.length);
      return messages;
    } catch (error) {
      await this.writeDiagnostics(page, debugDirectory, responseSummary, 0, error).catch(() => {});
      throw error;
    } finally {
      await browser.close();
    }
  }

  loadAuth(file) {
    if (!fs.existsSync(file)) return null;
    try {
      const auth = JSON.parse(fs.readFileSync(file, "utf8"));
      if (!auth?.headers?.authorization) return null;
      if (auth.expiresAt && Date.parse(auth.expiresAt) <= Date.now() + 60000) return null;
      return auth;
    } catch {
      return null;
    }
  }

  saveAuth(file, headers) {
    const token = headers.authorization.replace(/^Bearer\s+/i, "");
    let expiresAt = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
      if (payload.exp) expiresAt = new Date(payload.exp * 1000).toISOString();
    } catch {
      // Niet ieder bearer-token hoeft een JWT te zijn; de API-status blijft leidend.
    }
    const value = { savedAt: new Date().toISOString(), expiresAt, headers };
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  }

  extractReusableHeaders(headers) {
    const excluded = /^(accept-encoding|connection|content-length|cookie|host|origin|referer|range|sec-|user-agent)/i;
    return Object.fromEntries(Object.entries(headers).filter(([name]) => !excluded.test(name)));
  }

  async fetchAllGroupMessages(headers, maximumEntries, responseSummary) {
    const groupUrl = `${REST_BASE}/group?dtype=identity.RHomeGroup`;
    const groupPayloads = await this.fetchPaged(groupUrl, headers, responseSummary);
    const groups = groupPayloads
      .flatMap((payload) => Array.isArray(payload.items) ? payload.items : [])
      .map((group) => {
        const self = Array.isArray(group.links) && group.links.find((link) => link.rel === "self");
        const id = self?.id || String(self?.href || "").match(/\/group\/(\d+)/)?.[1];
        return { id: id && String(id), name: group.name || "Onbekende groep" };
      })
      .filter((group) => group.id);

    if (!groups.length) throw new Error("Geen actieve Parro-groepen gevonden");

    const perGroup = await Promise.all(groups.map(async (group) => {
      const url = `${REST_BASE}/event?dtype=event.RAnnouncementEventPrimer&group=${encodeURIComponent(group.id)}`;
      const payloads = await this.fetchPaged(url, headers, responseSummary);
      return parseMessages(payloads, Number.MAX_SAFE_INTEGER)
        .map((message) => ({ ...message, group: group.name }));
    }));

    const unique = new Map();
    perGroup.flat().forEach((message) => {
      const key = message.id || `${message.group}|${message.date}|${message.title}|${message.body}`;
      if (!unique.has(key)) unique.set(key, message);
    });
    return [...unique.values()]
      .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
      .slice(0, maximumEntries);
  }

  async fetchPaged(url, headers, responseSummary) {
    const payloads = [];
    const pageSize = 20;
    let start = 0;
    let total = Infinity;

    while (start < total) {
      const end = start + pageSize - 1;
      const requestRange = `items=${start}-${end}`;
      const response = await fetch(url, {
        headers: { ...headers, accept: "application/json", range: requestRange }
      });
      const contentRange = response.headers.get("content-range");
      responseSummary.push({
        status: response.status,
        method: "GET",
        url,
        contentRange,
        requestRange
      });
      if (!response.ok) throw new Error(`Parro API gaf HTTP ${response.status} voor ${url}`);
      payloads.push(await response.json());

      const match = contentRange?.match(/items\s+(\d+)-(\d+)\/(\d+)/i);
      if (!match) break;
      total = Number(match[3]);
      start = Number(match[2]) + 1;
    }
    return payloads;
  }

  responseSummary(response) {
    return {
      status: response.status(),
      method: response.request().method(),
      url: response.url(),
      contentRange: response.headers()["content-range"] || null,
      requestRange: response.request().headers()["range"] || null
    };
  }

  async enableFlutterSemantics(page) {
    const placeholder = page.locator("flt-semantics-placeholder");
    if (await placeholder.waitFor({ state: "attached", timeout: 15000 }).then(() => true).catch(() => false)) {
      await placeholder.evaluate((element) => element.click()).catch(() => {});
      await page.waitForTimeout(500);
    }
  }

  async loginIfNeeded(page) {
    const timeout = this.settings.loginTimeoutMs;
    const onLoginSite = () => /inloggen\.parnassys\.net|account\.parnassys\.net/.test(page.url());

    if (!onLoginSite()) {
      const loginButton = page.getByRole("button", { name: /inloggen|log in/i }).first();
      if (await loginButton.isVisible({ timeout: 15000 }).catch(() => false)) {
        await loginButton.click();
        const reachedLogin = await this.waitForUrlMatch(page, /inloggen\.parnassys\.net|account\.parnassys\.net/, timeout);
        if (!reachedLogin) {
          throw new Error(`Loginpagina niet bereikt binnen ${timeout}ms (huidige URL: ${page.url()})`);
        }
      }
    }
    if (!onLoginSite()) return;

    const username = page.locator('input[type="email"], input[name*="user" i], input[name*="email" i], input[type="text"]').first();
    const automaticallyReturned = await Promise.race([
      this.waitForUrlMatch(page, /talk\.parro\.com/, timeout).then(() => true),
      username.waitFor({ state: "visible", timeout }).then(() => false)
    ]);
    if (automaticallyReturned) {
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(8000);
      await this.enableFlutterSemantics(page);
      return;
    }

    await username.fill(this.settings.username);
    const password = page.locator('input[type="password"]').first();
    if (!await password.isVisible({ timeout: 2000 }).catch(() => false)) await username.press("Enter");
    await password.waitFor({ state: "visible", timeout });
    await password.fill(this.settings.password);
    await password.press("Enter");

    let reachedParro = await this.waitForUrlMatch(page, /talk\.parro\.com/, Math.min(timeout, 15000));
    if (!reachedParro) {
      const submitButton = page.locator('button[type="submit"], input[type="submit"]').first();
      if (await submitButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await submitButton.click();
      }
      reachedParro = await this.waitForUrlMatch(page, /talk\.parro\.com/, timeout);
    }

    if (!reachedParro) {
      throw new Error(`Inloggen niet afgerond binnen ${timeout}ms (huidige URL: ${page.url()})`);
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(8000);
    await this.enableFlutterSemantics(page);
  }

  async waitForUrlMatch(page, pattern, timeout) {
    try {
      await page.waitForURL(pattern, { timeout, waitUntil: "domcontentloaded" });
      return true;
    } catch {
      const deadline = Date.now() + Math.max(2000, Math.min(timeout, 10000));
      while (Date.now() < deadline) {
        if (pattern.test(page.url())) return true;
        await page.waitForTimeout(250);
      }
      return pattern.test(page.url());
    }
  }

  writeSummary(directory, responses, messageCount, error, pageUrl) {
    const summary = {
      generatedAt: new Date().toISOString(),
      pageUrl,
      title: "Parro token-sync",
      messageCount,
      error: error?.message || null,
      responses
    };
    fs.writeFileSync(path.join(directory, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  }

  async writeDiagnostics(page, directory, responses, messageCount, error) {
    this.writeSummary(directory, responses, messageCount, error, page.url());
    fs.writeFileSync(path.join(directory, "page-text.txt"), `${await page.locator("body").innerText().catch(() => "")}\n`);
    await page.screenshot({ path: path.join(directory, "page.png"), fullPage: true });
  }
}

module.exports = { ParroClient };
