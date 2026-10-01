import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  createNpmFixtureTarball,
  installNpmFixture,
} from "../internal/npmFixture";

/**
 * Verifies the explicit compatibility order for older registry metadata.
 *
 * SHA-1 `shasum` is used only when SRI is absent. Metadata carrying neither
 * field remains installable for private and historical registries.
 *
 * 1. Install with a matching SHA-1 shasum, then reject a mismatch.
 * 2. Remove both authentication fields.
 * 3. Assert the explicit legacy compatibility path remains installable.
 * @evidence contracts/testing.md#behavioral-verification installPlaygroundDependencies accepts matching SHA1 metadata, rejects a wrong shasum and preserves the explicit unsigned legacy path; both successful installs must retain exact runtime/declaration bytes and registry version.
 * @evidence contracts/testing.md#independent-expectations Node crypto.createHash supplies an independent SHA1 reference over fixture bytes; literal module/declaration contents and version1.0.0 prevent successful package counts from hiding a fabricated empty installation.
 * @evidence contracts/testing.md#distinguishing-cases Matching digest, forty-zero mismatch and neither authentication field separate verified and compatibility paths; each accepted result retains its existing count assertion plus literal file oracle.
 * @evidence contracts/testing.md#execution-ownership This named entry owns three fixture installs through installNpmFixture and the authored installer, using local injected responses and in-process digest/extraction without registry network or native/consumer build.
 */
export const test_npm_registry_uses_shasum_and_allows_legacy_unsigned_metadata =
  async () => {
    const tarball = createNpmFixtureTarball();
    const shasum = crypto
      .createHash("sha1")
      .update(new Uint8Array(tarball))
      .digest("hex");
    const authenticated = await installNpmFixture({ dist: { shasum }, tarball });
    assert.equal(
      authenticated.packages.length,
      1,
    );
    await assert.rejects(
      installNpmFixture({
        dist: { shasum: "0".repeat(40) },
        tarball,
      }),
      /tarball shasum mismatch/,
    );
    const legacy = await installNpmFixture({ tarball });
    assert.equal(
      legacy.packages.length,
      1,
      "missing authentication metadata follows the documented legacy policy",
    );
    for (const [lane, installed] of [["authenticated", authenticated], ["legacy", legacy]] as const) {
      assert.equal(installed.packages[0]?.name, "fixture", lane);
      assert.equal(installed.packages[0]?.version, "1.0.0", lane);
      assert.equal(installed.runtimeFiles["fixture/index.js"], "module.exports = true;\n", lane);
      assert.equal(installed.compilerFiles["node_modules/fixture/index.d.ts"], "export declare const value: true;\n", lane);
      assert.equal(installed.editorLibs["file:///node_modules/fixture/index.d.ts"], "export declare const value: true;\n", lane);
    }
  };
