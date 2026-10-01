import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphSourceReader } from "../../../../packages/graph/src/model/TtscGraphSourceReader";
import { docOf } from "../../../../packages/graph/src/server/runDetails";

const digest = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

/**
 * Verifies graph source display splits checker-identical snapshots at every
 * ECMAScript line terminator.
 *
 * The native compiler reports lines for CR, LS, and PS, but the reader used to
 * split only LF and CRLF. A provenance-approved source then indexed a one-line
 * array with a later compiler line and silently lost its JSDoc. Compiler-owned
 * signature heads are checked with these same terminators in the batched MCP
 * source-snapshot integration test.
 *
 * 1. Build one digest-approved reader for each of the five terminators.
 * 2. Read the two documented declarations through the immutable source cache.
 * 3. Assert every spelling yields the same logical lines and trailing empty line.
 *
 * @evidence contracts/testing.md#behavioral-verification TtscGraphSourceReader.lines and docOf return identical logical source lines and both JSDoc values for each ECMAScript newline spelling.
 * @evidence contracts/testing.md#independent-expectations ECMAScript line terminators LF, CRLF, CR, LS and PS define the independent literal line arrays; node:crypto SHA-256 supplies input provenance rather than borrowing the reader digest implementation.
 * @evidence contracts/testing.md#distinguishing-cases All five spellings include two separately positioned documented declarations and a trailing empty line. The batched native source-snapshot boundary owns compiler-origin signature heads; snapshot identity rejection is owned by the graph snapshot-identity unit.
 * @evidence contracts/testing.md#execution-ownership test_ttscgraph_source_reader_matches_ecmascript_line_terminators is the exported source-unit entry; injected immutable bytes and direct graph model/server helper calls need no installed artifact, native producer or process protocol.
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
