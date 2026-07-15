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
 * 1. Root string, `"."`-table, and bare condition map all load the same CJS
 *    entry and return its exports.
 * 2. `require` is preferred over `default` in a condition map (CJS precedence).
 * 3. Negative twin: an ESM-only root condition map with no CJS-compatible
 *    target and no main/index fallback still fails, naming the requested
 *    package.
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
    assert.deepEqual(load({ ".": { require: "./entry.cjs" } }), { value: "ok" });
    assert.deepEqual(load({ ".": "./entry.cjs" }), { value: "ok" });

    // Root string target.
    assert.deepEqual(load("./entry.cjs"), { value: "ok" });

    // Bare condition map (no "." key).
    assert.deepEqual(load({ require: "./entry.cjs", default: "./entry.cjs" }), {
      value: "ok",
    });

    // require is preferred over default: only the require target exists.
    assert.deepEqual(
      load({ require: "./entry.cjs", default: "./missing.mjs" }),
      { value: "ok" },
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
