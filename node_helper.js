"use strict";

const NodeHelper = require("node_helper");
const path = require("node:path");
const { loadSettings } = require("./lib/settings");
const { MessageStore } = require("./lib/message-store");
const { selectMessages } = require("./lib/message-selection");

module.exports = NodeHelper.create({
  start() {
    this.timer = null;
    this.running = false;
  },

  stop() {
    if (this.timer) clearInterval(this.timer);
  },

  socketNotificationReceived(notification, config) {
    if (notification !== "PARRO_CONFIG") return;
    console.log("[MMM-Parro-NL] Configuratie ontvangen van MagicMirror");
    this.config = config;
    if (this.timer) clearInterval(this.timer);
    try {
      this.settings = loadSettings(path.resolve(__dirname));
      this.store = new MessageStore(path.resolve(__dirname, this.settings.archiveFile));
      this.sendStoredMessages();
      this.syncMessages();
      this.timer = setInterval(
        () => this.syncMessages(),
        Math.max(60000, Number(this.settings.syncIntervalMs) || 60 * 60 * 1000)
      );
    } catch (error) {
      console.error(`[MMM-Parro-NL] Initialisatie mislukt: ${error.stack || error.message}`);
      this.sendSocketNotification("PARRO_ERROR", { message: error.message });
    }
  },

  displayCount() {
    return Number(this.config.maximumEntries) === 3 ? 3 : 5;
  },

  sendStoredMessages() {
    const messages = selectMessages(this.store.load(), {
      displayMode: this.config.displayMode,
      maximumEntries: this.displayCount(),
      timeZone: this.config.timeZone
    });
    console.log(`[MMM-Parro-NL] ${messages.length} lokaal opgeslagen bericht(en) naar frontend gestuurd`);
    this.sendSocketNotification("PARRO_MESSAGES", messages);
  },

  async syncMessages() {
    if (this.running) return;
    this.running = true;
    try {
      const moduleDirectory = path.resolve(__dirname);
      // Lazy require: als Playwright/Node incompatibel is, blijft node_helper
      // actief en verschijnt de echte fout in MagicMirror in plaats van eeuwig laden.
      const { ParroClient } = require("./lib/parro-client");
      console.log("[MMM-Parro-NL] Parro-synchronisatie gestart");
      const client = new ParroClient(this.settings, moduleDirectory);
      const messages = await client.getMessages(Number.MAX_SAFE_INTEGER);
      this.store.merge(messages);
      console.log(`[MMM-Parro-NL] Synchronisatie gereed; ${messages.length} serverbericht(en) verwerkt`);
      this.sendStoredMessages();
    } catch (error) {
      console.error(`[MMM-Parro-NL] ${error.stack || error.message}`);
      let hasArchive = false;
      try {
        hasArchive = this.store.load().length > 0;
      } catch {
        // De oorspronkelijke fout hieronder is voldoende voor de frontend.
      }
      if (!hasArchive) {
        this.sendSocketNotification("PARRO_ERROR", { message: error.message });
      }
    } finally {
      this.running = false;
    }
  }
});
