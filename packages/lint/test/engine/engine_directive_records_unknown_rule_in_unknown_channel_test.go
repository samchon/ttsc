package linthost

import (
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineDirectiveRecordsUnknownRuleInUnknownChannel verifies that a
// `// eslint-disable-next-line <unknown>` directive surfaces its
// unresolved rule name through `Engine.UnknownRules()` instead of
// silently no-opping.
//
// The legacy `@typescript-eslint/<id>` prefix is the migration cliff:
// before the clean break it would normalize to the bare name, after the
// break it falls through as "unknown" and the suppression has no effect.
// Without surfacing that name, the user cannot tell their suppression is
// dead. The diagnostic shares the same `UnknownRules()` channel the
// config layer uses, so existing CLI warning paths display it without
// extra wiring.
//
//  1. Enable `typescript/no-explicit-any`.
//  2. Parse a file with a legacy `@typescript-eslint/no-explicit-any`
//     disable directive plus an unknown `garbage/no-such-rule` one.
//  3. Run the engine.
//  4. Assert both unknown directive names appear in `UnknownRules()`.
func TestEngineDirectiveRecordsUnknownRuleInUnknownChannel(t *testing.T) {
  engine := NewEngine(RuleConfig{"typescript/no-explicit-any": SeverityError})
  file := parseTS(t, `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skipped: any = 1;
    // eslint-disable-next-line garbage/no-such-rule
    const other: any = 2;
  `)
  engine.Run([]*shimast.SourceFile{file}, nil)

  unknown := engine.UnknownRules()
  if len(unknown) != 2 {
    t.Fatalf("want 2 unknown directive names, got %d: %v", len(unknown), unknown)
  }
  // UnknownRules sorts the merged list alphabetically.
  if unknown[0] != "@typescript-eslint/no-explicit-any" {
    t.Errorf("want unknown[0] = @typescript-eslint/no-explicit-any, got %q", unknown[0])
  }
  if unknown[1] != "garbage/no-such-rule" {
    t.Errorf("want unknown[1] = garbage/no-such-rule, got %q", unknown[1])
  }
}
