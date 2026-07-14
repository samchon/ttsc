package linthost

import "testing"

// TestRuleCorpusUnicornStringContent verifies the shared corpus fixture for
// unicorn/string-content reports exactly its annotated lines.
//
// The rule has no default patterns, so this fixture is the one that pins the
// options-carrying corpus path end-to-end: the `@ttsc-corpus-options`
// directive supplies `{patterns}`, the directive prologue string, a plain
// literal, a template, and a tagged quasi report, and the `gql` template plus
// substitution identifiers stay silent. The source below is byte-identical to
// `tests/test-lint/src/cases/unicorn-string-content.ts`, which the TypeScript
// corpus runner drives through the real ttsc command path.
//
//  1. Parse the fixture's `// expect:` and `@ttsc-corpus-options` directives.
//  2. Run the engine with the resulting `[severity, options]` configuration.
//  3. Compare rule/severity/line triples against the annotations.
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
