"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { findBrave } = require("./browser-launch.cjs");

const root = path.resolve(__dirname, "..");
const checks = ["motion", "harbor", "progression", "performance"];
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function serve(request, response) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  let name;
  try {
    name = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  const file = path.resolve(root, `.${name === "/" ? "/index.html" : name}`);
  const relative = path.relative(root, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    response.writeHead(403).end();
    return;
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "Content-Type": mimeTypes[path.extname(file)] || "application/octet-stream" });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(file).pipe(response);
  });
}

function run(script, args = [], env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--preserve-symlinks", "--preserve-symlinks-main", path.join(__dirname, script), ...args], {
      cwd: root, env, stdio: "inherit"
    });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed (${signal || `exit ${code}`})`));
    });
  });
}

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  return new Promise(resolve => server.close(resolve));
}

(async () => {
  const brave = findBrave();
  console.log(`Browser checks use Brave: ${brave}`);
  await run("prepare-browser-playtest.cjs");
  const server = http.createServer(serve);
  try {
    const port = await listen(server);
    const env = { ...process.env, GAME_URL: `http://127.0.0.1:${port}`, BRAVE_EXECUTABLE_PATH: brave };
    for (const name of checks) {
      console.log(`Running browser-${name}-check`);
      await run(`browser-${name}-check.cjs`, process.argv[2] ? [process.argv[2]] : [], env);
    }
    console.log("BROWSER_ALL_PASS");
  } finally {
    if (server.listening) await close(server);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
