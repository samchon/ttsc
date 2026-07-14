package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeSkipsUpstreamValidCorpus
// verifies every valid case of the upstream test suite stays silent.
//
// Each case is the negative twin of an invalid one: the canonical `\${`
// spelling, templates with nothing to escape, real substitutions, tagged
// templates whose tag observes `strings.raw`, an escaped backslash before
// a canonical escape, and a plain string literal the rule never visits.
// An over-matching scan (e.g. one that miscounts backslash parity or
// matches decoded text) fires on at least one of them.
//
// 1. Transcribe the upstream valid corpus plus adjacent negative twins.
// 2. Run the engine with only this rule enabled.
// 3. Assert zero findings for every source.
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
