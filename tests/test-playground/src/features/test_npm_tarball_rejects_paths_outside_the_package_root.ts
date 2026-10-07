import assert from "node:assert/strict";

import { unpackNpmTarball } from "../../../../packages/playground/src/npm/internal/npmRegistry";
import { createPaxRecord, createTarball } from "../internal/tarball";

/**
 * Verifies every tar path source is confined below one consistent package root.
 *
 * Direct headers, PAX path overrides, and GNU long-name records must reject
 * parent, absolute, drive, and backslash spellings before any file map
 * returns.
 *
 * 1. Exercise unsafe direct, PAX, and GNU long-name spellings.
 * 2. Mix two individually safe top-level roots in one archive.
 * 3. Assert every form rejects before an unpacked file map is returned.
 *
 * @evidence contracts/testing.md#behavioral-verification unpackNpmTarball rejects parent/absolute/drive/backslash/dot/drive-relative header paths, traversal from PAX/GNU overrides and two individually safe but inconsistent roots before returning a file map.
 * @evidence contracts/testing.md#independent-expectations Authored unsafe spellings and differing package/other roots specify confinement independently of parser output; each archive contains populated bad or safe bytes rather than relying on absent fixture files.
 * @evidence contracts/testing.md#distinguishing-cases Six named direct-header rows plus PAX, GNU long-name and mixed-root controls preserve separate rejection identities; safe nonstandard-root acceptance belongs to the neighboring unit.
 * @evidence contracts/testing.md#execution-ownership This named entry owns every archive row and invokes the actual gzip/tar parser in the source-unit process, with no registry transport or consumer/native host.
 */
export const test_npm_tarball_rejects_paths_outside_the_package_root =
  async () => {
    for (const path of [
      "package/../../outside.js",
      "/package/outside.js",
      "C:/package/outside.js",
      "package\\outside.js",
      "package/./index.js",
      "package/C:outside.js",
    ]) {
      await assert.rejects(
        unpackNpmTarball(createTarball([{ body: "bad", path }]), undefined),
        /tar entry|confined package root/,
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
      /confined package root/,
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
      /confined package root/,
    );

    await assert.rejects(
      unpackNpmTarball(
        createTarball([
          { body: "first", path: "package/index.js" },
          { body: "second", path: "other/index.js" },
        ]),
        undefined,
      ),
      /mixes package roots/,
    );
  };
