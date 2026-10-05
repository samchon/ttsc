import assert from "node:assert/strict";

import { mapDiagnostic } from "../../../../packages/playground/src/compiler/mapDiagnostic";

type Native = Parameters<typeof mapDiagnostic>[0];

/**
 * Verifies a diagnostic without a usable byte start is located from its
 * one-based line and UTF-8 byte column, and that its span, severity and code
 * are normalized when the producer omits or malforms them.
 *
 * The native driver reports `start` for every located diagnostic, but the
 * mapper must still place one that carries only a display location, and must
 * never invent an invalid coordinate from a missing, negative or non-finite
 * field. The byte column is converted to UTF-16 units against the located line,
 * and a span cannot end inside a code point or past the source.
 *
 * 1. Locate by line and byte column across LF, CR, CRLF, U+2028 and U+2029
 *    separators and after an astral character.
 * 2. Send a line before the first, a line past the end, and fractional and
 *    non-finite line and column values, and a negative or NaN start.
 * 3. Send missing, zero, negative, fractional, overlong and code-point-splitting
 *    lengths, a warning, and an unknown category.
 *
 * @evidence contracts/testing.md#behavioral-verification Coordinate rows call mapDiagnostic without a valid start; span and severity rows supply a valid byte start. Every row deep-compares normalized line, column, length, severity, message and code, collecting mismatches together. The matrix adds line-and-byte-column fallback, malformed span normalization and warning/unknown-category branches beyond the byte-start matrix.
 * @evidence contracts/testing.md#independent-expectations The expected coordinates are hand-written from the declared contract: line and character are one-based, character counts UTF-8 bytes from the line start, the editor counts UTF-16 units, and a line terminator is LF, CR, CRLF, U+2028 or U+2029. For example the y after an astral character sits at byte column 5 and must map to column 3.
 * @evidence contracts/testing.md#distinguishing-cases Rows contrast five line-separator kinds, an astral prefix on the located line, an ASCII line, a line before the first and past the last, fractional and non-finite coordinates, a negative or NaN start that must fall back instead of being used, and each span class (missing, zero, negative, fractional, past the end, splitting a code point). A warning and an unknown category contrast with the error default.
 * @evidence contracts/testing.md#execution-ownership Unit-layer entry exported from src/features that calls only the pure mapDiagnostic function in the test process; no compiler, wasm host or consumer is involved. The byte-start matrix is owned by test_map_diagnostic_converts_native_bytes_to_editor_units.
 */
export function test_map_diagnostic_derives_a_missing_start_from_line_and_byte_column(): void {
  const base = {
    file: "/project/authored-source.ts",
    category: "error",
    code: 9002,
    messageText: "authored",
  } as const;
  const rows: {
    name: string;
    source: string;
    input: Record<string, unknown>;
    expected: {
      line: number;
      column: number;
      length: number;
      severity?: "error" | "warning";
    };
  }[] = [
    {
      name: "LF line and column",
      source: "ab\ncd",
      input: { line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "CR line",
      source: "ab\rcd",
      input: { line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "CRLF counts once",
      source: "ab\r\ncd",
      input: { line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "LS line",
      source: "ab cd",
      input: { line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "PS line",
      source: "ab cd",
      input: { line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "byte column after an astral character",
      source: "x\n\u{1F600}y",
      input: { line: 2, character: 5, length: 1 },
      expected: { line: 2, column: 3, length: 1 },
    },
    {
      name: "byte column after a two-byte character",
      source: "éx",
      input: { line: 1, character: 3, length: 1 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "line before the first",
      source: "ab\ncd",
      input: { line: 0, character: 2, length: 1 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "line past the end clamps to the end",
      source: "ab\ncd",
      input: { line: 9, character: 1, length: 1 },
      expected: { line: 2, column: 3, length: 1 },
    },
    {
      name: "column past the line clamps to the end",
      source: "ab",
      input: { line: 1, character: 50, length: 1 },
      expected: { line: 1, column: 3, length: 1 },
    },
    {
      name: "fractional line and column truncate",
      source: "ab\ncd",
      input: { line: 2.9, character: 2.9, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "non-finite line and column default to the start",
      source: "ab\ncd",
      input: {
        line: Number.NaN,
        character: Number.POSITIVE_INFINITY,
        length: 1,
      },
      expected: { line: 1, column: 1, length: 1 },
    },
    {
      name: "negative start falls back to line and column",
      source: "ab\ncd",
      input: { start: -1, line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "NaN start falls back to line and column",
      source: "ab\ncd",
      input: { start: Number.NaN, line: 2, character: 2, length: 1 },
      expected: { line: 2, column: 2, length: 1 },
    },
    {
      name: "missing length is one unit",
      source: "abc",
      input: { start: 1 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "zero length is one unit",
      source: "abc",
      input: { start: 1, length: 0 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "negative length is one unit",
      source: "abc",
      input: { start: 1, length: -5 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "non-finite length is one unit",
      source: "abc",
      input: { start: 1, length: Number.NaN },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "fractional length truncates",
      source: "abcd",
      input: { start: 0, length: 2.7 },
      expected: { line: 1, column: 1, length: 2 },
    },
    {
      name: "span past the end stops at the end",
      source: "ab",
      input: { start: 1, length: 100 },
      expected: { line: 1, column: 2, length: 1 },
    },
    {
      name: "span never ends inside a code point",
      source: "a\u{1F600}",
      input: { start: 0, length: 3 },
      expected: { line: 1, column: 1, length: 1 },
    },
    {
      name: "warning category",
      source: "abc",
      input: { start: 0, length: 1, category: "warning" },
      expected: { line: 1, column: 1, length: 1, severity: "warning" },
    },
    {
      name: "unknown category is an error",
      source: "abc",
      input: { start: 0, length: 1, category: "suggestion" },
      expected: { line: 1, column: 1, length: 1, severity: "error" },
    },
  ];

  const failures: unknown[] = [];
  for (const row of rows) {
    try {
      assert.deepEqual(
        mapDiagnostic(
          { ...base, ...row.input } as unknown as Native,
          row.source,
        ),
        {
          line: row.expected.line,
          column: row.expected.column,
          length: row.expected.length,
          severity: row.expected.severity ?? "error",
          message: "authored",
          code: "TS9002",
        },
        row.name,
      );
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Diagnostic line-and-column fallback matrix failed",
    );
}
