package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeSkipsUpstreamValidCorpus
// verifies the fifteen authored canonical or nonapplicable inputs stay silent.
//
// The inputs distinguish canonical and nonapplicable forms: the canonical `\${`
// spelling, templates with nothing to escape, real substitutions, tagged
// templates whose tag can observe `strings.raw`, an escaped backslash before
// a canonical escape, and a plain string literal the rule never visits.
// These inputs can expose specific over-matching decisions, such as counting
// escaped backslashes incorrectly or treating plain strings as template payloads.
//
// 1. Declare the fifteen canonical/nonapplicable input strings before execution.
// 2. Run the engine with only this rule enabled.
// 3. Assert zero findings for every source.
//
// @evidence contracts/testing.md#behavioral-verification fifteen named canonical or nonapplicable sources yield zero diagnostics.
// @evidence contracts/testing.md#independent-expectations The independently authored canonical/nonapplicable strings declare zero findings without deriving expectations from the implementation or certifying an upstream corpus identity.
// @evidence contracts/testing.md#distinguishing-cases Canonical escape, no escape, lone dollar/brace, empty template, real substitutions, tags, escaped-backslash parity, plain string/comment and canonical type all remain clean; invalid rewrites have the named FixesUpstreamInvalidCorpus entry.
// @evidence contracts/testing.md#execution-ownership Fifteen named t.Run cases belong to this discoverable Go unit host and run owning engine operations in one process. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
func TestUnicornConsistentTemplateLiteralEscapeSkipsUpstreamValidCorpus(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {name: "canonical dollar escape", source: "const foo = `\\${a}`\n"},
    {name: "no escaping needed", source: "const foo = `hello`\n"},
    {name: "lone dollar", source: "const foo = `$`\n"},
    {name: "lone brace", source: "const foo = `{`\n"},
    {name: "empty template", source: "const foo = ``\n"},
    {name: "real substitution", source: "const foo = `${a}`\n"},
    {name: "only substitutions", source: "const foo = `${a}${b}`\n"},
    {name: "string raw tagged template", source: "const foo = String.raw`$\\{a}`\n"},
    {name: "identifier tagged template", source: "const foo = html`$\\{a}`\n"},
    {name: "escaped backslash before canonical escape", source: "const foo = `\\\\\\${a}`\n"},
    {name: "plain string literal", source: "const foo = '$\\{a}'\n"},
    {name: "escaped backslash between dollar and brace", source: "const foo = `$\\\\{a}`\n"},
    {name: "dollar before real substitution", source: "const foo = `$${a}`\n"},
    {name: "comment carrying the pattern", source: "// template `$\\{a}`\nconst foo = 1\n"},
    {name: "canonical template literal type", source: "type Foo = `\\${string}`\n"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, test.source)
    })
  }
}
