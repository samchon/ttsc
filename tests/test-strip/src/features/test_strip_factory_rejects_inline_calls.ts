import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type createStrip from "../../../../packages/strip/src/index";

/**
 * Verifies the strip factory rejects inline calls while accepting file
 * selection.
 *
 * The TypeScript descriptor must reject calls on the plugin entry before native
 * strip config loading. Accepting configFile and host registration keys
 * preserves the separate file-based configuration path without evaluating that
 * file in the descriptor factory.
 *
 * 1. Call the authored factory with the stale inline calls array.
 * 2. Assert the throw names calls as unsupported and points to configFile.
 * 3. Pass configFile and all framework keys, then assert actual registration and
 *    observations for the selected absent file in an empty fixture.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createStrip with inline calls and verifies its actual unsupported-key error names calls and configFile; the accepted file/framework entry returns the exact native descriptor and explicit-path observations.
 * @evidence contracts/testing.md#independent-expectations The separate strip.config file owns call patterns, so the literal calls key must be rejected. The public plugin entry allows configFile and host registration keys; the empty fixture independently establishes null file observations and the descriptor contract establishes the sibling driver registration.
 * @evidence contracts/testing.md#distinguishing-cases Owns a calls array rejection and a valid relative configFile entry containing transform/enabled/name/stage. Disabled remains a host switch, and an absent explicit config is observed rather than evaluated here; actual stripping, config evaluation and CLI error forwarding remain with their existing owners.
 * @evidence contracts/testing.md#execution-ownership The matching src/features test_strip_factory_rejects_inline_calls function directly executes the authored factory in the source-unit Node process. Its empty temporary directory is cleaned in finally; no installed consumer, native build, config evaluation or product host is used to reach validation.
 */
export function test_strip_factory_rejects_inline_calls(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-strip-factory-"));
  try {
    const filename = fileURLToPath(
      new URL("../../../../packages/strip/src/index.ts", import.meta.url),
    );
    const dirname = path.dirname(filename);
    const factory = (
      createRequire(import.meta.url)(filename) as {
        default: typeof createStrip;
      }
    ).default;
    const context = { dirname, tsconfig: path.join(root, "tsconfig.json") };
    assert.throws(
      () =>
        factory({
          ...context,
          plugin: { transform: "@ttsc/strip", calls: ["console.log"] },
        }),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /unsupported key "calls"/);
        assert.match(error.message, /configFile/);
        return true;
      },
    );

    const config = path.join(root, "strip.config.json");
    assert.deepEqual(
      factory({
        ...context,
        plugin: {
          transform: "@ttsc/strip",
          enabled: false,
          name: "strip registration",
          stage: "transform",
          configFile: "./strip.config.json",
        },
      }),
      {
        capabilities: { emitProvenance: true },
        hostInputHashes: { [config]: null },
        hostInputRealpaths: { [config]: null },
        hostInputs: [config],
        name: "@ttsc/strip",
        source: path.resolve(dirname, "..", "driver"),
        stage: "transform",
      },
    );
  } finally {
    fs.rmdirSync(root);
  }
}
