"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { selectMessages } = require("../lib/message-selection");

const messages = [
  { id: "nieuw", date: "2026-07-15T18:00:00+02:00" },
  { id: "vandaag", date: "2026-07-15T08:00:00+02:00" },
  { id: "gisteren", date: "2026-07-14T20:00:00+02:00" },
  { id: "ouder", date: "2026-07-13T20:00:00+02:00" }
];

test("toont alle berichten van vandaag", () => {
  const result = selectMessages(messages, { displayMode: "todayAndLatest", timeZone: "Europe/Amsterdam" }, new Date("2026-07-15T20:00:00+02:00"));
  assert.deepEqual(result.map((message) => message.id), ["nieuw", "vandaag"]);
});

test("toont het nieuwste bericht als er vandaag niets is", () => {
  const result = selectMessages(messages, { displayMode: "todayAndLatest", timeZone: "Europe/Amsterdam" }, new Date("2026-07-16T10:00:00+02:00"));
  assert.deepEqual(result.map((message) => message.id), ["nieuw"]);
});

test("blijft de laatste 3 of 5 ondersteunen", () => {
  assert.equal(selectMessages(messages, { displayMode: "latest", maximumEntries: 3 }).length, 3);
  assert.equal(selectMessages([...messages, { id: "extra", date: "2026-07-12T10:00:00Z" }], { displayMode: "latest", maximumEntries: 5 }).length, 5);
});
