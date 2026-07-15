"use strict";

const fs = require("node:fs");
const path = require("node:path");

function messageKey(message) {
  return message.id || `${message.date || ""}|${message.title || ""}|${message.body || ""}`;
}

class MessageStore {
  constructor(file) {
    this.file = file;
  }

  load() {
    if (!fs.existsSync(this.file)) return [];
    try {
      const value = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (!Array.isArray(value)) throw new Error("het hoofdelement is geen array");
      return this.sort(value.filter((message) => message && typeof message === "object"));
    } catch (error) {
      throw new Error(`Berichtenarchief is niet leesbaar (${this.file}): ${error.message}`);
    }
  }

  merge(messages) {
    const byKey = new Map(this.load().map((message) => [messageKey(message), message]));
    messages.forEach((message) => {
      const key = messageKey(message);
      byKey.set(key, { ...byKey.get(key), ...message });
    });
    const merged = this.sort([...byKey.values()]);
    this.save(merged);
    return merged;
  }

  latest(count) {
    return this.load().slice(0, count);
  }

  save(messages) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.tmp`;
    fs.writeFileSync(temporaryFile, `${JSON.stringify(messages, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, this.file);
  }

  sort(messages) {
    return [...messages].sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
  }
}

module.exports = { MessageStore, messageKey };
