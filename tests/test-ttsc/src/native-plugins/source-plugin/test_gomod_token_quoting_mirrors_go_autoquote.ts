import {
  assert,
  autoQuoteGoModToken,
  formatGoWorkPath,
} from "../../internal/source-build";

/**
 * Verifies go.work/go.mod token quoting mirrors Go's modfile.AutoQuote.
 *
 * `writeGoWork` emits `use`/`replace` paths into a `go.work` whose grammar
 * (`golang.org/x/mod/modfile`) is whitespace-tokenized, so a path containing a
 * space — a home directory like `/Users/John Smith/...` — must be quoted or
 * `go` cannot parse it (#394). `formatGoWorkPath`/`autoQuoteGoModToken`
 * reproduce `modfile.AutoQuote` + `strconv.Quote`: a clean bare token
 * round-trips unchanged, and only a token that would otherwise mis-tokenize is
 * quoted with Go's exact escaping. This pins every branch of that logic.
 *
 * 1. Feed `autoQuoteGoModToken` a table spanning clean tokens, the space case,
 *    every forced-quote trigger, and every escape form.
 * 2. Feed `formatGoWorkPath` Windows/POSIX paths with and without spaces.
 * 3. Assert each output equals the value Go would emit for the same token.
 */
export const test_gomod_token_quoting_mirrors_go_autoquote = () => {
  const NBSP = " "; // U+00A0: a Zs (graphic) space that is not ASCII space.

  // [input, expected] where expected is exactly what modfile.AutoQuote emits.
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
    [`a${NBSP}b`, `a${NBSP}b`], // NBSP is Zs (graphic) → not forced.
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
    ["/Users/John Smith/x", '"/Users/John Smith/x"'],
    ["/home/user/x", "/home/user/x"],
    [".", "."],
  ];
  for (const [input, expected] of formatCases) {
    assert.equal(
      formatGoWorkPath(input),
      expected,
      `formatGoWorkPath(${JSON.stringify(input)})`,
    );
  }
};
