"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ParroClient } = require("./parro-client");

const REST_BASE = "https://rest-v2.parro.com/rest/v2";
const ALL_TYPES = new Set(["IMAGE", "VIDEO", "PDF", "DOCUMENT", "SPREADSHEET"]);

function safeName(value, fallback = "zonder-naam") {
  const safe = String(value || "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return safe || fallback;
}

function extensionFor(entry) {
  const extensions = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png",
    "image/gif": ".gif", "image/webp": ".webp", "video/mp4": ".mp4",
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx"
  };
  if (entry.filename && path.extname(entry.filename)) return path.extname(entry.filename).toLowerCase();
  return extensions[String(entry.contentType || "").toLowerCase()] || ".bin";
}

function collectMedia(groupsWithEvents, includeAll = false) {
  const allowed = includeAll ? ALL_TYPES : new Set(["IMAGE"]);
  const media = [];
  for (const { group, events } of groupsWithEvents) {
    for (const event of events) {
      for (const attachment of event.attachments || []) {
        if (!allowed.has(attachment.attachmentType)) continue;
        const entries = (attachment.entries || []).filter((entry) => {
          if (!entry.url) return false;
          if (attachment.attachmentType === "VIDEO") return entry.type === "VIDEO";
          return entry.type === "SOURCE";
        });
        entries.forEach((entry, entryIndex) => {
          const eventId = event.id || event.links?.find((link) => link.rel === "self")?.id || "event";
          const key = `${group.id}/${eventId}/${attachment.uploadId || attachment.index}/${entryIndex}/${entry.type}`;
          const date = String(event.sortDate || event.createdAt || "zonder-datum").slice(0, 10);
          const identifier = safeName(attachment.uploadId || eventId, "media").slice(0, 32);
          const base = entry.filename
            ? `${date}_${identifier}_${safeName(entry.filename)}`
            : `${date}_${safeName(event.title, "bericht")}_${safeName(attachment.uploadId || attachment.index, "media")}${extensionFor(entry)}`;
          media.push({ key, group: group.name, eventTitle: event.title || "", date, filename: base, url: entry.url, size: Number(entry.size) || 0, contentType: entry.contentType || "" });
        });
      }
    }
  }
  return media;
}

class MediaDownloader {
  constructor(settings, moduleDirectory, logger = console) {
    this.settings = settings;
    this.moduleDirectory = moduleDirectory;
    this.logger = logger;
    this.client = new ParroClient(settings, moduleDirectory, logger);
  }

  async scan(includeAll = false) {
    // Valideert de token en vernieuwt via OAuth indien nodig.
    await this.client.getMessages(1);
    const auth = this.client.loadAuth(path.resolve(this.moduleDirectory, this.settings.authFile));
    if (!auth) throw new Error("Geen geldige bearer-token beschikbaar voor de mediadownload");
    const summaries = [];
    const groupPayloads = await this.client.fetchPaged(`${REST_BASE}/group?dtype=identity.RHomeGroup`, auth.headers, summaries);
    const groups = groupPayloads.flatMap((payload) => payload.items || []).map((value) => {
      const self = value.links?.find((link) => link.rel === "self");
      return { id: String(self?.id || ""), name: value.name || "Onbekende groep" };
    }).filter((group) => group.id);

    const groupsWithEvents = await Promise.all(groups.map(async (group) => {
      const url = `${REST_BASE}/event?dtype=event.RAnnouncementEventPrimer&group=${encodeURIComponent(group.id)}`;
      const payloads = await this.client.fetchPaged(url, auth.headers, summaries);
      return { group, events: payloads.flatMap((payload) => payload.items || []) };
    }));
    return collectMedia(groupsWithEvents, includeAll);
  }

  async download({ includeAll = false, dryRun = false } = {}) {
    const items = await this.scan(includeAll);
    const directory = path.resolve(this.moduleDirectory, this.settings.mediaDownloadDirectory);
    const manifestFile = path.join(directory, ".parro-media-manifest.json");
    let manifest = {};
    if (fs.existsSync(manifestFile)) {
      try { manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8")); } catch { manifest = {}; }
    }

    const result = { found: items.length, bytes: items.reduce((sum, item) => sum + item.size, 0), downloaded: 0, skipped: 0, failed: 0, directory };
    if (dryRun) return result;
    fs.mkdirSync(directory, { recursive: true });

    for (const item of items) {
      const groupDirectory = path.join(directory, safeName(item.group));
      const target = path.join(groupDirectory, safeName(item.filename, "media.bin"));
      if (manifest[item.key] && fs.existsSync(path.resolve(directory, manifest[item.key].file))) {
        result.skipped += 1;
        continue;
      }
      try {
        fs.mkdirSync(groupDirectory, { recursive: true });
        const response = await fetch(item.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const temporary = `${target}.part`;
        fs.writeFileSync(temporary, Buffer.from(await response.arrayBuffer()));
        fs.renameSync(temporary, target);
        manifest[item.key] = { file: path.relative(directory, target), group: item.group, eventTitle: item.eventTitle, date: item.date, downloadedAt: new Date().toISOString() };
        result.downloaded += 1;
        fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
      } catch (error) {
        result.failed += 1;
        this.logger.error(`Download mislukt (${item.group}/${item.filename}): ${error.message}`);
      }
    }
    return result;
  }
}

module.exports = { MediaDownloader, collectMedia, safeName, extensionFor };
