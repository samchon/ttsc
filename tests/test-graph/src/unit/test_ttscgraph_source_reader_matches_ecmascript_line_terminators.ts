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
