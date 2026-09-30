const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "game.js"), "utf8");
const testSource = source.replace("update(PHYSICS_DT);",
  "if (globalThis.__beforeFrameStep) globalThis.__beforeFrameStep(); update(PHYSICS_DT);").replace(/\}\)\(\);\s*$/, `
  globalThis.__playtest = {
    resetRun, update, draw, frame, beginTether, releaseTether, keys, player, seals, startRecovery, takeHit,
    state: () => state, recoveryReady: () => recoveryReady,
    tetherAnchor: () => tetherAnchor, ropeLength: () => ropeLength,
    runTime: () => runTime,
    enterHarbor, leaveHarbor, updateSocial, openConversation, chooseConversation, closeConversation, toggleMap, travelToDock,
    socialDock: () => socialDock, conversation: () => conversation,
    startSealPractice, restartCurrentRun, targetPractice: () => targetPractice, toggleLog,
    setCamera: x => { cameraX = x; syncVisualPosition(); }
  };
})();`);
if (source === testSource) throw new Error("Playtest instrumentation failed");
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
    window.__playtestRun = true;
  </script>`).replace('src="game.js"', 'src="/work/browser-playtest.js"');
fs.writeFileSync(path.join(__dirname, "browser-playtest.js"), testSource);
fs.writeFileSync(path.join(__dirname, "browser-playtest.html"), html);
console.log("Prepared local browser playtest; player storage is isolated.");
