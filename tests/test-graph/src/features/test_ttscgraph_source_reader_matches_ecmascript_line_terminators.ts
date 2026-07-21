import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { assert } from "../internal/ttsgraph";

interface SourceReader {
  lines(file: string): readonly string[] | undefined;
}

interface SourceReaderConstructor {
  new (
    project: string,
    provenance: {
      capabilities: string[];
      sources: {
        file: string;
        checkerDigest: string;
        diskDigest: string;
      }[];
    },
    read: (file: string) => Buffer,
  ): SourceReader;
}

const digest = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

/**
 * Verifies graph source display splits checker-identical snapshots at every
 * ECMAScript line terminator.
 *
 * The native compiler reports lines for CR, LS, and PS, but the reader used to
 * split only LF and CRLF. A provenance-approved source then indexed a one-line
 * array with a later compiler line and silently lost its signature or JSDoc.
 *
 * 1. Build one digest-approved reader for each of the five terminators.
 * 2. Read a three-line snapshot through the immutable source cache.
 * 3. Assert every spelling yields the same logical lines and trailing empty line.
 */
export const test_ttscgraph_source_reader_matches_ecmascript_line_terminators =
  async (): Promise<void> => {
    const graphRoot = path.dirname(
      createRequire(import.meta.url).resolve("@ttsc/graph/package.json"),
    );
    const module = (await import(
      pathToFileURL(
        path.join(graphRoot, "lib", "model", "TtscGraphSourceReader.js"),
      ).href
    )) as { TtscGraphSourceReader: SourceReaderConstructor };
    const details = (await import(
      pathToFileURL(path.join(graphRoot, "lib", "server", "runDetails.js")).href
    )) as {
      docOf(graph: never, node: never): string | undefined;
      signatureOf(graph: never, node: never): string | undefined;
    };
    const Reader = module.TtscGraphSourceReader;
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
      const reader = new Reader(
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
        details.signatureOf(
          graph as never,
          {
            evidence: { file, startLine: 2, endLine: 2 },
          } as never,
        ),
        "export const alpha = 1;",
      );
      assert.equal(
        details.docOf(
          graph as never,
          {
            evidence: { file, startLine: 2, endLine: 2 },
          } as never,
        ),
        "first",
      );
      assert.equal(
        details.signatureOf(
          graph as never,
          {
            evidence: { file, startLine: 4, endLine: 4 },
          } as never,
        ),
        "export const beta = 2;",
      );
      assert.equal(
        details.docOf(
          graph as never,
          {
            evidence: { file, startLine: 4, endLine: 4 },
          } as never,
        ),
        "second",
      );
    }
  };
