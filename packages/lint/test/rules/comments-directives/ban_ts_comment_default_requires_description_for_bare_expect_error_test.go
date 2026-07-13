package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentDefaultRequiresDescriptionForBareExpectError verifies
// typescript/ban-ts-comment reports a bare `@ts-expect-error` under defaults.
//
// The default `allow-with-description` policy demands at least three
// characters after trimming, so a bare directive, a whitespace-only tail,
// and a one-character tail must all report with the upstream
// requires-description message anchored to the whole comment range, and
// no autofix (the ignore-to-expect-error rewrite never applies here).
//
// 1. Lint bare, whitespace-only, and one-character-description directives.
// 2. Assert each produces exactly one finding with the exact message.
// 3. Assert the finding covers the comment's byte range and carries no fix.
func TestBanTsCommentDefaultRequiresDescriptionForBareExpectError(t *testing.T) {
  const message = "Include a description after the `@ts-expect-error` directive to explain why the @ts-expect-error is necessary. The description must be 3 characters or longer."
  for _, comment := range []string{
    "// @ts-expect-error",
    "// @ts-expect-error         ",
    "// @ts-expect-error    .",
  } {
    source := comment + "\nconst a: number = 1;\nJSON.stringify(a);\n"
    file := parseTS(t, source)
    findings := NewEngine(RuleConfig{"typescript/ban-ts-comment": SeverityError}).
      Run([]*shimast.SourceFile{file}, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want 1 finding, got %d (%+v)", comment, len(findings), findings)
    }
    finding := findings[0]
    if finding.Message != message {
      t.Fatalf("%q: message mismatch:\nwant %q\ngot  %q", comment, message, finding.Message)
    }
    if finding.Pos != 0 || finding.End != len(comment) {
      t.Fatalf("%q: want range [0,%d), got [%d,%d)", comment, len(comment), finding.Pos, finding.End)
    }
    if len(finding.Fix) != 0 {
      t.Fatalf("%q: description findings must not carry fixes, got %+v", comment, finding.Fix)
    }
  }
}
