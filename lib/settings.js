"use strict";

const fs = require("node:fs");
const path = require("node:path");

function loadSettings(moduleDirectory) {
  const file = path.join(moduleDirectory, "settings.json");
  if (!fs.existsSync(file)) {
    throw new Error("settings.json ontbreekt; kopieer settings.example.json en vul je gegevens in");
  }
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`settings.json is geen geldige JSON: ${error.message}`);
  }
  if (!settings.username || !settings.password || settings.username.startsWith("jouw-")) {
    throw new Error("Vul username en password in settings.json in");
  }
  return {
    headless: true,
    loginTimeoutMs: 60000,
    sessionFile: ".cache/parro-session.json",
    authFile: ".cache/parro-auth.json",
    debugOutputDirectory: "debug-output",
    archiveFile: "data/messages.json",
    syncIntervalMs: 60 * 60 * 1000,
    maximumEntries: 5,
    ...settings
  };
}

module.exports = { loadSettings };
