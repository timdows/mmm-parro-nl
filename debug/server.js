"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { loadSettings } = require("../lib/settings");
const { ParroClient } = require("../lib/parro-client");
const { MessageStore } = require("../lib/message-store");
const { LastSyncedStore } = require("../lib/last-synced-store");

const moduleDirectory = path.resolve(__dirname, "..");
const mock = process.argv.includes("--mock");
const port = Number(process.env.PORT || 8080);
const mockMessages = [
  { title: "Schoolreisje groep 5", group: "Groep 5", author: "Juf Noor", date: new Date().toISOString(), body: "Vrijdag vertrekken we om 08:30. Vergeet geen lunchpakket mee te geven." },
  { title: "Nieuwe foto's", group: "De Regenbogen", author: "Meester Sam", date: new Date(Date.now() - 86400000).toISOString(), body: "De foto's van de sportdag staan in Parro." },
  { title: "Bibliotheek", group: "Groep 5", author: "Juf Noor", date: new Date(Date.now() - 172800000).toISOString(), body: "Maandag mogen de kinderen hun bibliotheekboek weer meenemen." }
];

let settings;
let store;
let lastSyncedStore;
let lastSyncedAt = null;
let setupError;
let inFlight;

if (!mock) {
  try {
    settings = loadSettings(moduleDirectory);
    store = new MessageStore(path.resolve(moduleDirectory, settings.archiveFile));
    lastSyncedStore = new LastSyncedStore(path.resolve(moduleDirectory, settings.lastSyncedFile));
    lastSyncedAt = lastSyncedStore.load();
  } catch (error) {
    setupError = error;
  }
}

async function syncMessages() {
  if (mock || setupError) return;
  if (!inFlight) {
    inFlight = (async () => {
      const client = new ParroClient(settings, moduleDirectory);
      const merged = store.merge(await client.getMessages(Number.MAX_SAFE_INTEGER));
      lastSyncedAt = new Date().toISOString();
      lastSyncedStore.save(lastSyncedAt);
      return merged;
    })().finally(() => { inFlight = null; });
  }
  return inFlight;
}

async function messages() {
  if (mock) return mockMessages;
  if (setupError) throw setupError;
  let archived = store.latest(Number(settings.maximumEntries) === 3 ? 3 : 5);
  if (!archived.length) {
    await syncMessages();
    archived = store.latest(Number(settings.maximumEntries) === 3 ? 3 : 5);
  }
  return archived;
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/api/messages") {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    try {
      const payloadMessages = await messages();
      response.end(JSON.stringify({
        messages: payloadMessages,
        lastSyncedAt: mock ? new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString() : lastSyncedAt,
        staleAfterDays: Number(settings?.staleAfterDays) >= 0 ? Number(settings.staleAfterDays) : 3,
        hideMessagesAfterDays: Number(settings?.hideMessagesAfterDays) >= 0 ? Number(settings.hideMessagesAfterDays) : 7
      }));
    } catch (error) {
      response.statusCode = 500;
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  const file = request.url === "/debug.css" ? "debug.css" : request.url === "/debug.js" ? "debug.js" : "index.html";
  const contentTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  response.setHeader("Content-Type", `${contentTypes[path.extname(file)]}; charset=utf-8`);
  response.end(fs.readFileSync(path.join(__dirname, file)));
});

server.listen(port, "127.0.0.1", () => {
  console.log(`MMM-Parro-NL debug${mock ? " (voorbeelddata)" : ""}: http://localhost:${port}`);
  if (!mock && !setupError) {
    syncMessages().catch((error) => console.error(`[MMM-Parro-NL] Synchronisatie mislukt: ${error.message}`));
    const interval = setInterval(
      () => syncMessages().catch((error) => console.error(`[MMM-Parro-NL] Synchronisatie mislukt: ${error.message}`)),
      Math.max(60000, Number(settings.syncIntervalMs) || 60 * 60 * 1000)
    );
    interval.unref();
  }
});
