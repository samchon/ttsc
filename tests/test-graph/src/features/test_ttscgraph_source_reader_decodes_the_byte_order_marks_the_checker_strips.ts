import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphSourceReader } from "../../../../packages/graph/src/model/TtscGraphSourceReader";
import { docOf } from "../../../../packages/graph/src/server/runDetails";

const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Verifies the source reader decodes UTF-8, UTF-16LE and UTF-16BE files the way
 * the checker does and refuses text that keeps the byte order mark.
 *
 * The checker strips the initial byte order mark and decodes UTF-16 by it.
 * U+FEFF already in the body remains content. The reader must return that
 * decoded text, replace invalid surrogate sequences, and reject a digest that
 * incorrectly retains the removed initial mark.
 *
 * 1. Encode non-ASCII text in UTF-8 and marked UTF-16LE/BE, including odd tails,
 *    and require the same lines from independent byte and checker digests.
 * 2. Refuse digests retaining the removed BOM and BOM-less UTF-16 assumptions.
 * 3. Decode empty, malformed and valid surrogate sequences in both byte orders;
 *    retain valid pairs, BMP characters and an inner BOM.
 * 4. Require replacement text to retain ECMAScript line coordinates and docOf to
 *    return the actual replacement character from an adjacent JSDoc.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSourceReader.lines must return ["const café = '日本';", "export {};", ""] for the plain UTF-8, UTF-8 BOM and both complete and odd-tail UTF-16LE/BE BOM encodings of the authored text, and undefined when the checker digest keeps the BOM. Both marked UTF-16 byte orders must return empty text, U+FFFD for unpaired high/low surrogates and U+1F600 for its valid pair. docOf at the declaration after an LS-terminated malformed JSDoc must return U+FFFD.
 * @evidence contracts/testing.md#independent-expectations The byte sequences are assembled in the test from literal BOM bytes and Node's own encoders and the expected lines are the authored text; the checker digest follows the pinned upstream VFS decodeBytes/decodeUtf16 contract: BOM stripping and len(s)/2 complete units decoded by Go unicode/utf16.Decode, which replaces unpaired surrogates with U+FFFD, and both digests are computed with node:crypto rather than the reader's helper.
 * @evidence contracts/testing.md#distinguishing-cases Four complete encodings and two odd-tail encodings give identical lines, contrasted with digests keeping the BOM and BOM-less UTF-16 bytes. Both UTF-16 byte orders ignore an incomplete final unit, replace an unpaired high or low surrogate with U+FFFD, preserve a valid astral pair and decode an empty BOM-only body. Adjacent high/low sequences, invalid-to-valid pair boundaries and BMP characters between invalid units distinguish scalar replacement from blanket surrogate removal. Inner BOM content and LS/PS line positions remain intact. Literal returned lines detect lone-surrogate text even when its UTF-8 digest equals the replacement character's digest.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the reader over in-memory bytes in the unit process; docOf consumes a graph-shaped input containing only that actual reader and authored declaration coordinates; no producer, session or filesystem is used.
 */
