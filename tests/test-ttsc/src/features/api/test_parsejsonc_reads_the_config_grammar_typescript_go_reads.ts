import { parseJsonc } from "../../../../../packages/ttsc/src/compiler/internal/project/parseJsonc";

import assert from "node:assert/strict";

/**
 * Verifies `parseJsonc` accepts and rejects the config text TypeScript-Go
 * accepts and rejects.
 *
 * The reader used to blank comments and trailing commas and hand the rest to
 * `JSON.parse`, a narrower grammar than the compiler's: a `//` comment ran past
 * a CR-only or U+2028 line end, a no-break space or a mid-file byte-order mark
 * was an error, hexadecimal, fractional-leading, and separated numbers and the
 * `\x` escape were refused, and an empty file failed although the compiler
 * reads it as an empty config. Authored lexical inputs distinguish those forms;
 * diagnostic labels beside rejection rows describe their compiler counterpart.
 * This direct parser unit asserts positioned failure, not compiler diagnostics.
 *
 * 1. Parse text using each accepted lexical form.
 * 2. Parse text using each form the compiler reports.
 * 3. Assert the accepted values and a positioned failure for each rejection.
 *
 * @evidence contracts/testing.md#behavioral-verification parseJsonc is called on accepted texts (CR-only and U+2028 comments, no-break and ideographic spaces, a mid-file BOM, hex/octal/binary/fractional/separated numbers, valid escapes, raw U+2028/U+2029 string data, trailing commas, duplicate keys, empty and comment-only text), compared by deepEqual with literal values; rejected texts including legacy octal, 8/9 and malformed hexadecimal/Unicode escapes must throw a SyntaxError ending in '(line N column M)', and a CRLF case must report line 4 column 8.
 * @evidence contracts/testing.md#independent-expectations Literal expected values follow the pinned TypeScript-Go scanner and JSON-value grammar; no product parse supplies an expected value. scanString permits raw U+2028/U+2029 data but reports invalid escape diagnostics, propagated through parser scanError and config parsing diagnostics. Diagnostic labels appear only in assertion messages: rejection assertions check a positioned SyntaxError and do not certify the corresponding compiler code.
 * @evidence contracts/testing.md#distinguishing-cases Accepted rows contrast with rejected rows by lexical form: line terminators in comments and raw Unicode separators inside strings, Unicode whitespace, number radices/separators/fractions, valid escapes, trailing commas, duplicate and __proto__ keys versus single-quoted strings, bare identifiers, signs, legacy octal numbers and escapes, 8/9 escapes, malformed x/u escapes, bad separators, missing commas, trailing text, an unterminated comment and an unterminated string; position counting is checked for one CRLF input.
 * @evidence contracts/testing.md#execution-ownership A unit test calling parseJsonc directly with strings; no files, compiler process or ttsc host.
 */
export function test_parsejsonc_reads_the_config_grammar_typescript_go_reads(): void {
    const B = "\\";
    const accepted: [string, unknown][] = [
      ['{\r// cr comment\r"a": 1\r}', { a: 1 }],
      ['{ // ls comment "a": 1}', { a: 1 }],
      ['{ "a": 1}', { a: 1 }],
      ['{ "a":　 1}', { a: 1 }],
      [' ﻿{"a": 1}', { a: 1 }],
      ['{"a": 0x1F, "b": 0o7, "c": 0B11}', { a: 31, b: 7, c: 3 }],
      [
        '{"a": .5, "b": 5., "c": 1e2, "d": 1_000, "e": 0x1_0}',
        { a: 0.5, b: 5, c: 100, d: 1000, e: 16 },
      ],
      ['{"a": - 1, "b": -0x2}', { a: -1, b: -2 }],
      [`{"a": "${B}x61${B}u0062${B}u{63}${B}0"}`, { a: "abc\0" }],
      [
        `{"a": "x${B}\ny", "b": "${B}q"}`,
        { a: "xy", b: "q" },
      ],
      ['{"a": "x\u2028y", "b": "x\u2029y"}', { a: "x\u2028y", b: "x\u2029y" }],
      ['{"a": [1, 2,], "b": {"c": null,},}', { a: [1, 2], b: { c: null } }],
      ['{"a": 1, "a": 2}', { a: 2 }],
      ["", {}],
      ["// only a comment\n", {}],
    ];
    for (const [text, expected] of accepted)
      assert.deepEqual(parseJsonc(text), expected, JSON.stringify(text));
    assert.deepEqual(
      Object.keys(parseJsonc('{"__proto__": {"x": 1}}') as object),
      ["__proto__"],
      "a __proto__ key stays an ordinary key",
    );

    const rejected: [string, string][] = [
      ["{'a': 1}", "TS1327"],
      ["{a: 1}", "TS1327"],
      ["{\"a\": 'x'}", "TS1327"],
      ['{"a": +1}', "TS1328"],
      ['{"a": Infinity}', "TS1328"],
      ['{"a": [1,,]}', "TS1328"],
      ['{"a": 010}', "TS1121"],
      ['{"a": 08}', "TS1489"],
      ['{"a": 1__0}', "TS6189"],
      ['{"a": 1_}', "TS6188"],
      ['{"a": 1.2.3}', "TS1005"],
      ['{"a": 1 "b": 2}', "TS1005"],
      ['{,"a": 1}', "TS1136"],
      ['{"a": 1} x', "TS1012"],
      ["{/* open", "TS1010"],
      ['{"a": "x\ny"}', "unterminated string"],
      [`{"a": "${B}101"}`, "legacy octal escape"],
      [`{"a": "${B}01"}`, "legacy octal escape"],
      [`{"a": "${B}8"}`, "invalid 8 escape"],
      [`{"a": "${B}9"}`, "invalid 9 escape"],
      [`{"a": "${B}xZ1"}`, "hexadecimal digit expected"],
      [`{"a": "${B}x1"}`, "hexadecimal digit expected"],
      [`{"a": "${B}u12Z4"}`, "hexadecimal digit expected"],
      [`{"a": "${B}u123"}`, "hexadecimal digit expected"],
      [`{"a": "${B}u{}"}`, "hexadecimal digit expected"],
      [`{"a": "${B}u{61"}`, "unterminated Unicode escape"],
      [`{"a": "${B}u{110000}"}`, "Unicode escape out of range"],
    ];
    for (const [text, diagnostic] of rejected)
      assert.throws(
        () => parseJsonc(text),
        (error: unknown) =>
          error instanceof SyntaxError &&
          /\(line \d+ column \d+\)$/.test(error.message),
        `${JSON.stringify(text)} (${diagnostic})`,
      );
    assert.throws(
      () => parseJsonc('{\r\n// crlf\r\n\r\n  "a": ]'),
      /line 4 column 8/,
      "a CRLF pair counts as one line end",
    );
  };
