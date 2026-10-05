import assert from "node:assert/strict";

import { autoQuoteGoModToken } from "../../../../../packages/ttsc/src/plugin/internal/source/autoQuoteGoModToken";
import { formatGoWorkPath } from "../../../../../packages/ttsc/src/plugin/internal/source/formatGoWorkPath";

/**
 * Verifies Go-style token quoting for the authored go.work/go.mod corpus.
 *
 * `writeGoWork` emits `use`/`replace` paths into a `go.work` whose grammar
 * (`golang.org/x/mod/modfile`) is whitespace-tokenized, so a path containing a
 * space — a home directory like `/Users/John Smith/...` — must be quoted or
 * `go` cannot parse it (#394). `formatGoWorkPath`/`autoQuoteGoModToken` apply
 * modfile's ASCII delimiter/comment rules and Go escape spellings to the
 * literal inputs below. JavaScript runtime Unicode categories do not certify
 * identity with every Go toolchain's Unicode tables, and malformed UTF-16 is
 * not covered by a Go-decoding round-trip guarantee. This corpus uses valid
 * Unicode scalars and observes formatter output without running Go.
 *
 * 1. Feed `autoQuoteGoModToken` a table spanning clean tokens, the space case,
 *    authored quote triggers and escape forms.
 * 2. Feed the explicit Windows grammar paths with and without spaces.
 * 3. Contrast POSIX literal backslashes and check the native default grammar.
 * 4. Assert each output equals the literal authored from Go's modfile quoting
 *    rules (the Go toolchain is not run).
 *
 * @evidence contracts/testing.md#behavioral-verification Calls authored autoQuoteGoModToken and formatGoWorkPath; literal output assertions detect invalid workspace tokens and incorrect Go escape sequences.
 * @evidence contracts/testing.md#independent-expectations Each expected string is an authored literal following the documented delimiter/comment behavior of golang.org/x/mod/modfile AutoQuote and strconv.Quote escape forms for this corpus. Expectations are not computed by the TypeScript implementation, but Go is not executed here, so a mistaken reading is not detected. These inputs do not certify runtime Unicode-table equivalence, arbitrary malformed UTF-16 or actual Go decoding round trips.
 * @evidence contracts/testing.md#distinguishing-cases Covers unquoted clean tokens, empty input, spaces, quotes, comments, Unicode separators and control escapes; explicit Windows grammar owns all original drive/UNC/device expectations, Linux and macOS preserve literal backslashes, and the omitted argument retains the real host default.
 * @evidence contracts/testing.md#execution-ownership A unit test calling autoQuoteGoModToken and formatGoWorkPath directly with strings and declared platform grammars, plus one call with the host default; it does not replace process.platform and does not run Go.
 */
export function test_gomod_token_quoting_mirrors_go_autoquote() {
  const NBSP = String.fromCodePoint(0x00a0);
  const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000);

  // [input, expected] with independently authored Go-style corpus outputs;
  // this table does not certify arbitrary Unicode-version or input-domain parity.
  const autoQuoteCases: readonly [string, string][] = [
    // Clean bare tokens: returned unchanged (space-free paths must not churn).
    ["/home/user/plugin", "/home/user/plugin"],
    [
      "github.com/samchon/ttsc/packages/ttsc",
      "github.com/samchon/ttsc/packages/ttsc",
    ],
    [".", "."],
    ["café", "café"], // lone Unicode letter is graphic → not forced.
    ["a😀b", "a😀b"], // lone astral symbol is graphic → not forced.
    ["(", "("], // a lone bracket/comma is a legal bare token.
    [")", ")"],
    [",", ","],

    // MustQuote triggers.
    ["/Users/John Smith/x", '"/Users/John Smith/x"'], // ASCII space.
    ['a"b', '"a\\"b"'], // double quote.
    ["a'b", '"a\'b"'], // apostrophe.
    ["a`b", '"a`b"'], // backtick.
    ["a(b", '"a(b"'], // bracket embedded in a longer token.
    ["a,b", '"a,b"'], // comma embedded in a longer token.
    ["", '""'], // empty string is not a valid bare token.
    ["//", '"//"'], // a line comment opener must be quoted to be a token.
    ["/*", '"/*"'], // a block comment opener too.
    ["a//b", '"a//b"'], // an embedded line-comment opener too.
    ["a/*b", '"a/*b"'], // an embedded block-comment opener too.

    // strconv.Quote escape forms (control runes force quoting on their own).
    ["a\tb", '"a\\tb"'], // \t
    ["a\nb", '"a\\nb"'], // \n
    ["a\rb", '"a\\rb"'], // \r
    ["a\vb", '"a\\vb"'], // \v
    ["a\fb", '"a\\fb"'], // \f
    ["a\bb", '"a\\bb"'], // \b (backspace)
    ["a\x07b", '"a\\ab"'], // \a (bell)
    ["a\x01b", '"a\\x01b"'], // \xNN for other C0 controls
    ["a\x7fb", '"a\\x7fb"'], // \x7f for DEL
    [`a${NBSP}b`, '"a\\u00a0b"'], // non-ASCII Zs is not printable.
    [`a${IDEOGRAPHIC_SPACE}b`, '"a\\u3000b"'], // neither is U+3000.
    [`a ${NBSP}`, '"a \\u00a0"'], // \uNNNN: NBSP is not printable inside a quote.
    [String.fromCodePoint(0x10ffff), '"\\U0010ffff"'], // \UNNNNNNNN for astral non-printable.

    // Verbatim emission inside a forced quote (printable runes are not escaped).
    ["caf é", '"caf é"'], // Unicode letter kept literally.
    ["a 😀", '"a 😀"'], // astral symbol kept literally.
    ["a\\b c", '"a\\\\b c"'], // backslash escaped only when quoting is forced.
  ];
  for (const [input, expected] of autoQuoteCases) {
    assert.equal(
      autoQuoteGoModToken(input),
      expected,
      `autoQuoteGoModToken(${JSON.stringify(input)})`,
    );
  }

  // formatGoWorkPath normalizes Windows separators before quoting, exactly as
  // writeGoWork emits `use`/`replace` paths.
  const formatCases: readonly [string, string][] = [
    ["C:\\Users\\John Smith\\proj", '"C:/Users/John Smith/proj"'],
    ["C:\\Users\\jsmith\\proj", "C:/Users/jsmith/proj"],
    ["\\\\server\\share\\proj", '"//server/share/proj"'],
    ["\\\\?\\C:\\Users\\x\\proj", '"//?/C:/Users/x/proj"'],
    ["C:\\Users\\x\\\\y\\proj", '"C:/Users/x//y/proj"'],
    ["/Users/John Smith/x", '"/Users/John Smith/x"'],
    ["/home/user/x", "/home/user/x"],
    [".", "."],
  ];
  for (const [input, expected] of formatCases) {
    assert.equal(
      formatGoWorkPath(input, "win32"),
      expected,
      `formatGoWorkPath(${JSON.stringify(input)})`,
    );
  }
  for (const platform of ["linux", "darwin"] as const) {
    assert.equal(formatGoWorkPath("a\\b c", platform), '"a\\\\b c"');
    assert.equal(formatGoWorkPath("a\\b", platform), "a\\b");
    assert.equal(
      formatGoWorkPath("/Users/John Smith/x", platform),
      '"/Users/John Smith/x"',
    );
  }
  assert.equal(
    formatGoWorkPath("a\\b c"),
    process.platform === "win32" ? '"a/b c"' : '"a\\\\b c"',
  );
}
