import { assert, runLint } from "../../internal/config-file";

/**
 * Verifies that a config file whose `extends` chain forms a cycle is rejected.
 *
 * `extends` is resolved recursively, and for `.ts`/`.js` configs every hop
 * spawns a loader subprocess. A cycle `lint.config.json -> b.config.json ->
 * lint.config.json` must fail fast with a readable error instead of recursing
 * (and re-spawning loaders) without bound — see issue #107.
 *
 * 1. Materialize a fixture whose discovered `lint.config.json` extends
 *    `b.config.json`, which extends `lint.config.json` back.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and stderr says `extends cycle detected`.
 */
export const test_lint_config_file_extends_rejects_cyclic_chain = () => {
  const result = runLint({
    name: "config-file-extends-cycle",
    source: "export const ok = 1;\n",
    extraSources: {
      "lint.config.json": JSON.stringify({ extends: "./b.config.json" }),
      "b.config.json": JSON.stringify({ extends: "./lint.config.json" }),
    },
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /extends cycle detected/);
};
