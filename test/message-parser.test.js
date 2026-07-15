"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseMessages, plainText } = require("../lib/message-parser");

test("verwijdert HTML uit berichttekst", () => {
  assert.equal(plainText("Hallo<br><b>ouders</b> &amp; kinderen"), "Hallo\nouders & kinderen");
});

test("behoudt regeleinden, alinea's en lijsten", () => {
  assert.equal(
    plainText("<p>Eerste regel<br>Tweede regel</p><p>Nieuwe alinea</p><ul><li>Eén</li><li>Twee</li></ul>"),
    "Eerste regel\nTweede regel\nNieuwe alinea\n• Eén\n• Twee"
  );
});

test("vindt, sorteert en begrenst geneste berichten", () => {
  const payload = { data: { announcements: [
    { id: 1, title: "Oud", content: "Eerste", createdAt: "2026-01-01T10:00:00Z", group: { name: "A" } },
    { id: 2, subject: "Nieuw", body: "Tweede", createdAt: "2026-01-02T10:00:00Z", sender: { displayName: "Juf" } }
  ] } };
  const result = parseMessages([payload], 1);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Nieuw");
  assert.equal(result[0].author, "Juf");
});

test("leest het Parro-mededelingenmodel", () => {
  const result = parseMessages([{ items: [{
    title: "Nieuws",
    contents: "Hallo <b>groep</b>",
    sortDate: "2026-07-14T20:23:13+02:00",
    owner: { firstname: "Jan", surname: "Jansen" }
  }] }], 5);
  assert.deepEqual(result[0], {
    id: "", title: "Nieuws", body: "Hallo groep",
    date: "2026-07-14T20:23:13+02:00", author: "Jan Jansen", group: ""
  });
});
