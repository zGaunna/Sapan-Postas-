(() => {
  "use strict";

  const W = 1280;
  const H = 720;
  const ROUTE_END = 17400;
  const SHIFT_SECONDS = 115;
  const GRAVITY = 430;
  const MIN_ROPE_LENGTH = 118;
  const MAX_ROPE_LENGTH = 460;
  const ROPE_REEL_SPEED = 220;
  const MAX_PLAYER_SPEED = 700;
  const BASE_PLAYER_VX_MAX = 325;
  const CLEAN_RELEASE_ANGLE = 22 * Math.PI / 180;
  const SLING = { baseImpulse: 40, bonusImpulse: 60, seconds: 1.2, vxCap: 400 };
  const FRAGILE_HOLD_SECONDS = 1.55;
  const WINCH_REEL_SPEED = 135;
  const PHYSICS_DT = 1 / 120;
  const BEST_TIME_KEY = "sapan-postasi-best-time";
  const DELIVERY_TIME_KEY = "sapan-postasi-best-time-full";
  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d", { alpha: false });
  const ui = {
    hud: document.querySelector("#hud"), start: document.querySelector("#start-screen"),
    pause: document.querySelector("#pause-screen"), result: document.querySelector("#result-screen"),
    touch: document.querySelector("#touch-controls"), score: document.querySelector("#score"),
    seals: document.querySelector("#seals"), sealMarks: document.querySelector("#seal-marks"), lives: document.querySelector("#lives"),
    routeFill: document.querySelector("#route-fill"), routeMarker: document.querySelector("#route-marker"),
    clock: document.querySelector("#route-clock"),
    hint: document.querySelector("#hint"), releaseCue: document.querySelector("#release-cue"),
    tutorial: document.querySelector("#tutorial-cue"),
    tutorialStep: document.querySelector("#tutorial-step"),
    tutorialCopy: document.querySelector("#tutorial-copy"),
    tutorialSkip: document.querySelector("#tutorial-skip"),
    rope: document.querySelector("#rope-readout"),
    ropeLength: document.querySelector("#rope-length"),
    ropeFill: document.querySelector("#rope-fill"),
    combo: document.querySelector("#combo"),
    bestStart: document.querySelector("#best-start"), bestResult: document.querySelector("#best-result"),
    resultKicker: document.querySelector("#result-kicker"), resultTitle: document.querySelector("#result-title"),
    resultCopy: document.querySelector("#result-copy"), finalScore: document.querySelector("#final-score"),
    resultScoreLabel: document.querySelector("#result-score-label"),
    finalHits: document.querySelector("#final-hits"), finalThrows: document.querySelector("#final-throws"),
    runTime: document.querySelector("#run-time"), finalTime: document.querySelector("#final-time"),
    bestTimeStart: document.querySelector("#best-time-start"), bestTimeResult: document.querySelector("#best-time-result"),
    deliveryTimeStart: document.querySelector("#delivery-time-start"), deliveryTimeResult: document.querySelector("#delivery-time-result"),
    newDeliveryBest: document.querySelector("#new-delivery-best"), resultSealMarks: document.querySelector("#result-seal-marks"),
    newTimeBest: document.querySelector("#new-time-best"), splits: document.querySelector("#result-splits"),
    finalSeals: document.querySelector("#final-seals"), newBest: document.querySelector("#new-best"),
    sound: document.querySelector("#sound-toggle"), pauseButton: document.querySelector("#pause-button"),
    tetherTouch: document.querySelector("#tether-touch"),
    previewButton: document.querySelector("#preview-toggle")
  };

  const anchorHeights = [305, 265, 370, 295, 405, 300, 345, 250, 390, 310, 420, 285, 360];
  const fragileAnchorIds = new Set([6, 10, 18]);
  const winchAnchorIds = new Set([13, 24]);
  const anchors = Array.from({ length: 27 }, (_, i) => ({
    id: i, x: 440 + i * 650, y: anchorHeights[i % anchorHeights.length],
    type: fragileAnchorIds.has(i) ? "fragile" : winchAnchorIds.has(i) ? "winch" : "normal",
    visited: false, fragileElapsed: 0
  }));
  const seals = [
    { id: 1, approachRing: 2, x: 2275, y: 540, collected: false, missedNotified: false },
    { id: 2, approachRing: 13, x: 9050, y: 330, collected: false, missedNotified: false },
    { id: 3, approachRing: 21, x: 14150, y: 480, collected: false, missedNotified: false }
  ];
  const hazards = [
    { x: 3200, y: 470, r: 24, phase: 0, moving: false },
    { x: 4850, y: 455, r: 22, phase: 1, moving: false },
    { x: 6480, y: 335, r: 24, phase: 2, moving: false },
    { x: 8120, y: 405, r: 24, phase: 0, moving: true },
    { x: 9730, y: 310, r: 22, phase: 2, moving: true },
    { x: 11390, y: 455, r: 25, phase: 1, moving: true },
    { x: 13020, y: 350, r: 22, phase: 0, moving: true },
    { x: 14750, y: 300, r: 24, phase: 2, moving: true },
  ];
  const checkpoints = [5900, 11200];
  const practiceStarts = [150, ...checkpoints];
  const skyline = Array.from({ length: 28 }, (_, i) => ({
    x: i * 78 + ((i * 37) % 33), h: 70 + ((i * 53) % 145), w: 40 + ((i * 29) % 36),
    lit: (i * 7) % 5
  }));
  const stars = Array.from({ length: 76 }, (_, i) => ({
    x: (i * 173 + 29) % W, y: 24 + ((i * 89) % 300), r: 0.6 + ((i * 3) % 12) / 10,
    a: 0.22 + ((i * 11) % 50) / 100
  }));

  let state = "menu";
  let cameraX = 0;
  let elapsed = 0;
  let runTime = 0;
  let splitTimes = [];
  let remaining = SHIFT_SECONDS;
  let lastFrame = 0;
  let frameAccumulator = 0;
  let hudClock = 0;
  let messageUntil = 0;
  let combo = 0;
  let boostTime = 0;
  let lives = 3;
  let score = 0;
  let sealCount = 0;
  let checkpointX = 150;
  let invulnerable = 0;
  let recoveryReady = false;
  const recoveryBlockedKeys = new Set();
  let tetherHeld = false;
  let tetherAnchor = null;
  let ropeLength = 0;
  let ropeLengthRate = 0;
  let tetherTime = 0;
  let fragileWarningPlayed = false;
  let practiceIndex = -1;
  let previewOn = true;
  let runStats = { hits: 0, cleanThrows: 0, ringBreaks: 0, segments: [0, 0, 0], hitLog: [] };
  let tutorialActive = false;
  let tutorialStep = 0;
  let tutorialTimer = 0;
  let soundOn = false;
  let audio = null;
  let steerPointer = new Map();
  let tetherPointerY = new Map();
  let tetherPointerId = null;
  let nearMissed = new Set();
  const player = { x: 165, y: 420, vx: 155, vy: -160, radius: 17 };

  function readBest() {
    try {
      const value = Number(localStorage.getItem("sapan-postasi-best"));
      return Number.isFinite(value) && value > 0 ? value : 0;
    }
    catch { return 0; }
  }

  let best = readBest();
  let bestTime = null;
  let bestDeliveryTime = null;
  try { bestTime = readBestRunTime(localStorage); } catch { /* Storage can be blocked. */ }
  try { bestDeliveryTime = readBestRunTime(localStorage, DELIVERY_TIME_KEY); } catch { /* Storage can be blocked. */ }

  // Süre yardımcıları Sonnet 5.5 ile hazırlandı; depolama hataları oyunu durdurmaz.
  function formatRunTime(seconds) {
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) return "—";
    const total = Math.floor(seconds * 100 + 1e-9);
    const minutes = Math.floor(total / 6000);
    const rest = total % 6000;
    const s = Math.floor(rest / 100);
    const cs = rest % 100;
    return minutes + ":" + String(s).padStart(2, "0") + "." + String(cs).padStart(2, "0");
  }

  function parseBestSeconds(raw) {
    let value = null;
    if (typeof raw === "number") value = raw;
    else if (typeof raw === "string" && /^\d+(?:\.\d+)?$/.test(raw)) value = Number(raw);
    return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
  }

  function readBestRunTime(storage, key = BEST_TIME_KEY) {
    try {
      if (!storage || typeof storage.getItem !== "function") return null;
      return parseBestSeconds(storage.getItem(key));
    } catch { return null; }
  }

  function saveBestRunTime(storage, seconds, key = BEST_TIME_KEY) {
    const previous = readBestRunTime(storage, key);
    const unchanged = { bestTime: previous, improved: false, saved: false };
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return unchanged;
    const text = seconds.toFixed(6);
    const candidate = parseBestSeconds(text);
    if (candidate === null || (previous !== null && candidate >= previous)) return unchanged;
    try {
      if (!storage || typeof storage.setItem !== "function") return unchanged;
      storage.setItem(key, text);
    } catch { return unchanged; }
    return { bestTime: candidate, improved: true, saved: true };
  }

  function hasCompletedTutorial() {
    try { return localStorage.getItem("sapan-postasi-tutorial") === "done"; }
    catch { return false; }
  }

  function updateTutorialPrompt() {
    const visible = state === "playing" && tutorialActive;
    ui.hud.classList.toggle("tutorial-active", visible);
    ui.tutorial.hidden = !visible;
    if (!visible) return;

    const touch = !ui.touch.hidden;
    const holdControl = touch ? "TUTUN düğmesini" : "SPACE tuşunu";
    const steerControl = touch ? "sol / sağ düğmeleriyle" : "← / → ile";
    const lessons = [
      { step: "1 / 3", copy: `Yakındaki halkaya tutunmak için ${holdControl} basılı tut.` },
      { step: "2 / 3", copy: touch
        ? "Tutunurken başlangıç noktasının üstü ipi kısaltır, altı uzatır; başlangıca dönünce durur. Salınımın dibine yakın bırakınca hız kazanırsın."
        : "Tutunurken ↑ / W ile kısalt, ↓ / S ile uzat. Salınımın en dibine yakın bırakmak ekstra hız verir." },
      { step: "3 / 3", copy: `Uçuşta ${steerControl} yön ver; sıradaki halkayı hedefle.` }
    ];
    const lesson = lessons[tutorialStep];
    ui.tutorialStep.textContent = lesson.step;
    ui.tutorialCopy.textContent = lesson.copy;
  }

  function completeTutorial() {
    tutorialActive = false;
    try { localStorage.setItem("sapan-postasi-tutorial", "done"); } catch { /* Tutorial preference is optional. */ }
    updateTutorialPrompt();
    if (state === "playing") updateHud(true);
  }

  function dismissTutorialForRun() {
    tutorialActive = false;
    updateTutorialPrompt();
    if (state === "playing") updateHud(true);
  }

  function advanceTutorial(dt) {
    if (!tutorialActive || tutorialStep !== 2) return;
    tutorialTimer = Math.max(0, tutorialTimer - dt);
    if (tutorialTimer === 0 && canDismissTutorial()) dismissTutorialForRun();
  }

  function canDismissTutorial() {
    if (tetherHeld || activeSteer() !== 0) return false;
    return hazards.every(hazard => {
      const pos = hazardPosition(hazard);
      return Math.hypot(player.x - pos.x, player.y - pos.y) >= player.radius + hazard.r + 72;
    });
  }

  function saveBest(value) {
    best = Math.max(best, value);
    try { localStorage.setItem("sapan-postasi-best", String(best)); } catch { /* Local file storage may be blocked. */ }
  }

  function formatScore(value) {
    return Math.max(0, Math.floor(value)).toString().padStart(5, "0");
  }

  function setPanels() {
    ui.hud.hidden = state !== "playing";
    ui.start.hidden = state !== "menu";
    ui.pause.hidden = state !== "paused";
    ui.result.hidden = state !== "won" && state !== "lost";
    ui.touch.hidden = state !== "playing" || !("ontouchstart" in window || navigator.maxTouchPoints > 0);
    ui.previewButton.hidden = state !== "playing" || practiceIndex < 0;
    updateReleaseCue();
    updateTutorialPrompt();
  }

  function resetRun(startIndex = practiceIndex) {
    if (!Number.isInteger(startIndex) || startIndex < -1 || startIndex >= practiceStarts.length) startIndex = -1;
    practiceIndex = startIndex;
    const startX = practiceIndex < 0 ? practiceStarts[0] : practiceStarts[practiceIndex];
    for (const anchor of anchors) { anchor.visited = false; anchor.fragileElapsed = 0; }
    for (const seal of seals) { seal.collected = false; seal.missedNotified = false; }
    if (practiceIndex > 0) {
      for (const anchor of anchors) if (anchor.x < startX - 85) anchor.visited = true;
      for (const seal of seals) if (seal.x < startX) seal.collected = true;
    }
    nearMissed = new Set();
    runStats = { hits: 0, cleanThrows: 0, ringBreaks: 0, segments: [0, 0, 0], hitLog: [] };
    player.x = practiceIndex > 0 ? startX : 165;
    player.y = practiceIndex > 0 ? 430 : 420;
    player.vx = 155; player.vy = -160;
    player.radius = 17;
    cameraX = Math.max(0, player.x - W * 0.36);
    elapsed = 0; runTime = 0; splitTimes = []; remaining = SHIFT_SECONDS; hudClock = 0;
    lives = 3; score = 0; sealCount = seals.filter(seal => seal.collected).length; combo = 0;
    boostTime = 0;
    checkpointX = startX; invulnerable = 0;
    recoveryReady = false; recoveryBlockedKeys.clear();
    tetherHeld = false; tetherAnchor = null; ropeLength = 0; ropeLengthRate = 0;
    tetherTime = 0; fragileWarningPlayed = false;
    tutorialActive = practiceIndex < 0 && !hasCompletedTutorial(); tutorialStep = 0; tutorialTimer = 0;
    steerPointer.clear(); tetherPointerY.clear(); tetherPointerId = null; keys.clear();
    state = "playing";
    resetFrameClock();
    ui.combo.textContent = "";
    setPanels();
    updateHud(true);
    playTone(540, 0.075, "sine");
  }

  function pauseGame() {
    if (state !== "playing") return;
    state = "paused";
    resetFrameClock();
    setPanels();
  }

  function resumeGame() {
    if (state !== "paused") return;
    state = "playing";
    resetFrameClock();
    setPanels();
  }

  function finishRun(won, reason = null) {
    if (state !== "playing") return;
    releaseTether({ award: false, consumeAnchor: false });
    boostTime = 0;
    state = won ? "won" : "lost";
    if (won && practiceIndex < 0) score += 500 + (sealCount === 3 ? 300 : 0) + Math.floor(remaining * 2);
    const previousBest = best;
    if (practiceIndex < 0) saveBest(score);
    ui.resultScoreLabel.textContent = practiceIndex >= 0 ? "BU ANTRENMAN" : "BU VARDİYA";
    ui.finalScore.textContent = formatScore(score);
    ui.finalSeals.textContent = `${sealCount}/3`;
    ui.finalHits.textContent = String(runStats.hits);
    ui.finalThrows.textContent = String(runStats.cleanThrows);
    let timeRecord = false;
    let deliveryRecord = false;
    if (won) splitTimes.push({ name: "Fener iskelesi", at: runTime });
    if (won && practiceIndex < 0) {
      try {
        const result = saveBestRunTime(localStorage, runTime);
        bestTime = result.bestTime;
        timeRecord = result.improved;
        if (sealCount === 3) {
          const delivery = saveBestRunTime(localStorage, runTime, DELIVERY_TIME_KEY);
          bestDeliveryTime = delivery.bestTime;
          deliveryRecord = delivery.improved;
        }
      } catch { /* Record persistence is optional. */ }
    }
    ui.finalTime.textContent = formatRunTime(runTime);
    ui.bestTimeStart.textContent = formatRunTime(bestTime);
    ui.bestTimeResult.textContent = formatRunTime(bestTime);
    ui.newTimeBest.hidden = !timeRecord;
    ui.deliveryTimeStart.textContent = formatRunTime(bestDeliveryTime);
    ui.deliveryTimeResult.textContent = formatRunTime(bestDeliveryTime);
    ui.newDeliveryBest.hidden = !deliveryRecord;
    renderSealMarks(ui.resultSealMarks, true);
    let previousSplit = 0;
    ui.splits.innerHTML = splitTimes.map(split => {
      const displayedSplit = Math.floor(split.at * 100 + 1e-9);
      const duration = (displayedSplit - previousSplit) / 100;
      previousSplit = displayedSplit;
      return `<li><span>${split.name}</span><b>${formatRunTime(split.at)}</b><small>+${formatRunTime(duration)}</small></li>`;
    }).join("");
    ui.splits.hidden = splitTimes.length === 0;
    ui.bestResult.textContent = formatScore(best);
    ui.bestStart.textContent = formatScore(best);
    ui.newBest.hidden = practiceIndex >= 0 || score <= previousBest || score === 0;
    if (won) {
      ui.resultKicker.textContent = practiceIndex >= 0 ? "ANTRENMAN TAMAM" : sealCount === 3 ? "TESLİMAT TAMAM" : "FENERE VARDIN";
      ui.resultTitle.textContent = practiceIndex >= 0 ? "Parkuru geçtin." : "Fener sönmeden yetiştin.";
      ui.resultCopy.textContent = practiceIndex >= 0
        ? "Hazırsan vardiyada süreye karşı deneyebilirsin."
        : sealCount === 3
          ? "Üç mührü de teslim ettin. Bu gecelik işin bitti."
          : `${sealCount}/3 mühür topladın. Tam teslimat için yeni vardiyada eksik mühürlerin rotasını dene.`;
      playTone(740, 0.15, "triangle");
      playTone(980, 0.22, "sine", 0.13);
    } else {
      ui.resultKicker.textContent = "VARDİYA BİTTİ";
      ui.resultTitle.textContent = "Bu gece olmadı.";
      ui.resultCopy.textContent = reason === "timeout"
        ? "Vardiya süresi doldu. İskelelere daha kısa yoldan ulaşmayı deneyebilirsin."
        : "Canların bitti. Zorlandığın kısmı antrenmanda yeniden deneyebilirsin.";
      playTone(190, 0.3, "sawtooth");
    }
    setPanels();
  }

  function nearestAnchor() {
    let bestAnchor = null;
    let bestDistance = Infinity;
    for (const anchor of anchors) {
      if (anchor.visited || anchor.x < player.x - 85 || anchor.x > player.x + 490) continue;
      const distance = Math.hypot(anchor.x - player.x, anchor.y - player.y);
      if (distance < bestDistance) { bestDistance = distance; bestAnchor = anchor; }
    }
    return bestAnchor && bestDistance <= 460 ? { anchor: bestAnchor, distance: bestDistance } : null;
  }

  function beginTether() {
    if (state !== "playing" || tetherHeld) return;
    tetherHeld = true;
    if (ui.tetherTouch) ui.tetherTouch.classList.add("is-held");
    tryAttach();
  }

  function tryAttach() {
    if (!tetherHeld || tetherAnchor) return;
    const target = nearestAnchor();
    if (!target) return;
    tetherAnchor = target.anchor;
    ropeLength = Math.max(MIN_ROPE_LENGTH, Math.min(MAX_ROPE_LENGTH, target.distance));
    ropeLengthRate = 0;
    tetherTime = target.anchor.type === "fragile" ? target.anchor.fragileElapsed : 0;
    fragileWarningPlayed = false;
    if (tutorialActive && tutorialStep === 0) {
      tutorialStep = 1;
      updateTutorialPrompt();
    }
    score += 10;
    playTone(430, 0.055, "sine");
    updateHud(true);
  }

  function isCleanRelease(anchor) {
    const dx = player.x - anchor.x;
    const dy = player.y - anchor.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nearBottom = dy > 0 && Math.abs(dx / distance) < Math.sin(CLEAN_RELEASE_ANGLE);
    const speed = Math.hypot(player.vx, player.vy);
    return nearBottom && player.vx > 140 && speed > 140;
  }

  function releaseQuality(anchor) {
    const dx = player.x - anchor.x;
    const distance = Math.max(1, Math.hypot(dx, player.y - anchor.y));
    const offset = Math.abs(dx / distance) / Math.sin(CLEAN_RELEASE_ANGLE);
    return 1 - Math.min(1, offset);
  }

  function applySlingBoost(anchor) {
    const quality = releaseQuality(anchor);
    const impulse = SLING.baseImpulse + SLING.bonusImpulse * quality;
    const speed = Math.max(1, Math.hypot(player.vx, player.vy));
    player.vx += player.vx / speed * impulse;
    player.vy += player.vy / speed * impulse;
    boostTime = SLING.seconds;
    limitPlayerSpeed();
    ui.combo.textContent += ` · SAPAN +${Math.round(impulse)}`;
    playTone(520 + quality * 260, 0.12, "triangle", 0.03);
  }

  function updateReleaseCue() {
    const shouldHide = state !== "playing" || !tetherHeld || !tetherAnchor || !isCleanRelease(tetherAnchor);
    ui.releaseCue.textContent = ui.touch.hidden
      ? "ŞİMDİ BIRAK · TEMİZ FIRLATMA"
      : "PARMAĞINI KALDIR · TEMİZ FIRLATMA";
    if (ui.releaseCue.hidden !== shouldHide) ui.releaseCue.hidden = shouldHide;
  }

  function releaseTether({ award = true, consumeAnchor = true } = {}) {
    if (state === "paused") { award = false; consumeAnchor = false; }
    if (!tetherHeld && !tetherAnchor) return;
    const teachSteering = tutorialActive && tutorialStep === 1 && award && Boolean(tetherAnchor);
    tetherHeld = false;
    if (ui.tetherTouch) ui.tetherTouch.classList.remove("is-held");
    if (tetherAnchor) {
      if (consumeAnchor) tetherAnchor.visited = true;
      if (award && isCleanRelease(tetherAnchor)) {
        runStats.cleanThrows += 1;
        combo = Math.min(8, combo + 1);
        score += 25 * combo;
        const specialBonus = tetherAnchor.type === "normal" ? 0 : 30;
        score += specialBonus;
        ui.combo.textContent = specialBonus ? `ÖZEL HALKA +30  ·  ZİNCİR ×${combo}` : `TEMİZ FIRLATMA  ×${combo}`;
        messageUntil = elapsed + 1.25;
        playTone(720 + combo * 25, 0.09, "triangle");
        applySlingBoost(tetherAnchor);
      } else if (award) {
        score += 5;
        playTone(330, 0.045, "sine");
      }
    }
    tetherAnchor = null;
    ropeLength = 0;
    ropeLengthRate = 0;
    tetherTime = 0;
    fragileWarningPlayed = false;
    tetherPointerId = null;
    tetherPointerY.clear();
    if (teachSteering) {
      tutorialStep = 2;
      tutorialTimer = 5;
      updateTutorialPrompt();
    }
    updateHud(true);
  }

  function applyRopeConstraint(body, anchor, length, lengthRate = 0) {
    const dx = body.x - anchor.x;
    const dy = body.y - anchor.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1e-6 || distance <= length) return false;
    const nx = dx / distance;
    const ny = dy / distance;
    body.x = anchor.x + nx * length;
    body.y = anchor.y + ny * length;
    const outwardSpeed = body.vx * nx + body.vy * ny;
    if (outwardSpeed > lengthRate) {
      const excessOutwardSpeed = outwardSpeed - lengthRate;
      body.vx -= excessOutwardSpeed * nx;
      body.vy -= excessOutwardSpeed * ny;
    }
    return true;
  }

  function limitPlayerSpeed() {
    const boostRatio = Math.min(1, boostTime / SLING.seconds);
    const vxCap = BASE_PLAYER_VX_MAX + (SLING.vxCap - BASE_PLAYER_VX_MAX) * boostRatio;
    player.vx = Math.max(-100, Math.min(vxCap, player.vx));
    player.vy = Math.max(-580, Math.min(650, player.vy));
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > MAX_PLAYER_SPEED) {
      player.vx *= MAX_PLAYER_SPEED / speed;
      player.vy *= MAX_PLAYER_SPEED / speed;
    }
  }

  function limitRopeSpeed(body, anchor, lengthRate) {
    const speed = Math.hypot(body.vx, body.vy);
    if (speed <= MAX_PLAYER_SPEED) return;

    const dx = body.x - anchor.x;
    const dy = body.y - anchor.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / distance;
    const ny = dy / distance;
    const radialSpeed = Math.min(body.vx * nx + body.vy * ny, lengthRate);
    const tangentX = -ny;
    const tangentY = nx;
    const tangentSpeed = body.vx * tangentX + body.vy * tangentY;
    const maxTangentSpeed = Math.sqrt(Math.max(0, MAX_PLAYER_SPEED ** 2 - radialSpeed ** 2));
    const limitedTangentSpeed = Math.max(-maxTangentSpeed, Math.min(maxTangentSpeed, tangentSpeed));
    body.vx = radialSpeed * nx + limitedTangentSpeed * tangentX;
    body.vy = radialSpeed * ny + limitedTangentSpeed * tangentY;
  }

  function activeSteer() {
    let value = 0;
    for (const direction of steerPointer.values()) value += direction;
    if (keys.has("ArrowLeft") || keys.has("KeyA")) value -= 1;
    if (keys.has("ArrowRight") || keys.has("KeyD")) value += 1;
    return Math.max(-1, Math.min(1, value));
  }

  function activeReel() {
    let value = 0;
    if (keys.has("ArrowUp") || keys.has("KeyW")) value -= 1;
    if (keys.has("ArrowDown") || keys.has("KeyS")) value += 1;
    for (const pointer of tetherPointerY.values()) {
      const offset = pointer.currentY - pointer.startY;
      if (offset < -7) value -= 1;
      else if (offset > 7) value += 1;
    }
    return Math.max(-1, Math.min(1, value));
  }

  function updateRopeLength(dt) {
    if (!tetherAnchor) {
      ropeLengthRate = 0;
      return;
    }
    if (dt <= 0) return;

    const winchRate = tetherAnchor.type === "winch" ? -WINCH_REEL_SPEED : 0;
    const delta = (activeReel() * ROPE_REEL_SPEED + winchRate) * dt;
    if (Math.abs(delta) < 0.001) {
      ropeLengthRate = 0;
      return;
    }

    const previousLength = ropeLength;
    const nextLength = Math.max(MIN_ROPE_LENGTH, Math.min(MAX_ROPE_LENGTH, previousLength + delta));
    const actualDelta = nextLength - previousLength;
    ropeLengthRate = actualDelta / dt;

    if (actualDelta < 0) {
      const dx = player.x - tetherAnchor.x;
      const dy = player.y - tetherAnchor.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      if (distance >= previousLength - 3) {
        const nx = dx / distance;
        const ny = dy / distance;
        const radialSpeed = player.vx * nx + player.vy * ny;
        const tangentX = player.vx - radialSpeed * nx;
        const tangentY = player.vy - radialSpeed * ny;
        const momentumScale = distance / Math.max(MIN_ROPE_LENGTH, nextLength);
        player.vx = radialSpeed * nx + tangentX * momentumScale;
        player.vy = radialSpeed * ny + tangentY * momentumScale;
      }
    }

    ropeLength = nextLength;
  }

  function updateSpecialRing(dt) {
    if (!tetherAnchor) return;
    tetherTime += dt;
    if (tetherAnchor.type !== "fragile") return;
    tetherAnchor.fragileElapsed = tetherTime;
    const remainingHold = FRAGILE_HOLD_SECONDS - tetherTime;
    if (remainingHold <= 0) {
      runStats.ringBreaks += 1;
      releaseTether({ award: false });
      ui.combo.textContent = "KIRILGAN HALKA KOPTU";
      messageUntil = elapsed + 1.1;
      playTone(180, 0.12, "sawtooth");
      updateHud(true);
    } else if (remainingHold <= 0.35 && !fragileWarningPlayed) {
      fragileWarningPlayed = true;
      playTone(560, 0.075, "square");
    }
  }

  function hazardPosition(hazard) {
    if (!hazard.moving) return { x: hazard.x, y: hazard.y };
    const phase = elapsed * 1.15 + hazard.phase * 2.1;
    return { x: hazard.x, y: hazard.y + Math.sin(phase) * 54 };
  }

  function takeHit(reason = "water") {
    if (state !== "playing" || (recoveryReady && reason !== "retry") || (invulnerable > 0 && reason === "hazard")) return;
    if (reason !== "retry") {
      const segment = checkpoints.filter(mark => checkpointX >= mark).length;
      runStats.hits += 1;
      runStats.segments[segment] += 1;
      runStats.hitLog.push({ reason, segment, x: player.x, y: player.y, at: elapsed, anchorId: tetherAnchor?.id ?? null });
      if (runStats.hitLog.length > 64) runStats.hitLog.shift();
    }
    if (practiceIndex < 0) lives -= 1;
    combo = 0;
    ui.combo.textContent = "";
    releaseTether({ award: false, consumeAnchor: false });
    for (const key of keys) recoveryBlockedKeys.add(key);
    keys.clear(); steerPointer.clear(); tetherPointerY.clear();
    for (const anchor of anchors) {
      if (anchor.x >= checkpointX - 85) {
        anchor.visited = false;
        anchor.fragileElapsed = 0;
      }
    }
    if (lives <= 0) { updateHud(true); finishRun(false, reason); return; }
    boostTime = 0;
    player.x = checkpointX;
    player.y = 430;
    player.vx = 185;
    for (const seal of seals) if (!seal.collected && seal.x > checkpointX) seal.missedNotified = false;
    player.vy = -70;
    cameraX = Math.max(0, checkpointX - W * 0.34);
    invulnerable = 0;
    recoveryReady = true;
    const cause = { water: "SUYA DÜŞTÜN", hazard: "ŞAMANDIRAYA ÇARPTIN", ceiling: "FAZLA YÜKSELDİN", backtrack: "HATTIN GERİSİNE DÜŞTÜN", retry: "TEKRAR DENEME" };
    ui.combo.textContent = `${cause[reason] || "İSKELEYE DÖNDÜN"} · SON İSKELE`;
    messageUntil = elapsed + 1.6;
    playTone(155, 0.2, "square");
    updateHud(true);
  }

  function update(dt) {
    if (recoveryReady) return;
    elapsed += dt;
    const steer = activeSteer();
    if (tutorialActive && tutorialStep === 2 && steer !== 0) completeTutorial();
    advanceTutorial(dt);
    if (!tutorialActive) {
      runTime += dt;
      if (practiceIndex < 0) remaining = Math.max(0, SHIFT_SECONDS - runTime);
    }
    invulnerable = Math.max(0, invulnerable - dt);
    boostTime = Math.max(0, boostTime - dt);
    hudClock += dt;

    if (tetherHeld && !tetherAnchor) tryAttach();
    updateSpecialRing(dt);
    updateRopeLength(dt);
    player.vx += (28 + steer * 420) * dt;
    player.vy += GRAVITY * dt;
    player.vx *= Math.exp(-0.16 * dt);
    player.vy *= Math.exp(-0.025 * dt);
    limitPlayerSpeed();
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    if (tetherAnchor && applyRopeConstraint(player, tetherAnchor, ropeLength, ropeLengthRate)) {
      limitRopeSpeed(player, tetherAnchor, ropeLengthRate);
    }

    cameraX += (Math.max(0, player.x - W * 0.36) - cameraX) * Math.min(1, dt * 4.5);

    for (let i = 0; i < seals.length; i += 1) {
      const seal = seals[i];
      if (!seal.collected && Math.hypot(player.x - seal.x, player.y - seal.y) < 36) {
        seal.collected = true;
        sealCount += 1;
        score += 50;
        ui.combo.textContent = `${seal.id}. MÜHÜR ALINDI · ${sealCount}/3`;
        messageUntil = elapsed + 1.1;
        playTone(880, 0.11, "sine");
        updateHud(true);
      }
      if (!seal.collected && player.x > seal.x + 60 && !seal.missedNotified) {
        seal.missedNotified = true;
        ui.combo.textContent = `${seal.id}. MÜHÜR GEÇİLDİ`;
        messageUntil = elapsed + 1.5;
        updateHud(true);
      }
    }

    let hitThisFrame = false;
    for (const hazard of hazards) {
      const pos = hazardPosition(hazard);
      const distance = Math.hypot(player.x - pos.x, player.y - pos.y);
      const collisionDistance = player.radius + hazard.r;
      if (distance < collisionDistance) { takeHit("hazard"); hitThisFrame = true; break; }
      if (distance < collisionDistance + 38 && distance > collisionDistance && !nearMissed.has(hazard.x)) {
        nearMissed.add(hazard.x);
        combo = Math.min(8, combo + 1);
        score += 15 * combo;
        ui.combo.textContent = `KIL PAYI  ×${combo}`;
        messageUntil = elapsed + 1;
        updateHud(true);
      }
    }

    if (!hitThisFrame) {
      if (player.y > 705) takeHit("water");
      else if (player.y < -110) takeHit("ceiling");
      else if (player.x < checkpointX - 180) takeHit("backtrack");
    }
    for (const mark of checkpoints) {
      if (player.x >= mark && checkpointX < mark) {
        checkpointX = mark;
        splitTimes.push({ name: mark === checkpoints[0] ? "Orta iskele" : "Fener hattı", at: runTime });
        lives = Math.min(3, lives + 1);
        ui.combo.textContent = `GÜVENLİ İSKELE · ${formatRunTime(runTime)}`;
        messageUntil = elapsed + 1.6;
        playTone(600, 0.1, "sine");
        updateHud(true);
      }
    }
    if (player.x >= ROUTE_END) finishRun(true);
    else if (practiceIndex < 0 && remaining <= 0) finishRun(false, "timeout");

    if (hudClock >= 0.1) { hudClock = 0; updateHud(false); }
    updateReleaseCue();
  }

  function getSealStatus(seal) {
    return seal.collected ? "collected" : seal.missedNotified ? "missed" : "waiting";
  }

  function renderSealMarks(node, final = false) {
    const markup = seals.map(seal => {
      const status = final && !seal.collected ? "missed" : getSealStatus(seal);
      const label = status === "collected" ? "alındı" : status === "missed" ? final ? "eksik" : "geçildi" : "ileride";
      return `<li class="is-${status}" aria-label="Mühür ${seal.id}: ${label}" title="${seal.id}. mühür: ${label}">${seal.id}</li>`;
    }).join("");
    if (node.innerHTML !== markup) node.innerHTML = markup;
  }

  function getSealLocator() {
    const seal = seals.find(item => getSealStatus(item) === "waiting");
    if (!seal) return null;
    const x = seal.x - cameraX;
    if (x >= 36 && x <= W - 36) return null;
    return { id: seal.id, side: x < 36 ? "left" : "right", y: Math.max(145, Math.min(H - 100, seal.y)) };
  }

  function updateHud(force) {
    ui.score.textContent = formatScore(score);
    ui.seals.innerHTML = `${sealCount} <span>/ 3</span>`;
    renderSealMarks(ui.sealMarks);
    ui.lives.setAttribute("aria-label", `${lives} can`);
    ui.lives.style.display = practiceIndex >= 0 ? "none" : "";
    [...ui.lives.children].forEach((dot, index) => dot.classList.toggle("empty", index >= lives));
    const progress = Math.max(0, Math.min(1, player.x / ROUTE_END));
    ui.routeFill.style.width = `${progress * 100}%`;
    ui.routeMarker.style.left = `${progress * 100}%`;
    ui.rope.hidden = !tetherAnchor;
    if (tetherAnchor) {
      ui.ropeLength.textContent = String(Math.round(ropeLength));
      ui.ropeFill.style.width = `${((ropeLength - MIN_ROPE_LENGTH) / (MAX_ROPE_LENGTH - MIN_ROPE_LENGTH)) * 100}%`;
      ui.rope.setAttribute("aria-label", `Halat uzunluğu ${Math.round(ropeLength)} piksel`);
    }
    const seconds = Math.ceil(remaining);
    ui.clock.textContent = practiceIndex >= 0 ? "ANTRENMAN" : tutorialActive ? "EĞİTİM" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} KALAN`;
    ui.runTime.textContent = `GEÇEN ${formatRunTime(runTime)}`;
    ui.previewButton.setAttribute("aria-pressed", String(previewOn));
    ui.previewButton.title = previewOn ? "Uçuş yolunu gizle (G)" : "Uçuş yolunu göster (G)";
    if (elapsed > messageUntil) {
      ui.combo.textContent = combo >= 2 ? `ZİNCİR  ×${combo}` : "";
    }
    const target = nearestAnchor();
    const touch = !ui.touch.hidden;
    const holdControl = touch ? "TUTUN" : "SPACE";
    let hint;
    if (recoveryReady) {
      hint = "İSKELEDESİN · Hazır olunca yeniden <kbd>SPACE</kbd>/fare veya yön tuşuna bas";
    } else if (tetherAnchor && touch) {
      hint = tetherAnchor.type === "winch"
        ? "MAKARA İPİ TOPLUYOR · TUTUN'da ↓ ile diren · parmağını kaldır: bırak"
        : "TUTUN'da ↑ kısalt · ↓ uzat · başlangıca dön: dur";
    } else if (tetherAnchor?.type === "fragile") {
      hint = `KIRILGAN HALKA · ${Math.max(0, FRAGILE_HOLD_SECONDS - tetherTime).toFixed(1)} sn · <kbd>SPACE</kbd>/fareyi bırak`;
    } else if (tetherAnchor?.type === "winch") {
      hint = "MAKARA İPİ TOPLUYOR · <kbd>S</kbd> ile diren · <kbd>SPACE</kbd>/fareyi bırak";
    } else if (tetherAnchor) {
      hint = "<kbd>↑</kbd>/<kbd>W</kbd> kısalt · <kbd>↓</kbd>/<kbd>S</kbd> uzat · <kbd>SPACE</kbd> bırak";
    } else if (target?.anchor.type === "fragile") {
      hint = `KIRMIZI HALKA · 1,55 sn içinde bırak · <kbd>${holdControl}</kbd> bas`;
    } else if (target?.anchor.type === "winch") {
      hint = `MAKARA HALKASI · ipi toplar · <kbd>${holdControl}</kbd> bas`;
    } else {
      hint = target ? `Halkaya tutunmak için <kbd>${holdControl}</kbd> basılı tut` : "Sonraki halkaya yaklaş";
    }
    if (practiceIndex >= 0 && tetherAnchor && previewOn) hint += " · Noktalı yol: yaklaşık uçuş";
    const routeSeal = tetherAnchor && seals.find(seal => seal.approachRing === tetherAnchor.id && getSealStatus(seal) === "waiting");
    if (!recoveryReady && routeSeal) {
      const routeTip = routeSeal.id === 1 ? "1. MÜHÜR AŞAĞIDA" : routeSeal.id === 2
        ? "2. MÜHÜR ↑ · Daha uzun ip dene" : "3. MÜHÜR ↑ · İpi kısalt, daha geç bırak";
      hint += ` · ${routeTip}`;
    }
    ui.hint.innerHTML = hint;
    updateReleaseCue();
  }

  function drawBackground(time) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, "#091d2b");
    sky.addColorStop(0.62, "#143342");
    sky.addColorStop(1, "#09212c");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    for (const star of stars) {
      const x = (star.x - cameraX * 0.035 + W * 3) % W;
      ctx.globalAlpha = star.a * (0.86 + Math.sin(time * 0.7 + star.x) * 0.14);
      ctx.fillStyle = "#e4eee5";
      ctx.beginPath(); ctx.arc(x, star.y, star.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.shadowColor = "rgba(255,195,107,.35)";
    ctx.shadowBlur = 45;
    ctx.fillStyle = "#f0d7a6";
    ctx.beginPath(); ctx.arc(1010, 152, 49, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(9,28,38,.32)";
    ctx.beginPath(); ctx.arc(992, 139, 44, 0, Math.PI * 2); ctx.fill();

    const parallax = (cameraX * 0.18) % 2184;
    ctx.fillStyle = "#102a35";
    for (let repeat = -1; repeat < 3; repeat += 1) {
      for (const building of skyline) {
        const x = repeat * 2184 + building.x - parallax;
        const y = 534 - building.h;
        ctx.fillRect(x, y, building.w, building.h);
        if (building.lit === 0) {
          ctx.fillStyle = "rgba(255,195,107,.25)";
          ctx.fillRect(x + 8, y + 18, 3, 5);
          ctx.fillStyle = "#102a35";
        }
      }
    }

    const water = ctx.createLinearGradient(0, 560, 0, 720);
    water.addColorStop(0, "#0c2a36"); water.addColorStop(1, "#061923");
    ctx.fillStyle = water; ctx.fillRect(0, 556, W, 164);
    ctx.strokeStyle = "rgba(108,185,181,.12)";
    ctx.lineWidth = 1;
    for (let row = 0; row < 7; row += 1) {
      const y = 576 + row * 22;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 18) {
        const wave = Math.sin(x * 0.022 + time * 0.75 + row) * 4;
        if (x === 0) ctx.moveTo(x, y + wave); else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#182e34";
    ctx.fillRect(0, 627, W, 16);
    ctx.fillStyle = "#334b4d";
    ctx.fillRect(0, 627, W, 4);
    const postOffset = (cameraX * 0.68) % 170;
    for (let x = -postOffset - 60; x < W + 80; x += 170) {
      ctx.fillStyle = "#1a3036";
      ctx.fillRect(x + 14, 642, 22, 82);
      ctx.fillStyle = "#385154";
      ctx.fillRect(x + 12, 641, 26, 7);
    }
  }

  function drawCheckpoint(mark, index) {
    const x = mark - cameraX;
    if (x < -110 || x > W + 110) return;
    const reached = checkpointX >= mark;
    ctx.save();
    ctx.strokeStyle = reached ? "rgba(85,214,207,.58)" : "rgba(255,195,107,.65)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 464); ctx.lineTo(x, 628); ctx.stroke();
    ctx.fillStyle = reached ? "#55d6cf" : "#ffc36b";
    ctx.beginPath(); ctx.moveTo(x, 463); ctx.lineTo(x + 42, 478); ctx.lineTo(x, 493); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e8eee3";
    ctx.font = "700 10px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`GÜVENLİ İSKELE ${index + 1}`, x, 449);
    ctx.restore();
  }

  function drawAnchor(anchor, target) {
    const x = anchor.x - cameraX;
    if (x < -70 || x > W + 70) return;
    const selected = target && target.anchor === anchor;
    const latched = tetherAnchor === anchor;
    const fragile = anchor.type === "fragile";
    const winch = anchor.type === "winch";
    const accent = fragile ? "#ff8f77" : winch ? "#ffc36b" : "#55d6cf";
    ctx.save();
    ctx.translate(x, anchor.y);
    ctx.strokeStyle = anchor.visited ? "rgba(143,169,161,.22)" : selected || latched ? accent : fragile ? "rgba(255,143,119,.65)" : winch ? "rgba(255,195,107,.68)" : "rgba(125,173,169,.45)";
    ctx.lineWidth = selected || latched ? 3 : 2;
    ctx.shadowColor = selected || latched ? accent : "transparent";
    ctx.shadowBlur = selected || latched ? 18 : 0;
    ctx.beginPath(); ctx.ellipse(0, 0, 19, 14, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-17, -2); ctx.moveTo(17, -2); ctx.lineTo(28, -2); ctx.stroke();
    if (!anchor.visited && fragile) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-5, -12); ctx.lineTo(1, -3); ctx.lineTo(-3, 4);
      ctx.moveTo(8, -10); ctx.lineTo(3, 0); ctx.lineTo(8, 9); ctx.stroke();
    }
    if (!anchor.visited && winch) {
      ctx.shadowBlur = 0;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-6, -7); ctx.lineTo(0, -2); ctx.lineTo(6, -7);
      ctx.moveTo(-6, 1); ctx.lineTo(0, 6); ctx.lineTo(6, 1); ctx.stroke();
    }
    if (latched) {
      ctx.strokeStyle = "rgba(255,195,107,.92)";
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(0, 0, 23, 17, 0, Math.PI / 2 - 0.39, Math.PI / 2 + 0.39); ctx.stroke();
      if (fragile) {
        ctx.strokeStyle = FRAGILE_HOLD_SECONDS - tetherTime < 0.35 ? "#ff6b6b" : "#ffc36b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 31, -Math.PI / 2, -Math.PI / 2 + Math.max(0, 1 - tetherTime / FRAGILE_HOLD_SECONDS) * Math.PI * 2);
        ctx.stroke();
      }
    }
    if (selected && !tetherAnchor) {
      ctx.setLineDash([4, 5]);
      ctx.strokeStyle = "rgba(85,214,207,.18)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(0, 44); ctx.stroke();
    }
    if (!anchor.visited && (fragile || winch)) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = accent;
      ctx.font = "800 9px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(fragile ? "KIRILGAN" : "MAKARA", 0, -27);
    }
    const routeSeal = seals.find(seal => seal.approachRing === anchor.id && getSealStatus(seal) === "waiting");
    if (routeSeal && (!anchor.visited || latched)) {
      ctx.shadowBlur = 0; ctx.fillStyle = "#ffc36b";
      ctx.font = "800 9px Segoe UI, sans-serif"; ctx.textAlign = "center";
      ctx.fillText(`${routeSeal.id}. MÜHÜR ${routeSeal.y > anchor.y + 80 ? "↓" : "→"}`, 0, -44);
    }
    ctx.restore();
  }

  function drawSeal(seal, time) {
    if (seal.collected) return;
    const x = seal.x - cameraX;
    if (x < -50 || x > W + 50) return;
    const y = seal.y + Math.sin(time * 2.4 + seal.x) * 5;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(time + seal.x) * 0.04);
    ctx.shadowColor = "rgba(255,195,107,.62)"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffc36b";
    ctx.beginPath(); ctx.roundRect(-15, -19, 30, 38, 5); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#684b2c"; ctx.lineWidth = 1.5;
    ctx.strokeRect(-9, -12, 18, 24);
    ctx.fillStyle = "#684b2c"; ctx.font = "bold 10px Segoe UI"; ctx.textAlign = "center";
    ctx.fillText(String(seal.id), 0, 4);
    ctx.restore();
  }

  function drawSealLocator() {
    if (state !== "playing" && state !== "paused") return;
    const locator = getSealLocator();
    if (!locator) return;
    const x = locator.side === "right" ? W - 22 : 22;
    const direction = locator.side === "right" ? 1 : -1;
    ctx.save();
    ctx.translate(x, locator.y);
    ctx.fillStyle = "rgba(6,22,31,.82)";
    ctx.strokeStyle = "#ffc36b"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#ffc36b"; ctx.font = "800 11px Segoe UI"; ctx.textAlign = "center";
    ctx.fillText(String(locator.id), 0, 4);
    ctx.beginPath(); ctx.moveTo(direction * 18, -4); ctx.lineTo(direction * 23, 0); ctx.lineTo(direction * 18, 4); ctx.stroke();
    ctx.restore();
  }

  function drawHazard(hazard, time) {
    const pos = hazardPosition(hazard);
    const x = pos.x - cameraX;
    if (x < -80 || x > W + 80) return;
    ctx.save(); ctx.translate(x, pos.y);
    ctx.strokeStyle = "rgba(255,107,107,.35)"; ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.arc(0, 0, hazard.r + 12, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.shadowColor = "rgba(255,107,107,.48)"; ctx.shadowBlur = 16;
    ctx.fillStyle = "#bc5b58";
    ctx.beginPath(); ctx.arc(0, 0, hazard.r * 0.72, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = "#f7a27f"; ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4 + time * 0.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * hazard.r * 0.62, Math.sin(angle) * hazard.r * 0.62);
      ctx.lineTo(Math.cos(angle) * hazard.r, Math.sin(angle) * hazard.r);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayer(time) {
    const screenX = player.x - cameraX;
    const screenY = player.y;
    ctx.save();
    if (invulnerable > 0 && Math.floor(elapsed * 12) % 2 === 0) ctx.globalAlpha = 0.35;
    const facing = player.vx < -20 ? -1 : 1;
    if (state === "playing" && boostTime > 0) {
      const intensity = Math.min(1, boostTime / SLING.seconds);
      ctx.strokeStyle = `rgba(255,195,107,${0.58 * intensity})`;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      for (let i = -1; i <= 1; i += 1) {
        const y = screenY + i * 7;
        ctx.beginPath();
        ctx.moveTo(screenX - facing * 22, y);
        ctx.lineTo(screenX - facing * (22 + 34 * intensity), y);
        ctx.stroke();
      }
    }
    ctx.translate(screenX, screenY);
    ctx.rotate(Math.max(-0.42, Math.min(0.42, player.vy / 850)));
    ctx.scale(facing, 1);
    ctx.strokeStyle = "#e4c98f"; ctx.lineWidth = 2.5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-7, -3); ctx.quadraticCurveTo(-19 - Math.sin(time * 9) * 4, -8, -29, -4); ctx.stroke();
    ctx.fillStyle = "#bc8057"; ctx.beginPath(); ctx.roundRect(-14, -9, 11, 16, 3); ctx.fill();
    ctx.fillStyle = "#e5e0cb"; ctx.beginPath(); ctx.ellipse(0, 2, 8, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#f2d7a1"; ctx.beginPath(); ctx.arc(2, -12, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e07959"; ctx.beginPath(); ctx.arc(4, -13, 7, Math.PI, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#e5e0cb"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-4, 9); ctx.lineTo(-8, 17); ctx.moveTo(3, 10); ctx.lineTo(8, 15); ctx.stroke();
    ctx.restore();
  }

  // Sonnet 5.5 ile hazırlanan saf uçuş tahmini; gerçek hareketle regresyon testi yapılır.
  function predictReleasePath(snapshot) {
    const BOOST_VX_MAX = SLING.vxCap;
    const BOOST_DURATION = SLING.seconds;
    const VX_MIN = -100;
    const VY_MIN = -580;
    const VY_MAX = 650;
    const WATER_Y = 705;
    const CEILING_Y = -110;
    const BACKTRACK_MARGIN = 180;
    const STEER_ACCEL_BASE = 28;
    const STEER_ACCEL_GAIN = 420;
    const DRAG_X = 0.16;
    const DRAG_Y = 0.025;
    const DT = PHYSICS_DT;
    const STEPS = 120;
    const STEPS_PER_POINT = 12;
    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);
    const p = snapshot.player;
    let x = num(p.x);
    let y = num(p.y);
    let vx = num(p.vx);
    let vy = num(p.vy);
    let boostTime = Math.max(0, num(snapshot.boostTime));
    const steer = clamp(num(snapshot.steer), -1, 1);
    const checkpointX = num(snapshot.checkpointX, -Infinity);
    const limitVelocity = () => {
      const boostRatio = Math.min(1, boostTime / BOOST_DURATION);
      const vxCap = BASE_PLAYER_VX_MAX + (BOOST_VX_MAX - BASE_PLAYER_VX_MAX) * boostRatio;
      vx = clamp(vx, VX_MIN, vxCap);
      vy = clamp(vy, VY_MIN, VY_MAX);
      const speed = Math.hypot(vx, vy);
      if (speed > MAX_PLAYER_SPEED) {
        const k = MAX_PLAYER_SPEED / speed;
        vx *= k;
        vy *= k;
      }
    };
    if (snapshot.cleanRelease) {
      const impulse = SLING.baseImpulse + SLING.bonusImpulse * clamp(num(snapshot.releaseQuality), 0, 1);
      const speed = Math.max(1, Math.hypot(vx, vy));
      vx += (vx / speed) * impulse;
      vy += (vy / speed) * impulse;
      boostTime = BOOST_DURATION;
      limitVelocity();
    }
    const points = [{ x, y }];
    let outcome = "flight";
    for (let step = 1; step <= STEPS; step++) {
      boostTime = Math.max(0, boostTime - DT);
      vx += (STEER_ACCEL_BASE + steer * STEER_ACCEL_GAIN) * DT;
      vy += GRAVITY * DT;
      vx *= Math.exp(-DRAG_X * DT);
      vy *= Math.exp(-DRAG_Y * DT);
      limitVelocity();
      x += vx * DT;
      y += vy * DT;
      let hit = null;
      if (y > WATER_Y) hit = "water";
      else if (y < CEILING_Y) hit = "ceiling";
      else if (x < checkpointX - BACKTRACK_MARGIN) hit = "backtrack";
      if (hit || step % STEPS_PER_POINT === 0) points.push({ x, y });
      if (hit) { outcome = hit; break; }
    }
    return { points, outcome };
  }

  function togglePreview() {
    if (state !== "playing" || practiceIndex < 0) return;
    previewOn = !previewOn;
    updateHud(true);
  }

  function drawReleasePreview() {
    if (state !== "playing" || practiceIndex < 0 || !previewOn || !tetherAnchor) return;
    const cleanRelease = isCleanRelease(tetherAnchor);
    const { points, outcome } = predictReleasePath({
      player, steer: activeSteer(), boostTime, checkpointX,
      cleanRelease, releaseQuality: releaseQuality(tetherAnchor)
    });
    const warning = outcome !== "flight";
    const color = warning ? "#ff8f77" : cleanRelease ? "#ffc36b" : "#55d6cf";
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 1; i < points.length; i += 1) {
      ctx.globalAlpha = 0.8 - (i / points.length) * 0.38;
      ctx.beginPath();
      ctx.arc(points[i].x - cameraX, points[i].y, i === points.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (warning && points.length > 1) {
      const end = points[points.length - 1];
      const x = end.x - cameraX;
      ctx.globalAlpha = 0.85; ctx.strokeStyle = color; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - 5, end.y - 5); ctx.lineTo(x + 5, end.y + 5);
      ctx.moveTo(x + 5, end.y - 5); ctx.lineTo(x - 5, end.y + 5); ctx.stroke();
    }
    ctx.restore();
  }

  function draw(time) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(rect.width * dpr);
    const pixelHeight = Math.round(rect.height * dpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
    }
    const scale = Math.min(pixelWidth / W, pixelHeight / H);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackground(time);

    if (state !== "menu") {
      const target = nearestAnchor();
      checkpoints.forEach(drawCheckpoint);
      for (const hazard of hazards) {
        const x = hazard.x - cameraX;
        if (x > -70 && x < W + 70) drawHazard(hazard, time);
      }
      for (const anchor of anchors) drawAnchor(anchor, target);
      for (const seal of seals) drawSeal(seal, time);
      if (tetherAnchor) {
        ctx.strokeStyle = "rgba(198,229,212,.78)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(player.x - cameraX, player.y); ctx.lineTo(tetherAnchor.x - cameraX, tetherAnchor.y); ctx.stroke();
      } else if (target) {
        ctx.strokeStyle = tetherHeld ? "rgba(85,214,207,.38)" : "rgba(85,214,207,.16)";
        ctx.lineWidth = tetherHeld ? 1.5 : 1; ctx.setLineDash([5, 7]);
        ctx.beginPath(); ctx.moveTo(player.x - cameraX, player.y); ctx.lineTo(target.anchor.x - cameraX, target.anchor.y); ctx.stroke(); ctx.setLineDash([]);
      }
      if (player.x > 16700) {
        const dockX = ROUTE_END - cameraX;
        ctx.fillStyle = "#263d3c"; ctx.fillRect(dockX, 440, 280, 195);
        ctx.fillStyle = "#56645a"; ctx.fillRect(dockX - 12, 436, 304, 8);
        ctx.fillStyle = "#d6bd8c"; ctx.fillRect(dockX + 208, 318, 9, 118);
        ctx.fillStyle = "#1c343b"; ctx.fillRect(dockX + 196, 298, 33, 26);
        ctx.fillStyle = "#ffc36b"; ctx.shadowColor = "#ffc36b"; ctx.shadowBlur = 16;
        ctx.fillRect(dockX + 208, 305, 9, 11); ctx.shadowBlur = 0;
      }
      drawReleasePreview();
      drawPlayer(time);
      drawSealLocator();
      for (const hazard of hazards) {
        const pos = hazardPosition(hazard);
        const dx = pos.x - player.x;
        if (dx > 50 && dx < 390) {
          ctx.fillStyle = "rgba(255,107,107,.85)";
          ctx.beginPath(); ctx.moveTo(W * 0.38 + dx - 8, 79); ctx.lineTo(W * 0.38 + dx + 8, 79); ctx.lineTo(W * 0.38 + dx, 92); ctx.closePath(); ctx.fill();
        }
      }
    } else {
      for (let i = 0; i < 4; i += 1) drawAnchor({ x: 480 + i * 255, y: [340, 285, 380, 300][i], visited: false }, null);
      drawPlayer(0);
    }
  }

  function playTone(frequency, duration, type, delay = 0) {
    if (!soundOn) return;
    try {
      audio ||= new AudioContext();
      if (audio.state === "suspended") audio.resume();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, audio.currentTime + delay);
      gain.gain.setValueAtTime(0.0001, audio.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.09, audio.currentTime + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + duration);
      oscillator.connect(gain); gain.connect(audio.destination);
      oscillator.start(audio.currentTime + delay); oscillator.stop(audio.currentTime + delay + duration + 0.02);
    } catch { /* Sound is optional and may be unavailable in some browsers. */ }
  }

  // Sonnet 5.5 ile hazırlanan döngü: çizim hızı, halat fiziğinin adımını değiştirmez.
  function resetFrameClock() {
    lastFrame = 0;
    frameAccumulator = 0;
  }

  function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const dt = Math.min(0.035, Math.max(0, (timestamp - lastFrame) / 1000));
    lastFrame = timestamp;
    if (state === "playing" && !recoveryReady) {
      frameAccumulator += dt;
      while (frameAccumulator >= PHYSICS_DT - 1e-9 && state === "playing" && !recoveryReady) {
        update(PHYSICS_DT);
        frameAccumulator = Math.max(0, frameAccumulator - PHYSICS_DT);
      }
      if (state !== "playing" || recoveryReady) frameAccumulator = 0;
    } else {
      frameAccumulator = 0;
    }
    draw(timestamp / 1000);
    requestAnimationFrame(frame);
  }

  const keys = new Set();
  function startRecovery() {
    if (state !== "playing" || !recoveryReady) return;
    recoveryReady = false;
    invulnerable = 2.1;
    resetFrameClock();
    updateHud(true);
  }

  window.addEventListener("keydown", event => {
    if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (state === "paused" && ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(event.code)) return;
    if (recoveryReady && recoveryBlockedKeys.has(event.code)) return;
    if (["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS"].includes(event.code)) startRecovery();
    keys.add(event.code);
    if (event.code === "Space") beginTether();
    if (event.code === "KeyG") togglePreview();
    if (event.code === "Escape" || event.code === "KeyP") {
      if (state === "playing") pauseGame(); else if (state === "paused") resumeGame();
    }
    if (event.code === "KeyR" && state === "playing" && practiceIndex >= 0) {
      invulnerable = 0;
      takeHit("retry");
      ui.combo.textContent = "TEKRAR DENEME";
      messageUntil = elapsed + 0.9;
    } else if (event.code === "KeyR" && (state === "won" || state === "lost")) resetRun();
    if (state === "menu" && ["Digit1", "Digit2", "Digit3"].includes(event.code)) {
      resetRun(Number(event.code.slice(-1)) - 1);
    }
  });
  window.addEventListener("keyup", event => {
    recoveryBlockedKeys.delete(event.code);
    keys.delete(event.code);
    if (event.code === "Space" && tetherPointerId === null) releaseTether();
  });
  window.addEventListener("blur", () => {
    keys.clear(); steerPointer.clear(); tetherPointerY.clear();
    releaseTether({ award: false, consumeAnchor: false });
    pauseGame();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      keys.clear();
      steerPointer.clear();
      tetherPointerY.clear();
      releaseTether({ award: false, consumeAnchor: false });
      pauseGame();
    }
    resetFrameClock();
  });

  function beginTetherPointer(event) {
    if (state !== "playing" || event.button !== 0 || tetherHeld) return;
    startRecovery();
    beginTether();
    if (!tetherHeld) return;
    tetherPointerId = event.pointerId;
    if (event.pointerType === "touch") {
      tetherPointerY.set(event.pointerId, { startY: event.clientY, currentY: event.clientY });
    }
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Pointer capture is not required. */ }
  }

  function trackTetherDrag(event) {
    if (!tetherPointerY.has(event.pointerId)) return;
    tetherPointerY.get(event.pointerId).currentY = event.clientY;
  }

  function endTetherPointer(event) {
    if (tetherPointerId !== event.pointerId) return;
    tetherPointerId = null;
    tetherPointerY.clear();
    releaseTether();
  }

  canvas.addEventListener("pointerdown", beginTetherPointer);
  canvas.addEventListener("pointermove", trackTetherDrag);
  canvas.addEventListener("pointerup", endTetherPointer);
  canvas.addEventListener("pointercancel", endTetherPointer);
  canvas.addEventListener("lostpointercapture", endTetherPointer);

  for (const button of document.querySelectorAll("[data-steer]")) {
    const direction = Number(button.dataset.steer);
    button.addEventListener("pointerdown", event => {
      event.preventDefault();
      if (state !== "playing") return;
      startRecovery();
      steerPointer.set(event.pointerId, direction);
      try { button.setPointerCapture(event.pointerId); } catch { /* Pointer capture is optional. */ }
    });
    const stopSteer = event => steerPointer.delete(event.pointerId);
    button.addEventListener("pointerup", stopSteer);
    button.addEventListener("pointercancel", stopSteer);
    button.addEventListener("lostpointercapture", stopSteer);
  }
  ui.tetherTouch.addEventListener("pointerdown", event => {
    event.preventDefault(); beginTetherPointer(event);
  });
  ui.tetherTouch.addEventListener("pointermove", trackTetherDrag);
  ui.tetherTouch.addEventListener("pointerup", endTetherPointer);
  ui.tetherTouch.addEventListener("pointercancel", endTetherPointer);
  ui.tetherTouch.addEventListener("lostpointercapture", endTetherPointer);

  document.querySelector("#start-button").addEventListener("click", () => resetRun(-1));
  for (const button of document.querySelectorAll("[data-practice-start]")) {
    button.addEventListener("click", () => resetRun(Number(button.dataset.practiceStart)));
  }
  ui.tutorialSkip.addEventListener("click", completeTutorial);
  document.querySelector("#resume-button").addEventListener("click", resumeGame);
  document.querySelector("#restart-button").addEventListener("click", () => resetRun());
  document.querySelector("#replay-button").addEventListener("click", () => resetRun());
  document.querySelector("#menu-button").addEventListener("click", () => { state = "menu"; setPanels(); });
  document.querySelector("#result-menu-button").addEventListener("click", () => { state = "menu"; setPanels(); });
  ui.pauseButton.addEventListener("click", event => { event.stopPropagation(); pauseGame(); });
  ui.previewButton.addEventListener("click", togglePreview);
  ui.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    ui.sound.classList.toggle("is-muted", !soundOn);
    ui.sound.setAttribute("aria-label", soundOn ? "Sesi kapat" : "Sesi aç");
    ui.sound.title = soundOn ? "Sesi kapat" : "Sesi aç";
    if (soundOn) playTone(560, 0.08, "sine");
  });

  ui.bestStart.textContent = formatScore(best);
  ui.bestTimeStart.textContent = formatRunTime(bestTime);
  ui.deliveryTimeStart.textContent = formatRunTime(bestDeliveryTime);
  setPanels();
  requestAnimationFrame(frame);
})();
