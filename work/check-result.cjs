const assert = require("node:assert/strict");
const { game, context, element } = require("./check-game.cjs");

assert.equal(typeof game.computeResult, "function", "Result calculation must be exposed by the test harness");

const plain = value => JSON.parse(JSON.stringify(value));
function freezeDeep(value) {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freezeDeep(child);
    Object.freeze(value);
  }
  return value;
}

function runState(overrides = {}) {
  return {
    won: true, reason: null, practiceIndex: -1, score: 400, remaining: 31.5,
    sealCount: 3, runTime: 42.375, runStats: { hits: 2, cleanThrows: 4 },
    splitTimes: [{ name: "İlk mühür", at: 12.25 }],
    seals: [1, 2, 3].map(id => ({ id, collected: true, missedNotified: false })),
    targetPractice: null, best: 500, testRun: false,
    ...overrides,
  };
}

const normalWins = [
  { delivered: false, score: 963, records: { score: 963, time: 42.375, deliveryTime: null },
    message: { kicker: "FENERE VARDIN", title: "Fener sönmeden yetiştin.",
      copy: "0/3 mühür topladın. Tam teslimat için yeni vardiyada eksik mühürlerin rotasını dene." } },
  { delivered: false, score: 963, records: { score: 963, time: 42.375, deliveryTime: null },
    message: { kicker: "FENERE VARDIN", title: "Fener sönmeden yetiştin.",
      copy: "1/3 mühür topladın. Tam teslimat için yeni vardiyada eksik mühürlerin rotasını dene." } },
  { delivered: false, score: 963, records: { score: 963, time: 42.375, deliveryTime: null },
    message: { kicker: "FENERE VARDIN", title: "Fener sönmeden yetiştin.",
      copy: "2/3 mühür topladın. Tam teslimat için yeni vardiyada eksik mühürlerin rotasını dene." } },
  { delivered: true, score: 1263, records: { score: 1263, time: 42.375, deliveryTime: 42.375 },
    message: { kicker: "TESLİMAT TAMAM", title: "Fener sönmeden yetiştin.",
      copy: "Üç mührü de teslim ettin. Bu gecelik işin bitti." } },
];
const practiceWinMessage = { kicker: "ANTRENMAN TAMAM", title: "Parkuru geçtin.",
  copy: "Hazırsan vardiyada süreye karşı deneyebilirsin." };
const lossMessages = {
  lives: { kicker: "VARDİYA BİTTİ", title: "Bu gece olmadı.",
    copy: "Canların bitti. Zorlandığın kısmı antrenmanda yeniden deneyebilirsin." },
  timeout: { kicker: "VARDİYA BİTTİ", title: "Bu gece olmadı.",
    copy: "Vardiya süresi doldu. İskelelere daha kısa yoldan ulaşmayı deneyebilirsin." },
};
const targetWinMessage = { kicker: "MÜHÜR ANTRENMANI TAMAM", title: "2. mührü aldın.",
  copy: "Aynı atışı tekrar çalışabilir veya normal vardiyada deneyebilirsin." };
const targetLossMessage = { kicker: "MÜHÜR ANTRENMANI", title: "Mühür geride kaldı.",
  copy: "R veya Yeniden oyna ile aynı atışı tekrar dene. Normal vardiya kayıtların etkilenmez." };
const noRecords = { score: null, time: null, deliveryTime: null };

function check(input, outcome, label) {
  freezeDeep(input);
  const before = plain(input);
  const result = game.computeResult(input);
  const { addFinishSplit, ...fields } = outcome;
  const expected = {
    ...fields, runTime: input.runTime, sealCount: input.sealCount,
    hits: input.runStats.hits, cleanThrows: input.runStats.cleanThrows,
    splits: addFinishSplit
      ? [{ name: "İlk mühür", at: 12.25 }, { name: "Fener iskelesi", at: 42.375 }]
      : [{ name: "İlk mühür", at: 12.25 }],
    seals: input.seals, targetPractice: input.targetPractice,
  };
  assert.deepEqual(plain(result), expected, label);
  assert.deepEqual(plain(input), before, `${label}: input must remain unchanged`);
  assert.notStrictEqual(result.splits, input.splitTimes, `${label}: split array must be copied`);
  assert.notStrictEqual(result.splits[0], input.splitTimes[0], `${label}: split objects must be copied`);
  assert.notStrictEqual(result.seals, input.seals, `${label}: seal array must be copied`);
  for (let i = 0; i < input.seals.length; i += 1) {
    assert.notStrictEqual(result.seals[i], input.seals[i], `${label}: seal objects must be copied`);
  }
  if (input.targetPractice) {
    assert.notStrictEqual(result.targetPractice, input.targetPractice, `${label}: target must be copied`);
  }
  assert.deepEqual(plain(game.computeResult(input)), expected, `${label}: repeated result must be deterministic`);
  return result;
}

