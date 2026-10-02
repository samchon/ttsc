import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphSourceReader } from "../../../../packages/graph/src/model/TtscGraphSourceReader";

const digest = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

/**
 * Verifies the source reader decodes UTF-8, UTF-16LE and UTF-16BE files the way
 * the checker does and refuses text that keeps the byte order mark.
 *
 * The checker strips a byte order mark and decodes UTF-16 by it, so the digest
 * of the text it parsed never contains U+FEFF. The reader must therefore return
 * the same lines for every encoding of one text, and must not accept a digest
 * of text that still starts with the mark.
 *
 * 1. Encode one text with non-ASCII characters as plain UTF-8, UTF-8 with a mark,
 *    UTF-16LE and UTF-16BE, each with a disk digest of its raw bytes and a
 *    checker digest of the text without a mark.
 * 2. Read each through the reader and require the same two lines and an empty
 *    trailing line.
 * 3. Offer a checker digest of the text with a leading U+FEFF for the marked
 *    encodings and require undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSourceReader.lines must return ["const café = '日本';", "export {};", ""] for the plain UTF-8, UTF-8 BOM, UTF-16LE BOM and UTF-16BE BOM encodings of the authored text, and undefined for the three marked encodings when the checker digest covers the text with a leading U+FEFF.
 * @evidence contracts/testing.md#independent-expectations The byte sequences are assembled in the test from literal BOM bytes and Node's own encoders and the expected lines are the authored text; the checker digest of the stripped text follows from the checker's documented BOM handling, and both digests are computed with node:crypto rather than the reader's helper.
 * @evidence contracts/testing.md#distinguishing-cases Four encodings of one text give identical lines, contrasted with the three marked encodings against a digest that keeps the mark; an odd trailing byte in a UTF-16 file and a BOM-less UTF-16 file are not exercised.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the reader over in-memory bytes in the unit process; no producer, session or filesystem is used.
 */
export function test_ttscgraph_source_reader_decodes_the_byte_order_marks_the_checker_strips(): void {
  const text = "const café = '日本';\nexport {};\n";
  const encodings: [string, Buffer][] = [
    ["utf8", Buffer.from(text, "utf8")],
    ["utf8 bom", Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")])],
    ["utf16le bom", Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")])],
    ["utf16be bom", Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(text, "utf16le").swap16()])],
  ];
  const failures: unknown[] = [];
  const readerOf = (bytes: Buffer, checkerText: string): TtscGraphSourceReader =>
    new TtscGraphSourceReader(
      "/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [{ file: "src/a.ts", checkerDigest: digest(checkerText), diskDigest: digest(bytes) }],
      },
      () => bytes,
    );
  for (const [label, bytes] of encodings) {
    try {
      assert.deepStrictEqual(readerOf(bytes, text).lines("src/a.ts"), ["const café = '日本';", "export {};", ""], label);
    } catch (error) {
      failures.push(error);
    }
    if (label === "utf8") continue;
    try {
      assert.strictEqual(readerOf(bytes, "﻿" + text).lines("src/a.ts"), undefined, `${label} kept mark`);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "byte order marks");
}
