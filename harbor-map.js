(() => {
  "use strict";

  const end = 17400;
  const districts = Object.freeze([
    Object.freeze({ id: "old-pier", name: "Eski Rıhtım", start: 0, end: 5900,
      practiceX: 150, accent: "#d5a76f", skyTop: "#182b36", skyBottom: "#53606a", waterTop: "#31505a" }),
    Object.freeze({ id: "crane-yard", name: "Vinç Avlusu", start: 5900, end: 11200,
      practiceX: 5900, accent: "#8aafb3", skyTop: "#142733", skyBottom: "#455965", waterTop: "#244853" }),
    Object.freeze({ id: "lighthouse-pass", name: "Fener Geçidi", start: 11200, end,
      practiceX: 11200, accent: "#8fbce1", skyTop: "#102539", skyBottom: "#41627a", waterTop: "#27546a" })
  ]);
  const checkpoints = Object.freeze(districts.slice(1).map(district => district.start));
  const practiceStarts = Object.freeze(districts.map(district => district.practiceX));

  function districtAt(x) {
    if (!Number.isFinite(x)) return null;
    const clamped = Math.max(0, Math.min(end, x));
    return districts.find((district, index) => clamped < district.end || index === districts.length - 1);
  }

  function practiceForSeal(id) {
    return Number.isInteger(id) && id >= 1 && id <= 3 ? id - 1 : null;
  }

  function drawScenery(ctx, options = {}) {
    const { cameraX, width = 1280, height = 720, time = 0, motion = true } = options;
    if (!Number.isFinite(cameraX) || !Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(height) || height <= 0) return;
    const left = Math.max(0, cameraX);
    const right = Math.min(end, cameraX + width);
    if (left >= right) return;
    const screen = x => x - cameraX;
    const inView = (x, radius = 0) => x + radius >= left && x - radius <= right;

    ctx.save();
    try {
      ctx.scale(1, height / 720);

      for (const district of districts) {
        const from = Math.max(left, district.start);
        const to = Math.min(right, district.end);
        if (from >= to) continue;
        ctx.fillStyle = district.waterTop;
        ctx.globalAlpha = 0.24;
        ctx.fillRect(screen(from), 565, to - from, 155);
        ctx.globalAlpha = 1;
      }

      for (let i = 0; i < checkpoints.length; i++) {
        const x = checkpoints[i];
        if (!inView(x, 85)) continue;
        const sx = screen(x);
        ctx.fillStyle = "#2b424b";
        ctx.fillRect(sx - 77, 520, 9, 45);
        ctx.fillRect(sx + 68, 520, 9, 45);
        ctx.fillStyle = districts[i + 1].accent;
        ctx.fillRect(sx - 59, 500, 118, 26);
        ctx.fillStyle = "#182d37";
        ctx.font = "700 10px Segoe UI, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(districts[i + 1].name.toLocaleUpperCase("tr"), sx, 518);
      }

      // Distant wooden sheds and low piers. Their solid mass stays below the route.
      for (const x of [620, 2060, 3520, 5030]) {
        if (!inView(x, 255)) continue;
        const sx = screen(x);
        ctx.fillStyle = "#18303a";
        ctx.fillRect(sx - 188, 475, 376, 91);
        ctx.fillStyle = "#3d3b36";
        ctx.beginPath();
        ctx.moveTo(sx - 212, 480); ctx.lineTo(sx - 151, 444);
        ctx.lineTo(sx + 151, 444); ctx.lineTo(sx + 212, 480);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#785b42";
        for (let door = -2; door <= 2; door++) ctx.fillRect(sx + door * 66 - 13, 510, 26, 56);
        ctx.fillStyle = "rgba(235,185,115,.32)";
        ctx.fillRect(sx - 127, 491, 17, 12);
        ctx.fillRect(sx + 106, 491, 17, 12);
      }
      const oldFrom = Math.max(left, 0);
      const oldTo = Math.min(right, districts[0].end);
      for (let x = Math.ceil((oldFrom - 180) / 260) * 260 + 180; x < oldTo; x += 260) {
        const sx = screen(x);
        ctx.fillStyle = "#5b4939";
        ctx.fillRect(sx - 30, 558, 62, 11);
        ctx.fillRect(sx - 22, 566, 11, 100);
        ctx.fillRect(sx + 12, 566, 11, 100);
        ctx.fillStyle = "#ad8154";
        ctx.fillRect(sx - 31, 556, 64, 3);
      }
      if (oldFrom < oldTo) {
        ctx.fillStyle = "rgba(184,180,155,.09)";
        for (let x = Math.ceil(oldFrom / 550) * 550; x < oldTo; x += 550) {
          ctx.fillRect(screen(x), 535, 310, 16);
        }
      }

      // Gantries sit behind the anchors; the container line begins at the water edge.
      for (const x of [6520, 8140, 9880, 10950]) {
        if (!inView(x, 370)) continue;
        const sx = screen(x);
        ctx.fillStyle = "#263c45";
        ctx.fillRect(sx - 270, 397, 540, 11);
        ctx.fillRect(sx - 242, 408, 13, 153);
        ctx.fillRect(sx + 229, 408, 13, 153);
        ctx.fillStyle = "#53646a";
        ctx.fillRect(sx - 285, 389, 570, 8);
        ctx.strokeStyle = "#49616b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(sx - 235, 410); ctx.lineTo(sx, 485);
        ctx.lineTo(sx + 235, 410); ctx.stroke();
        ctx.strokeStyle = "rgba(197,158,104,.43)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(sx + 84, 405); ctx.lineTo(sx + 84, 526); ctx.stroke();
        ctx.fillStyle = "#8f7255";
        ctx.fillRect(sx + 70, 522, 28, 5);
      }
      const yardFrom = Math.max(left, districts[1].start);
      const yardTo = Math.min(right, districts[1].end);
      for (let x = Math.ceil((yardFrom - 80) / 245) * 245 + 80; x < yardTo; x += 245) {
        const sx = screen(x);
        ctx.fillStyle = Math.floor(x / 245) % 2 ? "#385660" : "#765849";
        ctx.fillRect(sx, 510, 206, 53);
        ctx.strokeStyle = "rgba(13,35,43,.45)";
        ctx.lineWidth = 2;
        ctx.strokeRect(sx + 5, 515, 195, 43);
        ctx.beginPath();
        for (let rib = 1; rib < 6; rib++) {
          ctx.moveTo(sx + rib * 32, 515); ctx.lineTo(sx + rib * 32, 558);
        }
        ctx.stroke();
      }

      // Stone breakwater, small channel lights, and a single approach lighthouse.
      const passFrom = Math.max(left, districts[2].start);
      const passTo = Math.min(right, end);
      for (let x = Math.ceil(passFrom / 190) * 190; x < passTo; x += 190) {
        const sx = screen(x);
        ctx.fillStyle = Math.floor(x / 190) % 2 ? "#3c5664" : "#344b5b";
        ctx.fillRect(sx, 557, 184, 59);
        ctx.fillStyle = "#69808a";
        ctx.fillRect(sx, 554, 184, 5);
        ctx.strokeStyle = "rgba(17,44,58,.58)";
        ctx.beginPath(); ctx.moveTo(sx + 80, 580); ctx.lineTo(sx + 80, 615); ctx.stroke();
      }
      for (const x of [11920, 13020, 14780, 17030]) {
        if (!inView(x, 25)) continue;
        const sx = screen(x);
        ctx.fillStyle = "#254353";
        ctx.fillRect(sx - 6, 518, 12, 43);
        ctx.fillStyle = "#dfb976";
        ctx.fillRect(sx - 4, 513, 8, 7);
      }
      const lighthouseX = 15780;
      if (inView(lighthouseX, 550)) {
        const sx = screen(lighthouseX);
        const beamShift = motion && Number.isFinite(time) ? Math.sin(time * 0.55) * 225 : 0;
        ctx.fillStyle = "rgba(247,206,131,.075)";
        ctx.beginPath();
        ctx.moveTo(sx, 371);
        ctx.lineTo(sx + 380 + beamShift, 463);
        ctx.lineTo(sx + 475 + beamShift, 510);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#d2d6cc";
        ctx.beginPath();
        ctx.moveTo(sx - 17, 393); ctx.lineTo(sx + 17, 393);
        ctx.lineTo(sx + 30, 553); ctx.lineTo(sx - 30, 553);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#334f60";
        ctx.fillRect(sx - 20, 404, 40, 12);
        ctx.fillRect(sx - 24, 442, 48, 10);
        ctx.fillRect(sx - 29, 521, 58, 10);
        ctx.fillStyle = "#1d3849";
        ctx.fillRect(sx - 25, 375, 50, 19);
        ctx.fillStyle = "#e9be77";
        ctx.fillRect(sx - 14, 378, 28, 12);
        ctx.fillStyle = "#2b4757";
        ctx.beginPath();
        ctx.moveTo(sx - 33, 375); ctx.lineTo(sx, 351);
        ctx.lineTo(sx + 33, 375); ctx.closePath(); ctx.fill();
      }
    } finally {
      ctx.restore();
    }
  }

  globalThis.HarborMap = Object.freeze({ districts, checkpoints, practiceStarts, end,
    districtAt, practiceForSeal, drawScenery });
})();