const storageKeys = ["sapan-postasi-best", "sapan-postasi-best-time", "sapan-postasi-best-time-full",
  "sapan-postasi-voyages-v1"];
const liveBefore = plain({
  state: game.state(), practiceIndex: game.practiceIndex(), sealCount: game.sealCount(),
  remaining: game.remaining(), runTime: game.runTime(), stats: game.stats(),
  splits: game.splitTimes(), seals: game.seals, player: game.player,
  storage: storageKeys.map(key => context.localStorage.getItem(key)),
  resultText: ["#result-kicker", "#result-title", "#result-copy", "#final-score"]
    .map(selector => element(selector).textContent),
});

let cases = 0;
for (const practiceIndex of [-1, 0, 1, 2]) {
  for (const won of [true, false]) {
    for (const sealCount of [0, 1, 2, 3]) {
      const seals = [1, 2, 3].map((id, index) =>
        ({ id, collected: index < sealCount, missedNotified: index >= sealCount }));
      for (const reason of won ? [null] : [null, "timeout"]) {
        const input = runState({ practiceIndex, won, reason, sealCount, seals });
        let outcome;
        if (practiceIndex === -1 && won) {
          outcome = { won: true, reason: null, state: "won", practice: false,
            historyMode: "normal", newBest: true, addFinishSplit: true, ...normalWins[sealCount] };
        } else if (practiceIndex === -1) {
          outcome = { won: false, reason, state: "lost", delivered: false, score: 400,
            practice: false, historyMode: "normal", newBest: false, addFinishSplit: false,
            records: { score: 400, time: null, deliveryTime: null },
            message: reason === "timeout" ? lossMessages.timeout : lossMessages.lives };
        } else if (won) {
          outcome = { won: true, reason: null, state: "won", delivered: false, score: 400,
            practice: true, historyMode: "practice", newBest: false, addFinishSplit: true,
            records: noRecords, message: practiceWinMessage };
        } else {
          outcome = { won: false, reason, state: "lost", delivered: false, score: 400,
            practice: true, historyMode: "practice", newBest: false, addFinishSplit: false,
            records: noRecords, message: reason === "timeout" ? lossMessages.timeout : lossMessages.lives };
        }
        check(input, outcome, `practice=${practiceIndex}, won=${won}, seals=${sealCount}, reason=${reason}`);
        cases += 1;
      }
    }
  }
}

for (const fixture of [
  { best: 500, inputScore: 100, won: false, state: "lost", finalScore: 100, newBest: false,
    records: { score: 100, time: null, deliveryTime: null } },
  { best: 500, inputScore: 500, won: false, state: "lost", finalScore: 500, newBest: false,
    records: { score: 500, time: null, deliveryTime: null } },
  { best: 500, inputScore: 501, won: false, state: "lost", finalScore: 501, newBest: true,
    records: { score: 501, time: null, deliveryTime: null } },
  { best: 0, inputScore: 0, won: false, state: "lost", finalScore: 0, newBest: false,
    records: { score: 0, time: null, deliveryTime: null } },
  { best: 1263, inputScore: 700, won: true, state: "won", finalScore: 1263, newBest: false,
    records: { score: 1263, time: 42.375, deliveryTime: null } },
  { best: 1263, inputScore: 701, won: true, state: "won", finalScore: 1264, newBest: true,
    records: { score: 1264, time: 42.375, deliveryTime: null } },
]) {
  const input = runState({ best: fixture.best, score: fixture.inputScore,
    won: fixture.won, sealCount: 0 });
  check(input, { won: fixture.won, reason: null, state: fixture.state,
    delivered: false, score: fixture.finalScore, practice: false, historyMode: "normal",
    records: fixture.records, newBest: fixture.newBest, addFinishSplit: fixture.won,
    message: fixture.won ? normalWins[0].message : lossMessages.lives },
  `best=${fixture.best}, score=${fixture.inputScore}, won=${fixture.won}`);
  cases += 1;
}

