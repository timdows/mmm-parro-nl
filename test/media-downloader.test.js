"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { collectMedia, safeName } = require("../lib/media-downloader");

test("maakt veilige lokale bestandsnamen", () => {
  assert.equal(safeName('Klas 3: foto/feest?.jpg'), "Klas 3- foto-feest-.jpg");
});

test("selecteert standaard alleen bronfoto's", () => {
  const data = [{ group: { id: "1", name: "Groep A" }, events: [{
    id: "event-1", title: "Feest", sortDate: "2026-01-02T10:00:00Z",
    attachments: [
      { attachmentType: "IMAGE", uploadId: "foto", entries: [{ type: "SOURCE", url: "https://example/foto", contentType: "image/jpeg" }] },
      { attachmentType: "PDF", uploadId: "pdf", entries: [{ type: "SOURCE", url: "https://example/pdf", filename: "brief.pdf" }] }
    ]
  }] }];
  assert.equal(collectMedia(data, false).length, 1);
  assert.equal(collectMedia(data, true).length, 2);
});
