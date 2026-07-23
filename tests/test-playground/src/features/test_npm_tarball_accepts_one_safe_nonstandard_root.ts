import assert from "node:assert/strict";

import { unpackNpmTarball } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createTarball } from "../internal/tarball";

/**
 * Verifies DefinitelyTyped's official archive-root convention remains valid.
 *
 * 1. Build an `@types/node`-shaped archive whose single top-level root is `node/`
 *    rather than npm's usual `package/`.
 * 2. Assert the root is stripped consistently and the package files unpack without
 *    weakening mixed-root rejection.
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
