"use strict";

const fs = require("node:fs");
const path = require("node:path");

const moduleDirectory = path.resolve(__dirname, "..");
let failures = 0;

function check(label, ok, detail) {
  const icon = ok ? "OK" : "FOUT";
  console.log(`[${icon}] ${label}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures += 1;
}

function warning(label, detail) {
  console.log(`[WAARSCHUWING] ${label}${detail ? `: ${detail}` : ""}`);
}

(async () => {
  const nodeMajor = Number(process.versions.node.split(".")[0]);
  check("Node.js", nodeMajor >= 22, `${process.version} (vereist: 22+)`);
  check("Platform", true, `${process.platform} ${process.arch}`);
  if (path.basename(moduleDirectory) === "MMM-Parro-NL") {
    check("Modulemap", true, moduleDirectory);
  } else {
    warning("Modulemap heet niet exact MMM-Parro-NL", moduleDirectory);
  }

  let settings;
  try {
    const { loadSettings } = require("../lib/settings");
    settings = loadSettings(moduleDirectory);
    check("settings.json", true, "geldige JSON en accountvelden aanwezig");
  } catch (error) {
    check("settings.json", false, error.message);
  }

  if (settings) {
    try {
      const { MessageStore } = require("../lib/message-store");
      const archive = new MessageStore(path.resolve(moduleDirectory, settings.archiveFile)).load();
      check("Berichtenarchief", true, `${archive.length} bericht(en)`);
    } catch (error) {
      check("Berichtenarchief", false, error.message);
    }

    const authFile = path.resolve(moduleDirectory, settings.authFile);
    if (fs.existsSync(authFile)) {
      try {
        const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));
        const valid = !auth.expiresAt || Date.parse(auth.expiresAt) > Date.now();
        if (valid) {
          check("Bearer-cache", true, auth.expiresAt ? `verloopt ${auth.expiresAt}` : "geen vervaldatum in token");
        } else {
          warning("Bearer-cache is verlopen", "OAuth wordt bij de volgende sync gebruikt");
        }
      } catch (error) {
        check("Bearer-cache", false, `niet leesbaar: ${error.message}`);
      }
    } else {
      console.log("[INFO] Bearer-cache ontbreekt; eerste sync gebruikt OAuth-login");
    }
  }

  try {
    const { chromium } = require("playwright");
    const executable = chromium.executablePath();
    check("Playwright-pakket", true, require("playwright/package.json").version);
    check("Chromium-bestand", fs.existsSync(executable), executable);
    if (fs.existsSync(executable)) {
      const browser = await chromium.launch({ headless: true });
      await browser.close();
      check("Chromium starten", true, "headless start/stop geslaagd");
    }
  } catch (error) {
    check("Playwright/Chromium", false, error.message.split("\n")[0]);
  }

  console.log(failures ? `\nDiagnose afgerond met ${failures} fout(en).` : "\nDiagnose volledig geslaagd.");
  process.exitCode = failures ? 1 : 0;
})();
