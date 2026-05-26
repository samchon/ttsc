package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveAcceptsTypescriptNamespacePrefix verifies that the
// engine accepts the canonical `typescript/<id>` namespace inside
// `eslint-disable-next-line` directive comments.
//
// `@ttsc/lint` exposes every TypeScript-only rule under `typescript/*`
// (no `@typescript-eslint/*` legacy alias). The directive parser must
// match the canonical name; without that match the suppression silently
// has no effect.
//
//  1. Enable `typescript/no-explicit-any` and parse two lines — one with
//     a `typescript/`-prefixed disable directive, one without.
//  2. Run the engine.
//  3. Assert only the directive-covered line is suppressed; the other
//     line still fires.
func TestEngineDirectiveAcceptsTypescriptNamespacePrefix(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  file := parseTS(t, `
    // eslint-disable-next-line typescript/no-explicit-any
    const skipped: any = 1;
    const reported: any = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 unsuppressed finding, got %d: %v", got, findingRules(findings))
  }
}
