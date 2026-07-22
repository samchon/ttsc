import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

/**
 * Failed CommonJS and JSON evaluations must evict only their provisional cache
 * entries. Retrying a failed child or parent must evaluate it again, while the
 * pre-evaluation insertion that makes successful cycles work stays intact and
 * successful modules remain cached by identity.
 */
export const test_create_sandbox_require_evicts_failed_modules = () => {
  const hits = new Map<string, number>();
  const sandboxConsole: Record<string, (...args: unknown[]) => void> = {
    hit(...args: unknown[]) {
      const key = String(args[0]);
      hits.set(key, (hits.get(key) ?? 0) + 1);
    },
  };
  const requireFailed = createSandboxRequire(
    {
      "catcher/package.json": JSON.stringify({ main: "./catcher.js" }),
      "catcher/catcher.js": [
        'console.hit("catcher");',
        'try { require("./broken"); } catch {}',
        'module.exports = require("./broken");',
      ].join("\n"),
      "catcher/broken.js": [
        'console.hit("broken");',
        "exports.partial = true;",
        'throw new Error("boom");',
      ].join("\n"),
      "json/package.json": JSON.stringify({ main: "./broken.json" }),
      "json/broken.json": "{ invalid",
    },
    { console: sandboxConsole },
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    assert.throws(
      () => requireFailed("catcher"),
      /evaluating catcher\/catcher\.js: evaluating catcher\/broken\.js: boom/,
    );
  }
  assert.equal(hits.get("catcher"), 2, "the failed parent must re-evaluate");
  assert.equal(
    hits.get("broken"),
    4,
    "each caught child failure and retry must re-evaluate",
  );
  assert.throws(() => requireFailed("json"), /evaluating json\/broken\.json:/);
  assert.throws(
    () => requireFailed("json"),
    /evaluating json\/broken\.json:/,
    "invalid JSON must not leave an empty exports object cached",
  );

  const requireSuccessful = createSandboxRequire(
    {
      "cycle/package.json": JSON.stringify({ main: "./a.js" }),
      "cycle/a.js": [
        'console.hit("cycle-a");',
        'exports.name = "a";',
        'exports.b = require("./b");',
      ].join("\n"),
      "cycle/b.js": [
        'console.hit("cycle-b");',
        'exports.name = "b";',
        'exports.a = require("./a");',
      ].join("\n"),
      "once/package.json": JSON.stringify({ main: "./index.js" }),
      "once/index.js": [
        'console.hit("once");',
        "module.exports = { stable: true };",
      ].join("\n"),
    },
    { console: sandboxConsole },
  );

  const cycle = requireSuccessful("cycle") as {
    b: { a: unknown; name: string };
    name: string;
  };
  assert.equal(cycle.name, "a");
  assert.equal(cycle.b.name, "b");
  assert.equal(
    cycle.b.a,
    cycle,
    "the cycle must observe the provisional object",
  );
  assert.equal(hits.get("cycle-a"), 1);
  assert.equal(hits.get("cycle-b"), 1);

  const first = requireSuccessful("once");
  const second = requireSuccessful("once");
  assert.equal(second, first, "successful exports stay cached by identity");
  assert.equal(hits.get("once"), 1, "a successful module evaluates once");
};
