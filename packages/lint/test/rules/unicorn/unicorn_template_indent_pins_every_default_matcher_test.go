package linthost

import (
  "strings"
  "testing"
)

// TestUnicornTemplateIndentPinsEveryDefaultMatcher verifies that the actual rule requires ten default matcher findings at their authored markers.
//
// Official upstream defaults independently list six tags, two functions and two comment markers; the Go matcher does not generate the expected names.
//
// 1. Execute the retained template source or configuration variants.
// 2. Compare the authored diagnostic, edit or preserved source for each boundary.
//
// @evidence contracts/testing.md#behavioral-verification The actual rule requires ten default matcher findings at their authored markers.
// @evidence contracts/testing.md#independent-expectations Official upstream defaults independently list six tags, two functions and two comment markers; the Go matcher does not generate the expected names.
// @evidence contracts/testing.md#distinguishing-cases outdent/dedent/gql/sql/html/styled tags, dedent/stripIndent calls and HTML/indent comments retain their separate positions.
// @evidence contracts/testing.md#execution-ownership TestUnicornTemplateIndentPinsEveryDefaultMatcher owns its explicit variants and named subcases as a discoverable Go unit entry; parser/engine/fix/command functions run in the shared process with isolated fixture state and no consumer install, native producer or product host.
func TestUnicornTemplateIndentPinsEveryDefaultMatcher(t *testing.T) {
  source := "const taggedOutdent = outdent`\ntag-outdent\n`;\n" +
    "const taggedDedent = dedent`\ntag-dedent\n`;\n" +
    "const taggedGraphQL = gql`\ntag-gql\n`;\n" +
    "const taggedSQL = sql`\ntag-sql\n`;\n" +
    "const taggedHTML = html`\ntag-html\n`;\n" +
    "const taggedStyled = styled`\ntag-styled\n`;\n" +
    "const calledDedent = dedent(`\nfunction-dedent\n`);\n" +
    "const calledStripIndent = stripIndent(`\nfunction-strip-indent\n`);\n" +
    "const commentedHTML = /* HTML */ `\ncomment-html\n`;\n" +
    "const commentedIndent = /* indent */ `\ncomment-indent\n`;\n"
  markers := []string{
    "`\ntag-outdent", "`\ntag-dedent", "`\ntag-gql", "`\ntag-sql", "`\ntag-html", "`\ntag-styled",
    "`\nfunction-dedent", "`\nfunction-strip-indent", "`\ncomment-html", "`\ncomment-indent",
  }

  _, _, findings := runRuleFindingsSnapshot(t, unicornTemplateIndentRuleName, source, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornTemplateIndentRuleName, findings)
  if len(findings) != len(markers) {
    t.Fatalf("every default matcher must remain active: want %d findings, got %d (%+v)", len(markers), len(findings), findings)
  }
  for index, marker := range markers {
    want := strings.Index(source, marker)
    if want < 0 || findings[index].Pos != want {
      t.Fatalf("default matcher %q start: want %d, got %+v", marker, want, findings[index])
    }
  }
}
