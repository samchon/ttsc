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
 *
 * @evidence contracts/testing.md#behavioral-verification Ttsx with an authored NODE_OPTIONS user hook requires node:sqlite and node:custom and must print custom-remap,non-builtin-exact-strip.
 * @evidence contracts/testing.md#independent-expectations The actual hook returns different literal CommonJS sources for a custom URL and exact custom specifier; their exported values independently distinguish unwanted builtin-prefix correction.
 * @evidence contracts/testing.md#distinguishing-cases A genuine builtin remapped away from its normal URL and a node-shaped non-builtin exact strip both must remain user-owned. The unchanged native builtin branch is complementary coverage outside this case.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_preserves_custom_node_builtin_remaps E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Node hook ordering, ttsx compatibility correction and CommonJS load must preserve real user resolve/load results. Direct correction predicates cannot prove actual hooks compose without overriding them.
 * @evidence contracts/e2e.md#shared-execution One immutable hook/project and one host carry both remap inputs together. No separate host or plugin producer is created per specifier.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity NODE_OPTIONS is supplied only in the child environment; the hooks belong to that native process and vanish on exit. TestProject tracks fixture files and no artifact invalidation is claimed.
 * @evidence contracts/e2e.md#preserved-coverage Original zero exit and exact two-remap string remain. The user hook is a supported extension boundary, not a monkeypatch of ttsx internals.
 */
export function test_ttsx_preserves_custom_node_builtin_remaps() {
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
}
