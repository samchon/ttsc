package linthost

import "testing"

// TestUnicornConsistentTemplateLiteralEscapeSkipsTaggedTemplates verifies
// no tagged template reports, whatever shape its tag takes.
//
// A tag function receives `strings.raw`, where `$\{` and `\${` are
// different values (String.raw`$\{a}` renders the backslash), so
// rewriting a tagged template changes runtime behavior. The guard must
// key on being the quasi of a TaggedTemplateExpression, not on the tag's
// syntax, so member tags, call-result tags, and substitution-carrying
// tagged templates all stay untouched.
//
//  1. Build tagged templates with identifier, member, and call-result
//     tags, with and without substitutions.
//  2. Run the engine with only this rule enabled.
//  3. Assert zero findings for every source.
//
// @evidence contracts/testing.md#behavioral-verification five tagged-template shapes yield zero diagnostics.
// @evidence contracts/testing.md#independent-expectations Authored zero-result fixtures follow upstream raw-string preservation: a tag observes escape spelling and rewriting its quasi changes runtime meaning.
// @evidence contracts/testing.md#distinguishing-cases Identifier/member/call-result tags, real substitutions and both-escaped forms are excluded; TestUnicornConsistentTemplateLiteralEscapeReportsUntaggedInsideTagged owns the nested ordinary-template positive.
// @evidence contracts/testing.md#execution-ownership Five named t.Run cases belong to this Go unit entry and each failure preserves its source identity. Virtual/temporary fixture execution does not install consumers, build native artifacts or launch a product host.
func TestUnicornConsistentTemplateLiteralEscapeSkipsTaggedTemplates(t *testing.T) {
  cases := []struct {
    name   string
    source string
  }{
    {name: "member tag", source: "const foo = String.raw`$\\{a}`;\n"},
    {name: "identifier tag", source: "const foo = html`$\\{a}`;\n"},
    {name: "member tag with substitutions", source: "const foo = utils.html`$\\{a}${b}$\\{c}`;\n"},
    {name: "call result tag", source: "const foo = makeTag()`$\\{a}`;\n"},
    {name: "both escaped under tag", source: "const foo = html`\\$\\{a}`;\n"},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleSkipsSource(t, unicornConsistentTemplateLiteralEscapeRuleName, test.source)
    })
  }
}
