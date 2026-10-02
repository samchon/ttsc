import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { TtscGraphSourceReader } from "../../../../packages/graph/src/model/TtscGraphSourceReader";
import { docOf } from "../../../../packages/graph/src/server/runDetails";

const digest = (value: string | Buffer): string => createHash("sha256").update(value).digest("hex");

/**
 * Verifies docOf returns the first sentence of the JSDoc written directly above
 * a declaration and nothing else.
 *
 * The graph shows what a declaration says it is for, never its body, so only a
 * documentation comment adjacent to the declaration may supply text, only its
 * prose before the first tag counts, and only its first sentence is returned.
 * Ordinary block comments, line comments, an absent comment and a declaration on
 * the first line carry no documentation.
 *
 * 1. Read digest-approved sources through the real reader, one per case.
 * 2. Ask docOf for a declaration under a single-line comment, a multi-line
 *    comment with a tag, a comment separated by blank lines and an over-long
 *    sentence.
 * 3. Ask docOf for declarations under a tag-only comment, a plain block comment,
 *    a line comment, code and at the first line, and require undefined.
 *
 * @evidence contracts/testing.md#behavioral-verification docOf over a TtscGraphSourceReader must return "Parses the input." for a single-line JSDoc, "Loads the config from disk." for a multi-line JSDoc whose later sentence and @param tag are dropped, the same text across blank lines, a sentence without a period whole, "v1.2 is fine." where an inner period precedes a digit, and a 200-character cut ending in an ellipsis; and undefined for a tag-only JSDoc, a plain block comment, a line comment, preceding code and a declaration on line 1.
 * @evidence contracts/testing.md#independent-expectations The expected sentences are literals read off the authored comments by the documented rule (first sentence of the prose before any tag, a period ends a sentence only before whitespace or the end, 200 characters at most); the source digests are computed in the test with node:crypto.
 * @evidence contracts/testing.md#distinguishing-cases Each positive case varies one property of the comment (single or multi line, trailing tag, blank-line gap, inner period, length) against negatives that vary what sits above the declaration (plain comment, line comment, code, nothing); a comment above a different declaration than the one asked about and unreadable sources are owned by the reader tests.
 * @evidence contracts/testing.md#execution-ownership The src/features export calls the reader and docOf over in-memory bytes in the unit process; no producer, session or filesystem is used.
 */
export function test_ttscgraph_doc_of_returns_the_first_sentence_of_the_adjacent_jsdoc(): void {
  const failures: unknown[] = [];
  const docAt = (source: string, startLine: number): string | undefined => {
    const file = "src/doc.ts";
    const reader = new TtscGraphSourceReader(
      "/project",
      {
        capabilities: ["sourceDigests", "diskDigests"],
        sources: [{ file, checkerDigest: digest(source), diskDigest: digest(Buffer.from(source, "utf8")) }],
      },
      () => Buffer.from(source, "utf8"),
    );
    return docOf({ source: reader } as never, { evidence: { file, startLine, endLine: startLine } } as never);
  };
  const expect = (label: string, source: string, startLine: number, expected: string | undefined): void => {
    try {
      assert.strictEqual(docAt(source, startLine), expected, label);
    } catch (error) {
      failures.push(error);
    }
  };

  expect("single line", "/** Parses the input. Then more. */\nexport const a = 1;\n", 2, "Parses the input.");
  expect(
    "multi line with a tag",
    ["/**", " * Loads the config", " * from disk. Second sentence.", " * @param x ignored", " */", "export function load() {}", ""].join("\n"),
    6,
    "Loads the config from disk.",
  );
  expect("blank lines between", "/** Loads the cache. */\n\n\nexport const b = 2;\n", 4, "Loads the cache.");
  expect("no period", "/** Does things */\nexport const c = 3;\n", 2, "Does things");
  expect("period before a digit", "/** v1.2 is fine. Next. */\nexport const d = 4;\n", 2, "v1.2 is fine.");
  expect("over-long sentence", `/** ${"a".repeat(250)} */\nexport const e = 5;\n`, 2, `${"a".repeat(200)}…`);

  expect("tag only", "/**\n * @internal\n */\nexport const f = 6;\n", 4, undefined);
  expect("plain block comment", "/* Not documentation. */\nexport const g = 7;\n", 2, undefined);
  expect("line comment", "// Not documentation.\nexport const h = 8;\n", 2, undefined);
  expect("code above", "const before = 0;\nexport const i = 9;\n", 2, undefined);
  expect("first line", "export const j = 10;\n", 1, undefined);

  if (failures.length) throw new AggregateError(failures, "docOf matrix");
}
