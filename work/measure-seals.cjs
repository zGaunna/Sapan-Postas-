const { runRoute } = require("./playtest-route.cjs");
const { game } = require("./check-game.cjs");
if (process.argv.includes("--candidate")) {
  game.seals[0].y = 430;
  game.seals[2].y = 480;
}

function measure(ringPolicy = {}, frameRate = 120) {
  const closest = game.seals.map(() => ({ distance: Infinity }));
  const run = runRoute({ reelTo: 150, releaseOffset: -30, ringPolicy, frameRate, observe(g) {
    g.seals.forEach((seal, i) => {
      const distance = Math.hypot(g.player.x - seal.x, g.player.y - seal.y);
      if (distance < closest[i].distance) closest[i] = { distance: +distance.toFixed(2),
        x: +g.player.x.toFixed(1), y: +g.player.y.toFixed(1),
        ring: g.tetherAnchor()?.id ?? null, rope: +g.ropeLength().toFixed(1) };
    });
  }});
  return { state: run.state, seals: run.seals, seconds: run.seconds, hits: run.hits, closest };
}

console.log("Seal baseline:", JSON.stringify(measure()));
const choices = [];
for (const [seal, ring] of [[0, 2], [1, 13], [2, 21]]) {
  const probes = [];
  for (const reelTo of [118, 150, 190, 230, 270, 310, 350, 400, 460]) {
    for (const releaseOffset of [-120, -90, -60, -30, 0, 30, 60, 90, 120]) {
      const policy = { reelTo, releaseOffset };
      const result = measure({ [ring]: policy });
      probes.push({ ring, policy, state: result.state, seals: result.seals, hits: result.hits,
        closest: result.closest[seal] });
    }
  }
  probes.sort((a, b) => (b.state === "won") - (a.state === "won") || a.closest.distance - b.closest.distance || a.hits - b.hits);
  console.log(`Seal ${seal + 1} local policies:`, JSON.stringify(probes.slice(0, 5)));
  choices.push(probes[0]);
}
const combined = Object.fromEntries(choices.map(choice => [choice.ring, choice.policy]));
console.log("Combined seal policy:", JSON.stringify({ combined, result: measure(combined) }));
console.log("Variable physics-step sensitivity (not render Hz):", JSON.stringify([30, 60, 120, 180].map(frameRate => ({ frameRate, ...measure(combined, frameRate) }))));
