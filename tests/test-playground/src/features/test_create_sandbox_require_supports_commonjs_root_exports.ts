import assert from "node:assert/strict";

import { createSandboxRequire } from "../../../../packages/playground/lib/src/sandbox/createSandboxRequire.js";

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
