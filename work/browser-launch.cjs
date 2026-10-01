"use strict";

const fs = require("node:fs");
const path = require("node:path");

function findBrave() {
  const explicit = process.env.BRAVE_EXECUTABLE_PATH;
  if (explicit) {
    const browserPath = path.resolve(explicit);
    if (!fs.existsSync(browserPath)) {
      throw new Error(`BRAVE_EXECUTABLE_PATH does not exist: ${browserPath}`);
    }
    return browserPath;
  }

  const roots = [process.env.PROGRAMFILES, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA];
  for (const root of roots) {
    if (!root) continue;
    const browserPath = path.join(root, "BraveSoftware", "Brave-Browser", "Application", "brave.exe");
    if (fs.existsSync(browserPath)) return browserPath;
  }
  throw new Error("Brave was not found. Install Brave or set BRAVE_EXECUTABLE_PATH to its executable.");
}

function launchBrave(chromium) {
  // Disable Canvas farbling only in Playwright's disposable profile for deterministic pixel checks;
  // the player's normal Brave profile and settings remain untouched.
  return chromium.launch({ headless: true, executablePath: findBrave(), args: ["--force-color-profile=srgb", "--disable-features=BraveFarbling"] });
}

module.exports = { findBrave, launchBrave };
