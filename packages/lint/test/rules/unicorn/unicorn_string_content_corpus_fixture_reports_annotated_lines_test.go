package linthost

import "testing"

// TestRuleCorpusUnicornStringContent verifies the shared corpus fixture for
// unicorn/string-content reports exactly its annotated lines.
//
// The rule has no default patterns, so this fixture is the one that pins the
// options-carrying corpus path end-to-end: the `@ttsc-corpus-options`
// directive supplies `{patterns}`, the directive prologue string, a plain
// literal, a template, and a tagged quasi report, and the `gql` template plus
// substitution identifiers stay silent. This case owns these literal inputs
// directly in the Go engine rather than depending on a second corpus runner.
//
//  1. Parse the fixture's `// expect:` and `@ttsc-corpus-options` directives.
//  2. Run the engine with the resulting `[severity, options]` configuration.
//  3. Compare rule/severity/line triples against the annotations.
//
// @evidence contracts/testing.md#behavioral-verification assertRuleCorpusCase executes the configured engine and compares exact rule/severity/line triples for the directive, literal, template and unlisted tagged quasi.
// @evidence contracts/testing.md#independent-expectations Authored annotation positions and the documented configured string-content policy determine four findings independently of engine output.
// @evidence contracts/testing.md#distinguishing-cases gql quasis and identifier substitutions remain clean alongside the four matching string sites; the options directive exercises configured rather than default-silent behavior.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornStringContent is the owning discoverable Go unit entry; its explicit variants and named t.Run cases preserve failure identity while the lint engine parses and checks authored sources in one Go process. Fixture files use t.TempDir; no installed consumer, native build or product child host runs.
func TestRuleCorpusUnicornStringContent(t *testing.T) {
  assertRuleCorpusCase(t, "unicorn/string-content.ts", `// @ttsc-corpus-options: unicorn/string-content {"patterns":{"no":"yes","unicorn":{"suggest":"🦄"}}}
// expect: unicorn/string-content error
"no directive";

declare function gql(strings: TemplateStringsArray, ...values: unknown[]): string;
declare function tag(strings: TemplateStringsArray, ...values: unknown[]): string;

// expect: unicorn/string-content error
const literal = "no";

// expect: unicorn/string-content error
const emoji = `+"`"+`a unicorn`+"`"+`;

// expect: unicorn/string-content error
const quasi = tag`+"`"+`no${literal}`+"`"+`;

// Negative: foreign-language tags exempt their quasis, and identifiers inside
// substitutions are not string content.
const ignored = gql`+"`"+`{ field(input: 'no') }`+"`"+`;
const substitution = `+"`"+`${literal}${emoji}${quasi}${ignored}`+"`"+`;
`)
}
