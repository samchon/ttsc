import { parseJsonc } from "ttsc/tsconfig";

import { assert } from "../../internal/compiler";

/**
 * Verifies `parseJsonc` accepts and rejects the config text TypeScript-Go
 * accepts and rejects.
 *
 * The reader used to blank comments and trailing commas and hand the rest to
 * `JSON.parse`, a narrower grammar than the compiler's: a `//` comment ran past
 * a CR-only or U+2028 line end, a no-break space or a mid-file byte-order mark
 * was an error, hexadecimal, fractional-leading, and separated numbers and the
 * `\x` escape were refused, and an empty file failed although the compiler
 * reads it as an empty config. Every row below was checked against the pinned
 * compiler: an accepted row compiles without a diagnostic, a rejected row fails
 * with the diagnostic named beside it.
 *
 * 1. Parse text using each accepted lexical form.
 * 2. Parse text using each form the compiler reports.
 * 3. Assert the accepted values and a positioned failure for each rejection.
 */
export const test_parsejsonc_reads_the_config_grammar_typescript_go_reads =
  (): void => {
    const B = "\\";
    const accepted: [string, unknown][] = [
      ['{\r// cr comment\r"a": 1\r}', { a: 1 }],
      ['{ // ls comment "a": 1}', { a: 1 }],
      ['{ "a": 1}', { a: 1 }],
      ['{ "a":　 1}', { a: 1 }],
      [' ﻿{"a": 1}', { a: 1 }],
      ['{"a": 0x1F, "b": 0o7, "c": 0B11}', { a: 31, b: 7, c: 3 }],
      ['{"a": .5, "b": 5., "c": 1e2, "d": 1_000, "e": 0x1_0}', { a: 0.5, b: 5, c: 100, d: 1000, e: 16 }],
      ['{"a": - 1, "b": -0x2}', { a: -1, b: -2 }],
      [`{"a": "${B}x61${B}u0062${B}u{63}${B}0"}`, { a: "abc\0" }],
      [`{"a": "x${B}\ny", "b": "${B}q", "c": "${B}101"}`, { a: "xy", b: "q", c: "A" }],
      [`{"a": "${B}xZ1"}`, { a: `${B}xZ1` }],
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
      ['{"a": \'x\'}', "TS1327"],
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
      ['{/* open', "TS1010"],
      ['{"a": "x\ny"}', "unterminated string"],
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
