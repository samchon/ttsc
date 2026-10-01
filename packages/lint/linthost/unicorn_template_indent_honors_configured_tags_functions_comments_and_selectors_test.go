package linthost

import (
  "encoding/json"
  "strings"
  "testing"
)

// TestUnicornTemplateIndentHonorsConfiguredTagsFunctionsCommentsAndSelectors verifies that the engine checks named configured matches and reports overlapping selectors only once.
//
// Supported replacement lists, dotted paths, case-insensitive trimmed block comments and deduplication independently establish the literal selected positions.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The engine checks named configured matches and reports overlapping selectors only once.
// @evidence contracts/testing.md#independent-expectations Supported replacement lists, dotted paths, case-insensitive trimmed block comments and deduplication independently establish the literal selected positions.
// @evidence contracts/testing.md#distinguishing-cases Configured and parenthesized paths report; replaced defaults/computed/call-result forms do not, and two overlapping selectors share one diagnostic.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentHonorsConfiguredTagsFunctionsCommentsAndSelectors owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentHonorsConfiguredTagsFunctionsCommentsAndSelectors(t *testing.T) {
  t.Run("name and comment lists replace defaults", func(t *testing.T) {
    source := "const tagged = utils.dedent`\none\n`;\n" +
      "const called = helpers.strip(`\ntwo\n`);\n" +
      "const commented = /* Please /* Indent */ `\nthree\n`;\n" +
      "const defaultTagIsReplaced = gql`\nfour\n`;\n" +
      "const computedTagIsNotAPath = utils[\"dedent\"]`\nfive\n`;\n" +
      "const callResultTagIsNotAPath = makeTag()`\nsix\n`;\n" +
      "const defaultFunctionIsReplaced = stripIndent(`\nseven\n`);\n" +
      "const defaultCommentIsReplaced = /* indent */ `\neight\n`;\n" +
      "const parenthesizedTag = (utils.dedent)`\nnine\n`;\n" +
      "const parenthesizedCall = (helpers.strip)((`\nten\n`));\n"
    options := json.RawMessage(`{
      "tags":["utils.dedent"],
      "functions":["helpers.strip"],
      "comments":["please /* indent"],
      "selectors":[]
    }`)
    _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, options)
    assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
    if len(findings) != 5 {
      t.Fatalf("want configured and parenthesized tag/function plus comment findings; got %d (%+v)", len(findings), findings)
    }
    for _, text := range []string{"`\none", "`\ntwo", "`\nthree", "`\nnine", "`\nten"} {
      start := strings.Index(source, text)
      found := false
      for _, finding := range findings {
        found = found || finding.Pos == start
      }
      if !found {
        t.Fatalf("missing configured match at %q", text)
      }
    }
  })

  t.Run("overlapping selectors report once", func(t *testing.T) {
    source := "const selected = `\none\n`;\n"
    options := json.RawMessage(`{
      "tags":[],
      "functions":[],
      "comments":[],
      "selectors":["TemplateLiteral","* > TemplateLiteral"]
    }`)
    _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, options)
    assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
    if len(findings) != 1 {
      t.Fatalf("overlapping selectors must report one finding, got %d (%+v)", len(findings), findings)
    }
  })
}
