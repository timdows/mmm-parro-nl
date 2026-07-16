"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { LastSyncedStore } = require("../lib/last-synced-store");

test("slaagt op en leest de laatste succesvolle synchronisatietijd", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mmm-parro-last-sync-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "lastSynced.json");
  const store = new LastSyncedStore(file);
  const value = "2026-07-16T09:30:00.000Z";

  store.save(value);

  assert.equal(store.load(), value);
});

test("geeft null terug bij onleesbare of ongeldige inhoud", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mmm-parro-last-sync-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "lastSynced.json");
  const store = new LastSyncedStore(file);

  fs.writeFileSync(file, "geen json", "utf8");
  assert.equal(store.load(), null);

  fs.writeFileSync(file, JSON.stringify({ lastSyncedAt: "niet-een-datum" }), "utf8");
  assert.equal(store.load(), null);
});