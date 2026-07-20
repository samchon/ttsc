import assert from "node:assert/strict";

import {
  mountPackageFiles,
  unpackNpmTarball,
} from "../../../../packages/playground/lib/src/npm/internal/npmRegistry.js";
import { createPaxRecord, createTarball } from "../internal/tarball";

/**
 * Verifies playground npm tarball: parses PAX records by byte boundaries.
 *
 * PAX record lengths count UTF-8 bytes, not JavaScript string code units. A
 * multibyte path must therefore survive into all three mounted views instead of
 * acquiring a newline or corrupting the cursor before the next record.
 *
 * 1. Unpack a header with a multibyte non-path record followed by a multibyte
 *    `path` record, alongside an ASCII control.
 * 2. Mount the extracted file and reject malformed PAX record lengths rather than
 *    silently treating an invalid header as a different path.
 */
export const test_npm_tarball_parses_pax_bytes = async () => {
  const unicodePath = "package/한글/日本語.ts";
  const archive = createTarball([
    {
      body: concat([
        createPaxRecord("comment", "앞선 multibyte record"),
        createPaxRecord("path", unicodePath),
      ]),
      path: "PaxHeader",
      type: "x",
    },
    { body: "export const value = 1;\n", path: "ignored.ts" },
    {
      body: createPaxRecord("path", "package/package.json"),
      path: "PaxHeader",
      type: "x",
    },
    { body: '{"name":"fixture"}', path: "ignored.json" },
    {
      body: createPaxRecord("path", "package/index.d.ts"),
      path: "PaxHeader",
      type: "x",
    },
    { body: "export declare const typed: true;\n", path: "ignored.ts" },
    {
      body: createPaxRecord("path", "package/index.js"),
      path: "PaxHeader",
      type: "x",
    },
    { body: "module.exports = true;\n", path: "ignored.js" },
    {
      body: createPaxRecord("path", "package/plain.ts"),
      path: "PaxHeader",
      type: "x",
    },
    { body: "export const plain = 1;\n", path: "ignored.ts" },
  ]);
  const unpacked = await unpackNpmTarball(archive, undefined);
  assert.deepEqual(unpacked.files, {
    "index.d.ts": "export declare const typed: true;\n",
    "index.js": "module.exports = true;\n",
    "package.json": '{"name":"fixture"}',
    "plain.ts": "export const plain = 1;\n",
    "한글/日本語.ts": "export const value = 1;\n",
  });

  const mounted = mountPackageFiles("fixture", unpacked.files);
  assert.equal(
    mounted.compilerFiles["node_modules/fixture/한글/日本語.ts"],
    "export const value = 1;\n",
  );
  assert.equal(
    mounted.editorLibs["file:///node_modules/fixture/index.d.ts"],
    "export declare const typed: true;\n",
  );
  assert.equal(
    mounted.runtimeFiles["fixture/index.js"],
    "module.exports = true;\n",
  );
  assert.equal(
    mounted.runtimeFiles["fixture/package.json"],
    '{"name":"fixture"}',
    "PAX-derived package metadata reaches the Execute runtime pack",
  );

  await assert.rejects(
    unpackNpmTarball(
      createTarball([
        {
          body: "999 path=package/missing.ts\n",
          path: "PaxHeader",
          type: "x",
        },
        { body: "export {};", path: "ignored.ts" },
      ]),
      undefined,
    ),
    /Invalid PAX header record/,
  );
};

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
