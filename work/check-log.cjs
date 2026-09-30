const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "voyage-log.js"), "utf8");
const KEY = "sapan-postasi-voyages-v1";
const copy = value => JSON.parse(JSON.stringify(value));
const sample = () => ({ mode: "normal", won: true, seals: 3, score: 2400,
  time: 92.5, hits: 1, cleanThrows: 21, splits: [31, 64, 92.5], reason: null });

function storage(initial = null) {
  const values = new Map(initial === null ? [] : [[KEY, initial]]);
  let writes = 0;
  return {
    values, get writes() { return writes; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { writes += 1; values.set(key, value); }
  };
}

function load(store) {
  const context = {};
  if (store !== undefined) Object.defineProperty(context, "localStorage", { get: () => store });
  vm.runInNewContext(source, context, { filename: "voyage-log.js" });
  return context.VoyageLog;
}

const store = storage();
const log = load(store);
assert.deepEqual(copy(log.list()), []);
assert.deepEqual(Object.keys(log).sort(), ["list", "record"]);
const before = Date.now();
const input = sample();
const row = log.record(input);
assert.ok(Date.parse(row.at) >= before && Date.parse(row.at) <= Date.now());
assert.equal(new Date(row.at).toISOString(), row.at);
assert.deepEqual(Object.keys(row).sort(),
  ["at", "won", "seals", "score", "time", "hits", "cleanThrows", "splits", "reason"].sort());
assert.equal(store.writes, 1);
assert.equal(JSON.parse(store.values.get(KEY)).version, 1);
input.score = 0; input.splits[0] = 0;
row.score = 1; row.splits.push(99);
const read = log.list();
read[0].score = 2; read[0].splits[0] = 1; read.push({});
assert.equal(log.list().length, 1);
assert.equal(log.list()[0].score, 2400);
assert.deepEqual(copy(log.list()[0].splits), [31, 64, 92.5]);
assert.deepEqual(copy(load(store).list()), copy(log.list()));

// Bad types must be rejected, never coerced, clamped, or written.
const bad = [null, undefined, [], "run", 1, true, {},
  { ...sample(), mode: "practice" }, { ...sample(), mode: "test" },
  { ...sample(), at: "2000-01-01T00:00:00.000Z" },
  { ...sample(), version: 2 }];
for (const [field, values] of Object.entries({
  mode: [null, "NORMAL", "bot", 0], won: [0, 1, "true", null],
  seals: [-1, 4, 1.5, "3", NaN, Infinity],
  score: [-1, 1000001, 2.5, "2400", NaN, Infinity],
  time: [-1, 120.01, "92.5", null, NaN, Infinity],
  hits: [-1, 6, 1.5, "1", NaN, Infinity],
  cleanThrows: [-1, 1001, 1.5, "21", NaN, Infinity],
  splits: [null, {}, [NaN], [Infinity], [-1], [93], [64, 31], [1, 2, 3, 4], ["31"], new Array(1)],
  reason: [0, {}, "", "x".repeat(65)]
})) for (const value of values) bad.push({ ...sample(), [field]: value });
for (const field of Object.keys(sample())) {
  const missing = sample(); delete missing[field]; bad.push(missing);
}
bad.push(Object.create(sample()));
bad.push(JSON.parse(JSON.stringify(sample()).replace('"mode":', '"__proto__":{"polluted":true},"mode":')));
bad.push({ ...sample(), constructor: { prototype: { polluted: true } } });
let getterCalls = 0;
const getterInput = sample();
Object.defineProperty(getterInput, "score", { get() { getterCalls += 1; throw Error("getter"); } });
bad.push(getterInput);
bad.push(new Proxy({}, { ownKeys() { throw Error("proxy"); } }));
const getterSplits = sample();
Object.defineProperty(getterSplits.splits, "0", { get() { getterCalls += 1; throw Error("split getter"); } });
bad.push(getterSplits);
const old = copy(log.list());
const writes = store.writes;
for (const value of bad) assert.equal(log.record(value), null);
assert.equal(getterCalls, 0);
assert.equal(store.writes, writes);
assert.deepEqual(copy(log.list()), old);
assert.equal({}.polluted, undefined);

// Losses, partial deliveries, zero values, and final-step overshoot are valid.
const edges = load(storage());
assert.ok(edges.record({ ...sample(), won: false, seals: 0, score: 0,
  time: 0, hits: 0, cleanThrows: 0, splits: [], reason: "water" }));
assert.ok(edges.record({ ...sample(), seals: 2, time: 115 + 1 / 120, hits: 5, reason: null }));
assert.ok(edges.record({ ...sample(), score: 1000000, time: 120, cleanThrows: 1000,
  splits: [0, 0, 120], reason: "x".repeat(64) }));

// Insertion order survives reload, with exactly one row per accepted call.
const boundedStore = storage();
const bounded = load(boundedStore);
for (let i = 0; i < 25; i += 1) bounded.record({ ...sample(), score: i });
assert.equal(boundedStore.writes, 25);
assert.deepEqual(copy(bounded.list().map(value => value.score)),
  Array.from({ length: 20 }, (_, i) => 24 - i));
assert.equal(JSON.parse(boundedStore.values.get(KEY)).runs.length, 20);
assert.deepEqual(copy(load(boundedStore).list()), copy(bounded.list()));
const same = load(storage());
same.record(sample()); same.record(sample());
assert.equal(same.list().length, 2, "identical results may be separate real runs");

const storedRow = copy(log.list()[0]);
const envelope = runs => JSON.stringify({ version: 1, runs });
for (const raw of ["{broken", "null", "[]", "{}", "true", "0", '"string"',
  JSON.stringify({ version: 2, runs: [storedRow] }),
  JSON.stringify({ version: "1", runs: [storedRow] }),
  JSON.stringify({ runs: [storedRow] }),
  JSON.stringify({ version: 1, runs: {} }),
  JSON.stringify({ version: 1, runs: [storedRow], extra: true }),
  " ".repeat(65537)]) assert.deepEqual(copy(load(storage(raw)).list()), []);
const invalidStored = [null, [], {}, { ...storedRow, at: "not-a-date" },
  { ...storedRow, at: "2026-02-30T00:00:00.000Z" },
  { ...storedRow, at: "2026-09-30T00:00:00Z" },
  { ...storedRow, mode: "practice" }, { ...storedRow, version: 2 },
  { ...storedRow, score: "2400" }, { ...storedRow, splits: [100] },
  { ...storedRow, time: 121 }, { ...storedRow, reason: {} },
  { ...storedRow, seals: 4 }, { ...storedRow, won: "true" },
  JSON.parse(JSON.stringify(storedRow).replace('"at":', '"__proto__":{"polluted":true},"at":'))];
assert.deepEqual(copy(load(storage(envelope([...invalidStored, storedRow]))).list()), [storedRow]);
const oversized = Array.from({ length: 30 }, (_, i) => ({ ...storedRow, score: 30 - i }));
assert.deepEqual(copy(load(storage(envelope([null, ...oversized]))).list()), oversized.slice(0, 20));
const recovering = storage("{broken");
assert.ok(load(recovering).record(sample()));
assert.equal(load(recovering).list().length, 1);

// Storage may be missing, blocked on reads/writes, or blocked at property access.
for (const blocked of [undefined, null, {},
  { getItem() { throw Error("blocked read"); }, setItem() { throw Error("blocked write"); } },
  { getItem() { return envelope([storedRow]); }, setItem() { throw Error("quota"); } }]) {
  const safe = load(blocked);
  const count = safe.list().length;
  assert.ok(safe.record(sample()));
  assert.equal(safe.list().length, count + 1);
  assert.equal(safe.record({ ...sample(), mode: "test" }), null);
  assert.equal(safe.list().length, count + 1);
}
const context = {};
Object.defineProperty(context, "localStorage", { get() { throw Error("security"); } });
vm.runInNewContext(source, context);
assert.ok(context.VoyageLog.record(sample()));
assert.equal(context.VoyageLog.list().length, 1);
assert.deepEqual(copy(load(storage()).list()), [], "sessions without shared storage remain isolated");
assert.equal({}.polluted, undefined);
console.log("VoyageLog checks passed: normal-only validation, ISO dates, versioned persistence, malformed/corrupt/blocked storage, cloned reads/inputs, isolation, newest-first 20-row cap, reload, prototype safety.");
