import assert from "node:assert/strict";

import { unpackNpmTarball } from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createPaxRecord, createTarball } from "../internal/tarball";

/**
 * Verifies every tar path source is confined below the canonical package root.
 *
 * Direct headers, PAX path overrides, and GNU long-name records must reject
 * parent, absolute, drive, and backslash spellings before any file map
 * returns.
 */
export const test_npm_tarball_rejects_paths_outside_the_package_root =
  async () => {
    for (const path of [
      "package/../../outside.js",
      "/package/outside.js",
      "C:/package/outside.js",
      "package\\outside.js",
      "other/index.js",
      "package/./index.js",
    ]) {
      await assert.rejects(
        unpackNpmTarball(createTarball([{ body: "bad", path }]), undefined),
        /tar entry|canonical package root/,
        `header path ${JSON.stringify(path)} must be rejected`,
      );
    }

    await assert.rejects(
      unpackNpmTarball(
        createTarball([
          {
            body: createPaxRecord("path", "package/../../pax.js"),
            path: "PaxHeader",
            type: "x",
          },
          { body: "bad", path: "package/safe.js" },
        ]),
        undefined,
      ),
      /canonical package root/,
    );
    await assert.rejects(
      unpackNpmTarball(
        createTarball([
          {
            body: new TextEncoder().encode("package/../../long.js\0"),
            path: "././@LongLink",
            type: "L",
          },
          { body: "bad", path: "package/safe.js" },
        ]),
        undefined,
      ),
      /canonical package root/,
    );
  };
