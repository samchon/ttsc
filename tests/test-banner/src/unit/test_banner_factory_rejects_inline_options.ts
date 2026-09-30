import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type createBanner from "../../../../packages/banner/src/index";

/**
 * Verifies the banner factory rejects inline options before descriptor discovery.
 *
 * The TypeScript factory owns the first rejection of stale plugin-entry options,
 * before the Go driver can evaluate a banner config. A valid explicit configFile
 * and host registration keys must still produce the native descriptor even when
 * the selected config is absent; evaluating that file belongs to the driver.
 *
 * 1. Call the authored factory with separate text, config and options entries.
 * 2. Assert each throw identifies its literal key and the configFile remedy.
 * 3. Pass configFile with every allowed framework key and assert the descriptor
 *    registration and observations for that absent explicit config path.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls createBanner directly with text, config and options entries, checking unsupported-key throws and configFile guidance; the valid configFile/framework entry must return the expected native registration and explicit-path observations.
 * @evidence contracts/testing.md#independent-expectations Separate literal error patterns name the three forbidden keys. The public entry contract permits configFile and transform/enabled/name/stage; the empty fixture establishes null observations for its absent config, and the descriptor contract establishes the sibling driver registration.
 * @evidence contracts/testing.md#distinguishing-cases Owns string text, legacy string config and object options rejection against one accepted entry containing all framework keys and a relative configFile. Disabled is a host switch rather than an inline banner option; config evaluation, emitted banner text and CLI error forwarding remain boundary assertions.
 * @evidence contracts/testing.md#execution-ownership The matching src/unit test_banner_factory_rejects_inline_options function runs the authored factory in the source-unit Node process. It owns an empty temporary directory cleaned in finally; the factory only observes the absent explicit path, without loading a config, building native code, installing a consumer or starting a product host.
 */
export function test_banner_factory_rejects_inline_options(): void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-banner-factory-"));
  try {
    const filename = fileURLToPath(
      new URL("../../../../packages/banner/src/index.ts", import.meta.url),
    );
    const dirname = path.dirname(filename);
    const factory = (
      createRequire(import.meta.url)(filename) as {
        default: typeof createBanner;
      }
    ).default;
    const context = {
      binary: "",
      cwd: root,
      dirname,
      filename,
      projectRoot: root,
      tsconfig: path.join(root, "tsconfig.json"),
    };
    const invalid = [
      {
        plugin: { transform: "@ttsc/banner", text: "my banner" },
        key: /unsupported key "text"/,
      },
      {
        plugin: { transform: "@ttsc/banner", config: "./banner.config.cjs" },
        key: /unsupported key "config"/,
      },
      {
        plugin: { transform: "@ttsc/banner", options: { text: "x" } },
        key: /unsupported key "options"/,
      },
    ];
    for (const entry of invalid) {
      assert.throws(
        () => factory({ ...context, plugin: entry.plugin }),
        (error: unknown) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, entry.key);
          assert.match(error.message, /configFile/);
          return true;
        },
      );
    }

    const plugin = {
      transform: "@ttsc/banner",
      enabled: false,
      name: "banner registration",
      stage: "transform",
      configFile: "./banner.config.json",
    };
    const config = path.join(root, "banner.config.json");
    assert.deepEqual(factory({ ...context, plugin }), {
      capabilities: { emitProvenance: true },
      hostInputHashes: { [config]: null },
      hostInputRealpaths: { [config]: null },
      hostInputs: [config],
      name: "@ttsc/banner",
      source: path.resolve(dirname, "..", "driver"),
      stage: "transform",
    });
  } finally {
    fs.rmdirSync(root);
  }
}
