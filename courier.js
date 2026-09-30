/* Sapan Postası courier. Local origin is the player's physics centre; +x is forward. */
(function () {
  "use strict";

  const PI = Math.PI;
  const TAU = PI * 2;
  const C = {
    ink: "#20313a", seam: "#6c695d", coat: "#d8ceb1", coatShade: "#b6ab8e",
    coatLight: "#f0e5c8", trouser: "#214c54", trouserLight: "#397177",
    leather: "#815541", leatherLight: "#ac7552", leatherDark: "#563a32",
    cap: "#bd644d", capLight: "#e18a66", scarf: "#c65d48",
    scarfLight: "#e68c66", skin: "#e8b590", skinShade: "#ba856a",
    glove: "#594536", boot: "#493e37", bootLight: "#7a6756", envelope: "#ecd6aa"
  };

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function finite(v, fallback = 0) { return Number.isFinite(v) ? v : fallback; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function spring(s, target, rate, dt) {
    const f = 1 - Math.exp(-rate * dt);
    return s + (target - s) * f;
  }
  function angleDelta(from, to) { return Math.atan2(Math.sin(to - from), Math.cos(to - from)); }
  function point(x, y) { return { x, y }; }
  function path(ctx, points, close = true) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (close) ctx.closePath();
  }
  function filled(ctx, points, color, outline = C.ink, width = 1.25) {
    path(ctx, points);
    ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.lineWidth = width; ctx.strokeStyle = outline; ctx.stroke(); }
  }
  function stroke(ctx, points, color, width, outline = 0) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    path(ctx, points, false);
    if (outline) { ctx.strokeStyle = C.ink; ctx.lineWidth = width + outline * 2; ctx.stroke(); }
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }
  function ellipse(ctx, x, y, rx, ry, color, outline = C.ink, width = 1.15, rotation = 0) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
    ctx.fillStyle = color; ctx.fill();
    if (outline) { ctx.strokeStyle = outline; ctx.lineWidth = width; ctx.stroke(); }
  }
  function limb(ctx, a, b, width, color, highlight) {
    stroke(ctx, [a, b], color, width, 1.2);
    if (highlight) stroke(ctx, [point(mix(a.x, b.x, 0.18) - 0.8, mix(a.y, b.y, 0.18)),
      point(mix(a.x, b.x, 0.77) - 0.8, mix(a.y, b.y, 0.77))], highlight, 1.2);
  }
  function solveArm(shoulder, hand, bend = 1) {
    const upper = 11.4, lower = 11.2;
    let dx = hand.x - shoulder.x, dy = hand.y - shoulder.y;
    let d = Math.hypot(dx, dy);
    if (d < 0.01) { dx = 0; dy = 1; d = 1; }
    const reach = clamp(d, 2.5, upper + lower - 0.1);
    const ux = dx / d, uy = dy / d;
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const side = Math.sqrt(Math.max(0, upper * upper - along * along));
    return point(shoulder.x + ux * along - uy * side * bend,
      shoulder.y + uy * along + ux * side * bend);
  }
  function solveLeg(hip, foot, bend) {
    const upper = 10.2, lower = 9.7;
    const dx = foot.x - hip.x, dy = foot.y - hip.y;
    const distance = Math.max(0.01, Math.hypot(dx, dy));
    const reach = clamp(distance, 0.1, upper + lower - 0.05);
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach);
    const side = Math.sqrt(Math.max(0, upper * upper - along * along));
    return point(hip.x + dx / distance * along + dy / distance * side * bend,
      hip.y + dy / distance * along - dx / distance * side * bend);
  }

  class CourierRig {
    constructor() { this.reset(); }

    reset(input = {}) {
      this.input = this._input(input);
      this.time = 0;
      this.facing = this.input.vx < -65 ? -1 : 1;
      this.faceIntent = this.facing;
      this.faceIntentTime = 0;
      this.lean = 0;
      this.leanV = 0;
      this.bagAngle = 0;
      this.bagV = 0;
      this.reach = this.input.attached ? 1 : 0;
      this.tuck = 0;
      this.brace = 0;
      this.flight = 0;
      this.walk = 0;
      this.walkPhase = 0;
      this.talk = 0;
      this.blink = 0;
      this.nextBlink = 2.7;
      this.pulses = { attach: 0, release: 0, boost: 0, hurt: 0, recover: 0, seal: 0, checkpoint: 0 };
      this.scarf = [point(-7, -11), point(-14, -11), point(-22, -9), point(-29, -6)];
      this.scarfVelocity = [point(0, 0), point(0, 0), point(0, 0), point(0, 0)];
      return this;
    }

    _input(raw) {
      raw = raw && typeof raw === "object" ? raw : {};
      return {
        vx: clamp(finite(raw.vx), -2500, 2500), vy: clamp(finite(raw.vy), -2500, 2500),
        ax: clamp(finite(raw.ax), -6000, 6000), ay: clamp(finite(raw.ay), -6000, 6000),
        steer: clamp(finite(raw.steer), -1, 1), reel: clamp(finite(raw.reel), -1, 1),
        attached: !!raw.attached, anchorDX: clamp(finite(raw.anchorDX), -4000, 4000),
        anchorDY: clamp(finite(raw.anchorDY), -4000, 4000), taut: !!raw.taut,
        boost: clamp(finite(raw.boost), 0, 1), waiting: !!raw.waiting, menu: !!raw.menu,
        grounded: !!raw.grounded, talking: !!raw.talking, lookDirection: clamp(finite(raw.lookDirection), -1, 1),
        moveSpeed: clamp(finite(raw.moveSpeed, Math.abs(finite(raw.vx))), 0, 2500)
      };
    }

    event(kind, strength = 1) {
      if (Object.prototype.hasOwnProperty.call(this.pulses, kind)) {
        this.pulses[kind] = Math.max(this.pulses[kind], clamp(finite(strength, 1), 0, 2));
      }
      return this;
    }

    update(dt, input = this.input) {
      this.input = this._input(input);
      dt = clamp(finite(dt), 0, 0.1);
      // Menu and recovery may pass a whole frame. Substeps keep the cloth stable.
      const steps = Math.max(1, Math.ceil(dt * 120));
      for (let i = 0; i < steps; i++) this._step(dt / steps);
      return this;
    }

    _step(dt) {
      if (!dt) return;
      const q = this.input;
      this.time += dt;
      const speed = Math.hypot(q.vx, q.vy);
      const active = !q.waiting && !q.menu;
      const walking = q.grounded && active ? clamp((q.moveSpeed - 5) / 95, 0, 1) : 0;
      this.walk = spring(this.walk, walking, walking > this.walk ? 14 : 11, dt);
      this.talk = spring(this.talk, q.grounded && q.talking ? 1 : 0, 12, dt);
      if (walking > 0) this.walkPhase = (this.walkPhase + q.moveSpeed * dt * TAU / 34) % TAU;
      let desiredFacing = this.facing;
      if (q.grounded && q.talking && q.lookDirection) desiredFacing = q.lookDirection;
      if (!q.attached && active && Math.abs(q.vx) > (q.grounded ? 13 : 85)) desiredFacing = q.vx < 0 ? -1 : 1;
      if (q.attached && Math.abs(q.anchorDX) > 100 && Math.abs(q.vx) < 65) {
        desiredFacing = q.anchorDX < 0 ? -1 : 1;
      }
      if (desiredFacing !== this.faceIntent) { this.faceIntent = desiredFacing; this.faceIntentTime = 0; }
      if (desiredFacing !== this.facing) {
        this.faceIntentTime += dt;
        if (this.faceIntentTime >= (q.grounded ? 0.045 : 0.065)) {
          this.facing = desiredFacing; this.faceIntentTime = 0;
        }
      } else this.faceIntentTime = 0;
      const anchorDistance = Math.hypot(q.anchorDX, q.anchorDY);
      const aiming = active && !q.attached && anchorDistance > 2 && anchorDistance < 240 ? 0.73 : 0;
      this.reach = q.grounded ? 0 : spring(this.reach, q.attached ? 1 : aiming, q.attached ? 24 : 9, dt);
      const flightDemand = active && !q.attached
        ? clamp((Math.abs(q.vx) - 240) / 430 + q.boost * 0.55
          + this.pulses.release * 0.4, 0, 1)
          * clamp(Math.abs(q.vx) / Math.max(180, Math.abs(q.vy) * 0.9), 0, 1)
        : 0;
      this.flight = q.grounded ? 0 : spring(this.flight, flightDemand, flightDemand > this.flight ? 17 : 10, dt);
      this.tuck = q.grounded ? 0 : spring(this.tuck, active && !q.attached
        ? clamp((speed - 370) / 380 + q.boost * 0.48 + this.pulses.boost * 0.5, 0, 1) : 0, 8, dt);
      this.brace = q.grounded ? 0 : spring(this.brace, active && !q.attached
        ? clamp((q.vy - 260) / 580 + this.pulses.hurt * 0.5, 0, 1) : 0, 7, dt);
      const anchorLean = q.attached && q.taut ? clamp(q.anchorDX / Math.max(150, anchorDistance) * 0.31, -0.26, 0.26) : 0;
      const motionLean = clamp(q.vy / 4000, -0.12, 0.17)
        + this.facing * clamp(q.ax / 12000, -0.07, 0.07);
      const baseLean = clamp(anchorLean + motionLean - this.facing * this.brace * 0.55
        + this.facing * q.steer * 0.035
        + this.facing * this.pulses.release * 0.09 - this.facing * this.pulses.hurt * 0.13
        - this.facing * this.pulses.attach * 0.055, -0.43, 0.43);
      const flightAngle = this.facing * clamp(
        Math.atan2(Math.abs(q.vx), Math.max(80, -q.vy)) + 0.04, 0.97, 1.36);
      const targetLean = q.grounded ? clamp(baseLean * 0.4, -0.055, 0.055)
        : mix(baseLean, flightAngle, q.attached ? 0 : this.flight);
      this.leanV += (angleDelta(this.lean, targetLean) * 190 - this.leanV * 22) * dt;
      this.leanV = clamp(this.leanV, -12, 12);
      this.lean += this.leanV * dt;
      this.lean = clamp(this.lean, q.attached ? -0.66 : -1.4, q.attached ? 0.66 : 1.4);

      const bagTarget = clamp(-q.ax * this.facing / 15000 - q.vx * this.facing / 3700
        + q.reel * 0.12 + this.pulses.release * 0.17
        + this.walk * Math.sin(this.walkPhase) * 0.08, -0.42, 0.42);
      this.bagV += ((bagTarget - this.bagAngle) * 58 - this.bagV * 12) * dt;
      this.bagV = clamp(this.bagV, -5, 5);
      this.bagAngle = clamp(this.bagAngle + this.bagV * dt, -0.5, 0.5);

      this.blink = Math.max(0, this.blink - dt);
      if (this.time >= this.nextBlink) {
        this.blink = 0.11;
        this.nextBlink = this.time + 2.4 + 0.8 * (0.5 + 0.5 * Math.sin(this.time * 1.713));
      }
      for (const key of Object.keys(this.pulses)) {
        const rate = key === "hurt" ? 2.7 : key === "boost" ? 4.8 : 5.5;
        this.pulses[key] *= Math.exp(-rate * dt);
        if (this.pulses[key] < 0.0001) this.pulses[key] = 0;
      }

      const wind = clamp(q.vx * this.facing / 1100 + q.ax * this.facing / 9000, -1.2, 1.2);
      const rise = clamp(q.vy / 1200, -0.7, 0.8);
      const neck = this.scarf[0];
      neck.x = -7; neck.y = -11 + this._breath() * 0.25;
      for (let i = 1; i < this.scarf.length; i++) {
        const previous = this.scarf[i - 1];
        const node = this.scarf[i], velocity = this.scarfVelocity[i];
        const targetX = previous.x - 7.2 - wind * 2.5;
        const targetY = previous.y + 1.7 + rise * 2.1 + Math.sin(this.time * 9 - i * 0.7) * (0.22 + speed / 4500)
          + this.walk * Math.sin(this.walkPhase - i * 0.5) * 0.25;
        velocity.x = clamp((velocity.x + (targetX - node.x) * 125 * dt) * Math.exp(-16 * dt), -90, 90);
        velocity.y = clamp((velocity.y + (targetY - node.y) * 125 * dt) * Math.exp(-16 * dt), -90, 90);
        node.x += velocity.x * dt; node.y += velocity.y * dt;
        const dx = node.x - previous.x, dy = node.y - previous.y;
        const length = Math.hypot(dx, dy) || 1;
        const limited = clamp(length, 3, 10.5);
        node.x = previous.x + dx / length * limited;
        node.y = previous.y + dy / length * limited;
        node.x = clamp(node.x, -42, 12);
        node.y = clamp(node.y, -35, 20);
      }
    }

    _breath() { return Math.sin(this.time * 2.35) * (this.input.waiting || this.input.menu ? 1 : 0.35); }

    _world(local) {
      const c = Math.cos(this.lean), s = Math.sin(this.lean);
      return point(c * this.facing * local.x - s * local.y, s * this.facing * local.x + c * local.y);
    }
    _local(world) {
      const c = Math.cos(this.lean), s = Math.sin(this.lean);
      return point(this.facing * (c * world.x + s * world.y), -s * world.x + c * world.y);
    }

    _pose() {
      const q = this.input;
      const breath = this._breath();
      const step = Math.cos(this.walkPhase);
      const armSwing = this.walk * (1 - this.talk) * step * 3.4;
      const gesture = this.talk * Math.pow(Math.max(0, Math.sin(this.time * 2.7)), 8);
      const headX = this.talk * Math.sin(this.time * 1.55) * 0.65;
      const bob = (q.menu || q.waiting ? 0.65 : 0.25) * Math.sin(this.time * 2.35)
        + this.pulses.attach * 1.1 - this.pulses.hurt * 1.4
        - this.pulses.seal * 0.75 - this.pulses.checkpoint * 0.9
        + this.pulses.recover * 0.5 - this.walk * Math.abs(Math.sin(this.walkPhase)) * 0.6;
      const stride = Math.sin(this.time * clamp(Math.abs(q.vx) / 45, 4, 12));
      const shoulder = point(5.2, -6.8 + bob);
      const farShoulder = point(-4.6, -7 + bob);
      const reelPull = q.attached ? clamp(-q.reel, 0, 1) : 0;
      const gripIdle = point(13.2 + this.tuck * 2.3 + this.brace * 6 + this.pulses.release * 4
        - this.walk * 4.3 - armSwing + gesture * 1.5,
        3.8 - this.tuck * 9 - this.brace * 11 - this.pulses.release * 7
        + this.walk * 1.1 - gesture * 3.5);
      const toAnchor = this._local(point(q.anchorDX, q.anchorDY));
      const anchorLength = Math.hypot(toAnchor.x - shoulder.x, toAnchor.y - shoulder.y);
      const handAim = anchorLength > 0.01
        ? point(shoulder.x + (toAnchor.x - shoulder.x) * Math.min((21.8 - reelPull * 5.8) / anchorLength, 1),
          shoulder.y + (toAnchor.y - shoulder.y) * Math.min((21.8 - reelPull * 5.8) / anchorLength, 1))
        : point(shoulder.x + 7, shoulder.y - 7);
      const grip = point(mix(gripIdle.x, handAim.x, this.reach), mix(gripIdle.y, handAim.y, this.reach));
      // Attached state fixes the hand to the reachable aim even on the first update.
      if (q.attached) { grip.x = handAim.x; grip.y = handAim.y; }
      const elbow = solveArm(shoulder, grip);
      const farHand = point(-10 - this.tuck * 2 - this.brace * 8 + this.pulses.seal * 3
        + armSwing,
        5 - this.tuck * 7 - this.brace * 14
          - this.pulses.seal * 5 - this.pulses.checkpoint * 4);
      if (reelPull) {
        const ux = anchorLength > 0.01 ? (toAnchor.x - shoulder.x) / anchorLength : 0;
        const uy = anchorLength > 0.01 ? (toAnchor.y - shoulder.y) / anchorLength : -1;
        const pump = 0.93 + 0.07 * Math.sin(this.time * 16);
        const pullHand = point(grip.x + ux * 2.5, grip.y + uy * 2.5);
        farHand.x = mix(farHand.x, pullHand.x, reelPull * pump);
        farHand.y = mix(farHand.y, pullHand.y, reelPull * pump);
      }
      if (!q.grounded && this.flight > 0.05) {
        farHand.x += this.flight * Math.sin(this.time * 10.5) * 0.45;
      }
      const farElbow = solveArm(farShoulder, farHand, -1);
      const tangent = q.attached && anchorLength > 1
        ? (q.vx * -q.anchorDY + q.vy * q.anchorDX) / Math.max(1, Math.hypot(q.anchorDX, q.anchorDY))
        : 0;
      const swingTrail = q.attached ? -clamp(tangent * this.facing / 62, -8, 8) : 0;
      const swingSplit = q.attached ? clamp(Math.abs(tangent) / 330, 0, 1) * 4.5 : 0;
      const kick = clamp(q.vx * this.facing / 900, -0.7, 1) * 2.2;
      const hips = [point(-3.7, 10.4 + bob), point(4, 10.2 + bob)];
      const farKnee = point(-7.8 - this.tuck * 5 - this.brace * 7 - kick
        + swingTrail * 0.45 - swingSplit * 0.45, 17.7 - this.tuck * 1.5);
      const farFoot = point(-6.4 - this.tuck * 12 - this.brace * 10 + stride * 0.65
        + swingTrail * 1.1 - swingSplit, 25 - this.tuck * 5.2 - swingSplit * 0.35);
      const nearKnee = point(6.3 - this.tuck * 4 + this.brace * 7 + kick
        + swingTrail * 0.3 + swingSplit * 0.45, 17.7 - this.tuck * 2);
      const nearFoot = point(8.2 - this.tuck * 9 + this.brace * 12 - stride * 0.65
        + swingTrail * 0.55 + swingSplit, 26 - this.tuck * 6 + swingSplit * 0.45);
      if (this.walk > 0.001) {
        const nearStep = this.walkPhase;
        const farStep = nearStep + PI;
        const nearWalkFoot = point(2.4 + 6.3 * Math.cos(nearStep),
          25.5 - 4.5 * Math.max(0, -Math.sin(nearStep)));
        const farWalkFoot = point(-2.4 + 6.3 * Math.cos(farStep),
          25.5 - 4.5 * Math.max(0, -Math.sin(farStep)));
        const nearWalkKnee = solveLeg(hips[1], nearWalkFoot, 1);
        const farWalkKnee = solveLeg(hips[0], farWalkFoot, 1);
        nearKnee.x = mix(nearKnee.x, nearWalkKnee.x, this.walk);
        nearKnee.y = mix(nearKnee.y, nearWalkKnee.y, this.walk);
        farKnee.x = mix(farKnee.x, farWalkKnee.x, this.walk);
        farKnee.y = mix(farKnee.y, farWalkKnee.y, this.walk);
        nearFoot.x = mix(nearFoot.x, nearWalkFoot.x, this.walk);
        nearFoot.y = mix(nearFoot.y, nearWalkFoot.y, this.walk);
        farFoot.x = mix(farFoot.x, farWalkFoot.x, this.walk);
        farFoot.y = mix(farFoot.y, farWalkFoot.y, this.walk);
      }
      if (!q.grounded && this.flight > 0.05) {
        const airDrift = this.flight * Math.sin(this.time * 10.5);
        farFoot.y += airDrift * 0.65;
        nearFoot.y -= airDrift * 0.5;
      }
      return { breath, bob, headX, gesture, shoulder, farShoulder, grip, elbow, farHand, farElbow,
        hips, farKnee, farFoot, nearKnee, nearFoot };
    }

    attachment(x, y) {
      const hand = this._world(this._pose().grip);
      return { x: finite(x) + hand.x, y: finite(y) + hand.y };
    }

    snapshot() {
      const pose = this._pose();
      const grip = this._world(pose.grip);
      const farHand = this._world(pose.farHand);
      const farFoot = this._world(pose.farFoot);
      const nearFoot = this._world(pose.nearFoot);
      return { facing: this.facing, lean: this.lean, flight: this.flight,
        reach: this.reach, tuck: this.tuck, walk: this.walk, walkPhase: this.walkPhase,
        talk: this.talk, headX: pose.headX, gesture: pose.gesture,
        brace: this.brace, bagAngle: this.bagAngle, blink: this.blink,
        gripX: grip.x, gripY: grip.y, farHandX: farHand.x, farHandY: farHand.y,
        farFootX: farFoot.x, farFootY: farFoot.y,
        nearFootX: nearFoot.x, nearFootY: nearFoot.y,
        bodyBob: pose.bob,
        scarfX: this.scarf[3].x, scarfY: this.scarf[3].y,
        eventAttach: this.pulses.attach, eventRelease: this.pulses.release,
        eventBoost: this.pulses.boost, eventHurt: this.pulses.hurt,
        eventRecover: this.pulses.recover, eventSeal: this.pulses.seal,
        eventCheckpoint: this.pulses.checkpoint };
    }

    draw(ctx, x, y, scale = 1) {
      if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return;
      scale = clamp(finite(scale, 1), 0.01, 8);
      const p = this._pose();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.lean);
      ctx.scale(this.facing * scale, scale);
      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      // Four cloth points make a soft trailing ribbon. Its fork keeps the end legible.
      const scarf = this.scarf;
      filled(ctx, [point(-5.5, -14), point(scarf[1].x, scarf[1].y - 2.1),
        point(scarf[2].x, scarf[2].y - 2), point(scarf[3].x, scarf[3].y - 1.5),
        point(scarf[3].x + 1.8, scarf[3].y + 2), point(scarf[2].x, scarf[2].y + 2.5),
        point(scarf[1].x, scarf[1].y + 2.6), point(-5.5, -9)], C.scarf);
      stroke(ctx, [point(scarf[2].x - 0.4, scarf[2].y - 0.4),
        point(scarf[3].x + 0.5, scarf[3].y - 0.3)], C.scarfLight, 1);

      this._drawLeg(ctx, p.hips[0], p.farKnee, p.farFoot, false);
      this._drawArm(ctx, p.farShoulder, p.farElbow, p.farHand, false);
      this._drawSatchel(ctx, p);
      this._drawLeg(ctx, p.hips[1], p.nearKnee, p.nearFoot, true);

      // Coat silhouette: a short split hem, bright front panel and narrow lapels.
      const hem = this.walk * Math.sin(this.walkPhase) * 0.9;
      filled(ctx, [point(-7.3, -9 + p.bob), point(2.5, -11.1 + p.bob),
        point(8.8, -7.5 + p.bob), point(9, 2), point(8.2 + hem, 12.5),
        point(2.5 + hem * 0.4, 13.4), point(0.4, 9.5), point(-2.6 - hem, 13.1),
        point(-9 - hem, 12.1), point(-8, 2)], C.coat);
      filled(ctx, [point(-7.2, -7.8), point(-2.1, -8.5), point(-2.5, 10),
        point(-8.1, 11)], C.coatShade, null);
      filled(ctx, [point(1.8, -9.5), point(7, -7), point(6.7, 10.5),
        point(2.6, 11.6)], C.coatLight, null);
      stroke(ctx, [point(1.2, -7.8), point(0.8, 10.3)], C.seam, 0.9);
      for (const yy of [-2.3, 4, 9]) ellipse(ctx, 2.6, yy, 0.75, 0.75, C.leatherDark, null);
      filled(ctx, [point(-0.7, -10.2), point(3.8, -9.5), point(1, -3.4),
        point(-2.7, -6)], C.coatShade);
      filled(ctx, [point(3.7, -9.5), point(7.4, -7.3), point(4.2, -3.2),
        point(1, -3.4)], C.coatLight);
      stroke(ctx, [point(-8, -0.5), point(-4.8, 1)], C.coatLight, 1.1);

      // Satchel strap crosses the coat and terminates under the bag flap.
      stroke(ctx, [point(3.5, -8.3), point(-5.8, 6.2)], C.leatherDark, 2.5);
      stroke(ctx, [point(3.5, -8.3), point(-5.8, 6.2)], C.leatherLight, 1.05);

      ellipse(ctx, 1.4 + p.headX, -20.2 + p.bob, 7.2, 7.5, C.skin);
      ellipse(ctx, -4.7 + p.headX, -19.9 + p.bob, 1.6, 2.1, C.skinShade, null);
      filled(ctx, [point(6.2 + p.headX, -21.4 + p.bob), point(10.2 + p.headX, -19.4 + p.bob),
        point(6.8 + p.headX, -17.8 + p.bob)], C.skin);
      if (this.blink > 0) stroke(ctx, [point(4.3 + p.headX, -21.5 + p.bob), point(6.2 + p.headX, -21.7 + p.bob)], C.ink, 0.9);
      else ellipse(ctx, 5.5 + p.headX, -21.4 + p.bob, 0.75, 1.15, C.ink, null);
      const mouth = this.talk * Math.max(0, Math.sin(this.time * 10));
      if (mouth > 0.12) ellipse(ctx, 3.4 + p.headX, -16.6 + p.bob, 0.85, 0.35 + mouth * 0.85, C.skinShade, null);
      else stroke(ctx, [point(2 + p.headX, -16.8 + p.bob), point(4.5 + p.headX, -16.4 + p.bob)], C.skinShade, 0.7);

      // Cap has a dark underbrim so the face remains readable on a bright sky.
      filled(ctx, [point(-6.7 + p.headX, -23.5 + p.bob), point(-6 + p.headX, -28.8 + p.bob),
        point(-2.5 + p.headX, -31.2 + p.bob), point(4.6 + p.headX, -29.7 + p.bob),
        point(7.4 + p.headX, -25.2 + p.bob), point(5.8 + p.headX, -23.5 + p.bob)], C.cap);
      stroke(ctx, [point(-4.8 + p.headX, -28.5 + p.bob), point(3.2 + p.headX, -28.4 + p.bob)], C.capLight, 1.2);
      filled(ctx, [point(2.6 + p.headX, -24 + p.bob), point(11.5 + p.headX, -23.7 + p.bob),
        point(10.5 + p.headX, -22.3 + p.bob), point(3.4 + p.headX, -22.2 + p.bob)], C.capLight);
      stroke(ctx, [point(3.1 + p.headX, -22.2 + p.bob), point(10.4 + p.headX, -22.2 + p.bob)], C.leatherDark, 0.9);

      this._drawArm(ctx, p.shoulder, p.elbow, p.grip, true);
      filled(ctx, [point(-5.9, -12), point(1.1, -11.5), point(3, -8),
        point(-4.8, -7.6), point(-7, -10)], C.scarf);
      stroke(ctx, [point(-4.5, -11.4), point(0.6, -10.8)], C.scarfLight, 1.1);
      ctx.restore();
    }

    _drawLeg(ctx, hip, knee, foot, near) {
      limb(ctx, hip, knee, near ? 6.1 : 5.8, C.trouser, near ? C.trouserLight : null);
      ellipse(ctx, knee.x, knee.y, 2.8, 2.9, C.trouser, null);
      limb(ctx, knee, point(foot.x - 0.4, foot.y - 1.8), near ? 5.5 : 5.2, C.trouser,
        near ? C.trouserLight : null);
      filled(ctx, [point(foot.x - 3.4, foot.y - 3.7), point(foot.x + 2.3, foot.y - 3.6),
        point(foot.x + 5.1, foot.y + 0.6), point(foot.x + 4, foot.y + 2.2),
        point(foot.x - 4.2, foot.y + 2.2), point(foot.x - 4.5, foot.y)], C.boot);
      stroke(ctx, [point(foot.x - 3.1, foot.y + 1.1), point(foot.x + 4.2, foot.y + 1.1)], C.bootLight, 1.25);
    }

    _drawArm(ctx, shoulder, elbow, hand, near) {
      limb(ctx, shoulder, elbow, near ? 5.8 : 5.1, near ? C.coat : C.coatShade,
        near ? C.coatLight : null);
      ellipse(ctx, elbow.x, elbow.y, near ? 2.7 : 2.5, near ? 2.7 : 2.5,
        near ? C.coat : C.coatShade, null);
      const cuff = point(mix(elbow.x, hand.x, 0.75), mix(elbow.y, hand.y, 0.75));
      limb(ctx, elbow, cuff, near ? 4.9 : 4.5, near ? C.coat : C.coatShade,
        near ? C.coatLight : null);
      ellipse(ctx, cuff.x, cuff.y, 2.6, 2.4, C.coatLight);
      limb(ctx, cuff, hand, 3.8, C.glove);
      ellipse(ctx, hand.x, hand.y, near ? 2.7 : 2.4, near ? 2.8 : 2.5, C.glove);
      if (near && this.input.attached) {
        // Thumb wraps the rope at precisely the point returned by attachment().
        stroke(ctx, [point(hand.x - 1.1, hand.y + 0.8), point(hand.x + 1.3, hand.y - 0.9)], C.leatherLight, 1);
      }
    }

    _drawSatchel(ctx, pose) {
      ctx.save();
      ctx.translate(-9.3, 3.3 + pose.bob);
      ctx.rotate(this.bagAngle);
      filled(ctx, [point(-6.7, -6.7), point(4.9, -6.7), point(6.5, -4),
        point(5.6, 7.9), point(-5.8, 8.1), point(-7.3, 5.7)], C.leather);
      filled(ctx, [point(-6.8, -6.6), point(4.7, -6.6), point(5.4, -0.1),
        point(-0.5, 2), point(-6.6, 0)], C.leatherLight);
      stroke(ctx, [point(-5.9, 6.5), point(4.5, 6.5)], C.leatherDark, 0.9);
      // Small addressed envelope peeks from the flap.
      filled(ctx, [point(-2.4, 0.5), point(3, 0.5), point(3, 4.3), point(-2.4, 4.3)],
        C.envelope, C.leatherDark, 0.65);
      stroke(ctx, [point(-2.1, 1.1), point(0.3, 2.9), point(2.7, 1.1)], C.leatherLight, 0.65);
      ellipse(ctx, -0.6, -0.7, 0.85, 0.85, C.envelope, null);
      ctx.restore();
    }
  }

  globalThis.CourierRig = CourierRig;
})();
