(() => {
  "use strict";

  const KEY = "sapan-postasi-voyages-v1";
  const LIMIT = 20;
  const FIELDS = ["won", "seals", "score", "time", "hits", "cleanThrows", "splits", "reason"];
  // Normal shifts last 115 s, with a final fixed physics step. Two checkpoints
  // can restore one life each; generous score/throw caps allow repeated rings.
  const MAX_TIME = 120;

  function dataFields(value, fields) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) return null;
    const result = Object.create(null);
    for (const field of fields) {
      const descriptor = descriptors[field];
      if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
      result[field] = descriptor.value;
    }
    return result;
  }

  function integer(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max;
  }

  function seconds(value) {
    return Number.isFinite(value) && value >= 0 && value <= MAX_TIME;
  }

  function normalize(value, stored) {
    try {
      const row = dataFields(value, [...FIELDS, stored ? "at" : "mode"]);
      if (!row || (!stored && row.mode !== "normal")) return null;
      if (typeof row.won !== "boolean" || !integer(row.seals, 3) ||
          !integer(row.score, 1000000) || !seconds(row.time) ||
          !integer(row.hits, 5) || !integer(row.cleanThrows, 1000)) return null;
      if (row.reason !== null && (typeof row.reason !== "string" ||
          row.reason.length === 0 || row.reason.length > 64)) return null;
      if (!Array.isArray(row.splits) || row.splits.length > 3) return null;
      const splits = [];
      let previous = 0;
      for (let i = 0; i < row.splits.length; i += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(row.splits, String(i));
        if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
        const split = descriptor.value;
        if (!seconds(split) || split < previous || split > row.time) return null;
        splits.push(split);
        previous = split;
      }
      let at;
      if (stored) {
        if (typeof row.at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(row.at)) return null;
        const date = new Date(row.at);
        if (!Number.isFinite(date.getTime()) || date.toISOString() !== row.at) return null;
        at = row.at;
      } else {
        at = new Date().toISOString();
      }
      return { at, won: row.won, seals: row.seals, score: row.score,
        time: row.time, hits: row.hits, cleanThrows: row.cleanThrows,
        splits, reason: row.reason };
    } catch { return null; }
  }

  function read() {
    try {
      const raw = globalThis.localStorage.getItem(KEY);
      // A normal 20-row log is much smaller. Avoid parsing oversized junk.
      if (typeof raw !== "string" || raw.length > 65536) return [];
      const saved = dataFields(JSON.parse(raw), ["version", "runs"]);
      if (!saved || saved.version !== 1 || !Array.isArray(saved.runs)) return [];
      const rows = [];
      for (const value of saved.runs) {
        const row = normalize(value, true);
        if (row) rows.push(row);
        if (rows.length === LIMIT) break;
      }
      return rows;
    } catch { return []; }
  }

  function clone(row) {
    return { ...row, splits: row.splits.slice() };
  }

  const history = read();

  // Returns a detached accepted row, or null for invalid/non-normal input.
  // Persistence is optional: accepted records still survive in session memory.
  function record(run) {
    const row = normalize(run, false);
    if (!row) return null;
    history.unshift(row);
    history.length = Math.min(history.length, LIMIT);
    try {
      globalThis.localStorage.setItem(KEY, JSON.stringify({ version: 1, runs: history }));
    } catch { /* Blocked or full storage must not interrupt a finished run. */ }
    return clone(row);
  }

  globalThis.VoyageLog = Object.freeze({ record, list: () => history.map(clone) });
})();
