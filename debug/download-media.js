"use strict";

const path = require("node:path");
const readline = require("node:readline");
const { loadSettings } = require("../lib/settings");
const { MediaDownloader } = require("../lib/media-downloader");

const moduleDirectory = path.resolve(__dirname, "..");
const includeAll = process.argv.includes("--all");
const dryRun = process.argv.includes("--dry-run");

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function progressBar(current, total, width = 24) {
  const ratio = total ? Math.min(1, current / total) : 0;
  const filled = Math.round(ratio * width);
  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

let lastLogged = -1;
let lastPhase = null;
function showProgress(progress) {
  let line;
  if (progress.phase === "scan") {
    line = `Groepen scannen: ${progress.current}/${progress.total}${progress.group ? ` · ${progress.group}` : ""}`;
  } else if (progress.phase === "download") {
    const percent = progress.total ? Math.round(progress.current / progress.total * 100) : 0;
    line = `${progressBar(progress.current, progress.total)} ${String(percent).padStart(3)}%  ${progress.current}/${progress.total}`
      + ` · ${formatBytes(progress.processedBytes)}/${formatBytes(progress.bytes)}`
      + ` · nieuw ${progress.downloaded} · overgeslagen ${progress.skipped} · mislukt ${progress.failed}`;
  } else {
    return;
  }

  if (lastPhase !== progress.phase) {
    lastPhase = progress.phase;
    lastLogged = -10;
  }

  if (process.stdout.isTTY) {
    readline.clearLine(process.stdout, 0);
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(line);
    if (progress.current === progress.total) process.stdout.write("\n");
    return;
  }

  const percent = progress.total ? Math.floor(progress.current / progress.total * 100) : 0;
  if (progress.current === progress.total || percent >= lastLogged + 10) {
    console.log(line);
    lastLogged = percent;
  }
}

(async () => {
  const downloader = new MediaDownloader(loadSettings(moduleDirectory), moduleDirectory);
  console.log(dryRun ? "Parro-media inventariseren…" : "Parro-media downloaden…");
  const result = await downloader.download({ includeAll, dryRun, onProgress: showProgress });
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
