(() => {
  "use strict";
  const flashCache = new WeakMap();
  const TRAUMA_DECAY = 1.6, TRAUMA_MAX_OFFSET = 14;
  const PARTICLE_CAPACITY = 220, PARTICLE_ALPHA_BUCKETS = 4;
  const PARTICLE_COLORS = ["#8ce9de", "#cfe8d9", "#ffc36b", "#ffdc92", "#70e0ca", "#ff917e", "#8bbdc9", "#ee967e"];
  const PARTICLE_COLOR_IDS = { attach: 0, release: 1, boost: 2, seal: 3, checkpoint: 4, hurt: 5, water: 6, finish: 3, break: 7 };
  const PARTICLE_FIELDS = ["x", "y", "px", "py", "vx", "vy", "age", "life", "size", "gravity"];
  const particleDrawCache = new WeakMap();
  const ROPE_ITERATIONS = 6, ROPE_GRAVITY = 900, ROPE_DAMPING = .985;

  class Spring {
    constructor(k = 220, c = 18) { this.k = k; this.c = c; this.reset(); }
    reset() { this.x = 0; this.v = 0; this.previous = 0; }
    kick(impulse) { this.v += impulse; }
    update(dt) {
      this.previous = this.x;
      this.v += (-this.k * this.x - this.c * this.v) * dt;
      this.x += this.v * dt;
    }
  }

  class VerletRope {
    constructor(segments = 12) {
      this.n = segments + 1;
      for (const key of ["x", "y", "px", "py"]) this[key] = new Float32Array(this.n);
    }
    reset(ax, ay, bx, by) {
      for (let i = 0; i < this.n; i++) {
        const t = i / (this.n - 1);
        this.x[i] = this.px[i] = ax + (bx - ax) * t;
        this.y[i] = this.py[i] = ay + (by - ay) * t;
      }
    }
    kick(vx, dt) {
      for (let i = 1; i < this.n - 1; i++) this.px[i] -= vx * dt * Math.sin(Math.PI * i / (this.n - 1));
    }
    step(dt, ax, ay, bx, by, length) {
      const segment = Math.max(1, length) / (this.n - 1), last = this.n - 1;
      this.px[0] = this.x[0]; this.py[0] = this.y[0];
      this.px[last] = this.x[last]; this.py[last] = this.y[last];
      for (let i = 1; i < last; i++) {
        const vx = (this.x[i] - this.px[i]) * ROPE_DAMPING, vy = (this.y[i] - this.py[i]) * ROPE_DAMPING;
        this.px[i] = this.x[i]; this.py[i] = this.y[i];
        this.x[i] += vx; this.y[i] += vy + ROPE_GRAVITY * dt * dt;
      }
      for (let iteration = 0; iteration < ROPE_ITERATIONS; iteration++) {
        this.x[0] = ax; this.y[0] = ay; this.x[last] = bx; this.y[last] = by;
        for (let i = 0; i < last; i++) {
          const dx = this.x[i + 1] - this.x[i], dy = this.y[i + 1] - this.y[i];
          const distance = Math.hypot(dx, dy) || 1e-6, diff = (distance - segment) / distance;
          const wa = i === 0 ? 0 : 1, wb = i + 1 === last ? 0 : 1, weight = wa + wb || 1;
          this.x[i] += dx * diff * wa / weight; this.y[i] += dy * diff * wa / weight;
          this.x[i + 1] -= dx * diff * wb / weight; this.y[i + 1] -= dy * diff * wb / weight;
        }
      }
    }
    atX(i, alpha) { return this.px[i] + (this.x[i] - this.px[i]) * alpha; }
    atY(i, alpha) { return this.py[i] + (this.y[i] - this.py[i]) * alpha; }
    path(ctx, camera, alpha, ax, ay, bx, by) {
      ctx.beginPath(); ctx.moveTo(ax - camera, ay);
      for (let i = 1; i < this.n - 1; i++) {
        const x = this.atX(i, alpha), y = this.atY(i, alpha);
        const ex = i === this.n - 2 ? bx : (x + this.atX(i + 1, alpha)) / 2;
        const ey = i === this.n - 2 ? by : (y + this.atY(i + 1, alpha)) / 2;
        ctx.quadraticCurveTo(x - camera, y, ex - camera, ey);
      }
    }
  }

  class ParticlePool {
    constructor(size) {
      this.n = size; this.live = 0; this.serial = 0;
      for (const key of PARTICLE_FIELDS) this[key] = new Float32Array(size);
      this.color = new Uint8Array(size); this.order = new Float64Array(size);
      particleDrawCache.set(this, { buckets: new Uint8Array(size), counts: new Uint16Array(PARTICLE_COLORS.length * PARTICLE_ALPHA_BUCKETS),
        widths: new Float64Array(PARTICLE_COLORS.length * PARTICLE_ALPHA_BUCKETS) });
    }
    get length() { return this.live; }
    clear() {
      this.live = 0; this.serial = 0;
      for (const key of PARTICLE_FIELDS) this[key].fill(0);
      this.color.fill(0); this.order.fill(0);
    }
    spawn(x, y, vx, vy, life, size, gravity, color) {
      if (this.live === this.n) {
        // Keep the newest particles, as the former overflow splice did.
        let oldest = 0;
        for (let i = 1; i < this.live; i++) if (this.order[i] < this.order[oldest]) oldest = i;
        this.remove(oldest);
      }
      const i = this.live++;
      this.x[i] = this.px[i] = x; this.y[i] = this.py[i] = y;
      this.vx[i] = vx; this.vy[i] = vy; this.age[i] = 0; this.life[i] = life;
      this.size[i] = size; this.gravity[i] = gravity; this.color[i] = color; this.order[i] = this.serial++;
    }
    remove(i) {
      const last = --this.live;
      if (i === last) return;
      for (const key of PARTICLE_FIELDS) this[key][i] = this[key][last];
      this.color[i] = this.color[last]; this.order[i] = this.order[last];
    }
    update(dt) {
      const drag = Math.exp(-1.4 * dt);
      for (let i = this.live - 1; i >= 0; i--) {
        this.px[i] = this.x[i]; this.py[i] = this.y[i];
        this.vy[i] += this.gravity[i] * dt; this.vx[i] *= drag;
        this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt; this.age[i] += dt;
        if (this.age[i] >= this.life[i]) this.remove(i);
      }
    }
  }

  function drawParticles(ctx, pool, camera) {
    const cache = particleDrawCache.get(pool);
    cache.counts.fill(0); cache.widths.fill(0);
    for (let i = 0; i < pool.live; i++) {
      const alpha = Math.max(0, 1 - pool.age[i] / pool.life[i]) ** 1.5;
      const bucket = pool.color[i] * PARTICLE_ALPHA_BUCKETS + Math.min(PARTICLE_ALPHA_BUCKETS - 1, Math.floor(alpha * PARTICLE_ALPHA_BUCKETS));
      cache.buckets[i] = bucket; cache.counts[bucket]++; cache.widths[bucket] += pool.size[i];
    }
    for (let bucket = 0; bucket < cache.counts.length; bucket++) {
      if (!cache.counts[bucket]) continue;
      ctx.globalAlpha = (bucket % PARTICLE_ALPHA_BUCKETS + .5) / PARTICLE_ALPHA_BUCKETS;
      ctx.strokeStyle = PARTICLE_COLORS[Math.floor(bucket / PARTICLE_ALPHA_BUCKETS)];
      ctx.lineWidth = cache.widths[bucket] / cache.counts[bucket];
      ctx.beginPath();
      for (let i = 0; i < pool.live; i++) if (cache.buckets[i] === bucket) {
        ctx.moveTo(pool.px[i] - camera, pool.py[i]); ctx.lineTo(pool.x[i] - camera + .3, pool.y[i]);
      }
      ctx.stroke();
    }
  }

  class Trauma {
    constructor() { this.t = 0; this.clock = 0; }
    add(value) {
      if (Number.isFinite(value)) this.t = Math.max(0, Math.min(1, this.t + value));
    }
    update(dt) {
      this.clock += dt;
      this.t = Math.max(0, this.t - TRAUMA_DECAY * dt);
    }
    offset(max = TRAUMA_MAX_OFFSET) {
      const strength = this.t * this.t, clock = this.clock;
      return { x: max * strength * (Math.sin(clock * 47) + Math.sin(clock * 83 + 1.3)) * .5,
        y: max * strength * .6 * (Math.sin(clock * 59 + 2.1) + Math.sin(clock * 97)) * .5 };
    }
  }

  function flashSprite(ctx, width, height, color) {
    if (!globalThis.document?.createElement) return null;
    let cache = flashCache.get(ctx);
    if (!cache || cache.width !== width || cache.height !== height) {
      cache = { width, height, colors: new Map() };
      flashCache.set(ctx, cache);
    }
    let image = cache.colors.get(color);
    if (!image) {
      image = document.createElement("canvas"); image.width = width; image.height = height;
      const paint = image.getContext("2d");
      if (!paint) return null;
      const gradient = paint.createRadialGradient(width / 2, height / 2, height * .28, width / 2, height / 2, width * .64);
      gradient.addColorStop(0, `rgba(${color},0)`); gradient.addColorStop(1, `rgba(${color},1)`);
      paint.fillStyle = gradient; paint.fillRect(0, 0, width, height);
      if (cache.colors.size >= 2) cache.colors.delete(cache.colors.keys().next().value);
      cache.colors.set(color, image);
    }
    return image;
  }

  // Visual effects have their own clock and random stream; they never move the player.
  class MotionFX {
    constructor() { this.reset(); }

    reset() {
      if (this.particles) this.particles.clear();
      else this.particles = new ParticlePool(PARTICLE_CAPACITY);
      this.rings = [];
      this.trail = [];
      this.seed = 1847;
      this.clock = 0;
      this.trailClock = 0;
      this.trauma = new Trauma();
      this.flash = 0;
      this.flashColor = "255,143,119";
      this.reduced = false;
    }

    random() {
      this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
      return this.seed / 4294967296;
    }

    burst(kind, x, y, vx = 0, vy = 0, strength = 1) {
      const colorId = PARTICLE_COLOR_IDS[kind] ?? PARTICLE_COLOR_IDS.release;
      const color = PARTICLE_COLORS[colorId];
      const powerful = ["boost", "seal", "checkpoint", "finish"].includes(kind);
      const count = this.reduced ? 4 : kind === "water" ? 24 : powerful ? 22 : 10;
      if (this.rings.length >= 16) this.rings.shift();
      this.rings.push({ x, y, age: 0, life: powerful ? 0.65 : 0.4,
        radius: kind === "water" ? 8 : 5, color, water: kind === "water" });
      for (let i = 0; i < count; i++) {
        const angle = this.random() * Math.PI * 2;
        const speed = (22 + this.random() * (powerful ? 135 : 80)) * strength;
        this.particles.spawn(x, y, Math.cos(angle) * speed + vx * .13,
          kind === "water" ? -70 - this.random() * 140 : Math.sin(angle) * speed + vy * .13,
          .25 + this.random() * .45, 1 + this.random() * 1.6, kind === "water" ? 310 : 60, colorId);
      }
      this.trauma.add(kind === "hurt" ? .5 : .12);
      if (["hurt", "water", "seal", "checkpoint"].includes(kind)) {
        this.flash = kind === "hurt" || kind === "water" ? 0.28 : 0.11;
        this.flashColor = kind === "hurt" || kind === "water" ? "255,143,119" : "255,211,131";
      }
    }

    clearTrail() { this.trail.length = 0; this.trailClock = 0; }

    update(dt, body, boost = 0, flying = true) {
      if (!(dt > 0)) return;
      this.clock += dt;
      this.trauma.update(dt);
      this.flash *= Math.exp(-7 * dt);
      this.particles.update(dt);
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
      return this.trauma.offset();
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
      drawParticles(ctx, this.particles, camera);
      ctx.restore();
    }

    drawFlash(ctx, width, height) {
      if (this.flash < 0.004 || this.reduced) return;
      ctx.save();
      const sprite = flashSprite(ctx, width, height, this.flashColor);
      if (sprite) {
        ctx.globalAlpha *= this.flash;
        ctx.drawImage(sprite, 0, 0);
        ctx.restore();
        return;
      }
      const glow = ctx.createRadialGradient(width / 2, height / 2, height * 0.28,
        width / 2, height / 2, width * 0.64);
      glow.addColorStop(0, `rgba(${this.flashColor},0)`);
      glow.addColorStop(1, `rgba(${this.flashColor},${this.flash})`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height); ctx.restore();
    }
  }
  globalThis.MotionFX = MotionFX;
  MotionFX.VerletRope = VerletRope;
  MotionFX.Spring = Spring;
})();
