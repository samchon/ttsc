package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestBanTsCommentPragmaRequiresTwoOrThreeSlashes verifies the
// typescript/ban-ts-comment pragma matcher's slash-count boundary.
//
// The compiler recognizes `@ts-check`/`@ts-nocheck` pragmas only in line
// comments with two or three leading slashes (upstream's "pragma comments
// may contain 2 or 3 leading slashes" cases). Four slashes are a no-op to
// the compiler and must stay a negative control even when the directive is
// configured to report; three slashes are effective and must report.
//
//  1. Assert `//// @ts-nocheck` (defaults) and `//// @ts-check` (configured
//     true) produce zero findings.
//  2. Assert `/// @ts-nocheck` (three slashes) still reports under defaults.
func TestBanTsCommentPragmaRequiresTwoOrThreeSlashes(t *testing.T) {
  const ruleName = "typescript/ban-ts-comment"
  assertRuleSkipsSource(
    t,
    ruleName,
    "//// @ts-nocheck - pragma comments may contain 2 or 3 leading slashes\nconst a = 1;\nJSON.stringify(a);\n",
  )
  assertRuleSkipsSourceWithOptions(
    t,
    ruleName,
    "//// @ts-check - pragma comments may contain 2 or 3 leading slashes\nconst a = 1;\nJSON.stringify(a);\n",
    `{"ts-check": true}`,
  )

  source := "/// @ts-nocheck\nconst a = 1;\nJSON.stringify(a);\n"
  file := parseTS(t, source)
  findings := NewEngine(RuleConfig{ruleName: SeverityError}).Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 1 {
    t.Fatalf("three-slash pragma: want 1 finding, got %d (%+v)", len(findings), findings)
  }
  if findings[0].Pos != 0 || findings[0].End != len("/// @ts-nocheck") {
    t.Fatalf("want range [0,%d), got [%d,%d)", len("/// @ts-nocheck"), findings[0].Pos, findings[0].End)
  }
}
