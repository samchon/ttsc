import assert from "node:assert/strict";

import { checkNodeRuntimeSupport } from "../../../../../packages/ttsc/src/launcher/internal/runtime/checkNodeRuntimeSupport";

/**
 * Verifies ttsx refuses Bun and Deno with an actionable message although both
 * report a supported Node version.
 *
 * Supplied Bun and Deno identity markers must select the Node-only checked
 * emit/plugin support policy despite a compatible-looking Node version. The
 * diagnostic names that policy and provides a Node invocation; neither the
 * records nor this guard probe either runtime's current hook APIs or execute
 * its loader. The Node-only control passes this guard without certifying the
 * separate loader capability boundary.
 *
 * 1. Assert a Bun and a Deno `process.versions` are each refused with a message
 *    naming the runtime, the supported policy, and the way to run under Node.
 * 2. Assert Node's own `process.versions` at the same version is admitted.
 *
 * @evidence contracts/testing.md#behavioral-verification checkNodeRuntimeSupport rejects supplied Bun and Deno identity markers despite a sufficient reported Node version and admits the supplied Node-only control; actual runtime APIs are not probed.
 * @evidence contracts/testing.md#independent-expectations Literal identity and Node-only checked-emit/plugin policy statements, the reported-version limitation, and the explicit Node invocation specify actionable rejection without asserting that Bun or Deno lacks a current API.
 * @evidence contracts/testing.md#distinguishing-cases Bun and Deno markers each reject the same sufficient version that the Node-only control admits, distinguishing runtime identity from version-floor checks.
 * @evidence contracts/testing.md#execution-ownership The actual source guard consumes explicit version records in-process without replacing process.versions or claiming hook installation was exercised.
 */
export const test_ttsx_refuses_runtimes_that_only_imitate_node = () => {
  for (const [key, version, identity, policy] of [
    [
      "bun",
      "1.4.2",
      "ttsx runs on Node.js, but this process is Bun 1.4.2.",
      "The ttsx checked-emit/plugin runtime supports Node.js rather than Bun;",
    ],
    [
      "deno",
      "2.9.6",
      "ttsx runs on Node.js, but this process is Deno 2.9.6.",
      "The ttsx checked-emit/plugin runtime supports Node.js rather than Deno;",
    ],
  ] as const) {
    const message = checkNodeRuntimeSupport("24.3.0", {
      node: "24.3.0",
      [key]: version,
    });
    assert.equal(typeof message, "string", `${key} must be refused`);
    assert.ok(message!.includes(identity));
    assert.ok(message!.includes(policy));
    assert.ok(
      message!.includes(
        "a reported compatibility version does not establish the supported hook boundary or checked-emit execution.",
      ),
    );
    assert.ok(message!.includes("Run it with Node.js instead"));
    assert.ok(message!.includes("example `npx ttsx`"));
  }
  assert.equal(checkNodeRuntimeSupport("24.3.0", { node: "24.3.0" }), null);
};