for (const fixture of [
  { collected: true, requestedWon: true, requestedReason: "target", testRun: false,
    won: true, reason: "target", state: "won", historyMode: "practice", message: targetWinMessage },
  { collected: false, requestedWon: true, requestedReason: "target", testRun: false,
    won: false, reason: "target-missed", state: "lost", historyMode: "practice", message: targetLossMessage },
  { collected: false, requestedWon: false, requestedReason: "target-missed", testRun: false,
    won: false, reason: "target-missed", state: "lost", historyMode: "practice", message: targetLossMessage },
  { collected: true, requestedWon: true, requestedReason: "target", testRun: true,
    won: true, reason: "target", state: "won", historyMode: "test", message: targetWinMessage },
]) {
  const input = runState({ practiceIndex: 0, sealCount: fixture.collected ? 1 : 0,
    seals: [1, 2, 3].map(id => ({ id, collected: id === 2 && fixture.collected, missedNotified: false })),
    targetPractice: { id: 2, x: 10, y: 20 }, won: fixture.requestedWon,
    reason: fixture.requestedReason, testRun: fixture.testRun });
  check(input, { won: fixture.won, reason: fixture.reason, state: fixture.state,
    delivered: false, score: 400, practice: true, historyMode: fixture.historyMode,
    records: noRecords, newBest: false, addFinishSplit: false, message: fixture.message },
  `target collected=${fixture.collected}, won=${fixture.requestedWon}, test=${fixture.testRun}`);
  cases += 1;
}

for (const fixture of [
  { practiceIndex: -1, delivered: true, score: 1263, newBest: true,
    records: { score: 1263, time: 42.375, deliveryTime: 42.375 },
    message: normalWins[3].message, practice: false },
  { practiceIndex: 0, delivered: false, score: 400, newBest: false, records: noRecords,
    message: practiceWinMessage, practice: true },
  { practiceIndex: 1, delivered: false, score: 400, newBest: false, records: noRecords,
    message: practiceWinMessage, practice: true },
  { practiceIndex: 2, delivered: false, score: 400, newBest: false, records: noRecords,
    message: practiceWinMessage, practice: true },
]) {
  const input = runState({ practiceIndex: fixture.practiceIndex, testRun: true });
  check(input, { won: true, reason: null, state: "won", delivered: fixture.delivered,
    score: fixture.score, practice: fixture.practice, historyMode: "test",
    records: fixture.records, newBest: fixture.newBest, addFinishSplit: true,
    message: fixture.message }, `test history, practice=${fixture.practiceIndex}`);
  cases += 1;
}

const mutableResult = game.computeResult(freezeDeep(runState()));
const pristineResult = plain(mutableResult);
mutableResult.splits[0].name = "changed";
mutableResult.seals[0].collected = false;
assert.deepEqual(plain(game.computeResult(freezeDeep(runState()))), pristineResult,
  "Changing a result must not affect later calculations");

assert.deepEqual(plain({
  state: game.state(), practiceIndex: game.practiceIndex(), sealCount: game.sealCount(),
  remaining: game.remaining(), runTime: game.runTime(), stats: game.stats(),
  splits: game.splitTimes(), seals: game.seals, player: game.player,
  storage: storageKeys.map(key => context.localStorage.getItem(key)),
  resultText: ["#result-kicker", "#result-title", "#result-copy", "#final-score"]
    .map(selector => element(selector).textContent),
}), liveBefore, "computeResult must not change live game, DOM, or storage state");

console.log(`Result checks passed: ${cases} cases, frozen inputs, copied output, deterministic calls, no live side effects.`);
