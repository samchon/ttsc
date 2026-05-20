package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveNormalizesTypeScriptESLintRuleNames verifies that the engine accepts
// the `@typescript-eslint/` prefix in directive comments and maps it to the native
// bare rule name.
//
// ESLint users often write `// eslint-disable-next-line @typescript-eslint/no-explicit-any`
// while the native registry only knows `no-explicit-any`. The directive parser must strip
// the prefix before looking up the suppression set; without normalization the suppression
// silently has no effect, and the finding leaks through. This test pins the name-mapping
// branch in the directive scanner.
//
//  1. Enable `no-explicit-any` and parse two lines — one with a prefixed disable directive,
//     one without.
//  2. Run the engine.
//  3. Assert only the directive-covered line is suppressed; the other line still fires.
func TestEngineDirectiveNormalizesTypeScriptESLintRuleNames(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-explicit-any": SeverityError})
  file := parseTS(t, `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skipped: any = 1;
    const reported: any = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 unsuppressed finding, got %d: %v", got, findingRules(findings))
  }
}
