import assert from "node:assert/strict";

import {
  mountPackageFiles,
  unpackNpmTarball,
} from "../../../../packages/playground/src/npm/internal/npmRegistry";
import { createPaxRecord, createTarball } from "../internal/tarball";

/**
 * Verifies playground npm tarball: parses PAX records by byte boundaries.
 *
 * PAX record lengths count UTF-8 bytes, not JavaScript string code units. A
 * multibyte path must therefore survive into all three mounted views instead of
 * acquiring a newline or corrupting the cursor before the next record. The
 * multibyte path is a TypeScript source, so it is mounted into the compiler
 * view; declaration, runtime and manifest files cover the other two views.
 *
 * 1. Unpack a header with a multibyte non-path record followed by a multibyte
 *    `path` record, alongside an ASCII control.
 * 2. Mount the extracted file and reject malformed PAX record lengths rather than
 *    silently treating an invalid header as a different path.
 *
 * @evidence contracts/testing.md#behavioral-verification unpackNpmTarball parses UTF8-byte PAX records without corrupting multibyte paths, and mountPackageFiles preserves extracted text in compiler/editor/runtime namespaces; malformed length999 rejects.
 * @evidence contracts/testing.md#independent-expectations Authored unicode/ASCII archive paths and literal complete extracted map define the oracle independently of parsing; literal mounted keys/bytes establish each consumer namespace and package metadata retention.
 * @evidence contracts/testing.md#distinguishing-cases Multibyte comment before multibyte path, repeated PAX overrides, ASCII control, declaration/runtime/manifest mounts and an overflowing PAX record retain distinct assertions.
 * @evidence contracts/testing.md#execution-ownership This entry owns its byte-oriented createPaxRecord/createTarball fixtures and direct extraction/mount calls in process, without network, native artifact production or a browser host.
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
