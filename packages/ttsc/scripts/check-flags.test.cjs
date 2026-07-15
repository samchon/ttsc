// Regression for the generated-flag drift gate's line-ending sensitivity
// (issue #683 / RA-09).
//
// `check-flags.cjs` used to compare the raw working-tree bytes of each
// generated target before and after regeneration. On a clean
// `core.autocrlf=true` checkout the committed LF files materialize as CRLF while
// the generator/gofmt emit LF, so every target was reported as drifted although
// git's normalized content was identical. The gate now folds line terminators
// before comparing (`normalizeEol`) and decides drift through `computeDrift`.
//
// These cases exercise the pure decision seam directly, so they are
// deterministic and need no Go toolchain. The `before` snapshots are built from
// the *real* committed targets so the oracle is the shipped output, not a
// synthetic stand-in.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { test } = require("node:test");

const {
  computeDrift,
  normalizeEol,
  snapshot,
  targets,
} = require("./check-flags.cjs");

// The committed LF content of every target, regardless of how this checkout
// materialized them on disk. This is the "after" a clean regeneration produces.
function lfSnapshot() {
  const out = {};
  for (const target of targets) {
    out[target] = normalizeEol(fs.readFileSync(target, "utf8"));
  }
  return out;
}

function withEol(text, eol) {
  return normalizeEol(text).replace(/\n/g, eol);
}

test("targets is the four committed generated artifacts", () => {
  // Guards the oracle: a renamed or dropped target would otherwise make the
  // regression silently vacuous.
  assert.equal(targets.length, 4);
  for (const target of targets) {
    assert.ok(fs.existsSync(target), `${target} should exist`);
  }
});

test("a CRLF checkout of unchanged output is not drift", () => {
  const after = lfSnapshot();
  // The committed content re-expressed with CRLF terminators — exactly what
  // core.autocrlf=true writes to the working tree on a clean checkout.
  const before = {};
  for (const target of targets) {
    before[target] = withEol(after[target], "\r\n");
  }
  // The raw bytes genuinely differ (this is why the old raw compare failed);
  // only after normalization are they equal.
  for (const target of targets) {
    assert.notEqual(
      before[target],
      after[target],
      `${target} CRLF/LF bytes should differ before normalization`,
    );
  }
  assert.deepEqual(computeDrift(before, after, targets), []);
});

test("a lone-CR checkout of unchanged output is not drift", () => {
  const after = lfSnapshot();
  const before = {};
  for (const target of targets) {
    before[target] = withEol(after[target], "\r");
  }
  assert.deepEqual(computeDrift(before, after, targets), []);
});

test("a real content change drifts under both LF and CRLF before-states", () => {
  const after = lfSnapshot();
  const [victim] = targets;
  for (const eol of ["\n", "\r\n"]) {
    const before = {};
    for (const target of targets) {
      before[target] = withEol(after[target], eol);
    }
    // Flip one non-terminator byte so the difference is content, not EOL.
    before[victim] = `${before[victim]}// hand-edited drift`;
    assert.deepEqual(
      computeDrift(before, after, targets),
      [victim],
      `content drift must be reported for a ${JSON.stringify(eol)} checkout`,
    );
  }
});

test("a missing committed target drifts against regenerated content", () => {
  const after = lfSnapshot();
  const [missing] = targets;
  const before = { ...after, [missing]: "" };
  assert.deepEqual(computeDrift(before, after, targets), [missing]);
});

test("normalizeEol folds only line terminators, never other whitespace", () => {
  // Tabs and internal spaces (gofmt's alignment columns) must survive, or the
  // gate would go blind to real formatting drift.
  assert.equal(normalizeEol("a\r\nb\rc\n"), "a\nb\nc\n");
  assert.equal(normalizeEol("a\tb  c"), "a\tb  c");
});

test("snapshot reads current targets and reports absent files as empty", () => {
  const snap = snapshot([...targets, `${targets[0]}.does-not-exist`]);
  assert.equal(snap[`${targets[0]}.does-not-exist`], "");
  assert.ok(snap[targets[0]].length > 0);
});
