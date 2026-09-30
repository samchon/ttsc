import assert from "node:assert/strict";

import { checkNodeRuntimeSupport } from "../../../../../packages/ttsc/src/launcher/internal/runtime/checkNodeRuntimeSupport";

/**
 * Verifies ttsx refuses Bun and Deno with an actionable message although both
 * report a supported Node version.
 *
 * Both runtimes publish a Node version in `process.versions.node` for
 * compatibility, so the version floor alone admitted them. Neither implements
 * `module.registerHooks`. Under Bun, `--preload ttsc/register` died on the
 * missing function, and `bun ttsx` ran its child with Bun too, which executed
 * the entry through Bun's own TypeScript support instead of the checked emit
 * and dropped the project's transform plugins without a word. The runtime is
 * named by its own `process.versions` key, which the exported guard takes so
 * the case runs under the Node that runs the suite.
 *
 * 1. Assert a Bun and a Deno `process.versions` are each refused with a message
 *    naming the runtime, `registerHooks`, and the way to run under Node.
 * 2. Assert Node's own `process.versions` at the same version is admitted.
 *
 * @evidence contracts/testing.md#behavioral-verification checkNodeRuntimeSupport rejects Bun and Deno identity markers despite a sufficient reported Node version and admits a genuine Node identity.
 * @evidence contracts/testing.md#independent-expectations Literal runtime names and versions plus required registerHooks and npx ttsx diagnostic text specify actionable rejection independently of the guard.
 * @evidence contracts/testing.md#distinguishing-cases Bun and Deno markers each reject the same sufficient version that the Node-only control admits, distinguishing runtime identity from version-floor checks.
 * @evidence contracts/testing.md#execution-ownership The actual source guard consumes explicit version records in-process without replacing process.versions or claiming hook installation was exercised.
 */
export const test_ttsx_refuses_runtimes_that_only_imitate_node = () => {
  for (const [key, name, version] of [
    ["bun", "Bun", "1.4.2"],
    ["deno", "Deno", "2.9.6"],
  ] as const) {
    const message = checkNodeRuntimeSupport("24.3.0", {
      node: "24.3.0",
      [key]: version,
    });
    assert.notEqual(message, null, `${name} must be refused`);
    assert.match(
      message!,
      new RegExp(`${name} ${version.replace(/\./g, "\\.")}`),
    );
    assert.match(message!, /registerHooks/);
    assert.match(message!, /npx ttsx/);
  }
  assert.equal(checkNodeRuntimeSupport("24.3.0", { node: "24.3.0" }), null);
};
