const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.join(__dirname, "..");
const checks = [
  "check-game", "playtest-route", "check-frame-loop", "check-delivery",
  "check-courier", "check-motion", "check-world", "check-social",
  "check-harbor", "check-harbor-map", "check-target", "check-target-practice",
  "check-log", "check-progression", "check-result"
];

function run(args) {
  // OneDrive checkouts can reject Node's entry-point realpath lookup.
  const result = spawnSync(process.execPath,
    ["--preserve-symlinks", "--preserve-symlinks-main", ...args],
    { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run(["--check", "game.js"]);
run(["--check", "game-start.js"]);
run(["--check", "level-data.js"]);
for (const check of checks) run([`work/${check}.cjs`]);
