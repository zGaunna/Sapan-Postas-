const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const testSource = `window.__gameOptions.debug = true;
window.__gameOptions.beforeStep = () => window.__beforeFrameStep?.();
window.__playtest = SapanGame.create(window.__gameOptions);
const setCamera = window.__playtest.setCamera;
window.__playtest.setCamera = x => { setCamera(x); window.__playtest.syncVisualPosition(); };
`;
let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
html = html.replace("<head>", `<head><base href="/">
  <script>
    // Keep automation records separate from the player's storage.
    const testStorage = new Map([["sapan-postasi-tutorial", "done"]]);
    Object.defineProperty(window, "localStorage", { value: {
      getItem: key => testStorage.get(key) ?? null,
      setItem: (key, value) => testStorage.set(key, String(value))
    }});
    window.__nativeRAF = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = () => 0;
    window.__gameOptions = { testRun: true };
  </script>`).replace('src="game-start.js"', 'src="/work/browser-playtest.js"');
fs.writeFileSync(path.join(__dirname, "browser-playtest.js"), testSource);
fs.writeFileSync(path.join(__dirname, "browser-playtest.html"), html);
console.log("Prepared local browser playtest; player storage is isolated.");
