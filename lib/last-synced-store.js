"use strict";

const fs = require("node:fs");
const path = require("node:path");

class LastSyncedStore {
  constructor(file) {
    this.file = file;
  }

  load() {
    if (!fs.existsSync(this.file)) return null;
    try {
      const value = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (!value || typeof value !== "object") return null;
      if (typeof value.lastSyncedAt !== "string") return null;
      return Number.isNaN(Date.parse(value.lastSyncedAt)) ? null : value.lastSyncedAt;
    } catch {
      return null;
    }
  }

  save(lastSyncedAt) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temporaryFile = `${this.file}.tmp`;
    const payload = {
      lastSyncedAt
    };
    fs.writeFileSync(temporaryFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    fs.renameSync(temporaryFile, this.file);
  }
}

module.exports = { LastSyncedStore };