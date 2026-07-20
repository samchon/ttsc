import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

/**
 * Verifies ttsx preserves custom remaps outside the exact stripped boundary.
 *
 * A user hook may intentionally map a builtin to another URL or use a
 * `node:`-shaped specifier outside Node's builtin set. The compatibility
 * correction owns only Node's exact prefix-stripping defect, so both custom
 * results must pass through.
 *
 * 1. Remap `node:sqlite` to a custom URL and `node:custom` to exact `custom`.
 * 2. Run a CommonJS entry that requires both remapped specifiers through ttsx.
 * 3. Assert both custom modules load instead of being rewritten by ttsx.
 */
export const test_ttsx_preserves_custom_node_builtin_remaps = () => {
  const root = TestProject.commonJsProject({
    "custom-hook.cjs": `
      const { registerHooks } = require("node:module");
      const url = "ttsx-custom:sqlite-boundary";
      registerHooks({
        resolve(specifier, context, nextResolve) {
          if (specifier === "node:sqlite") {
            return { format: "commonjs", shortCircuit: true, url };
          }
          if (specifier === "node:custom") {
            return { format: "commonjs", shortCircuit: true, url: "custom" };
          }
          return nextResolve(specifier, context);
        },
        load(candidate, context, nextLoad) {
          if (candidate === url) {
            return {
              format: "commonjs",
              shortCircuit: true,
              source: 'module.exports = { source: "custom-remap" };',
            };
          }
          if (candidate === "custom") {
            return {
              format: "commonjs",
              shortCircuit: true,
              source: 'module.exports = { source: "non-builtin-exact-strip" };',
            };
          }
          return nextLoad(candidate, context);
        },
      });
    `,
    "src/main.ts": `
      declare function require(specifier: "node:sqlite" | "node:custom"): {
        source: string;
      };
      console.log([
        require("node:sqlite").source,
        require("node:custom").source,
      ].join(","));
    `,
  });

  const result = TestProject.spawn(
    TestProject.TTSX_BIN,
    ["--cwd", root, "src/main.ts"],
    {
      cwd: root,
      env: {
        NODE_OPTIONS: `--require ${JSON.stringify(path.join(root, "custom-hook.cjs"))}`,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "custom-remap,non-builtin-exact-strip");
};
