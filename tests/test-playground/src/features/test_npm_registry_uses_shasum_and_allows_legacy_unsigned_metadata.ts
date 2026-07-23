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
 */
export const test_npm_registry_uses_shasum_and_allows_legacy_unsigned_metadata =
  async () => {
    const tarball = createNpmFixtureTarball();
    const shasum = crypto
      .createHash("sha1")
      .update(new Uint8Array(tarball))
      .digest("hex");
    assert.equal(
      (await installNpmFixture({ dist: { shasum }, tarball })).packages.length,
      1,
    );
    await assert.rejects(
      installNpmFixture({
        dist: { shasum: "0".repeat(40) },
        tarball,
      }),
      /tarball shasum mismatch/,
    );
    assert.equal(
      (await installNpmFixture({ tarball })).packages.length,
      1,
      "missing authentication metadata follows the documented legacy policy",
    );
  };
