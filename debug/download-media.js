"use strict";

const path = require("node:path");
const { loadSettings } = require("../lib/settings");
const { MediaDownloader } = require("../lib/media-downloader");

const moduleDirectory = path.resolve(__dirname, "..");
const includeAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");

(async () => {
  const downloader = new MediaDownloader(loadSettings(moduleDirectory), moduleDirectory);
  console.log(dryRun ? "Parro-media inventariseren…" : "Parro-media downloaden…");
  const result = await downloader.download({ includeAll, dryRun });
  const megabytes = (result.bytes / 1024 / 1024).toFixed(1);
  console.log(`Gevonden: ${result.found} bestand(en), circa ${megabytes} MB`);
  if (!dryRun) {
    console.log(`Gedownload: ${result.downloaded}; overgeslagen: ${result.skipped}; mislukt: ${result.failed}`);
    console.log(`Map: ${result.directory}`);
  }
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
