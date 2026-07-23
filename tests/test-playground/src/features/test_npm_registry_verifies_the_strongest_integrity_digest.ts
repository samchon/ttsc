import assert from "node:assert/strict";
import crypto from "node:crypto";

import {
  createNpmFixtureTarball,
  installNpmFixture,
} from "../internal/npmFixture";

/**
 * Verifies npm SRI is checked before an archive is decompressed.
 *
 * The strongest supported algorithm controls the decision even when a weaker
 * digest matches. Changed bytes and malformed metadata must fail with package
 * context, while a correct SHA-512 digest installs normally.
 *
 * 1. Mix unsupported, weak mismatching, and strong matching digests.
 * 2. Reverse the strong/weak result, alter bytes, and malform metadata.
 * 3. Assert only an authenticated strongest digest reaches extraction.
 */
export const test_npm_registry_verifies_the_strongest_integrity_digest =
  async () => {
    const tarball = createNpmFixtureTarball();
    const sha512 = digest(tarball, "sha512");
    const sha256 = digest(tarball, "sha256");
    const installed = await installNpmFixture({
      dist: {
        integrity: `futurehash-${wrongDigest(20)} sha256-${wrongDigest(32)} sha512-${sha512}`,
      },
      tarball,
    });
    assert.equal(installed.packages[0]?.name, "fixture");

    await assert.rejects(
      installNpmFixture({
        dist: {
          integrity: `sha256-${sha256} sha512-${wrongDigest(64)}`,
        },
        tarball,
      }),
      /Failed to install fixture@1\.0\.0: tarball integrity mismatch \(sha512\)/,
    );

    const changed = tarball.slice(0);
    new Uint8Array(changed)[10] ^= 1;
    await assert.rejects(
      installNpmFixture({
        dist: { integrity: `sha512-${sha512}` },
        tarball: changed,
      }),
      /tarball integrity mismatch/,
    );
    await assert.rejects(
      installNpmFixture({
        dist: { integrity: "sha512-not base64" },
        tarball,
      }),
      /tarball integrity contains (?:malformed metadata|a malformed digest)/,
    );
  };

function digest(bytes: ArrayBuffer, algorithm: "sha256" | "sha512"): string {
  return crypto
    .createHash(algorithm)
    .update(new Uint8Array(bytes))
    .digest("base64");
}

function wrongDigest(bytes: number): string {
  return Buffer.alloc(bytes, 0xa5).toString("base64");
}
