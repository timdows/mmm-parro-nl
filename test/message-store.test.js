"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MessageStore } = require("../lib/message-store");

test("archiveert, dedupliceert en bewaart verdwenen berichten", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mmm-parro-store-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const store = new MessageStore(path.join(directory, "messages.json"));

  store.merge([
    { id: "oud", title: "Oud", body: "Blijft bewaard", date: "2026-01-01T10:00:00Z" },
    { id: "nieuw", title: "Nieuw", body: "Versie 1", date: "2026-01-02T10:00:00Z" }
  ]);
  store.merge([
    { id: "nieuw", title: "Nieuw", body: "Versie 2", date: "2026-01-02T10:00:00Z" },
    { id: "nieuwst", title: "Nieuwst", body: "Hallo", date: "2026-01-03T10:00:00Z" }
  ]);

  assert.equal(store.load().length, 3);
  assert.deepEqual(store.latest(2).map((message) => message.id), ["nieuwst", "nieuw"]);
  assert.equal(store.load().find((message) => message.id === "nieuw").body, "Versie 2");
  assert.equal(store.load().some((message) => message.id === "oud"), true);
});

test("meldt een beschadigd archief duidelijk", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "mmm-parro-store-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "messages.json");
  fs.writeFileSync(file, "geen json", "utf8");
  assert.throws(() => new MessageStore(file).load(), /Berichtenarchief is niet leesbaar/);
});
