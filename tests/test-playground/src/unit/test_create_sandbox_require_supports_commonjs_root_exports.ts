import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/src/sandbox/createSandboxRequire";

/**
 * The Execute sandbox must interpret every valid CommonJS root
 * `package.json#exports` shape consistently. Node accepts three: a bare string
 * target, a `"."` subpath table, and a bare condition map. A package that
 * downloads fine and is loadable by Node's CJS resolver must not fail sandbox
 * execution merely because its root export uses one of the non-`"."` shapes.
 *
 * RA-12 (#670): the pre-fix resolver honored only `exports["."]`; a root string
 * or root condition map threw `require(...) is not available`.
 *
 * 1. Root string, `"."`-table, and bare condition map all load the same CJS entry
 *    and return its exports.
 * 2. Active `require` / `default` conditions are selected in manifest order.
 * 3. Negative twin: an ESM-only root condition map with no CJS-compatible target
 *    and no main/index fallback still fails, naming the requested package.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs createSandboxRequire with root string, dot table and conditional exports and asserts their actual CommonJS values. Reordered active conditions must select default, and an import-only root must reject its package identity.
 * @evidence contracts/testing.md#independent-expectations Literal entry/default/require/node module values distinguish target choices under the supported require/default condition set and manifest-order contract. Expected values do not come from the resolver's target-selection computation.
 * @evidence contracts/testing.md#distinguishing-cases Both dot-table forms and root strings succeed, a missing later default target cannot override first active require, reordered default wins, and a real ESM-only packed entry cannot become a CommonJS fallback.
 * @evidence contracts/testing.md#execution-ownership This exported source unit invokes the authored CommonJS resolver and actual in-memory module bodies, without installing packages or launching a compiler/native host. Each load helper creates its own pack/resolver, and the manifest-order fixture owns a distinct local resolver.
 */
export const test_create_sandbox_require_supports_commonjs_root_exports =
  () => {
    const load = (exportsField: unknown, extra: Record<string, string> = {}) =>
      createSandboxRequire(
        {
          "fixture/package.json": JSON.stringify({ exports: exportsField }),
          "fixture/entry.cjs": "module.exports = { value: 'ok' };",
          ...extra,
        },
        { console },
      )("fixture");

    // Root "." subpath table (already supported — must keep working).
    assert.deepEqual(load({ ".": { require: "./entry.cjs" } }), {
      value: "ok",
    });
    assert.deepEqual(load({ ".": "./entry.cjs" }), { value: "ok" });

    // Root string target.
    assert.deepEqual(load("./entry.cjs"), { value: "ok" });

    // Bare condition map (no "." key).
    assert.deepEqual(load({ require: "./entry.cjs", default: "./entry.cjs" }), {
      value: "ok",
    });

    // `require` is selected because it is the first active manifest condition.
    assert.deepEqual(
      load({ require: "./entry.cjs", default: "./missing.mjs" }),
      { value: "ok" },
    );

    // Reordering two active conditions deliberately changes the selected branch;
    // this proves the resolver reads package.json key order rather than a fixed
    // `require ?? default` priority expression.
    assert.deepEqual(
      createSandboxRequire(
        {
          "ordered/package.json": JSON.stringify({
            exports: {
              default: "./default.cjs",
              require: "./require.cjs",
              node: "./node.cjs",
            },
          }),
          "ordered/default.cjs": "module.exports = { value: 'default' };",
          "ordered/require.cjs": "module.exports = { value: 'require' };",
          "ordered/node.cjs": "module.exports = { value: 'node' };",
        },
        { console },
      )("ordered"),
      { value: "default" },
    );

    // Negative twin: ESM-only root with no CJS target and no main/index fails,
    // and the error identifies the requested package.
    assert.throws(
      () =>
        createSandboxRequire(
          {
            "fixture/package.json": JSON.stringify({
              exports: { import: "./index.mjs" },
            }),
            "fixture/index.mjs": "export const value = 'nope';",
          },
          { console },
        )("fixture"),
      /require\("fixture"\) is not available/,
    );
  };
