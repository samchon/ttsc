import assert from "node:assert/strict";

import { unpackNpmTarball } from "../../../../packages/playground/src/npm/internal/npmRegistry";
import { createTarball } from "../internal/tarball";

/**
 * Verifies DefinitelyTyped's official archive-root convention remains valid.
 *
 * Current `@types/*` tarballs use roots such as `node/`, not npm's usual
 * `package/`, while still requiring the same single-root confinement.
 *
 * 1. Build an `@types/node`-shaped archive whose single top-level root is `node/`
 *    rather than npm's usual `package/`.
 * 2. Assert the root is stripped consistently and the package files unpack without
 *    weakening mixed-root rejection.
 * @evidence contracts/testing.md#behavioral-verification unpackNpmTarball accepts the single node/ archive root, strips it from index.d.ts and a GNU long-name path, and preserves the @types/node manifest name and exact declaration text.
 * @evidence contracts/testing.md#independent-expectations Authored node/ entries and literal declaration bytes independently determine stripped keys; the longPath is fixture input, not a key computed from extraction output.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary declaration and sixteen-level GNU long-name override share one safe nonstandard root; mixed/unsafe roots remain covered by the neighboring rejection case.
 * @evidence contracts/testing.md#execution-ownership This entry calls the actual extraction helper on a locally generated gzip/tar fixture in one source process; no npm download or installed package/compiler host is involved.
 */
export const test_npm_tarball_accepts_one_safe_nonstandard_root = async () => {
  const longPath = `node/${"nested/".repeat(16)}long.d.ts`;
  const unpacked = await unpackNpmTarball(
    createTarball([
      {
        body: JSON.stringify({ name: "@types/node", version: "26.1.1" }),
        path: "node/package.json",
      },
      {
        body: "export declare const value: true;\n",
        path: "node/index.d.ts",
      },
      {
        body: new TextEncoder().encode(`${longPath}\0`),
        path: "././@LongLink",
        type: "L",
      },
      {
        body: "export declare const long: true;\n",
        path: "node/ignored.d.ts",
      },
    ]),
    undefined,
  );

  assert.equal(unpacked.packageJson.name, "@types/node");
  assert.equal(
    unpacked.files["index.d.ts"],
    "export declare const value: true;\n",
  );
  assert.equal(
    unpacked.files[longPath.slice("node/".length)],
    "export declare const long: true;\n",
  );
};