export function test_ttscgraph_source_reader_decodes_the_byte_order_marks_the_checker_strips(): void {
  const text = "const café = '日本';\nexport {};\n";
  const encodings: [string, Buffer][] = [
    ["utf8", Buffer.from(text, "utf8")],
    [
      "utf8 bom",
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(text, "utf8"),
      ]),
    ],
    [
      "utf16le bom",
      Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]),
    ],
    [
      "utf16be bom",
      Buffer.concat([
        Buffer.from([0xfe, 0xff]),
        Buffer.from(text, "utf16le").swap16(),
      ]),
    ],
    [
      "utf16le bom odd tail",
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(text, "utf16le"),
        Buffer.from([0x61]),
      ]),
    ],
    [
      "utf16be bom odd tail",
      Buffer.concat([
        Buffer.from([0xfe, 0xff]),
        Buffer.from(text, "utf16le").swap16(),
        Buffer.from([0x61]),
      ]),
    ],
  ];
  const failures: unknown[] = [];
  const readerOf = (
    bytes: Buffer,
    checkerText: string,
  ): TtscGraphSourceReader =>
    new TtscGraphSourceReader(
      "/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [
          {
            file: "src/a.ts",
            checkerDigest: digest(checkerText),
            diskDigest: digest(bytes),
          },
        ],
      },
      () => bytes,
    );
  for (const [label, bytes] of encodings) {
    try {
      assert.deepStrictEqual(
        readerOf(bytes, text).lines("src/a.ts"),
        ["const café = '日本';", "export {};", ""],
        label,
      );
    } catch (error) {
      failures.push(error);
    }
    if (label === "utf8") continue;
    try {
      assert.strictEqual(
        readerOf(bytes, "﻿" + text).lines("src/a.ts"),
        undefined,
        `${label} kept mark`,
      );
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    assert.strictEqual(
      readerOf(Buffer.from(text, "utf16le"), text).lines("src/a.ts"),
      undefined,
      "BOM-less UTF-16 cannot be assumed from its bytes",
    );
  } catch (error) {
    failures.push(error);
  }
  for (const [label, units, expected, expectedLines] of [
    ["empty", [], "", [""]],
    ["unpaired high", [0x00, 0xd8], "\uFFFD", ["\uFFFD"]],
    ["unpaired low", [0x00, 0xdc], "\uFFFD", ["\uFFFD"]],
    ["valid astral pair", [0x3d, 0xd8, 0x00, 0xde], "\u{1F600}", ["\u{1F600}"]],
    ["high-high", [0x00, 0xd8, 0x01, 0xd8], "\uFFFD\uFFFD", ["\uFFFD\uFFFD"]],
    ["low-low", [0x00, 0xdc, 0x01, 0xdc], "\uFFFD\uFFFD", ["\uFFFD\uFFFD"]],
    ["low-high", [0x00, 0xdc, 0x00, 0xd8], "\uFFFD\uFFFD", ["\uFFFD\uFFFD"]],
    [
      "high then valid pair",
      [0x00, 0xd8, 0x3d, 0xd8, 0x00, 0xde],
      "\uFFFD\u{1F600}",
      ["\uFFFD\u{1F600}"],
    ],
    [
      "surrogates around BMP",
      [0x00, 0xd8, 0x41, 0x00, 0x00, 0xdc],
      "\uFFFDA\uFFFD",
      ["\uFFFDA\uFFFD"],
    ],
    ["inner BOM", [0xff, 0xfe], "\uFEFF", ["\uFEFF"]],
    [
      "malformed with line separators",
      [0x00, 0xd8, 0x28, 0x20, 0x41, 0x00, 0x29, 0x20, 0x00, 0xdc],
      "\uFFFD\u2028A\u2029\uFFFD",
      ["\uFFFD", "A", "\uFFFD"],
    ],
  ] as const) {
    const body = Buffer.from(units);
    for (const [order, bytes] of [
      ["LE", Buffer.concat([Buffer.from([0xff, 0xfe]), body])],
      [
        "BE",
        Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(body).swap16()]),
      ],
    ] as const) {
      try {
        assert.deepEqual(
          readerOf(bytes, expected).lines("src/a.ts"),
          expectedLines,
          `${order} ${label}`,
        );
      } catch (error) {
        failures.push(error);
      }
    }
  }
  const malformedDoc = "/** \uD800 */\u2028export const value = 1;\u2029";
  const decodedDoc = "/** \uFFFD */\u2028export const value = 1;\u2029";
  const docBody = Buffer.from(malformedDoc, "utf16le");
  for (const [order, bytes] of [
    ["LE", Buffer.concat([Buffer.from([0xff, 0xfe]), docBody])],
    [
      "BE",
      Buffer.concat([Buffer.from([0xfe, 0xff]), Buffer.from(docBody).swap16()]),
    ],
  ] as const) {
    try {
      const reader = readerOf(bytes, decodedDoc);
      assert.equal(
        docOf({ source: reader } as never, {
          id: "src/a.ts#value:variable",
          name: "value",
          kind: "variable",
          file: "src/a.ts",
          external: false,
          evidence: { file: "src/a.ts", startLine: 2, endLine: 2 },
        }),
        "\uFFFD",
        `${order} JSDoc retains checker-decoded text`,
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length) throw new AggregateError(failures, "byte order marks");
}
