(() => {
  "use strict";

  // Visual effects have their own clock and random stream; they never move the player.
  class MotionFX {
    constructor() { this.reset(); }

    reset() {
      this.particles = [];
      this.rings = [];
      this.trail = [];
      this.seed = 1847;
      this.clock = 0;
      this.trailClock = 0;
      this.shake = 0;
      this.flash = 0;
      this.flashColor = "255,143,119";
      this.reduced = false;
    }

    random() {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    burst(kind, x, y, vx = 0, vy = 0, strength = 1) {
      const colors = { attach: "#8ce9de", release: "#cfe8d9", boost: "#ffc36b",
        seal: "#ffdc92", checkpoint: "#70e0ca", hurt: "#ff917e", water: "#8bbdc9", finish: "#ffdc92", break: "#ee967e" };
      const color = colors[kind] || colors.release;
      const powerful = ["boost", "seal", "checkpoint", "finish"].includes(kind);
      const count = this.reduced ? 4 : kind === "water" ? 24 : powerful ? 22 : 10;
      if (this.rings.length >= 16) this.rings.shift();
      this.rings.push({ x, y, age: 0, life: powerful ? 0.65 : 0.4,
        radius: kind === "water" ? 8 : 5, color, water: kind === "water" });
      for (let i = 0; i < count; i++) {
        const angle = this.random() * Math.PI * 2;
        const speed = (22 + this.random() * (powerful ? 135 : 80)) * strength;
        this.particles.push({ x, y, px: x, py: y, vx: Math.cos(angle) * speed + vx * 0.13,
          vy: kind === "water" ? -70 - this.random() * 140 : Math.sin(angle) * speed + vy * 0.13,
          age: 0, life: 0.25 + this.random() * 0.45, size: 1 + this.random() * 1.6,
          gravity: kind === "water" ? 310 : 60, color });
      }
      if (this.particles.length > 220) this.particles.splice(0, this.particles.length - 220);
      this.shake = Math.max(this.shake, kind === "hurt" || kind === "water" ? 4 : kind === "boost" ? 2 : 0.65);
      if (["hurt", "water", "seal", "checkpoint"].includes(kind)) {
        this.flash = kind === "hurt" || kind === "water" ? 0.28 : 0.11;
        this.flashColor = kind === "hurt" || kind === "water" ? "255,143,119" : "255,211,131";
      }
    }

    clearTrail() { this.trail.length = 0; this.trailClock = 0; }

    update(dt, body, boost = 0, flying = true) {
      if (!(dt > 0)) return;
      this.clock += dt;
      this.shake *= Math.exp(-13 * dt);
      this.flash *= Math.exp(-7 * dt);
      for (const particle of this.particles) {
        particle.px = particle.x; particle.py = particle.y;
        particle.vy += particle.gravity * dt;
        particle.vx *= Math.exp(-1.4 * dt);
        particle.x += particle.vx * dt; particle.y += particle.vy * dt;
        particle.age += dt;
      }
      this.particles = this.particles.filter(particle => particle.age < particle.life);
      for (const ring of this.rings) ring.age += dt;
      this.rings = this.rings.filter(ring => ring.age < ring.life);
      for (const point of this.trail) point.age += dt;
      this.trail = this.trail.filter(point => point.age < 0.32);
      this.trailClock += dt;
      if (body && flying && Math.hypot(body.vx, body.vy) > 170 && this.trailClock >= 1 / 90) {
        const previous = this.trail[this.trail.length - 1];
        if (previous && Math.hypot(previous.x - body.x, previous.y - body.y) > 90) this.clearTrail();
        this.trail.push({ x: body.x, y: body.y + 5, age: 0, boost });
        this.trailClock %= 1 / 90;
        if (this.trail.length > 34) this.trail.shift();
      }
    }

    offset() {
      if (this.reduced) return { x: 0, y: 0 };
      return { x: Math.sin(this.clock * 91) * this.shake,
        y: Math.cos(this.clock * 73 + 1) * this.shake * 0.6 };
    }

    draw(ctx, camera) {
      ctx.save(); ctx.lineCap = "round";
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        const fade = Math.max(0, 1 - b.age / 0.32);
        ctx.globalAlpha = fade * (this.reduced ? 0.13 : 0.34);
        ctx.strokeStyle = b.boost > 0 ? "#ffca83" : "#9addd4";
        ctx.lineWidth = 0.5 + fade * (b.boost > 0 ? 3.5 : 1.8);
        ctx.beginPath(); ctx.moveTo(a.x - camera, a.y); ctx.lineTo(b.x - camera, b.y); ctx.stroke();
      }
      for (const ring of this.rings) {
        const t = ring.age / ring.life;
        ctx.globalAlpha = (1 - t) ** 2 * 0.8;
        ctx.strokeStyle = ring.color; ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(ring.x - camera, ring.y, ring.radius + t * 38,
          (ring.radius + t * 38) * (ring.water ? 0.28 : 1), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const particle of this.particles) {
        ctx.globalAlpha = (1 - particle.age / particle.life) ** 1.5;
        ctx.strokeStyle = particle.color; ctx.lineWidth = particle.size;
        ctx.beginPath(); ctx.moveTo(particle.px - camera, particle.py);
        ctx.lineTo(particle.x - camera + 0.3, particle.y); ctx.stroke();
      }
      ctx.restore();
    }

    drawFlash(ctx, width, height) {
      if (this.flash < 0.004 || this.reduced) return;
      ctx.save();
      const glow = ctx.createRadialGradient(width / 2, height / 2, height * 0.28,
        width / 2, height / 2, width * 0.64);
      glow.addColorStop(0, `rgba(${this.flashColor},0)`);
      glow.addColorStop(1, `rgba(${this.flashColor},${this.flash})`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
  }
  globalThis.MotionFX = MotionFX;
})();
