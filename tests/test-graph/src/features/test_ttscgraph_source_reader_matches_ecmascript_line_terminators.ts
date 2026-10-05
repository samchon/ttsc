import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphSourceReader } from "../../../../packages/graph/src/model/TtscGraphSourceReader";
import { docOf } from "../../../../packages/graph/src/server/runDetails";

const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Verifies graph source display splits checker-identical snapshots at every
 * ECMAScript line terminator.
 *
 * The native compiler reports lines for CR, LS and PS as well as LF and CRLF. A
 * provenance-approved source split only at LF and CRLF would index a short line
 * array with a later compiler line and silently lose its JSDoc.
 *
 * 1. Build one digest-approved reader for each of the five terminators.
 * 2. Read the file through the reader and require the same five logical lines.
 * 3. Require docOf for the two documented declarations to return "first" and
 *    "second" for every spelling.
 *
 * @evidence contracts/testing.md#behavioral-verification For each of LF, CRLF, CR, U+2028 and U+2029, TtscGraphSourceReader.lines must return five lines (the two JSDoc comment lines, the two export lines and a trailing empty line) with no terminator characters left inside them, and docOf at lines 2 and 4 must return "first" and "second".
 * @evidence contracts/testing.md#independent-expectations The ECMAScript line terminators define the literal expected line array; the SHA-256 provenance digests are computed with node:crypto in the test rather than with the reader's own helper.
 * @evidence contracts/testing.md#distinguishing-cases Five terminator spellings produce the identical result, including the trailing empty line, and two documented declarations at different lines are resolved. Mixed terminators in one file and non-matching digests are not exercised here.
 * @evidence contracts/testing.md#execution-ownership Runs TtscGraphSourceReader and docOf in the test process with injected in-memory bytes in place of file reads and a stub graph holding only the reader; no file, installed artifact, native producer or process protocol is involved.
 */
export const test_ttscgraph_source_reader_matches_ecmascript_line_terminators =
  async (): Promise<void> => {
    const cases = [
      ["LF", "\n"],
      ["CRLF", "\r\n"],
      ["CR", "\r"],
      ["LS", "\u2028"],
      ["PS", "\u2029"],
    ] as const;

    for (const [name, terminator] of cases) {
      const source = [
        "/** first */",
        "export const alpha = 1;",
        "/** second */",
        "export const beta = 2;",
        "",
      ].join(terminator);
      const file = `src/${name}.ts`;
      const reader = new TtscGraphSourceReader(
        "C:/project",
        {
          capabilities: ["sourceDigests", "diskDigests"],
          sources: [
            {
              file,
              checkerDigest: digest(source),
              diskDigest: digest(Buffer.from(source, "utf8")),
            },
          ],
        },
        () => Buffer.from(source, "utf8"),
      );
      assert.deepEqual(reader.lines(file), [
        "/** first */",
        "export const alpha = 1;",
        "/** second */",
        "export const beta = 2;",
        "",
      ]);
      const graph = { source: reader };
      assert.equal(
        docOf(
          graph as never,
          {
            evidence: { file, startLine: 2, endLine: 2 },
          } as never,
        ),
        "first",
      );
      assert.equal(
        docOf(
          graph as never,
          {
            evidence: { file, startLine: 4, endLine: 4 },
          } as never,
        ),
        "second",
      );
    }
  };
